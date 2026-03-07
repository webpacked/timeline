> **Load this file when:** Touching `validation/invariants.ts`, writing tests that produce `TimelineState`, debugging unexpected rejections from `INVARIANT_VIOLATED`.
> **Do NOT load this file when:** Writing per-primitive validators (→ `core/DISPATCHER.md`).

---

# INVARIANTS — checkInvariants() Specification

## Critical Rule

`checkInvariants(state)` **must be called in every test** that produces a new `TimelineState`. Zero violations is the only acceptable result.

---

## Signature

```typescript
function checkInvariants(state: TimelineState): InvariantViolation[];
// Returns [] if state is valid.
// Returns one entry per violation — does NOT short-circuit after first failure.
```

---

## The 9 Invariant Rules (in this exact order)

| #   | ViolationType          | Rule                                                                                                 |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | `OVERLAP`              | No two clips on the same track may have overlapping `[timelineStart, timelineEnd)` ranges            |
| 2   | `ASSET_MISSING`        | Every `clip.assetId` must exist in `state.assetRegistry`                                             |
| 3   | `TRACK_TYPE_MISMATCH`  | `clip.assetId → asset.mediaType` must equal `track.type` for the track the clip is on                |
| 4   | `MEDIA_BOUNDS_INVALID` | `clip.mediaIn ≥ 0`                                                                                   |
| 5   | `MEDIA_BOUNDS_INVALID` | `clip.mediaOut ≤ asset.intrinsicDuration` for the referenced asset                                   |
| 6   | `DURATION_MISMATCH`    | `clip.mediaOut - clip.mediaIn` must equal `clip.timelineEnd - clip.timelineStart` (when speed = 1.0) |
| 7   | `CLIP_BEYOND_TIMELINE` | `clip.timelineEnd ≤ timeline.duration`                                                               |
| 8   | `TRACK_NOT_SORTED`     | `track.clips` must be sorted ascending by `timelineStart`                                            |
| 9   | `SPEED_INVALID`        | `clip.speed > 0`                                                                                     |

---

## InvariantViolation Shape

```typescript
type InvariantViolation = {
  readonly type: ViolationType;
  readonly entityId: string; // clipId for clip violations, trackId for track violations
  readonly message: string;
};
```

---

## Examples

### ✅ State that passes (empty array)

```typescript
const state = createTimelineState({ timeline, assetRegistry });
// clip [0..100] on video track, asset in registry, mediaOut ≤ intrinsicDuration
expect(checkInvariants(state)).toEqual([]);
```

### ❌ State that fails OVERLAP

```typescript
// clip-a: [0..100], clip-b: [50..150] on same track
const violations = checkInvariants(badState);
// Returns:
[
  {
    type: "OVERLAP",
    entityId: "clip-b",
    message: "Clip clip-b overlaps clip-a on track video-1",
  },
];
```

### ❌ State that fails ASSET_MISSING

```typescript
// clip references assetId 'ghost-asset' not in registry
[{ type: "ASSET_MISSING", entityId: "clip-id", message: "..." }];
```

---

## Rule on DURATION_MISMATCH (invariant #6)

This invariant is **waived** when `clip.speed ≠ 1.0`. The formula becomes:

```
(mediaOut - mediaIn) / speed ≈ (timelineEnd - timelineStart)
```

Only enforce strictly for speed = 1.0 in Phase 0.

---

## This file does NOT cover

- Per-primitive pre-dispatch validation (→ `core/DISPATCHER.md`)
- How violations trigger `INVARIANT_VIOLATED` rejection (→ `core/DISPATCHER.md`)
- Snap-point calculation (→ `core/SNAP_INDEX.md`)

---

## Common mistakes to avoid

- Short-circuiting invariant checking after the first failure — all 9 must run and all violations collected
- Enforcing DURATION_MISMATCH for clips with speed ≠ 1.0 — this is Phase 0 only, not a hard rule for retimed clips
- Testing invariants on the wrong state — always call `checkInvariants(proposedState)` not `checkInvariants(originalState)`
