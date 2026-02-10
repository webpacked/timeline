/**
 * useViewport Hook
 * 
 * WHAT THIS DOES:
 * - Manages viewport state (zoom, scroll, width)
 * - Provides time ↔ pixel conversion functions
 * - Handles zoom and pan operations
 * 
 * WHAT THIS DOES NOT DO:
 * - Render anything
 * - Handle mouse/wheel events (components do that)
 * - Manage timeline content
 * 
 * WHY IT EXISTS:
 * - Separates viewport state from timeline content
 * - Provides conversion utilities for positioning
 * - Enables zoom/scroll without affecting timeline data
 * 
 * MENTAL MODEL:
 * The viewport is a "camera" looking at the timeline.
 * Zoom = how close the camera is
 * Scroll = where the camera is pointing
 */

import { useState, useCallback, useMemo } from 'react';
import type { ViewportState, TimeMs } from '@timeline/core';
import {
  createViewportState,
  timeToPixels as coreTimeToPixels,
  pixelsToTime as corePixelsToTime,
  getVisibleDuration,
} from '@timeline/core';

export interface UseViewportReturn {
  viewport: ViewportState;
  
  // Viewport mutations
  setZoom: (zoom: number) => void;
  setScroll: (scrollTime: TimeMs) => void;
  setViewportWidth: (width: number) => void;
  
  // Conversion utilities
  timeToPixels: (time: TimeMs) => number;
  pixelsToTime: (pixels: number) => TimeMs;
  
  // Calculated values
  visibleDuration: number;
  
  // Direct state setter
  setViewport: (viewport: ViewportState) => void;
}

export function useViewport(
  initialViewport?: Partial<ViewportState>
): UseViewportReturn {
  const [viewport, setViewport] = useState<ViewportState>(() =>
    createViewportState({
      zoom: initialViewport?.zoom ?? 0.1,
      scrollTime: initialViewport?.scrollTime ?? (0 as TimeMs),
      viewportWidth: initialViewport?.viewportWidth ?? 1000,
    })
  );
  
  // Viewport mutations
  const setZoom = useCallback((zoom: number) => {
    setViewport(current => ({
      ...current,
      zoom,
    }));
  }, []);
  
  const setScroll = useCallback((scrollTime: TimeMs) => {
    setViewport(current => ({
      ...current,
      scrollTime,
    }));
  }, []);
  
  const setViewportWidth = useCallback((width: number) => {
    setViewport(current => ({
      ...current,
      viewportWidth: width,
    }));
  }, []);
  
  // Conversion utilities (memoized with current viewport)
  const timeToPixels = useCallback(
    (time: TimeMs) => coreTimeToPixels(viewport, time),
    [viewport]
  );
  
  const pixelsToTime = useCallback(
    (pixels: number) => corePixelsToTime(viewport, pixels),
    [viewport]
  );
  
  // Calculated values
  const visibleDuration = useMemo(
    () => getVisibleDuration(viewport),
    [viewport]
  );
  
  return {
    viewport,
    setZoom,
    setScroll,
    setViewportWidth,
    timeToPixels,
    pixelsToTime,
    visibleDuration,
    setViewport,
  };
}
