# @webpacked-timeline/core

Headless TypeScript engine for professional NLE timeline editing. Framework-agnostic, fully tested, zero dependencies.

## Install

```bash
npm install @webpacked-timeline/core
```

## Features

- **40+ atomic operations** — `MOVE_CLIP`, `RESIZE_CLIP`, `SLICE_CLIP`, `INSERT_CLIP`, `DELETE_CLIP`, `SET_MEDIA_BOUNDS`, `ADD_TRACK`, `DELETE_TRACK`, `ADD_MARKER`, `ADD_EFFECT`, `ADD_KEYFRAME`, `ADD_TRANSITION`, `LINK_CLIPS`, and more
- **Tool system** — Selection, Razor, Ripple Trim, Roll Trim, Slip, Slide, Ripple Delete, Ripple Insert, Hand, Transition, Keyframe, Zoom
- **Undo/redo** with transaction compression
- **Playback engine** with J/K/L shuttle control via `KeyboardHandler`
- **Snap system** — `SnapIndexManager` with configurable snap points
- **Virtual windowing** — `getVisibleClips()` / `getVisibleFrameRange()` for large timelines
- **Export** — OTIO, EDL (CMX 3600), AAF, FCP XML
- **Serialization** — versioned JSON with `serializeTimeline` / `deserializeTimeline`
- **Import** — SRT and VTT subtitle import
- **Project model** — multi-timeline container with bin/folder hierarchy
- **Interval tree** — O(log n) clip lookup via `IntervalTree` / `TrackIndex`
- **Branded types** — `TimelineFrame`, `ClipId`, `TrackId`, `FrameRate` are distinct at compile time
- **Zero dependencies**

## Quick Start

```typescript
import {
  createTimelineState,
  createTimeline,
  createTrack,
  createClip,
  dispatch,
  checkInvariants,
  toFrame,
  toTrackId,
  toClipId,
  toAssetId,
  frameRate,
} from '@webpacked-timeline/core';

// 1. Build initial state
const state = createTimelineState({
  timeline: createTimeline({
    id: 'tl-1',
    name: 'My Timeline',
    fps: frameRate(30),
    duration: toFrame(9000),
    tracks: [
      createTrack({ id: toTrackId('v1'), name: 'Video 1', type: 'video' }),
    ],
  }),
});

// 2. Dispatch an operation
const result = dispatch(state, {
  id: 'tx-1',
  label: 'Insert clip',
  timestamp: Date.now(),
  operations: [{
    type: 'INSERT_CLIP',
    trackId: toTrackId('v1'),
    clip: createClip({
      id: toClipId('clip-1'),
      assetId: toAssetId('asset-1'),
      trackId: toTrackId('v1'),
      timelineStart: toFrame(0),
      timelineEnd: toFrame(90),
      mediaIn: toFrame(0),
      mediaOut: toFrame(90),
      name: 'Intro',
    }),
  }],
});

// 3. Validate
if (result.ok) {
  const violations = checkInvariants(result.state);
  console.log(violations); // []
}
```

## Playback

```typescript
import { PlaybackEngine, browserClock } from '@webpacked-timeline/core';

const playback = new PlaybackEngine(
  state,
  { videoDecoder, compositor }, // PipelineConfig
  { width: 1920, height: 1080 },
  browserClock,
);

playback.play();
```

## Serialization

```typescript
import {
  serializeTimeline,
  deserializeTimeline,
  exportToOTIO,
  exportToEDL,
  exportToAAF,
  exportToFCPXML,
} from '@webpacked-timeline/core';

// JSON round-trip
const json = serializeTimeline(state);
const restored = deserializeTimeline(json);

// Industry formats
const otio = exportToOTIO(state);
const edl = exportToEDL(state);
const aaf = exportToAAF(state);
const fcpxml = exportToFCPXML(state);
```

## Architecture

- **Immutable state** — every operation returns a new object; unchanged clips keep their reference identity
- **Rolling-state validation** — each op in a compound transaction is validated against the result of the previous op
- **Branded types** — `TimelineFrame`, `ClipId`, `TrackId` are distinct types at compile time
- **No DOM, no React** — safe to use in Workers, Node.js, or Electron main process

## API Reference

### Factories
`createTimeline`, `createTrack`, `createClip`, `createAsset`, `createTimelineState`

### Frame Utilities
`toFrame`, `frameRate`, `framesToTimecode`, `framesToSeconds`, `secondsToFrames`, `FrameRates`

### State Management
`dispatch`, `checkInvariants`, `HistoryStack`, `TransactionCompressor`

### Tools
`SelectionTool`, `RazorTool`, `RippleTrimTool`, `RollTrimTool`, `SlipTool`, `SlideTool`, `RippleDeleteTool`, `RippleInsertTool`, `HandTool`, `TransitionTool`, `KeyframeTool`, `ZoomTool`

### Playback
`PlaybackEngine`, `PlayheadController`, `KeyboardHandler`, `browserClock`, `nodeClock`

### Serialization & Export
`serializeTimeline`, `deserializeTimeline`, `exportToOTIO`, `importFromOTIO`, `exportToEDL`, `exportToAAF`, `exportToFCPXML`

### Performance
`IntervalTree`, `TrackIndex`, `SnapIndexManager`, `ThumbnailCache`, `ThumbnailQueue`, `getVisibleClips`

## Tests

```bash
pnpm --filter @webpacked-timeline/core test
# 852 tests, 0 TypeScript errors
```

## License

MIT
