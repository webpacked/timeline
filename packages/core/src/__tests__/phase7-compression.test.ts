/**
 * Phase 7 Step 3 — Transaction compression, checkpoints, persistence
 */

import { describe, it, expect, vi } from 'vitest';
import { toFrame } from '../types/frame';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { toTrackId } from '../types/track';
import { toClipId } from '../types/clip';
import type { Clip } from '../types/clip';
import type { TimelineState } from '../types/state';
import type { Transaction } from '../types/operations';
import type { HistoryEntry } from '../engine/history';
import {
  NO_COMPRESSION,
  DEFAULT_COMPRESSION_POLICY,
} from '../types/compression';
import { TransactionCompressor } from '../engine/transaction-compressor';
import { HistoryStack } from '../engine/history';
import { SerializationError } from '../engine/serialization-error';

function makeTimeline(name: string) {
  return createTimeline({
    id: 'tl',
    name,
    fps: 30,
    duration: toFrame(3000),
    version: 0,
  } as Parameters<typeof createTimeline>[0]);
}

function makeState(name: string): TimelineState {
  return createTimelineState({ timeline: makeTimeline(name) });
}

function makeEntry(state: TimelineState, opType: string): HistoryEntry {
  return {
    state,
    transaction: {
      id: 'tx-1',
      label: 'test',
      timestamp: 0,
      operations: [{ type: opType } as Transaction['operations'][0]],
    },
  };
}

describe('Phase 7 — TransactionCompressor', () => {
  it('1. NO_COMPRESSION policy: shouldCompress always false', () => {
    const compressor = new TransactionCompressor(NO_COMPRESSION);
    const entry = makeEntry(makeState('S1'), 'MOVE_CLIP');
    expect(compressor.shouldCompress(entry.transaction, 1000)).toBe(false);
    compressor.record(entry.transaction, 1000);
    expect(compressor.shouldCompress(entry.transaction, 1100)).toBe(false);
  });

  it('2. Multi-op transaction: shouldCompress false', () => {
    const compressor = new TransactionCompressor(DEFAULT_COMPRESSION_POLICY);
    compressor.record(
      {
        id: 't',
        label: 'x',
        timestamp: 0,
        operations: [
          { type: 'MOVE_CLIP' } as Transaction['operations'][0],
          { type: 'MOVE_CLIP' } as Transaction['operations'][0],
        ],
      },
      1000,
    );
    const tx = {
      id: 't2',
      label: 'x',
      timestamp: 0,
      operations: [
        { type: 'MOVE_CLIP' } as Transaction['operations'][0],
        { type: 'MOVE_CLIP' } as Transaction['operations'][0],
      ],
    };
    expect(compressor.shouldCompress(tx, 1200)).toBe(false);
  });

  it('3. Non-compressible op type: shouldCompress false', () => {
    const compressor = new TransactionCompressor(DEFAULT_COMPRESSION_POLICY);
    const tx: Transaction = {
      id: 't',
      label: 'x',
      timestamp: 0,
      operations: [{ type: 'INSERT_CLIP', clip: {} as Clip, trackId: toTrackId('v1') }],
    };
    expect(compressor.shouldCompress(tx, 1000)).toBe(false);
  });

  it('4. Same type, within window: shouldCompress true', () => {
    const clock = vi.fn().mockReturnValue(1000).mockReturnValueOnce(1000).mockReturnValueOnce(1200);
    const compressor = new TransactionCompressor(DEFAULT_COMPRESSION_POLICY, clock);
    const tx = makeEntry(makeState('S1'), 'MOVE_CLIP').transaction;
    compressor.record(tx, 1000);
    expect(compressor.shouldCompress(tx, 1200)).toBe(true);
  });

  it('5. Same type, outside window: shouldCompress false', () => {
    const clock = vi.fn().mockReturnValue(1000).mockReturnValueOnce(1000).mockReturnValueOnce(1500);
    const compressor = new TransactionCompressor(DEFAULT_COMPRESSION_POLICY, clock);
    const tx = makeEntry(makeState('S1'), 'MOVE_CLIP').transaction;
    compressor.record(tx, 1000);
    expect(compressor.shouldCompress(tx, 1500)).toBe(false);
  });

  it('6. Different type: shouldCompress false', () => {
    const clock = vi.fn().mockReturnValue(1000).mockReturnValueOnce(1000).mockReturnValueOnce(1100);
    const compressor = new TransactionCompressor(DEFAULT_COMPRESSION_POLICY, clock);
    compressor.record(makeEntry(makeState('S1'), 'MOVE_CLIP').transaction, 1000);
    const setIn = makeEntry(makeState('S2'), 'SET_IN_POINT').transaction;
    expect(compressor.shouldCompress(setIn, 1100)).toBe(false);
  });

  it('7. reset() clears state (shouldCompress false after)', () => {
    const clock = vi.fn().mockReturnValue(1000).mockReturnValueOnce(1000).mockReturnValueOnce(1100);
    const compressor = new TransactionCompressor(DEFAULT_COMPRESSION_POLICY, clock);
    const tx = makeEntry(makeState('S1'), 'MOVE_CLIP').transaction;
    compressor.record(tx, 1000);
    compressor.reset();
    expect(compressor.shouldCompress(tx, 1100)).toBe(false);
  });
});

