/**
 * useTimeline Hook
 * 
 * WHAT THIS DOES:
 * - Wraps @timeline/core Timeline state in React
 * - Provides action functions that call core operations
 * - Ensures all updates are immutable
 * 
 * WHAT THIS DOES NOT DO:
 * - Render anything (no JSX)
 * - Handle DOM events
 * - Manage viewport or selection (separate hooks)
 * 
 * WHY IT EXISTS:
 * - Adapts pure core functions to React's state model
 * - Provides a clean API for components
 * - Maintains immutability through core operations
 * 
 * DATA FLOW:
 * Component calls action → Hook calls core function → Core returns new state → setState updates
 */

import { useState, useCallback } from 'react';
import type { Timeline, Track, Clip, Marker, ID } from '@timeline/core';
import {
  addTrack as coreAddTrack,
  removeTrack as coreRemoveTrack,
  updateTrack as coreUpdateTrack,
  addClip as coreAddClip,
  removeClip as coreRemoveClip,
  updateClip as coreUpdateClip,
  addMarker as coreAddMarker,
  removeMarker as coreRemoveMarker,
  updateMarker as coreUpdateMarker,
  moveTrack as coreMoveTrack,
  setTimelineDuration as coreSetTimelineDuration,
  renameTimeline as coreRenameTimeline,
} from '@timeline/core';

export interface UseTimelineReturn {
  timeline: Timeline;
  
  // Track operations
  addTrack: (track: Track) => void;
  removeTrack: (trackId: ID) => void;
  updateTrack: (track: Track) => void;
  moveTrack: (fromIndex: number, toIndex: number) => void;
  
  // Clip operations
  addClip: (clip: Clip) => void;
  removeClip: (clipId: ID) => void;
  updateClip: (clip: Clip) => void;
  
  // Marker operations
  addMarker: (marker: Marker) => void;
  removeMarker: (markerId: ID) => void;
  updateMarker: (marker: Marker) => void;
  
  // Timeline properties
  setDuration: (duration: number) => void;
  rename: (name: string) => void;
  
  // Direct state setter (for advanced use cases)
  setTimeline: (timeline: Timeline) => void;
}

export function useTimeline(initialTimeline: Timeline): UseTimelineReturn {
  const [timeline, setTimeline] = useState<Timeline>(initialTimeline);
  
  // Track operations
  const addTrack = useCallback((track: Track) => {
    setTimeline(current => coreAddTrack(current, track));
  }, []);
  
  const removeTrack = useCallback((trackId: ID) => {
    setTimeline(current => coreRemoveTrack(current, trackId));
  }, []);
  
  const updateTrack = useCallback((track: Track) => {
    setTimeline(current => coreUpdateTrack(current, track));
  }, []);
  
  const moveTrack = useCallback((fromIndex: number, toIndex: number) => {
    setTimeline(current => coreMoveTrack(current, fromIndex, toIndex));
  }, []);
  
  // Clip operations
  const addClip = useCallback((clip: Clip) => {
    setTimeline(current => coreAddClip(current, clip));
  }, []);
  
  const removeClip = useCallback((clipId: ID) => {
    setTimeline(current => coreRemoveClip(current, clipId));
  }, []);
  
  const updateClip = useCallback((clip: Clip) => {
    setTimeline(current => coreUpdateClip(current, clip));
  }, []);
  
  // Marker operations
  const addMarker = useCallback((marker: Marker) => {
    setTimeline(current => coreAddMarker(current, marker));
  }, []);
  
  const removeMarker = useCallback((markerId: ID) => {
    setTimeline(current => coreRemoveMarker(current, markerId));
  }, []);
  
  const updateMarker = useCallback((marker: Marker) => {
    setTimeline(current => coreUpdateMarker(current, marker));
  }, []);
  
  // Timeline properties
  const setDuration = useCallback((duration: number) => {
    setTimeline(current => coreSetTimelineDuration(current, duration as any));
  }, []);
  
  const rename = useCallback((name: string) => {
    setTimeline(current => coreRenameTimeline(current, name));
  }, []);
  
  return {
    timeline,
    addTrack,
    removeTrack,
    updateTrack,
    moveTrack,
    addClip,
    removeClip,
    updateClip,
    addMarker,
    removeMarker,
    updateMarker,
    setDuration,
    rename,
    setTimeline,
  };
}
