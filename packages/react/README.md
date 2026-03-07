# @timeline/react

React adapter for `@timeline/core`. Provides `TimelineEngine`, hooks, context, and tool routing for building timeline editors.

## Install

```bash
npm install @webpacked-timeline/core @webpacked-timeline/react
```

Both packages are required. `@webpacked-timeline/core` is a peer dependency.

## Quick Start

```tsx
import { TimelineEngine, TimelineProvider, useTrackIds, usePlayheadFrame } from '@webpacked-timeline/react';
import { createTimelineState, createTimeline, toFrame, frameRate } from '@webpacked-timeline/core';

const engine = new TimelineEngine({
  initialState: createTimelineState({
    timeline: createTimeline({
      id: 'tl-1',
      name: 'My Timeline',
      fps: frameRate(30),
      duration: toFrame(9000),
    }),
  }),
});

function App() {
  return (
    <TimelineProvider engine={engine}>
      <TimelineView />
    </TimelineProvider>
  );
}

function TimelineView() {
  const trackIds = useTrackIds();
  const frame = usePlayheadFrame();
  return (
    <div>
      <p>Frame: {frame as number}</p>
      <p>{trackIds.length} tracks</p>
    </div>
  );
}
```

## Hooks

All hooks accept an optional `engine` argument for use outside `TimelineProvider`. Inside the provider, they read from context automatically.

| Hook | Returns | Re-renders when |
|------|---------|-----------------|
| `useEngine()` | `TimelineEngine` | — (stable ref) |
| `useTimeline(engine?)` | `Timeline` | timeline metadata changes |
| `useTrackIds(engine?)` | `string[]` | tracks added/removed/reordered |
| `useTrack(engine?, trackId)` | `Track \| null` | that track changes |
| `useClip(engine?, clipId)` | `Clip \| null` | that clip changes |
| `useClips(engine?, trackId)` | `Clip[]` | any clip on track changes |
| `useMarkers(engine?)` | `Marker[]` | markers change |
| `useHistory(engine?)` | `{ canUndo, canRedo }` | history changes |
| `usePlayheadFrame(engine?)` | `TimelineFrame` | every frame tick |
| `useIsPlaying(engine?)` | `boolean` | play/pause toggle |
| `useActiveToolId(engine?)` | `string` | tool switch |
| `useActiveTool(engine?)` | `ITool` | tool switch |
| `useProvisional(engine?)` | `ProvisionalState \| null` | drag preview |
| `useSelectedClipIds(engine?)` | `ReadonlySet<string>` | selection changes |
| `useCursor(engine?)` | `string` | cursor style changes |
| `useCanUndo(engine?)` | `boolean` | undo availability |
| `useCanRedo(engine?)` | `boolean` | redo availability |
| `useChange(engine?)` | `StateChange` | any state diff |
| `usePlaybackEngine(engine?)` | `PlaybackEngine \| null` | — |
| `usePlayhead(engine?)` | `UsePlayheadResult` | playhead state |
| `useVirtualWindow(engine, vpWidth, scrollLeft, ppf)` | `VirtualWindow` | viewport changes |
| `useVisibleClips(engine, window)` | `VirtualClipEntry[]` | visible clips change |

### Engine-first variants

For use without context: `useTimelineWithEngine(engine)`, `useTrackIdsWithEngine(engine)`, `useTrackWithEngine(engine, id)`, `useClipWithEngine(engine, id)`, `useProvisionalWithEngine(engine)`.

## Tool Routing

```tsx
import { useToolRouter } from '@timeline/react';

const handlers = useToolRouter(engine, {
  getPixelsPerFrame: () => ppf,
});

return (
  <div {...handlers} tabIndex={0}>
    {/* timeline content */}
  </div>
);
```

## TimelineEngine

`TimelineEngine` is the main orchestrator class. It wires together the core dispatcher, history, tools, playback, snap system, and keyboard handler.

```typescript
const engine = new TimelineEngine({
  initialState,                    // TimelineState (required)
  pipeline,                        // PipelineConfig (optional)
  clock,                           // Clock (optional, defaults to browserClock)
  getPixelsPerFrame,               // () => number (optional)
  onZoomChange,                    // (ppf: number) => void (optional)
  historyLimit,                    // number (optional, default 100)
  compression,                     // CompressionPolicy (optional)
  tools,                           // ITool[] (optional, overrides defaults)
  defaultToolId,                   // string (optional, default 'selection')
});
```

Key methods: `dispatch()`, `undo()`, `redo()`, `seekTo()`, `activateTool()`, `getState()`, `getSnapshot()`, `subscribe()`.

## License

MIT
