/**
 * DISPATCH ORCHESTRATION
 * 
 * Coordinates operation execution, validation, and history management.
 * 
 * WHAT IS THE DISPATCHER?
 * - Executes operations on state
 * - Validates the resulting state
 * - Commits valid states to history
 * - Rejects invalid states with errors
 * 
 * WHY A DISPATCHER?
 * - Enforces validation before mutation
 * - Prevents invalid states from entering history
 * - Provides consistent error handling
 * - Separates concerns (operations vs validation vs history)
 * 
 * CRITICAL FLOW:
 * 1. Execute operation (pure function)
 * 2. Validate resulting state
 * 3. If valid: push to history, return success
 * 4. If invalid: return errors, state unchanged
 * 
 * USAGE:
 * ```typescript
 * const result = dispatch(history, (state) => addClip(state, trackId, clip));
 * if (result.success) {
 *   history = result.history;
 * } else {
 *   console.error('Operation failed:', result.errors);
 * }
 * ```
 */

import { HistoryState, pushHistory, getCurrentState } from './history';
import { TimelineState } from '../types/state';
import { ValidationError } from '../types/validation';
import { validateTimeline } from '../systems/validation';

/**
 * Operation - A pure function that transforms timeline state
 */
export type Operation = (state: TimelineState) => TimelineState;

/**
 * DispatchResult - The result of a dispatch operation
 * 
 * Contains:
 * - success: Whether the operation succeeded
 * - history: Updated history (if success) or unchanged (if failure)
 * - errors: Validation errors (if failure)
 */
export interface DispatchResult {
  /** Whether the operation succeeded */
  success: boolean;
  
  /** Updated history state */
  history: HistoryState;
  
  /** Validation errors (if operation failed) */
  errors?: ValidationError[];
}

/**
 * Dispatch an operation
 * 
 * Executes the operation, validates the result, and commits to history
 * if valid. Returns errors if validation fails.
 * 
 * @param history - Current history state
 * @param operation - Operation to execute
 * @returns Dispatch result with success status and updated history
 */
export function dispatch(history: HistoryState, operation: Operation): DispatchResult {
  // Get current state
  const currentState = getCurrentState(history);
  
  // Execute operation
  const newState = operation(currentState);
  
  // Validate resulting state
  const validationResult = validateTimeline(newState);
  
  if (!validationResult.valid) {
    // Validation failed, return errors
    return {
      success: false,
      history, // Return unchanged history
      errors: validationResult.errors,
    };
  }
  
  // Validation passed, commit to history
  const newHistory = pushHistory(history, newState);
  
  return {
    success: true,
    history: newHistory,
  };
}

/**
 * Dispatch multiple operations as a batch
 * 
 * Executes all operations in sequence. If any operation fails validation,
 * the entire batch is rejected and state remains unchanged.
 * 
 * This is useful for atomic operations that must all succeed or all fail.
 * 
 * @param history - Current history state
 * @param operations - Array of operations to execute
 * @returns Dispatch result with success status and updated history
 */
export function dispatchBatch(
  history: HistoryState,
  operations: Operation[]
): DispatchResult {
  // Compose all operations into a single operation
  const composedOperation: Operation = (state) => {
    let currentState = state;
    for (const operation of operations) {
      currentState = operation(currentState);
    }
    return currentState;
  };
  
  // Dispatch the composed operation
  return dispatch(history, composedOperation);
}
