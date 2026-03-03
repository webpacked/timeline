/**
 * PROVISIONAL MANAGER — Phase 1
 *
 * Manages ghost state during pointer drags.
 *
 * RULES (from ITOOL_CONTRACT.md):
 *   - setProvisional / clearProvisional return NEW objects — never mutate
 *   - resolveClip checks provisional first, then committed state
 *   - The engine calls clearProvisional() BEFORE dispatching onPointerUp's tx
 *   - Provisional updates trigger notify() so ghosts render immediately
 *
 * resolveClip priority:
 *   1. provisional.clips has a clip with this id → return ghost version
 *   2. clip exists in committed state → return committed
 *   3. clip absent from both (deleted mid-drag) → return undefined
 */

import type { ClipId, Clip } from '../types/clip';
import type { TimelineState } from '../types/state';
import type { ProvisionalState } from './types';

// ---------------------------------------------------------------------------
// ProvisionalManager
// ---------------------------------------------------------------------------

export type ProvisionalManager = {
  readonly current: ProvisionalState | null;
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Create an empty provisional manager (current = null). */
export function createProvisionalManager(): ProvisionalManager {
  return { current: null };
}

/** Return a new manager with current set to state.
 *  Pure — never mutates the original manager. */
export function setProvisional(
  _manager: ProvisionalManager,
  state:    ProvisionalState,
): ProvisionalManager {
  return { current: state };
}

/** Return a new manager with current set to null.
 *  Pure — never mutates the original manager. */
export function clearProvisional(_manager: ProvisionalManager): ProvisionalManager {
  return { current: null };
}

/**
 * Resolve which version of a clip to render.
 *
 * Priority:
 *   1. If manager.current has a clip with this id → return provisional (ghost)
 *   2. Otherwise → search committed state
 *   3. If absent from both (clip deleted mid-drag) → return undefined
 *
 * Returns undefined if the clip has been deleted from committed state
 * and is not in provisional. Components must handle this:
 *   const clip = useClip(id)
 *   if (!clip) return null  ← required, not optional
 *
 * Call site in useClip selector:
 *   () => resolveClip(id, engine.getSnapshot(), engine.getProvisionalManager())
 */
export function resolveClip(
  clipId:  ClipId,
  state:   TimelineState,
  manager: ProvisionalManager,
): Clip | undefined {
  // Priority 1 — provisional ghost
  if (manager.current !== null) {
    const ghost = manager.current.clips.find(c => c.id === clipId);
    if (ghost) return ghost;
  }

  // Priority 2 — committed state
  for (const track of state.timeline.tracks) {
    const clip = track.clips.find(c => c.id === clipId);
    if (clip) return clip;
  }

  // Priority 3 — absent from both
  return undefined;
}
