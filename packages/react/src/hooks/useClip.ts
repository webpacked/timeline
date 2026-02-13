/**
 * @timeline/react - useClip hook
 * 
 * Subscribe to a specific clip by ID.
 * 
 * This hook subscribes to state changes and returns the clip with the
 * specified ID. It searches across all tracks to find the clip.
 * Re-renders whenever the timeline state changes (currently not optimized
 * with selectors).
 * 
 * @example
 * ```tsx
 * function ClipView({ clipId }: { clipId: string }) {
 *   const clip = useClip(clipId);
 *   const engine = useEngine();
 *   
 *   if (!clip) {
 *     return <div>Clip not found</div>;
 *   }
 *   
 *   const handleMove = (newStart: Frame) => {
 *     engine.moveClip(clipId, newStart);
 *   };
 *   
 *   return (
 *     <div>
 *       <div>Start: {clip.timelineStart}</div>
 *       <div>End: {clip.timelineEnd}</div>
 *       <button onClick={() => handleMove(frame(100))}>
 *         Move to 100
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect } from 'react';
import type { Clip } from '@timeline/core';
import { useEngine } from './useEngine';

/**
 * Subscribe to a specific clip
 * 
 * Searches across all tracks to find the clip with the specified ID.
 * Re-renders whenever the timeline state changes.
 * Returns undefined if the clip is not found.
 * 
 * @param clipId - ID of the clip to subscribe to
 * @returns The clip, or undefined if not found
 */
export function useClip(clipId: string): Clip | undefined {
  const engine = useEngine();
  
  const [clip, setClip] = useState<Clip | undefined>(() => {
    const state = engine.getState();
    // Search across all tracks
    for (const track of state.timeline.tracks) {
      const found = track.clips.find(c => c.id === clipId);
      if (found) return found;
    }
    return undefined;
  });
  
  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = engine.subscribe((state) => {
      // Search across all tracks
      for (const track of state.timeline.tracks) {
        const found = track.clips.find(c => c.id === clipId);
        if (found) {
          setClip(found);
          return;
        }
      }
      setClip(undefined);
    });
    
    // Cleanup subscription on unmount
    return unsubscribe;
  }, [engine, clipId]);
  
  return clip;
}
