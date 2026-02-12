/**
 * HISTORY ENGINE
 * 
 * Snapshot-based undo/redo system for timeline state.
 * 
 * WHAT IS THE HISTORY ENGINE?
 * - Stores immutable snapshots of timeline state
 * - Provides undo/redo functionality
 * - Prevents state corruption
 * 
 * HOW IT WORKS:
 * - past: Array of previous states
 * - present: Current state
 * - future: Array of states that can be redone
 * 
 * WHY SNAPSHOTS?
 * - Simple and reliable (no complex diffing)
 * - Guaranteed to restore exact state
 * - No risk of partial corruption
 * - Easy to implement and test
 * 
 * USAGE:
 * ```typescript
 * let history = createHistory(initialState);
 * history = pushHistory(history, newState);
 * history = undo(history);
 * history = redo(history);
 * ```
 * 
 * ALL FUNCTIONS ARE PURE:
 * - Take history as input
 * - Return new history as output
 * - Never mutate input
 */

import { TimelineState } from '../types/state';

/**
 * HistoryState - The history container
 * 
 * Contains:
 * - past: Array of previous states (oldest first)
 * - present: Current state
 * - future: Array of states that can be redone (newest first)
 * - limit: Maximum number of past states to keep
 */
export interface HistoryState {
  past: TimelineState[];
  present: TimelineState;
  future: TimelineState[];
  limit: number;
}

/**
 * Create a new history state
 * 
 * @param initialState - Initial timeline state
 * @param limit - Maximum number of past states to keep (default: 50)
 * @returns A new HistoryState
 */
export function createHistory(
  initialState: TimelineState,
  limit: number = 50
): HistoryState {
  return {
    past: [],
    present: initialState,
    future: [],
    limit,
  };
}

/**
 * Push a new state to history
 * 
 * Moves current state to past, sets new state as present,
 * and clears future (can't redo after new action).
 * 
 * @param history - Current history state
 * @param newState - New timeline state to push
 * @returns New history state with new state pushed
 */
export function pushHistory(
  history: HistoryState,
  newState: TimelineState
): HistoryState {
  const newPast = [...history.past, history.present];
  
  // Enforce limit by removing oldest states
  if (newPast.length > history.limit) {
    newPast.shift();
  }
  
  return {
    ...history,
    past: newPast,
    present: newState,
    future: [], // Clear future on new action
  };
}

/**
 * Undo the last action
 * 
 * Moves current state to future, pops last state from past
 * and sets it as present.
 * 
 * @param history - Current history state
 * @returns New history state with undo applied
 */
export function undo(history: HistoryState): HistoryState {
  if (history.past.length === 0) {
    // Nothing to undo
    return history;
  }
  
  const newPast = [...history.past];
  const previous = newPast.pop()!;
  
  return {
    ...history,
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

/**
 * Redo the last undone action
 * 
 * Moves current state to past, pops first state from future
 * and sets it as present.
 * 
 * @param history - Current history state
 * @returns New history state with redo applied
 */
export function redo(history: HistoryState): HistoryState {
  if (history.future.length === 0) {
    // Nothing to redo
    return history;
  }
  
  const newFuture = [...history.future];
  const next = newFuture.shift()!;
  
  return {
    ...history,
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}

/**
 * Check if undo is available
 * 
 * @param history - Current history state
 * @returns true if undo is available
 */
export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0;
}

/**
 * Check if redo is available
 * 
 * @param history - Current history state
 * @returns true if redo is available
 */
export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0;
}

/**
 * Get the current state from history
 * 
 * @param history - Current history state
 * @returns The current timeline state
 */
export function getCurrentState(history: HistoryState): TimelineState {
  return history.present;
}

/**
 * Clear history
 * 
 * Keeps the current state but clears past and future.
 * 
 * @param history - Current history state
 * @returns New history state with history cleared
 */
export function clearHistory(history: HistoryState): HistoryState {
  return {
    ...history,
    past: [],
    future: [],
  };
}
