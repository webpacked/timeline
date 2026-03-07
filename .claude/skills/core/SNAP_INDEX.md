> **Load this file when:** Touching `engine/snap-index.ts`, implementing snap behavior in any tool, changing snap priorities.
> **Do NOT load this file when:** Writing clip operations, history logic, or UI layout math.

---

# SNAP_INDEX — Types, Algorithm & Priority Table

## Critical Rule

`buildSnapIndex()` is called **after** an accepted dispatch via `queueMicrotask`. **Never** call it during a drag (pointer move). Snap queries use the index built from the last committed state.

---

## Types

```typescript
type SnapPointType =
  | "ClipStart"
  | "ClipEnd"
  | "InPoint"
  | "OutPoint"
  | "Playhead"
  | "Marker"
  | "BeatGrid";

type SnapPoint = {
  readonly frame: TimelineFrame;
  readonly type: SnapPointType;
  readonly priority: number; // see priority table below
  readonly trackId: TrackId | null; // null = timeline-wide points
  readonly entityId: string; // clipId, markerId, etc.
};

type SnapIndex = {
  readonly points: readonly SnapPoint[];
  readonly builtAt: number; // Date.now() of last build
};
```

---

## Priority Table (canonical — do not change values)

| Source                     | Priority |
| -------------------------- | -------- |
| `Marker` (timeline marker) | **100**  |
| `InPoint`                  | **90**   |
| `OutPoint`                 | **90**   |
| `ClipStart`                | **80**   |
| `ClipEnd`                  | **80**   |
| `Playhead`                 | **70**   |
| `BeatGrid`                 | **50**   |

Higher priority wins when two snap candidates are equidistant from the cursor.

---

## buildSnapIndex()

```typescript
function buildSnapIndex(
  state: TimelineState,
  playheadFrame: TimelineFrame,
): SnapIndex;
```

**Sources pulled in order:**

1. All `ClipStart` and `ClipEnd` points from every track in `state.timeline.tracks`
2. Playhead position (single `Playhead` point, trackId = null)
3. _(Phase 2+)_ Timeline-level markers → `Marker` points
4. _(Phase 3+)_ Beat grid positions → `BeatGrid` points

---

## nearest()

```typescript
function nearest(
  index: SnapIndex,
  frame: TimelineFrame,
  radiusFrames: number,
  exclude?: readonly string[], // entityIds to exclude from snap candidates
): SnapPoint | null;
```

**Algorithm:**

```typescript
1. Filter index.points: remove any point where entityId is in exclude[]
2. For each remaining point: distance = Math.abs(point.frame - frame)
3. Keep only points where distance ≤ radiusFrames
4. If none: return null
5. Find minimum distance across candidates
6. Among candidates AT minimum distance: pick highest priority
7. If priority tie: pick first in iteration order
8. Return winning SnapPoint
```

**Radius conversion** (pixels → frames at call site):

```typescript
const radiusFrames = SNAP_RADIUS_PX / pixelsPerFrame;
```

`SNAP_RADIUS_PX = 8` is the default. Never hardcode inside `nearest()`.

---

## Rebuild Rule

```typescript
// In TimelineEngine, after accepted dispatch:
const result = coreDispatch(this.history.present, tx);
if (result.accepted) {
  this.history = pushHistory(this.history, result.nextState);
  queueMicrotask(() => {
    this.snapIndex = buildSnapIndex(result.nextState, this.playheadFrame);
  });
  this.notify();
}
```

Never rebuild during `onPointerMove`. The SnapIndex is read-only during a drag gesture.

---

## This file does NOT cover

- How tools query the snap index (→ `tools/ITOOL_CONTRACT.md`)
- How ToolRouter passes `pixelsPerFrame` to tools (→ `adapter/TOOL_ROUTER.md`)
- Phase 2 marker snap points (→ future MARKERS.md)

---

## Common mistakes to avoid

- Rebuilding the snap index synchronously inside `dispatch()` — always use `queueMicrotask`
- Snapping to the clip being DRAGGED — always pass the dragging clip's id in `exclude[]`
- Using raw pixel values inside `nearest()` — convert pixels to frames at the tool layer before calling `nearest()`
