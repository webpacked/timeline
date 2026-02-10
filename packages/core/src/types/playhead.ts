import type { TimeMs, ID } from './common';

/**
 * PlayheadState - Current time position(s) in the timeline
 * 
 * WHAT IS IT?
 * The playhead is the "current time" indicator - like the playback cursor
 * in a video player or the current frame in an animation tool.
 * 
 * WHY TWO PLAYHEADS?
 * - Primary (current): The "real" time position (where playback happens)
 * - Hover (optional): Preview time (where you're about to click/drop)
 * 
 * This separation allows you to preview where a clip will land
 * without moving the actual playback position.
 * 
 * WHAT IT DOESN'T CONTAIN:
 * - Visual representation (line, color, etc.)
 * - Scrubbing/dragging logic
 */
export interface PlayheadState {
  /** Primary playhead - the "real" current time */
  current: TimeMs;
  
  /** 
   * Secondary hover playhead - preview time
   * Used when hovering over the timeline to show where you'd click
   */
  hover?: TimeMs;
}

/**
 * Create initial playhead state
 * Starts at time 0 with no hover playhead
 */
export const createPlayheadState = (current: TimeMs = 0 as TimeMs): PlayheadState => {
  return {
    current,
  };
};
