/**
 * useSelection Hook
 * 
 * WHAT THIS DOES:
 * - Manages which clips and tracks are selected
 * - Provides selection operations (select, deselect, clear)
 * - Exposes helper functions to check selection state
 * 
 * WHAT THIS DOES NOT DO:
 * - Render selection UI
 * - Handle mouse events
 * - Manage timeline content
 * 
 * WHY IT EXISTS:
 * - Selection is temporary editing state (separate from timeline)
 * - Multiple components need to know selection state
 * - Enables multi-select operations
 * 
 * MENTAL MODEL:
 * Selection is like highlighting text in a document.
 * It doesn't change the document, just marks what's active.
 */

import { useState, useCallback } from 'react';
import type { SelectionState, ID } from '@timeline/core';
import {
  createSelectionState,
  selectClip as coreSelectClip,
  removeClipFromSelection as coreRemoveClipFromSelection,
  addClipToSelection as coreAddClipToSelection,
  selectTrack as coreSelectTrack,
  removeTrackFromSelection as coreRemoveTrackFromSelection,
  clearSelection as coreClearSelection,
  isClipSelected,
  isTrackSelected,
} from '@timeline/core';

export interface UseSelectionReturn {
  selection: SelectionState;
  
  // Clip selection
  selectClip: (clipId: ID) => void;
  deselectClip: (clipId: ID) => void;
  addClipToSelection: (clipId: ID) => void;
  isClipSelected: (clipId: ID) => boolean;
  
  // Track selection
  selectTrack: (trackId: ID) => void;
  deselectTrack: (trackId: ID) => void;
  isTrackSelected: (trackId: ID) => boolean;
  
  // Clear all
  clearSelection: () => void;
  
  // Direct state setter
  setSelection: (selection: SelectionState) => void;
}

export function useSelection(): UseSelectionReturn {
  const [selection, setSelection] = useState<SelectionState>(
    createSelectionState()
  );
  
  // Clip selection
  const selectClip = useCallback((clipId: ID) => {
    setSelection(current => coreSelectClip(current, clipId));
  }, []);
  
  const deselectClip = useCallback((clipId: ID) => {
    setSelection(current => coreRemoveClipFromSelection(current, clipId));
  }, []);
  
  const addClipToSelection = useCallback((clipId: ID) => {
    setSelection(current => coreAddClipToSelection(current, clipId));
  }, []);
  
  const checkClipSelected = useCallback(
    (clipId: ID) => isClipSelected(selection, clipId),
    [selection]
  );
  
  // Track selection
  const selectTrack = useCallback((trackId: ID) => {
    setSelection(current => coreSelectTrack(current, trackId));
  }, []);
  
  const deselectTrack = useCallback((trackId: ID) => {
    setSelection(current => coreRemoveTrackFromSelection(current, trackId));
  }, []);
  
  const checkTrackSelected = useCallback(
    (trackId: ID) => isTrackSelected(selection, trackId),
    [selection]
  );
  
  // Clear all
  const clearSelection = useCallback(() => {
    setSelection(current => coreClearSelection(current));
  }, []);
  
  return {
    selection,
    selectClip,
    deselectClip,
    addClipToSelection,
    isClipSelected: checkClipSelected,
    selectTrack,
    deselectTrack,
    isTrackSelected: checkTrackSelected,
    clearSelection,
    setSelection,
  };
}
