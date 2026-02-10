import type { ID, Bounds } from './common';

/**
 * SelectionState - Tracks which entities are currently selected
 * 
 * WHAT IS IT?
 * Selection state tracks what the user has selected for editing.
 * This is SEPARATE from the timeline content - it's editing state, not data.
 * 
 * WHY IT'S SEPARATE:
 * - Selection is temporary (doesn't need to be saved with the project)
 * - Multiple UIs can have different selections of the same timeline
 * - Easier to implement undo/redo (selection changes don't affect content)
 * 
 * KEY CONCEPT: MULTI-SELECT
 * Users can select:
 * - Multiple clips (for batch operations)
 * - Multiple tracks (for track operations)
 * - A time range (for ripple delete, etc.)
 * 
 * WHAT IT DOESN'T CONTAIN:
 * - Mouse event handlers
 * - Selection box rendering
 * - Keyboard shortcuts
 */
export interface SelectionState {
  /** 
   * Selected clip IDs
   * Using a Set for O(1) lookup and automatic deduplication
   */
  clipIds: Set<ID>;
  
  /** 
   * Selected track IDs
   * Using a Set for O(1) lookup and automatic deduplication
   */
  trackIds: Set<ID>;
  
  /** 
   * Optional time range selection
   * Used for operations like "select all clips in this range"
   */
  timeRange?: {
    start: number;
    end: number;
    /** Optional: limit selection to specific tracks */
    trackIds?: ID[];
  };
}

/**
 * Create initial selection state (nothing selected)
 */
export const createSelectionState = (): SelectionState => {
  return {
    clipIds: new Set(),
    trackIds: new Set(),
  };
};

/**
 * Check if a clip is selected
 */
export const isClipSelected = (state: SelectionState, clipId: ID): boolean => {
  return state.clipIds.has(clipId);
};

/**
 * Check if a track is selected
 */
export const isTrackSelected = (state: SelectionState, trackId: ID): boolean => {
  return state.trackIds.has(trackId);
};

/**
 * Check if anything is selected
 */
export const hasSelection = (state: SelectionState): boolean => {
  return state.clipIds.size > 0 || state.trackIds.size > 0 || state.timeRange !== undefined;
};