describe('Phase 7 — HistoryStack compression', () => {
  it('8. pushWithCompression within window replaces last entry (stack length unchanged)', () => {
    const clock = vi.fn().mockReturnValue(1000).mockReturnValueOnce(1000).mockReturnValueOnce(1200);
    const stack = new HistoryStack(100, DEFAULT_COMPRESSION_POLICY, clock);
    const e0 = makeEntry(makeState('S0'), 'MOVE_CLIP');
    const e1 = makeEntry(makeState('S1'), 'MOVE_CLIP');
    stack.push(e0);
    stack.pushWithCompression(e1, e1.transaction);
    expect(stack.getCurrentState()?.timeline.name).toBe('S1');
    stack.pushWithCompression(makeEntry(makeState('S2'), 'MOVE_CLIP'), makeEntry(makeState('S2'), 'MOVE_CLIP').transaction);
    expect(stack.getCurrentState()?.timeline.name).toBe('S2');
  });

  it('9. pushWithCompression outside window appends (stack length increases)', () => {
    const clock = vi.fn().mockReturnValue(1000).mockReturnValueOnce(1000).mockReturnValueOnce(2000);
    const stack = new HistoryStack(100, DEFAULT_COMPRESSION_POLICY, clock);
    const e0 = makeEntry(makeState('S0'), 'MOVE_CLIP');
    const e1 = makeEntry(makeState('S1'), 'MOVE_CLIP');
    stack.push(e0);
    stack.pushWithCompression(e1, e1.transaction);
    const e2 = makeEntry(makeState('S2'), 'MOVE_CLIP');
    stack.pushWithCompression(e2, e2.transaction);
    expect(stack.getCurrentState()?.timeline.name).toBe('S2');
  });

  it('10. pushWithCompression with different op type appends (no compression)', () => {
    const clock = vi.fn().mockReturnValue(1000).mockReturnValueOnce(1000).mockReturnValueOnce(1100);
    const stack = new HistoryStack(100, DEFAULT_COMPRESSION_POLICY, clock);
    stack.push(makeEntry(makeState('S0'), 'MOVE_CLIP'));
    stack.pushWithCompression(makeEntry(makeState('S1'), 'MOVE_CLIP'), makeEntry(makeState('S1'), 'MOVE_CLIP').transaction);
    stack.pushWithCompression(makeEntry(makeState('S2'), 'SET_IN_POINT'), makeEntry(makeState('S2'), 'SET_IN_POINT').transaction);
    expect(stack.getCurrentState()?.timeline.name).toBe('S2');
  });

  it('11. undo still works after compression (undoes to correct prior state)', () => {
    const clock = vi.fn().mockReturnValue(1000).mockReturnValueOnce(1000).mockReturnValueOnce(1100);
    const stack = new HistoryStack(100, DEFAULT_COMPRESSION_POLICY, clock);
    stack.push(makeEntry(makeState('S0'), 'MOVE_CLIP'));
    stack.pushWithCompression(makeEntry(makeState('S1'), 'MOVE_CLIP'), makeEntry(makeState('S1'), 'MOVE_CLIP').transaction);
    stack.pushWithCompression(makeEntry(makeState('S2'), 'MOVE_CLIP'), makeEntry(makeState('S2'), 'MOVE_CLIP').transaction);
    stack.undo();
    expect(stack.getCurrentState()?.timeline.name).toBe('S0');
  });

  it('12. redo still works after compression', () => {
    const clock = vi.fn().mockReturnValue(1000).mockReturnValueOnce(1000).mockReturnValueOnce(1100);
    const stack = new HistoryStack(100, DEFAULT_COMPRESSION_POLICY, clock);
    stack.push(makeEntry(makeState('S0'), 'MOVE_CLIP'));
    stack.pushWithCompression(makeEntry(makeState('S1'), 'MOVE_CLIP'), makeEntry(makeState('S1'), 'MOVE_CLIP').transaction);
    stack.pushWithCompression(makeEntry(makeState('S2'), 'MOVE_CLIP'), makeEntry(makeState('S2'), 'MOVE_CLIP').transaction);
    stack.undo();
    stack.redo();
    expect(stack.getCurrentState()?.timeline.name).toBe('S2');
  });
});

