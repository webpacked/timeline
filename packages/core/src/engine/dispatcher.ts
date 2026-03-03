/**
 * DISPATCHER — Phase 0 compliant
 *
 * The ONLY entry point for mutating TimelineState.
 * Validates first, applies atomically, checks invariants.
 *
 * Algorithm:
 * 1. For each operation: run per-primitive validator → reject immediately on failure
 * 2. Apply all operations sequentially to get proposedState
 * 3. Run checkInvariants(proposedState) → reject on any violation
 * 4. Bump timeline.version by 1 and return accepted
 *
 * RULE: If one primitive fails, zero primitives are applied.
 */

import type { TimelineState } from '../types/state';
import type {
  Transaction,
  DispatchResult,
} from '../types/operations';
import { applyOperation } from './apply';
import { checkInvariants } from '../validation/invariants';
import { validateOperation } from '../validation/validators';

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

export function dispatch(
  state: TimelineState,
  transaction: Transaction,
): DispatchResult {
  // Step 1 + Step 2: Validate each operation against the rolling state, then apply it.
  // Validating against rolling state is necessary for compound transactions like
  //   [ DELETE_CLIP, INSERT_CLIP(left), INSERT_CLIP(right) ]
  // where INSERT_CLIP validation must see the post-DELETE state (original clip gone).
  // If any op fails validation, we return immediately — zero ops have been committed.
  let proposedState = state;
  for (const op of transaction.operations) {
    const rejection = validateOperation(proposedState, op);
    if (rejection) {
      return {
        accepted: false,
        reason: rejection.reason,
        message: rejection.message,
      };
    }
    proposedState = applyOperation(proposedState, op);
  }

  // Step 3: Run InvariantChecker on the full proposed state
  const violations = checkInvariants(proposedState);
  if (violations.length > 0) {
    return {
      accepted: false,
      reason: 'INVARIANT_VIOLATED',
      message: violations.map((v) => v.message).join('; '),
    };
  }

  // Step 4: Commit — bump version
  const nextState: TimelineState = {
    ...proposedState,
    timeline: {
      ...proposedState.timeline,
      version: state.timeline.version + 1,
    },
  };

  return { accepted: true, nextState };
}
