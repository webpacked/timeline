# @timeline/core

Headless NLE timeline engine. Zero UI dependencies.
Runs anywhere TypeScript runs.

## Install
```bash
npm install @timeline/core
```

## What's inside

- **Dispatcher** — atomic transactions,
  rolling-state validation, immutable state
- **Tools** — SelectionTool, RazorTool,
  RippleTrimTool, RollTrimTool, SlipTool,
  SlideTool, RippleDeleteTool, RippleInsertTool,
  HandTool, TransitionTool, KeyframeTool, ZoomTool
- **Playback** — PlayheadController, PlaybackEngine,
  pipeline contracts for decode + composite
- **Serialization** — JSON (versioned + migratable),
  OTIO, EDL (CMX3600), AAF, FCP XML
- **Import** — SRT/VTT subtitle import
- **Project model** — multi-timeline container,
  bin/folder hierarchy
- **Performance** — interval tree (O(log n) lookup),
  transaction compression, LRU thumbnail cache,
  virtual rendering contract

## Basic usage
```typescript
import {
  createTimelineState,
  createTrack,
  createClip,
  toTrackId,
  toClipId,
  toFrame,
  dispatch,
  checkInvariants,
} from '@timeline/core'

const track = createTrack(toTrackId('v1'), 'video')
const clip  = createClip({
  id:             toClipId('clip-1'),
  trackId:        toTrackId('v1'),
  startFrame:     toFrame(0),
  durationFrames: 90,
  mediaType:      'video',
})

const state = createTimelineState({
  timeline: createTimeline({ fps: 30, durationFrames: 900 }),
  tracks:   [track],
})

const result = dispatch(state, {
  operations: [{ type: 'INSERT_CLIP', clip, trackId: track.id }],
  label: 'Add clip',
  timestamp: Date.now(),
})

if (result.ok) {
  const violations = checkInvariants(result.state)
  console.log(violations) // []
}
```

## Playback
```typescript
import {
  PlaybackEngine,
  browserClock,
} from '@timeline/core'

const engine = new PlaybackEngine(
  state,
  { videoDecoder, compositor },
  { width: 1920, height: 1080 },
  browserClock,
)

engine.play()
engine.on((event) => {
  if (event.type === 'ended') console.log('done')
})
```

## Serialization
```typescript
import { serializeTimeline, deserializeTimeline }
  from '@timeline/core'

const json  = serializeTimeline(state)
const state2 = deserializeTimeline(json)
// checkInvariants() runs automatically on deserialize
```

## Architecture decisions

- **Immutable state** — every operation returns
  a new object. Unchanged clips keep their reference.
- **Branded types** — `TimelineFrame`, `ClipId`,
  `TrackId` are distinct types at compile time.
- **Rolling-state validation** — each op in a
  compound transaction is validated against the
  result of the previous op, not the original state.
- **No DOM, no React** — safe to use in Workers,
  Node, or Electron main process.

## Test
```bash
pnpm --filter @timeline/core test
# 942 tests, 0 TypeScript errors
```

## License

MIT
