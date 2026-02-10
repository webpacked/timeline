import type { TimeMs, ID } from './common';

/**
 * Marker - A labeled point in time
 * 
 * WHAT IS IT?
 * A marker is a reference point on the timeline, like a bookmark.
 * Think of chapter markers in a video or cue points in audio.
 * 
 * WHY IT EXISTS:
 * - Mark important moments (chapter points, edit markers)
 * - Provide snap targets for precise editing
 * - Organize timeline sections
 * 
 * WHAT IT DOESN'T CONTAIN:
 * - Visual styling (that's the UI's job)
 * - Click handlers or interaction logic
 */
export interface Marker {
  /** Unique identifier */
  id: ID;
  
  /** Time position on the timeline */
  time: TimeMs;
  
  /** Human-readable label */
  label: string;
  
  /** Optional color hint for UI (e.g., "#ff0000") */
  color?: string;
  
  /** Optional metadata for custom use cases */
  metadata?: Record<string, unknown>;
}

/**
 * Create a new marker
 * 
 * This is a factory function that ensures all required fields are present
 * and provides sensible defaults for optional fields.
 */
export const createMarker = (params: {
  id: ID;
  time: TimeMs;
  label: string;
  color?: string;
  metadata?: Record<string, unknown>;
}): Marker => {
  const marker: Marker = {
    id: params.id,
    time: params.time,
    label: params.label,
  };
  
  if (params.color !== undefined) {
    marker.color = params.color;
  }
  
  if (params.metadata !== undefined) {
    marker.metadata = params.metadata;
  }
  
  return marker;
};
