import { createContext, useContext, useState, ReactNode } from 'react';
import { frame, type Frame } from '@timeline/core';

/**
 * UI Interaction State
 * 
 * Separate from engine state - this is purely for UI interactions.
 * Does NOT integrate with undo/redo.
 */
export interface TimelineUIState {
  /** Current playhead position */
  playhead: Frame;
  
  /** Zoom level (pixels per frame) */
  zoom: number;
  
  /** Whether snapping is enabled */
  snappingEnabled: boolean;
  
  /** Current editing mode */
  editingMode: 'normal' | 'ripple' | 'insert';
  
  /** Set of selected clip IDs */
  selectedClipIds: Set<string>;
}

/**
 * UI Context Actions
 */
export interface TimelineUIActions {
  setPlayhead: (playhead: Frame) => void;
  setZoom: (zoom: number) => void;
  setSnappingEnabled: (enabled: boolean) => void;
  setEditingMode: (mode: 'normal' | 'ripple' | 'insert') => void;
  setSelectedClipIds: (clipIds: Set<string>) => void;
  toggleClipSelection: (clipId: string) => void;
  clearSelection: () => void;
}

/**
 * Combined UI Context
 */
export interface TimelineUIContextValue {
  state: TimelineUIState;
  actions: TimelineUIActions;
}

const TimelineUIContext = createContext<TimelineUIContextValue | null>(null);

/**
 * TimelineUI Provider Props
 */
export interface TimelineUIProviderProps {
  children: ReactNode;
  initialPlayhead?: Frame;
  initialZoom?: number;
  initialSnappingEnabled?: boolean;
  initialEditingMode?: 'normal' | 'ripple' | 'insert';
}

/**
 * TimelineUI Provider
 * 
 * Provides UI interaction state to all timeline components.
 * Separate from engine state.
 */
export function TimelineUIProvider({
  children,
  initialPlayhead = frame(0),
  initialZoom = 1,
  initialSnappingEnabled = true,
  initialEditingMode = 'normal',
}: TimelineUIProviderProps) {
  const [playhead, setPlayhead] = useState<Frame>(initialPlayhead);
  const [zoom, setZoom] = useState(initialZoom);
  const [snappingEnabled, setSnappingEnabled] = useState(initialSnappingEnabled);
  const [editingMode, setEditingMode] = useState<'normal' | 'ripple' | 'insert'>(initialEditingMode);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());

  const toggleClipSelection = (clipId: string) => {
    setSelectedClipIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedClipIds(new Set());
  };

  const value: TimelineUIContextValue = {
    state: {
      playhead,
      zoom,
      snappingEnabled,
      editingMode,
      selectedClipIds,
    },
    actions: {
      setPlayhead,
      setZoom,
      setSnappingEnabled,
      setEditingMode,
      setSelectedClipIds,
      toggleClipSelection,
      clearSelection,
    },
  };

  return (
    <TimelineUIContext.Provider value={value}>
      {children}
    </TimelineUIContext.Provider>
  );
}

/**
 * Hook to access TimelineUI context
 * 
 * @throws Error if used outside TimelineUIProvider
 */
export function useTimelineUI(): TimelineUIContextValue {
  const context = useContext(TimelineUIContext);
  
  if (!context) {
    throw new Error('useTimelineUI must be used within TimelineUIProvider');
  }
  
  return context;
}
