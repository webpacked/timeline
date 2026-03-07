> **Load this file when:** Adding or modifying any `OperationPrimitive`, touching `apply.ts`, writing compound Transaction patterns.
> **Do NOT load this file when:** Writing validation logic (→ `core/DISPATCHER.md`), React hooks (→ `adapter/HOOKS.md`).

---

# OPERATIONS — Primitives, Validation Rules & Apply Semantics

## Critical Rule First

**NEVER add a new mutation function.** Every new mutation = new member of `OperationPrimitive`. Update `apply.ts`, `validators.ts`, and this file. Zero exceptions.

Every `OperationPrimitive` must be **JSON-serializable**: no functions, no class instances, no Symbols.

---

## OperationPrimitive — Fields + Validator + Apply

### MOVE_CLIP

```typescript
{ type: 'MOVE_CLIP'; clipId: ClipId; newTimelineStart: TimelineFrame; targetTrackId?: TrackId }
```

**Validator checks:** clip exists · source track not locked · if `targetTrackId`: target track not locked, track type compatible with clip's asset  
**Apply:**

```typescript
delta = newTimelineStart - clip.timelineStart;
movedClip = {
  ...clip,
  timelineStart: newTimelineStart,
  timelineEnd: clip.timelineEnd + delta,
  trackId: targetTrackId ?? clip.trackId,
};
// If cross-track: remove from source.clips, insert into target.clips (sorted)
// If same-track: update clip in place
```

### RESIZE_CLIP

```typescript
{
  type: "RESIZE_CLIP";
  clipId: ClipId;
  edge: "start" | "end";
  newFrame: TimelineFrame;
}
```

**Validator checks:** clip exists · track not locked · newFrame is within media bounds  
**Apply — START edge (THE CRITICAL ONE):**

```typescript
delta = newFrame - clip.timelineStart;
// timelineStart advances, mediaIn advances by IDENTICAL delta
// timelineEnd and mediaOut stay FIXED
return { ...clip, timelineStart: newFrame, mediaIn: clip.mediaIn + delta };
```

**Apply — END edge:**

```typescript
delta = newFrame - clip.timelineEnd;
return { ...clip, timelineEnd: newFrame, mediaOut: clip.mediaOut + delta };
```

> ⚠ If you move `timelineStart` without moving `mediaIn` by the same delta, **Slip is broken.** The test `'trimming start by +30 frames advances timelineStart and mediaIn by identical delta'` catches this.

### SLICE_CLIP

```typescript
{
  type: "SLICE_CLIP";
  clipId: ClipId;
  atFrame: TimelineFrame;
}
```

**Validator checks:** clip exists · atFrame is within [timelineStart, timelineEnd]  
**Apply:** No-op in `apply.ts` — must be used inside a compound Transaction:

```typescript
// Correct compound pattern for SLICE:
[
  { type: "DELETE_CLIP", clipId },
  { type: "INSERT_CLIP", clip: leftHalf, trackId },
  { type: "INSERT_CLIP", clip: rightHalf, trackId },
];
```

### DELETE_CLIP

```typescript
{
  type: "DELETE_CLIP";
  clipId: ClipId;
}
```

**Validator:** clip exists · track not locked  
**Apply:** Remove clip from its track's clips array.

### INSERT_CLIP

```typescript
{
  type: "INSERT_CLIP";
  clip: Clip;
  trackId: TrackId;
}
```

**Validator:** track exists · `clip.assetId` in registry · `clip.speed > 0`  
**Apply:** Append clip to track.clips, then sort by timelineStart.

### SET_MEDIA_BOUNDS (Slip tool)

```typescript
{
  type: "SET_MEDIA_BOUNDS";
  clipId: ClipId;
  mediaIn: TimelineFrame;
  mediaOut: TimelineFrame;
}
```

**Validator:** `mediaOut > mediaIn` · `mediaOut - mediaIn ≤ asset.intrinsicDuration` · `mediaIn ≥ 0`  
**Apply:** `{ ...clip, mediaIn, mediaOut }` — timeline bounds untouched.

### SET_CLIP_ENABLED / SET_CLIP_REVERSED / SET_CLIP_SPEED / SET_CLIP_COLOR / SET_CLIP_NAME

Simple field setters. **Validator for SPEED:** `speed > 0`. Others: clip exists.

### ADD_TRACK / DELETE_TRACK / REORDER_TRACK / SET_TRACK_HEIGHT / SET_TRACK_NAME

**DELETE_TRACK validator:** track must be empty (no clips). Use a `[ DELETE_CLIP×N, DELETE_TRACK ]` Transaction if clips exist.

### REGISTER_ASSET

```typescript
{
  type: "REGISTER_ASSET";
  asset: Asset;
}
```

