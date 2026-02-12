/**
 * TIMELINE OPERATIONS
 * 
 * Pure functions for manipulating timeline-level properties.
 * 
 * WHAT ARE TIMELINE OPERATIONS?
 * - Update timeline duration
 * - Update timeline name
 * - Update timeline metadata
 * 
 * ALL OPERATIONS ARE PURE:
 * - Take state as input
 * - Return new state as output
 * - Never mutate input state
 * 
 * USAGE:
 * ```typescript
 * let state = setTimelineDuration(state, frame(9000));
 * state = setTimelineName(state, 'My Project');
 * ```
 */

import { TimelineState } from '../types/state';
import { Frame } from '../types/frame';

/**
 * Set the timeline duration
 * 
 * @param state - Current timeline state
 * @param duration - New duration in frames
 * @returns New timeline state with updated duration
 */
export function setTimelineDuration(state: TimelineState, duration: Frame): TimelineState {
  return {
    ...state,
    timeline: {
      ...state.timeline,
      duration,
    },
  };
}

/**
 * Set the timeline name
 * 
 * @param state - Current timeline state
 * @param name - New timeline name
 * @returns New timeline state with updated name
 */
export function setTimelineName(state: TimelineState, name: string): TimelineState {
  return {
    ...state,
    timeline: {
      ...state.timeline,
      name,
    },
  };
}

/**
 * Update timeline metadata
 * 
 * @param state - Current timeline state
 * @param metadata - Metadata to merge with existing metadata
 * @returns New timeline state with updated metadata
 */
export function updateTimelineMetadata(
  state: TimelineState,
  metadata: Record<string, unknown>
): TimelineState {
  return {
    ...state,
    timeline: {
      ...state.timeline,
      metadata: {
        ...state.timeline.metadata,
        ...metadata,
      },
    },
  };
}
