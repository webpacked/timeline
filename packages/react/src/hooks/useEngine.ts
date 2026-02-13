/**
 * @timeline/react - useEngine hook
 * 
 * Access the TimelineEngine instance from context.
 * 
 * This hook provides direct access to the engine instance without subscribing
 * to state changes. Use this when you need to call engine methods but don't
 * need to re-render on state changes.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const engine = useEngine();
 *   
 *   const handleAddClip = () => {
 *     engine.addClip(trackId, clip);
 *   };
 *   
 *   return <button onClick={handleAddClip}>Add Clip</button>;
 * }
 * ```
 */

import { useContext } from 'react';
import { TimelineEngine } from '@timeline/core';
import { TimelineContext } from '../TimelineProvider';

/**
 * Access the timeline engine instance
 * 
 * @returns The timeline engine instance
 * @throws Error if used outside TimelineProvider
 */
export function useEngine(): TimelineEngine {
  const engine = useContext(TimelineContext);
  
  if (!engine) {
    throw new Error(
      'useEngine must be used within a TimelineProvider. ' +
      'Wrap your component tree with <TimelineProvider engine={engine}>.'
    );
  }
  
  return engine;
}
