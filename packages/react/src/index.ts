/**
 * @timeline/react
 * 
 * React adapter for @timeline/core
 * 
 * This package provides a thin integration layer between the framework-agnostic
 * timeline core and React applications. It includes:
 * 
 * - TimelineProvider: Context provider for the engine
 * - useEngine: Access the engine instance
 * - useTimeline: Subscribe to full timeline state
 * - useTrack: Subscribe to a specific track
 * - useClip: Subscribe to a specific clip
 * 
 * @example
 * ```tsx
 * import { TimelineEngine, createTimeline, createTimelineState } from '@timeline/core';
 * import { TimelineProvider, useTimeline } from '@timeline/react';
 * 
 * // Create engine
 * const engine = new TimelineEngine(createTimelineState({
 *   timeline: createTimeline({ ... })
 * }));
 * 
 * // Wrap app in provider
 * function App() {
 *   return (
 *     <TimelineProvider engine={engine}>
 *       <TimelineView />
 *     </TimelineProvider>
 *   );
 * }
 * 
 * // Use hooks in components
 * function TimelineView() {
 *   const { state, engine } = useTimeline();
 *   
 *   return (
 *     <div>
 *       <h1>{state.timeline.name}</h1>
 *       <button onClick={() => engine.undo()}>Undo</button>
 *       {state.timeline.tracks.map(track => (
 *         <Track key={track.id} trackId={track.id} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

// Context provider
export { TimelineProvider, TimelineContext } from './TimelineProvider';
export type { TimelineProviderProps } from './TimelineProvider';

// Hooks
export { useEngine } from './hooks/useEngine';
export { useTimeline } from './hooks/useTimeline';
export type { UseTimelineResult } from './hooks/useTimeline';
export { useTrack } from './hooks/useTrack';
export { useClip } from './hooks/useClip';
