/**
 * @timeline/react
 *
 * React adapter for @timeline/core. Provides the TimelineProvider context
 * and all Phase 1 hooks for subscribing to engine state.
 *
 * @example
 * ```tsx
 * import { TimelineEngine, createTimeline, createTimelineState, toFrame, frameRate } from '@timeline/core';
 * import { TimelineProvider, useTimeline, useTrackIds } from '@timeline/react';
 *
 * const engine = new TimelineEngine(createTimelineState({
 *   timeline: createTimeline({ id: 'tl-1', name: 'My Timeline', fps: frameRate(30), duration: toFrame(9000) }),
 * }));
 *
 * function App() {
 *   return <TimelineProvider engine={engine}><TimelineView /></TimelineProvider>;
 * }
 *
 * function TimelineView() {
 *   const timeline  = useTimeline();
 *   const trackIds  = useTrackIds();
 *   return <h1>{timeline.name} — {trackIds.length} tracks</h1>;
 * }
 * ```
 */

// Context provider
export { TimelineProvider, TimelineContext } from './TimelineProvider';
export type { TimelineProviderProps } from './TimelineProvider';

// Engine class + snapshot type
export { TimelineEngine, DEFAULT_PLAYHEAD_STATE } from './engine';
export type { EngineSnapshot, TimelineEngineOptions } from './engine';

// Phase R Step 2: all hooks (context-based wrappers + engine-as-first-arg from hooks/index)
export {
  useEngine,
  useTimeline,
  useTrackIds,
  useTrack,
  useClip,
  useClips,
  useMarkers,
  useHistory,
  useActiveTool,
  useActiveToolId,
  useCanUndo,
  useCanRedo,
  useCursor,
  useProvisional,
  usePlayheadFrame,
  useIsPlaying,
  useChange,
  usePlaybackEngine,
  usePlayhead,
  usePlayheadEvent,
  useTimelineWithEngine,
  useTrackIdsWithEngine,
  useTrackWithEngine,
  useClipWithEngine,
  useProvisionalWithEngine,
  useSelectedClipIds,
} from './hooks';
export type { UsePlayheadResult } from './hooks';

// Phase R Step 3: ToolRouter (adapter) + virtual hooks
export { createToolRouter } from './adapter/tool-router';
export type { ToolRouterOptions, ToolRouterHandlers } from './adapter/tool-router';
export { useToolRouter } from './hooks/use-tool-router';
export { useVirtualWindow, useVisibleClips } from './hooks/use-virtual-window';