**Validator:** `asset.intrinsicDuration > 0` · `asset.nativeFps` is a valid `FrameRate` literal  
**Apply:** `new Map(registry).set(asset.id, asset)`

### UNREGISTER_ASSET

```typescript
{
  type: "UNREGISTER_ASSET";
  assetId: AssetId;
}
```

**Validator:** Asset **not referenced by any clip** in any track → `ASSET_IN_USE` rejection if used  
**Apply:** `new Map(registry).delete(assetId)`

### RENAME_TIMELINE / SET_TIMELINE_DURATION / SET_TIMELINE_START_TC / SET_SEQUENCE_SETTINGS

Simple timeline field updates. No cross-entity validation required.

---

## Compound Transaction Patterns

| Edit name           | Operations                                                 |
| ------------------- | ---------------------------------------------------------- |
| **Ripple Delete**   | `DELETE_CLIP` + `MOVE_CLIP×N` for all clips to the right   |
| **Slip**            | `SET_MEDIA_BOUNDS` (single op)                             |
| **Roll Trim**       | `RESIZE_CLIP(end, clip A)` + `RESIZE_CLIP(start, clip B)`  |
| **Ripple Trim**     | `RESIZE_CLIP` + `MOVE_CLIP×N` for downstream clips         |
| **Slice**           | `DELETE_CLIP` + `INSERT_CLIP(left)` + `INSERT_CLIP(right)` |
| **Lift**            | `DELETE_CLIP` (leaves gap)                                 |
| **Extract**         | `DELETE_CLIP` + `MOVE_CLIP×N` to close gap                 |
| **Overwrite Paste** | `DELETE_CLIP×N` (evicted clips) + `INSERT_CLIP`            |
| **Insert Paste**    | `MOVE_CLIP×N` (shift right) + `INSERT_CLIP`                |

---

### Lift (detailed)

Removes a clip but leaves a gap — upstream and downstream clips do not move.

```typescript
{ type: 'DELETE_CLIP', clipId }
{ type: 'INSERT_CLIP', clip: gapClip, trackId }  // same duration, fills the hole
```

`gapClip` is a special transparent/silent placeholder with the same `timelineStart`,
`timelineEnd` as the deleted clip. If the track has no gap-clip concept, Lift is just
`DELETE_CLIP` alone (gap is implicit silence/transparency).

### Extract (detailed)

Alias for **Ripple Delete** — removes the clip and closes the gap. Clips to the right shift left.

```typescript
{ type: 'DELETE_CLIP', clipId }
{ type: 'MOVE_CLIP', clipId: leftmost_right, newTimelineStart: ... }   // left-to-right sort
{ type: 'MOVE_CLIP', clipId: next_right, newTimelineStart: ... }
// ... one MOVE_CLIP per clip to the right
```

`MOVE_CLIP` sort: **left-to-right** (ascending `timelineStart`) because delta is negative.
See § MOVE_CLIP ordering rule below.

---

When a Transaction contains multiple `MOVE_CLIP`s shifting clips in the **same direction**, the order within the `operations` array is critical for rolling-state validation.

| Direction                      | Sort order                                     | Reason                                                                                                      |
| ------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **+delta** (clips shift RIGHT) | **Right-to-left** (descending `timelineStart`) | Rightmost clip moves into empty space first; each subsequent clip moves into space the previous one vacated |
| **−delta** (clips shift LEFT)  | **Left-to-right** (ascending `timelineStart`)  | Leftmost clip moves first; same principle                                                                   |

**Why it matters:** The dispatcher validates each op against the rolling state immediately before applying it. If clip B is moved right before clip C (which is to its right), B's new position overlaps C's current position — an `OVERLAP` rejection — even though the final arrangement is valid.

```typescript
// +delta: move rightmost first
const sorted = downstream.sort(
  (a, b) =>
    delta >= 0
      ? b.timelineStart - a.timelineStart // right-to-left
      : a.timelineStart - b.timelineStart, // left-to-right
);
```

**Applies to:** `RippleTrim`, `RippleDelete`, `RippleInsert`, `RippleMove` — any Transaction with 2+ `MOVE_CLIP`s in the same direction.

---

## This file does NOT cover

- How the Dispatcher orchestrates validation (→ `core/DISPATCHER.md`)
- Invariant rules that run after apply (→ `core/INVARIANTS.md`)
- How tools build Transactions (→ `tools/ITOOL_CONTRACT.md`)

---

## Common mistakes to avoid

- Forgetting to advance `mediaIn` when moving `timelineStart` in RESIZE_CLIP start edge
- Leaving SLICE_CLIP as a no-op in isolation — always wrap it in a 3-op Transaction
- Validator for UNREGISTER_ASSET must scan ALL tracks — missing one track silently corrupts state
