> **Load this file when:** Touching `engine/dispatcher.ts`, writing validators, adding rejection reasons.
> **Do NOT load this file when:** Writing UI, hooks, or tool implementations.

---

# DISPATCHER — Algorithm & Contract

## Critical Rule

The Dispatcher does **four things and only four things**. Do not add side effects.

---

## The dispatch() Algorithm (exact order — do not change)

```typescript
function dispatch(
  state: TimelineState,
  transaction: Transaction,
): DispatchResult;
```

**Steps 1+2 — Validate then apply, per op, against rolling state**

```typescript
let proposedState = state;
for (const op of transaction.operations) {
  const rejection = validateOperation(proposedState, op); // ← ROLLING state
  if (rejection) {
    return {
      accepted: false,
      reason: rejection.reason,
      message: rejection.message,
    };
    // ← entire transaction rejected, zero ops committed
  }
  proposedState = applyOperation(proposedState, op);
}
```

**Step 3 — Run InvariantChecker on full proposed state**

```typescript
const violations = checkInvariants(proposedState);
if (violations.length > 0) {
  return {
    accepted: false,
    reason: "INVARIANT_VIOLATED",
    message: violations.map((v) => v.message).join("; "),
  };
}
```

**Step 4 — Commit: bump version exactly once**

```typescript
const nextState: TimelineState = {
  ...proposedState,
  timeline: { ...proposedState.timeline, version: state.timeline.version + 1 },
};
return { accepted: true, nextState };
// version bumps +1 per Transaction, NOT per operation
```

---

## What the Dispatcher Does NOT Do

- ❌ No event emission
- ❌ No React state updates
- ❌ No history push (history is managed by the caller in `engine/history.ts`)
- ❌ No logging (call sites log if needed)
- ❌ No async operations (dispatch is synchronous)

---

## RejectionReason Enum

```typescript
type RejectionReason =
  | "OVERLAP" // clip placement creates timeline overlap on a track
  | "LOCKED_TRACK" // operation targets a track with locked: true
  | "ASSET_MISSING" // INSERT_CLIP references an assetId not in registry
  | "TYPE_MISMATCH" // clip's asset.mediaType ≠ target track.type
  | "OUT_OF_BOUNDS" // frame position is outside [0, timeline.duration]
  | "MEDIA_BOUNDS_INVALID" // mediaOut ≤ mediaIn, or bounds exceed intrinsicDuration
  | "ASSET_IN_USE" // UNREGISTER_ASSET: asset still referenced by at least one clip
  | "TRACK_NOT_EMPTY" // DELETE_TRACK: track still has clips
  | "SPEED_INVALID" // SET_CLIP_SPEED: speed ≤ 0
  | "INVARIANT_VIOLATED"; // checkInvariants() returned violations after apply
```

---

## Examples

### Correct rejection return

```typescript
return {
  accepted: false,
  reason: "OVERLAP",
  message: "Clip clip-b overlaps clip-a on track video-1",
};
```

### Correct acceptance return

```typescript
return {
  accepted: true,
  nextState: {
    ...proposedState,
    timeline: {
      ...proposedState.timeline,
      version: state.timeline.version + 1,
    },
  },
};
```

---

## Why rolling state validation matters

`DELETE_CLIP` followed by `INSERT_CLIP` in the same Transaction:

- **Without rolling:** `INSERT_CLIP` validates against state that still has the original clip → `OVERLAP` rejection
- **With rolling:** `INSERT_CLIP` validates against state after `DELETE_CLIP` → original clip is gone, no overlap

All compound Transaction patterns require rolling state validation:

| Pattern                          | Why rolling is required                             |
| -------------------------------- | --------------------------------------------------- |
| Slice (DELETE + 2× INSERT)       | INSERTs overlap the original clip in original state |
| Ripple Delete (DELETE + N× MOVE) | MOVEs might hit positions freed by the DELETE       |
| Roll Trim (2× RESIZE)            | Second RESIZE sees clip already resized by first    |
| Ripple Insert (N× MOVE + INSERT) | INSERT occupies space freed by the MOVEs            |

---

## MOVE_CLIP ordering — enforced by tool, not dispatcher

The dispatcher's rolling-state validation **requires** `MOVE_CLIP`s to be ordered
so each clip's destination is vacated before it moves. The dispatcher does **not** re-sort —
the tool is responsible for ordering.

| Direction                      | Required order                                 |
| ------------------------------ | ---------------------------------------------- |
| **+delta** (clips shift RIGHT) | **Right-to-left** (descending `timelineStart`) |
| **−delta** (clips shift LEFT)  | **Left-to-right** (ascending `timelineStart`)  |

A wrong-order Transaction will be **rejected with `OVERLAP`** even if the final
arrangement would be valid. This is a silent failure — no error message distinguishes
it from a genuine overlap.

**Tools that must apply this rule:** `RippleTrim`, `RippleDelete`, `RippleInsert`,
`RippleMove`, any tool emitting 2+ `MOVE_CLIP`s in the same direction.

---

- What each validator checks per operation (→ `core/OPERATIONS.md`)
- What invariants run in Step 3 (→ `core/INVARIANTS.md`)
- History management after acceptance (→ `core/HISTORY.md`)

---

## Common mistakes to avoid

- Bumping `version` inside `applyOperation` — version bumps ONCE in Step 4 of dispatch regardless of op count
- Running `checkInvariants` on the original `state` instead of `proposedState`
- Validators referencing the original `state` passed to `dispatch()` — they must use `proposedState` (rolling state)
