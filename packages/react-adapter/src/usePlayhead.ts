/**
 * usePlayhead Hook
 * 
 * WHAT THIS DOES:
 * - Manages playhead position (current time)
 * - Handles hover playhead (preview position)
 * - Provides simple setters for playhead state
 * 
 * WHAT THIS DOES NOT DO:
 * - Handle playback (play/pause/seek)
 * - Render the playhead line
 * - Manage timeline content
 * 
 * WHY IT EXISTS:
 * - Playhead is separate from timeline content
 * - Multiple components need playhead position
 * - Enables preview (hover) playhead
 * 
 * MENTAL MODEL:
 * The playhead is like a cursor in a text editor.
 * It shows where you are, but doesn't change the content.
 */

import { useState, useCallback } from 'react';
import type { PlayheadState, TimeMs } from '@timeline/core';
import { createPlayheadState } from '@timeline/core';

export interface UsePlayheadReturn {
  playhead: PlayheadState;
  
  // Playhead mutations
  setPlayheadTime: (time: TimeMs) => void;
  setHoverTime: (time: TimeMs | undefined) => void;
  clearHover: () => void;
  
  // Direct state setter
  setPlayhead: (playhead: PlayheadState) => void;
}

export function usePlayhead(initialTime?: TimeMs): UsePlayheadReturn {
  const [playhead, setPlayhead] = useState<PlayheadState>(() =>
    createPlayheadState(initialTime ?? (0 as TimeMs))
  );
  
  const setPlayheadTime = useCallback((time: TimeMs) => {
    setPlayhead(current => ({
      ...current,
      current: time,
    }));
  }, []);
  
  const setHoverTime = useCallback((time: TimeMs | undefined) => {
    setPlayhead(current => {
      if (time === undefined) {
        return { current: current.current };
      }
      return {
        ...current,
        hover: time,
      };
    });
  }, []);
  
  const clearHover = useCallback(() => {
    setPlayhead(current => ({
      current: current.current,
    }));
  }, []);
  
  return {
    playhead,
    setPlayheadTime,
    setHoverTime,
    clearHover,
    setPlayhead,
  };
}
