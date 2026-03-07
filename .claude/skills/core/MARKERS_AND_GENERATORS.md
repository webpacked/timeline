---
name: markers-and-generators
description: >
  Load when working on markers, in/out points, beat grid, generators,
  captions, or SRT/VTT import. Do NOT load when working on tools,
  dispatcher, hooks, or any Phase 1/2 file.
---

> **Load this file when:** Working on `markers`, `in/out points`, `beat grid`, `generators`, `captions`, `SRT/VTT import`.  
> **Do NOT load this file when:** Working on tools, dispatcher, hooks, or any Phase 1/2 file.

---

# MARKERS, GENERATORS, CAPTIONS — Phase 3 Data Model

## Marker type

```typescript
type Marker = {
  readonly id: MarkerId;
  readonly type: "point" | "range";
  readonly frame: TimelineFrame; // point markers only
  readonly frameStart: TimelineFrame; // range markers only
  readonly frameEnd: TimelineFrame; // range markers only
  readonly label: string;
  readonly color: string;
  readonly scope: "global" | "personal" | "export";
  readonly linkedClipId?: ClipId; // moves with clip on ripple
};
```

Markers live on `Timeline`, not on a `Track`. All markers are accessible regardless of track visibility.

---

## Generator type

```typescript
type Generator = {
  readonly id: GeneratorId;
  readonly type: "solid" | "bars" | "countdown" | "noise" | "text";
  readonly params: Record<string, unknown>;
  readonly duration: TimelineFrame;
};
```

Generators act as Assets with no `filePath`. They are registered in `AssetRegistry` like any other asset. `mediaType` is always `'video'` (or `'audio'` for tone generators).

---

## Caption type

```typescript
type Caption = {
  readonly id: CaptionId;
  readonly text: string;
  readonly startFrame: TimelineFrame;
  readonly endFrame: TimelineFrame;
  readonly language: string; // BCP-47: 'en-US', 'fr-FR'
  readonly style: CaptionStyle;
  readonly burnIn: boolean;
};

type CaptionStyle = {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly color: string;
  readonly backgroundColor: string;
  readonly hAlign: "left" | "center" | "right";
  readonly vAlign: "top" | "center" | "bottom";
};
```

`burnIn: true` means the caption is composited into the video at export. The export pipeline reads this flag — it is NOT a track-level setting.

---

## BeatGrid type

```typescript
type BeatGrid = {
  readonly bpm: number;
  readonly timeSignature: [number, number]; // [4, 4], [3, 4] etc.
  readonly offset: TimelineFrame;
};
```

Stored on `Timeline`. Generates `SnapPoint`s at every beat and bar. `buildSnapIndex()` must handle `null` gracefully.

---

## New fields on Timeline (Phase 3 additions)

```typescript
// Current Timeline (Phase 0–2)
type Timeline = {
  readonly id:               string
  readonly name:             string
  readonly fps:              FrameRate
  readonly duration:         TimelineFrame
  readonly startTimecode:    Timecode
  readonly tracks:           readonly Track[]
  readonly sequenceSettings: SequenceSettings
  readonly version:          number
}

// Phase 3 additions:
  readonly markers:   readonly Marker[]     // default: []
  readonly beatGrid:  BeatGrid | null       // default: null
  readonly inPoint:   TimelineFrame | null  // default: null
  readonly outPoint:  TimelineFrame | null  // default: null
```

When adding these fields, `createTimeline()` defaults: `markers: []`, `beatGrid: null`, `inPoint: null`, `outPoint: null`.

---

## New OperationPrimitives (Phase 3)

```typescript
| ADD_MARKER     | { type: 'ADD_MARKER';      marker: Marker }
| MOVE_MARKER    | { type: 'MOVE_MARKER';     markerId: MarkerId; newFrame: TimelineFrame }
| DELETE_MARKER  | { type: 'DELETE_MARKER';   markerId: MarkerId }
| SET_IN_POINT   | { type: 'SET_IN_POINT';    frame: TimelineFrame | null }
| SET_OUT_POINT  | { type: 'SET_OUT_POINT';   frame: TimelineFrame | null }
| ADD_BEAT_GRID  | { type: 'ADD_BEAT_GRID';   beatGrid: BeatGrid }
| REMOVE_BEAT_GRID | { type: 'REMOVE_BEAT_GRID' }
| INSERT_GENERATOR | { type: 'INSERT_GENERATOR'; generator: Generator; trackId: TrackId; timelineStart: TimelineFrame }
| ADD_CAPTION    | { type: 'ADD_CAPTION';     caption: Caption }
| EDIT_CAPTION   | { type: 'EDIT_CAPTION';    captionId: CaptionId; patch: Partial<Caption> }
| DELETE_CAPTION | { type: 'DELETE_CAPTION';  captionId: CaptionId }
```

---

## Snap index additions (Phase 3)

`buildSnapIndex()` must be updated to pull from all four sources:

| Source              | Priority   | Notes                                    |
| ------------------- | ---------- | ---------------------------------------- |
| Markers             | 100        | Both point and range markers (start+end) |
| InPoint             | 90         | Single frame                             |
| OutPoint            | 90         | Single frame                             |
| BeatGrid beats      | 50         | Every beat; bars at higher priority      |
| Existing clip edges | (existing) | Unchanged from Phase 2                   |

`buildSnapIndex()` handles `markers: []`, `beatGrid: null`, `inPoint: null`, `outPoint: null` without branching — map over empty arrays and skip nulls.

---

## Common mistakes to avoid

- **Never** store `Marker[]` on a `Track` — markers live on `Timeline`
- `BeatGrid` is `null` by default — `buildSnapIndex()` must handle `null` gracefully (no crash)
- `Caption.burnIn` is on the entity, not the track — the export pipeline reads it at render time, not the dispatcher
- `linkedClipId` on a `Marker` moves the marker during ripple operations — `RippleDelete` and `RippleInsert` must update linked markers when their linked clip moves
- `ADD_BEAT_GRID` should fail if `timeline.beatGrid !== null` (only one beat grid per timeline) — validator enforces this
- In/out points are `null` when not set — `SET_IN_POINT(null)` clears the in point (valid operation)
