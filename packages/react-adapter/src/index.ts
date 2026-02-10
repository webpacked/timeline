/**
 * @timeline/react-adapter
 * 
 * React hooks for @timeline/core
 * 
 * This package provides React state management for timeline operations.
 * All hooks wrap core functions and maintain immutability.
 */

export { useTimeline } from './useTimeline';
export type { UseTimelineReturn } from './useTimeline';

export { useViewport } from './useViewport';
export type { UseViewportReturn } from './useViewport';

export { useSelection } from './useSelection';
export type { UseSelectionReturn } from './useSelection';

export { usePlayhead } from './usePlayhead';
export type { UsePlayheadReturn } from './usePlayhead';

// Re-export core types for convenience
export type {
  Timeline,
  Track,
  Clip,
  Marker,
  PlayheadState,
  SelectionState,
  ViewportState,
  TimeMs,
  ID,
} from '@timeline/core';
