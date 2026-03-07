/**
 * HISTORY ENGINE TESTS — Phase 0
 *
 * Verifies that the HistoryStack correctly tracks undo/redo with
 * the pure, immutable HistoryState functions.
 */

import { describe, it, expect } from 'vitest';
import {
  createHistory,
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  getCurrentState,
  clearHistory,
} from '../engine/history';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { toFrame } from '../types/frame';

function makeTimeline(name: string, version = 0) {
  return createTimeline({ id: 'tl', name, fps: 30, duration: toFrame(3000), version } as any);
}

function makeState(name: string) {
  return createTimelineState({ timeline: makeTimeline(name) });
}

describe('createHistory', () => {
  it('creates history with no past or future', () => {
    const h = createHistory(makeState('S0'));
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(getCurrentState(h).timeline.name).toBe('S0');
  });
});

describe('pushHistory', () => {
  it('moves present to past and sets new state as present', () => {
    let h = createHistory(makeState('S0'));
    h = pushHistory(h, makeState('S1'));
    expect(getCurrentState(h).timeline.name).toBe('S1');
    expect(canUndo(h)).toBe(true);
  });

  it('clears future when a new state is pushed', () => {
    let h = createHistory(makeState('S0'));
    h = pushHistory(h, makeState('S1'));
    h = undo(h);                      // future = [S1]
    h = pushHistory(h, makeState('S2')); // future should clear
    expect(canRedo(h)).toBe(false);
    expect(getCurrentState(h).timeline.name).toBe('S2');
  });

  it('respects the history limit', () => {
    let h = createHistory(makeState('S0'), 3); // limit to 3 past entries
    h = pushHistory(h, makeState('S1'));
    h = pushHistory(h, makeState('S2'));
    h = pushHistory(h, makeState('S3'));
    h = pushHistory(h, makeState('S4')); // oldest (S0) should be dropped
    // Can still undo 3 times to reach S1
    h = undo(h); // → S3
    h = undo(h); // → S2
    h = undo(h); // → S1
    expect(getCurrentState(h).timeline.name).toBe('S1');
    expect(canUndo(h)).toBe(false); // S0 was evicted
  });
});

describe('undo / redo', () => {
  it('undo returns to previous state', () => {
    let h = createHistory(makeState('S0'));
    h = pushHistory(h, makeState('S1'));
    h = undo(h);
    expect(getCurrentState(h).timeline.name).toBe('S0');
  });

  it('redo re-applies an undone state', () => {
    let h = createHistory(makeState('S0'));
    h = pushHistory(h, makeState('S1'));
    h = undo(h);
    h = redo(h);
    expect(getCurrentState(h).timeline.name).toBe('S1');
  });

  it('undo is a no-op when there is no past', () => {
    const h = createHistory(makeState('S0'));
    const h2 = undo(h);
    expect(h2).toBe(h); // reference equality — nothing changed
  });

  it('redo is a no-op when there is no future', () => {
    const h = createHistory(makeState('S0'));
    const h2 = redo(h);
    expect(h2).toBe(h);
  });

  it('multiple undo/redo cycles work correctly', () => {
    let h = createHistory(makeState('A'));
    h = pushHistory(h, makeState('B'));
    h = pushHistory(h, makeState('C'));

    h = undo(h); expect(getCurrentState(h).timeline.name).toBe('B');
    h = undo(h); expect(getCurrentState(h).timeline.name).toBe('A');
    h = redo(h); expect(getCurrentState(h).timeline.name).toBe('B');
    h = redo(h); expect(getCurrentState(h).timeline.name).toBe('C');
  });
});

describe('clearHistory', () => {
  it('resets past and future but keeps current state', () => {
    let h = createHistory(makeState('S0'));
    h = pushHistory(h, makeState('S1'));
    h = clearHistory(h);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(getCurrentState(h).timeline.name).toBe('S1');
  });
});
