/**
 * @timeline/react - useTrack hook
 * 
 * Subscribe to a specific track by ID.
 * 
 * This hook subscribes to state changes and returns the track with the
 * specified ID. Re-renders whenever the timeline state changes (currently
 * not optimized with selectors).
 * 
 * @example
 * ```tsx
 * function TrackView({ trackId }: { trackId: string }) {
 *   const track = useTrack(trackId);
 *   
 *   if (!track) {
 *     return <div>Track not found</div>;
 *   }
 *   
 *   return (
 *     <div>
 *       <h2>{track.name}</h2>
 *       <div>Clips: {track.clips.length}</div>
 *       
 *       {track.clips.map(clip => (
 *         <Clip key={clip.id} clipId={clip.id} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect } from 'react';
import type { Track } from '@timeline/core';
import { useEngine } from './useEngine';

/**
 * Subscribe to a specific track
 * 
 * Re-renders whenever the timeline state changes.
 * Returns undefined if the track is not found.
 * 
 * @param trackId - ID of the track to subscribe to
 * @returns The track, or undefined if not found
 */
export function useTrack(trackId: string): Track | undefined {
  const engine = useEngine();
  
  const [track, setTrack] = useState<Track | undefined>(() => {
    const state = engine.getState();
    return state.timeline.tracks.find(t => t.id === trackId);
  });
  
  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = engine.subscribe((state) => {
      const newTrack = state.timeline.tracks.find(t => t.id === trackId);
      setTrack(newTrack);
    });
    
    // Cleanup subscription on unmount
    return unsubscribe;
  }, [engine, trackId]);
  
  return track;
}
