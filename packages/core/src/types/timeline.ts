import type { TimeMs, ID } from './common';
import type { Track } from './track';
import type { Marker } from './marker';

/**
 * Timeline - The root container for the entire timeline project
 * 
 * WHAT IS IT?
 * The timeline is the top-level data structure that represents your entire project.
 * Think of it like a Premiere Pro project or a Logic Pro session.
 * 
 * WHY IT EXISTS:
 * - Single source of truth for all timeline data
 * - Defines the bounds and structure of the project
 * - Contains all tracks, markers, and global state
 * 
 * WHAT IT DOESN'T CONTAIN:
 * - Rendering information (that's the UI's job)
 * - UI state like selection or viewport (those are separate)
 * - Event handlers or interaction logic
 * 
 * KEY CONCEPT: SEPARATION OF CONCERNS
 * The Timeline contains CONTENT (tracks, clips, markers)
 * Separate state objects handle EDITING (selection, viewport, playhead)
 * This separation makes the code easier to understand and test
 */
export interface Timeline {
  /** Unique identifier */
  id: ID;
  
  /** Human-readable name */
  name: string;
  
  /** 
   * Total duration of the timeline in milliseconds
   * This defines the "end" of the timeline
   * Clips can exist beyond this, but this is the logical end point
   */
  duration: TimeMs;
  
  /** 
   * Tracks (layers) in the timeline
   * Ordered from bottom to top:
   * - tracks[0] = bottom layer
   * - tracks[n] = top layer
   */
  tracks: Track[];
  
  /** 
   * Global markers
   * These are timeline-level markers (like chapter points)
   * Individual clips can also have their own markers
   */
  markers: Marker[];
  
  /** Optional metadata for custom use cases */
  metadata?: Record<string, unknown>;
}

/**
 * Create a new timeline
 * Factory function with sensible defaults
 */
export const createTimeline = (params: {
  id: ID;
  name: string;
  duration: TimeMs;
  tracks?: Track[];
  markers?: Marker[];
  metadata?: Record<string, unknown>;
}): Timeline => {
  const timeline: Timeline = {
    id: params.id,
    name: params.name,
    duration: params.duration,
    tracks: params.tracks ?? [],
    markers: params.markers ?? [],
  };
  
  if (params.metadata !== undefined) {
    timeline.metadata = params.metadata;
  }
  
  return timeline;
};
