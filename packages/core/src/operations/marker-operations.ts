/**
 * MARKER OPERATIONS
 * 
 * Operations for adding/removing markers.
 * Markers are pure metadata - they don't affect clip timing or validation.
 * 
 * DESIGN:
 * - Markers stored in TimelineState.markers
 * - Pure functions - no mutations
 * - Three types: timeline, clip, region
 * - Work area is separate from markers
 */

import { TimelineState } from '../types/state';
import { TimelineMarker, ClipMarker, RegionMarker, WorkArea } from '../types/marker';
import { findClipById } from '../systems/queries';

/**
 * Add a timeline marker
 * 
 * @param state - Timeline state
 * @param marker - Timeline marker to add
 * @returns New state with marker added
 */
export function addTimelineMarker(
  state: TimelineState,
  marker: TimelineMarker
): TimelineState {
  return {
    ...state,
    markers: {
      ...state.markers,
      timeline: [...state.markers.timeline, marker],
    },
  };
}

/**
 * Add a clip marker
 * 
 * @param state - Timeline state
 * @param marker - Clip marker to add
 * @returns New state with marker added
 */
export function addClipMarker(
  state: TimelineState,
  marker: ClipMarker
): TimelineState {
  // Verify clip exists
  const clip = findClipById(state, marker.clipId);
  if (!clip) {
    throw new Error(`Clip not found: ${marker.clipId}`);
  }
  
  return {
    ...state,
    markers: {
      ...state.markers,
      clips: [...state.markers.clips, marker],
    },
  };
}

/**
 * Add a region marker
 * 
 * @param state - Timeline state
 * @param marker - Region marker to add
 * @returns New state with marker added
 */
export function addRegionMarker(
  state: TimelineState,
  marker: RegionMarker
): TimelineState {
  if (marker.startFrame >= marker.endFrame) {
    throw new Error('Region marker start must be before end');
  }
  
  return {
    ...state,
    markers: {
      ...state.markers,
      regions: [...state.markers.regions, marker],
    },
  };
}

/**
 * Remove a marker by ID
 * 
 * Searches all marker types and removes the first match.
 * 
 * @param state - Timeline state
 * @param markerId - Marker ID to remove
 * @returns New state with marker removed
 */
export function removeMarker(
  state: TimelineState,
  markerId: string
): TimelineState {
  return {
    ...state,
    markers: {
      timeline: state.markers.timeline.filter(m => m.id !== markerId),
      clips: state.markers.clips.filter(m => m.id !== markerId),
      regions: state.markers.regions.filter(m => m.id !== markerId),
    },
  };
}

/**
 * Remove all markers for a specific clip
 * 
 * Useful when deleting a clip.
 * 
 * @param state - Timeline state
 * @param clipId - Clip ID
 * @returns New state with clip markers removed
 */
export function removeClipMarkers(
  state: TimelineState,
  clipId: string
): TimelineState {
  return {
    ...state,
    markers: {
      ...state.markers,
      clips: state.markers.clips.filter(m => m.clipId !== clipId),
    },
  };
}

/**
 * Set work area
 * 
 * @param state - Timeline state
 * @param workArea - Work area to set
 * @returns New state with work area set
 */
export function setWorkArea(
  state: TimelineState,
  workArea: WorkArea
): TimelineState {
  if (workArea.startFrame >= workArea.endFrame) {
    throw new Error('Work area start must be before end');
  }
  
  return {
    ...state,
    workArea,
  };
}

/**
 * Clear work area
 * 
 * @param state - Timeline state
 * @returns New state with work area cleared
 */
export function clearWorkArea(
  state: TimelineState
): TimelineState {
  const { workArea: _, ...stateWithoutWorkArea } = state;
  return stateWithoutWorkArea as TimelineState;
}

/**
 * Update timeline marker
 * 
 * @param state - Timeline state
 * @param markerId - Marker ID to update
 * @param updates - Partial marker updates
 * @returns New state with marker updated
 */
export function updateTimelineMarker(
  state: TimelineState,
  markerId: string,
  updates: Partial<Omit<TimelineMarker, 'id' | 'type'>>
): TimelineState {
  return {
    ...state,
    markers: {
      ...state.markers,
      timeline: state.markers.timeline.map(m =>
        m.id === markerId ? { ...m, ...updates } : m
      ),
    },
  };
}

/**
 * Update region marker
 * 
 * @param state - Timeline state
 * @param markerId - Marker ID to update
 * @param updates - Partial marker updates
 * @returns New state with marker updated
 */
export function updateRegionMarker(
  state: TimelineState,
  markerId: string,
  updates: Partial<Omit<RegionMarker, 'id' | 'type'>>
): TimelineState {
  return {
    ...state,
    markers: {
      ...state.markers,
      regions: state.markers.regions.map(m =>
        m.id === markerId ? { ...m, ...updates } : m
      ),
    },
  };
}
