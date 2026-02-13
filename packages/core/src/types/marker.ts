/**
 * MARKER TYPES
 * 
 * Pure metadata for timeline navigation and organization.
 * Markers do not affect clip timing or validation.
 */

import { Frame } from './frame';

/**
 * Timeline marker - marks a specific frame on the timeline
 */
export interface TimelineMarker {
  id: string;
  type: 'timeline';
  frame: Frame;
  label: string;
  color?: string;
}

/**
 * Clip marker - marks a frame relative to clip start
 */
export interface ClipMarker {
  id: string;
  type: 'clip';
  clipId: string;
  frame: Frame; // Relative to clip's timelineStart
  label: string;
  color?: string;
}

/**
 * Region marker - marks a frame range
 */
export interface RegionMarker {
  id: string;
  type: 'region';
  startFrame: Frame;
  endFrame: Frame;
  label: string;
  color?: string;
}

/**
 * Work area - defines the active editing region
 */
export interface WorkArea {
  startFrame: Frame;
  endFrame: Frame;
}

/**
 * Union type for all marker types
 */
export type Marker = TimelineMarker | ClipMarker | RegionMarker;
