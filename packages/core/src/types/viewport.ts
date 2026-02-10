import type { TimeMs } from './common';

/**
 * ViewportState - The viewport into the timeline
 * 
 * WHAT IS IT?
 * The viewport represents what portion of the timeline is currently visible.
 * Think of it like the camera view in a game - you can zoom in/out and pan left/right.
 * 
 * WHY IT'S SEPARATE:
 * - Viewport is view state, not content state
 * - Multiple UIs can have different viewports of the same timeline
 * - Doesn't need to be saved with the project
 * 
 * KEY CONCEPT: ZOOM AS A SCALE FACTOR
 * Zoom is measured in "pixels per millisecond"
 * - Higher zoom = more pixels per ms = zoomed IN (more detail)
 * - Lower zoom = fewer pixels per ms = zoomed OUT (more overview)
 * 
 * Example:
 * - zoom = 0.1 means 1 second (1000ms) = 100 pixels
 * - zoom = 1.0 means 1 second (1000ms) = 1000 pixels
 * 
 * WHAT IT DOESN'T CONTAIN:
 * - Scroll bar rendering
 * - Mouse wheel handlers
 * - Zoom UI controls
 */
export interface ViewportState {
  /** 
   * Zoom level in pixels per millisecond
   * Higher = more zoomed in
   */
  zoom: number;
  
  /** 
   * Left edge of the visible area (in timeline time)
   * This is the "scroll position" in time units
   */
  scrollTime: TimeMs;
  
  /** 
   * Width of the visible area in pixels
   * This comes from the UI (e.g., container width)
   */
  viewportWidth: number;
}

/**
 * Create initial viewport state
 * Defaults to showing the first 10 seconds at 0.1 zoom
 */
export const createViewportState = (params?: {
  zoom?: number;
  scrollTime?: TimeMs;
  viewportWidth?: number;
}): ViewportState => {
  return {
    zoom: params?.zoom ?? 0.1,
    scrollTime: params?.scrollTime ?? (0 as TimeMs),
    viewportWidth: params?.viewportWidth ?? 1000,
  };
};

/**
 * Get the visible duration (how much time is visible)
 * This is a computed property based on zoom and viewport width
 */
export const getVisibleDuration = (viewport: ViewportState): TimeMs => {
  return (viewport.viewportWidth / viewport.zoom) as TimeMs;
};

/**
 * Get the right edge of the visible area (in timeline time)
 */
export const getVisibleEnd = (viewport: ViewportState): TimeMs => {
  return (viewport.scrollTime + getVisibleDuration(viewport)) as TimeMs;
};

/**
 * Check if a time is currently visible in the viewport
 */
export const isTimeVisible = (viewport: ViewportState, time: TimeMs): boolean => {
  return time >= viewport.scrollTime && time <= getVisibleEnd(viewport);
};

/**
 * Convert timeline time to pixel position (relative to viewport)
 * This is the core time-to-pixel conversion
 */
export const timeToPixels = (viewport: ViewportState, time: TimeMs): number => {
  return (time - viewport.scrollTime) * viewport.zoom;
};

/**
 * Convert pixel position to timeline time
 * This is the inverse of timeToPixels
 */
export const pixelsToTime = (viewport: ViewportState, pixels: number): TimeMs => {
  return (viewport.scrollTime + pixels / viewport.zoom) as TimeMs;
};