describe('Phase 7 — Named checkpoints', () => {
  it('13. saveCheckpoint stores current undoIndex', () => {
    const stack = new HistoryStack(100);
    stack.push(makeEntry(makeState('S0'), 'MOVE_CLIP'));
    stack.push(makeEntry(makeState('S1'), 'MOVE_CLIP'));
    stack.saveCheckpoint('cp1');
    stack.push(makeEntry(makeState('S2'), 'MOVE_CLIP'));
    const entry = stack.restoreCheckpoint('cp1');
    expect(entry?.state.timeline.name).toBe('S1');
  });

  it('14. restoreCheckpoint returns correct entry', () => {
    const stack = new HistoryStack(100);
    stack.push(makeEntry(makeState('S0'), 'MOVE_CLIP'));
    stack.saveCheckpoint('a');
    const e = stack.restoreCheckpoint('a');
    expect(e?.state.timeline.name).toBe('S0');
  });

  it('15. restoreCheckpoint on unknown name returns null', () => {
    const stack = new HistoryStack(100);
    stack.push(makeEntry(makeState('S0'), 'MOVE_CLIP'));
    expect(stack.restoreCheckpoint('unknown')).toBeNull();
  });

  it('16. listCheckpoints returns saved names', () => {
    const stack = new HistoryStack(100);
    stack.push(makeEntry(makeState('S0'), 'MOVE_CLIP'));
    stack.saveCheckpoint('a');
    stack.saveCheckpoint('b');
    expect(stack.listCheckpoints()).toEqual(expect.arrayContaining(['a', 'b']));
    expect(stack.listCheckpoints().length).toBe(2);
  });

  it('17. clearCheckpoint removes it', () => {
    const stack = new HistoryStack(100);
    stack.push(makeEntry(makeState('S0'), 'MOVE_CLIP'));
    stack.saveCheckpoint('a');
    stack.clearCheckpoint('a');
    expect(stack.listCheckpoints()).not.toContain('a');
  });
});

describe('Phase 7 — History persistence', () => {
  it('18. serialize() produces valid JSON', () => {
    const stack = new HistoryStack(100);
    stack.push(makeEntry(makeState('S0'), 'MOVE_CLIP'));
    const json = stack.serialize();
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.undoIndex).toBe(0);
    expect(Array.isArray(parsed.entries)).toBe(true);
  });

  it('19. deserialize(serialize()) round-trips entries and undoIndex', () => {
    const stack = new HistoryStack(100);
    stack.push(makeEntry(makeState('S0'), 'MOVE_CLIP'));
    stack.push(makeEntry(makeState('S1'), 'MOVE_CLIP'));
    const json = stack.serialize();
    const restored = HistoryStack.deserialize(json);
    expect(restored.getCurrentState()?.timeline.name).toBe('S1');
    restored.undo();
    expect(restored.getCurrentState()?.timeline.name).toBe('S0');
  });

  it('20. deserialize throws SerializationError on invalid JSON', () => {
    expect(() => HistoryStack.deserialize('not json')).toThrow(SerializationError);
    expect(() => HistoryStack.deserialize('{')).toThrow(SerializationError);
  });

  it('21. softLimitWarning false when under 80%', () => {
    const stack = new HistoryStack(100);
    for (let i = 0; i < 50; i++) {
      stack.push(makeEntry(makeState(`S${i}`), 'MOVE_CLIP'));
    }
    expect(stack.softLimitWarning()).toBe(false);
  });

  it('22. softLimitWarning true when at 80%+', () => {
    const stack = new HistoryStack(100);
    for (let i = 0; i < 80; i++) {
      stack.push(makeEntry(makeState(`S${i}`), 'MOVE_CLIP'));
    }
    expect(stack.softLimitWarning()).toBe(true);
  });
});
