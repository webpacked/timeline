/**
 * TIMELINE MODEL
 * 
 * The Timeline is the root container for the entire editing project.
 * 
 * WHAT IS A TIMELINE?
 * - The top-level data structure for a project
 * - Contains all tracks (which contain all clips)
 * - Defines the frame rate (FPS) for the entire project
 * - Defines the total duration of the project
 * 
 * WHY A TIMELINE?
 * - Single source of truth for all timeline data
 * - Defines the temporal bounds of the project
 * - Provides a consistent frame rate for all time calculations
 * 
 * EXAMPLE:
 * ```typescript
 * const timeline: Timeline = {
 *   id: 'timeline_1',
 *   name: 'My Project',
 *   fps: frameRate(30),
 *   duration: frame(9000),  // 5 minutes at 30fps
 *   tracks: [],
 * };
 * ```
 * 
 * INVARIANTS:
 * - FPS is immutable after timeline creation
 * - Duration must be positive
 * - All tracks must have unique IDs
 */

import { Frame, FrameRate } from './frame';
import { Track } from './track';

/**
 * Timeline - The root container for a timeline project
 */
export interface Timeline {
  /** Unique identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Frames per second (immutable after creation) */
  fps: FrameRate;
  
  /** Total duration of the timeline in frames */
  duration: Frame;
  
  /** Tracks in the timeline (ordered bottom-to-top) */
  tracks: Track[];
  
  /** Optional metadata for custom use cases */
  metadata?: Record<string, unknown>;
}

/**
 * Create a new timeline
 * 
 * @param params - Timeline parameters
 * @returns A new Timeline object
 */
export function createTimeline(params: {
  id: string;
  name: string;
  fps: FrameRate;
  duration: Frame;
  tracks?: Track[];
  metadata?: Record<string, unknown>;
}): Timeline {
  const timeline: Timeline = {
    id: params.id,
    name: params.name,
    fps: params.fps,
    duration: params.duration,
    tracks: params.tracks ?? [],
  };
  
  if (params.metadata !== undefined) {
    timeline.metadata = params.metadata;
  }
  
  return timeline;
}
