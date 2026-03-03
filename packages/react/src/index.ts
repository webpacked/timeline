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
export { TimelineEngine } from './engine';
export type { EngineSnapshot } from './engine';

// All Phase 1 hooks + Phase 6 playhead hooks (single source of truth: hooks.ts)
export {
  useEngine,
  useTimeline,
  useTrackIds,
  useTrack,
  useClip,
  useActiveTool,
  useCanUndo,
  useCanRedo,
  useProvisional,
  usePlayhead,
  usePlayheadEvent,
} from './hooks';
export type { UsePlayheadResult } from './hooks';
