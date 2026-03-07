/**
 * HISTORY ENGINE
 *
 * Snapshot-based undo/redo system for timeline state.
 *
 * Two APIs:
 * - HistoryState + pure functions (createHistory, pushHistory, undo, redo)
 * - HistoryStack class with compression, checkpoints, and persistence
 */

import { TimelineState } from '../types/state';
import type { Transaction } from '../types/operations';
import type { CompressionPolicy } from '../types/compression';
import { DEFAULT_COMPRESSION_POLICY } from '../types/compression';
import { TransactionCompressor } from './transaction-compressor';
import { serializeTimeline, deserializeTimeline } from './serializer';
import { SerializationError } from './serialization-error';

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

// ---------------------------------------------------------------------------
// HistoryStack — Phase 7 Step 3 (compression, checkpoints, persistence)
// ---------------------------------------------------------------------------

export type HistoryEntry = {
  readonly state: TimelineState;
  readonly transaction: Transaction;
};

export class HistoryStack {
  private entries: HistoryEntry[] = [];
  private undoIndex = -1;
  private limit: number;
  private compressor: TransactionCompressor;
  private clock: () => number;
  private checkpoints: Map<string, number> = new Map();

  constructor(
    limit: number = 100,
    policy: CompressionPolicy = DEFAULT_COMPRESSION_POLICY,
    clock: () => number = Date.now,
  ) {
    this.limit = limit;
    this.clock = clock;
    this.compressor = new TransactionCompressor(policy, clock);
  }

  push(entry: HistoryEntry): void {
    if (this.entries.length === 0) {
      this.entries.push(entry);
      this.undoIndex = 0;
      return;
    }
    this.entries.push(entry);
    if (this.entries.length > this.limit) {
      this.entries.shift();
      this.undoIndex = this.entries.length - 1;
    } else {
      this.undoIndex = this.entries.length - 1;
    }
  }

  pushWithCompression(entry: HistoryEntry, transaction: Transaction): void {
    const now = this.clock();
    if (this.compressor.shouldCompress(transaction, now)) {
      if (this.entries.length > 0) {
        this.entries[this.entries.length - 1] = entry;
        this.compressor.record(transaction, now);
        return;
      }
    }
    this.push(entry);
    this.compressor.record(transaction, now);
  }

  resetCompression(): void {
    this.compressor.reset();
  }

  undo(): TimelineState | null {
    if (this.undoIndex <= 0) return null;
    this.undoIndex--;
    return this.entries[this.undoIndex]!.state;
  }

  redo(): TimelineState | null {
    if (this.undoIndex >= this.entries.length - 1) return null;
    this.undoIndex++;
    return this.entries[this.undoIndex]!.state;
  }

  getCurrentState(): TimelineState | null {
    if (this.entries.length === 0) return null;
    return this.entries[this.undoIndex]!.state;
  }

  canUndo(): boolean {
    return this.undoIndex > 0;
  }

  canRedo(): boolean {
    return this.undoIndex < this.entries.length - 1;
  }

  saveCheckpoint(name: string): void {
    this.checkpoints.set(name, this.undoIndex);
  }

  restoreCheckpoint(name: string): HistoryEntry | null {
    const idx = this.checkpoints.get(name);
    if (idx === undefined) return null;
    if (idx >= this.entries.length) return null;
    return this.entries[idx] ?? null;
  }

  listCheckpoints(): string[] {
    return [...this.checkpoints.keys()];
  }

  clearCheckpoint(name: string): void {
    this.checkpoints.delete(name);
  }

  serialize(): string {
    const payload = {
      version: 1,
      undoIndex: this.undoIndex,
      entries: this.entries.map((e) => ({
        state: serializeTimeline(e.state),
        transaction: e.transaction,
      })),
    };
    return JSON.stringify(payload);
  }

  static deserialize(
    raw: string,
    limit?: number,
    policy: CompressionPolicy = DEFAULT_COMPRESSION_POLICY,
    clock: () => number = Date.now,
  ): HistoryStack {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      throw new SerializationError(msg);
    }
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed)) {
      throw new SerializationError('Invalid history structure');
    }
    const obj = parsed as { version: number; undoIndex: number; entries: Array<{ state: string; transaction: Transaction }> };
    if (obj.version !== 1) {
      throw new SerializationError(`Unknown history version: ${obj.version}`);
    }
    if (!Array.isArray(obj.entries)) {
      throw new SerializationError('Missing entries');
    }
    const entries: HistoryEntry[] = [];
    for (const e of obj.entries) {
      if (typeof e.state !== 'string' || !e.transaction) {
        throw new SerializationError('Invalid entry');
      }
      entries.push({
        state: deserializeTimeline(e.state),
        transaction: e.transaction,
      });
    }
    const stack = new HistoryStack(limit ?? entries.length + 50, policy, clock);
    stack.entries = entries;
    stack.undoIndex =
      entries.length === 0
        ? -1
        : Math.min(Math.max(0, obj.undoIndex), entries.length - 1);
    return stack;
  }

  softLimitWarning(): boolean {
    return this.entries.length >= this.limit * 0.8;
  }
}
