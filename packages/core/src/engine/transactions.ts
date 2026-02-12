/**
 * TRANSACTION SYSTEM
 * 
 * Batches multiple operations into a single history entry.
 * 
 * WHY TRANSACTIONS?
 * - Advanced edits (ripple, roll, etc.) involve multiple state changes
 * - Each change should not create separate undo steps
 * - Transaction commits as single atomic operation
 * 
 * DESIGN:
 * - Transactions are ephemeral (not stored in timeline state)
 * - All operations validated before commit
 * - Rollback returns to initial state
 * - Single history snapshot on commit
 * 
 * USAGE:
 * ```typescript
 * const tx = beginTransaction(state);
 * tx = applyOperation(tx, (s) => moveClip(s, 'clip1', frame(100)));
 * tx = applyOperation(tx, (s) => moveClip(s, 'clip2', frame(200)));
 * const result = commitTransaction(tx);
 * ```
 */

import { TimelineState } from '../types/state';
import { ValidationResult } from '../types/validation';

/**
 * Operation function - takes state, returns new state
 */
export type Operation = (state: TimelineState) => TimelineState;

/**
 * Transaction context - ephemeral batching state
 */
export interface TransactionContext {
  /** Initial state before any operations */
  initialState: TimelineState;
  
  /** Current state after applied operations */
  currentState: TimelineState;
  
  /** Operations applied so far */
  operations: Operation[];
  
  /** Whether transaction has been committed or rolled back */
  finalized: boolean;
}

/**
 * Transaction result
 */
export interface TransactionResult {
  success: boolean;
  state: TimelineState;
  errors?: ValidationResult[];
}

/**
 * Begin a new transaction
 * 
 * @param state - Initial timeline state
 * @returns Transaction context
 */
export function beginTransaction(state: TimelineState): TransactionContext {
  return {
    initialState: state,
    currentState: state,
    operations: [],
    finalized: false,
  };
}

/**
 * Apply an operation to the transaction
 * 
 * Operations are applied immediately but not validated until commit.
 * This allows building complex state transformations.
 * 
 * @param tx - Transaction context
 * @param operation - Operation to apply
 * @returns Updated transaction context
 */
export function applyOperation(
  tx: TransactionContext,
  operation: Operation
): TransactionContext {
  if (tx.finalized) {
    throw new Error('Cannot apply operation to finalized transaction');
  }
  
  const newState = operation(tx.currentState);
  
  return {
    ...tx,
    currentState: newState,
    operations: [...tx.operations, operation],
  };
}

/**
 * Commit the transaction
 * 
 * Returns the final state if successful.
 * The caller is responsible for:
 * - Validating the final state
 * - Recording in history
 * 
 * @param tx - Transaction context
 * @returns Final state
 */
export function commitTransaction(tx: TransactionContext): TimelineState {
  if (tx.finalized) {
    throw new Error('Transaction already finalized');
  }
  
  // Mark as finalized
  tx.finalized = true;
  
  // Return final state
  // Note: Validation happens at dispatch layer, not here
  return tx.currentState;
}

/**
 * Rollback the transaction
 * 
 * Returns to the initial state, discarding all operations.
 * 
 * @param tx - Transaction context
 * @returns Initial state
 */
export function rollbackTransaction(tx: TransactionContext): TimelineState {
  if (tx.finalized) {
    throw new Error('Transaction already finalized');
  }
  
  // Mark as finalized
  tx.finalized = true;
  
  // Return initial state
  return tx.initialState;
}

/**
 * Get the number of operations in the transaction
 * 
 * @param tx - Transaction context
 * @returns Number of operations
 */
export function getOperationCount(tx: TransactionContext): number {
  return tx.operations.length;
}
