/**
 * @timeline/react - useTimeline hook
 * 
 * Subscribe to the entire timeline state.
 * 
 * This hook subscribes to all state changes and re-renders whenever the
 * timeline state changes. Use this for components that need access to the
 * full state or need to respond to any state change.
 * 
 * @example
 * ```tsx
 * function TimelineView() {
 *   const { state, engine } = useTimeline();
 *   
 *   return (
 *     <div>
 *       <h1>{state.timeline.name}</h1>
 *       <button onClick={() => engine.undo()}>Undo</button>
 *       <button onClick={() => engine.redo()}>Redo</button>
 *       
 *       {state.timeline.tracks.map(track => (
 *         <Track key={track.id} trackId={track.id} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect } from 'react';
import { TimelineState } from '@timeline/core';
import { useEngine } from './useEngine';

/**
 * Timeline hook return value
 */
export interface UseTimelineResult {
  /** Current timeline state */
  state: TimelineState;
  /** Timeline engine instance */
  engine: ReturnType<typeof useEngine>;
}

/**
 * Subscribe to the entire timeline state
 * 
 * Re-renders whenever any part of the timeline state changes.
 * 
 * @returns Current state and engine instance
 */
export function useTimeline(): UseTimelineResult {
  const engine = useEngine();
  const [state, setState] = useState<TimelineState>(() => engine.getState());
  
  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = engine.subscribe((newState) => {
      setState(newState);
    });
    
    // Cleanup subscription on unmount
    return unsubscribe;
  }, [engine]);
  
  return { state, engine };
}
