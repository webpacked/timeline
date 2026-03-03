/**
 * TimelineEngine — Phase 1 Tests
 *
 * 27 tests covering the full engine contract:
 *   subscribe / getSnapshot    — useSyncExternalStore interface
 *   dispatch()                 — accept / reject
 *   undo() / redo()            — history
 *   provisional state          — handlePointerMove / Up
 *   activateTool()             — cursor + onCancel
 *   handlePointerDown          — cursor notify
 *   handleKeyDown              — tx dispatch + null no-notify
 *   setPixelsPerFrame          — no notify (ppf not in snapshot)
 *   setPlayheadFrame           — notify
 *   NoOpTool default           — engine default
 *   notify() storm guard       — exactly ONE notify per handlePointerMove
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimelineEngine, type EngineSnapshot } from '../engine';
import {
  createTimelineState,
  createTimeline,
  toFrame,
  toTimecode,
  NoOpTool,
  toToolId,
} from '@timeline/core';
import type {
  ITool,
  ToolContext,
  TimelinePointerEvent,
  TimelineKeyEvent,
  Modifiers,
  ProvisionalState,
  Transaction,
  TimelineState,
} from '@timeline/core';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeState(): TimelineState {
  return createTimelineState({
    timeline: createTimeline({
      id:             'tl-1',
      name:           'Test Timeline',
      fps:            30,
      duration:       toFrame(9000),
      startTimecode:  toTimecode('00:00:00:00'),
      tracks:         [],
    }),
  });
}

const noModifiers: Modifiers = { shift: false, alt: false, ctrl: false, meta: false };

function makePointerEvent(frame = 0): TimelinePointerEvent {
  return {
    frame:    toFrame(frame),
    trackId:  null,
    clipId:   null,
    x:        0,
    y:        0,
    buttons:  1,
    shiftKey: false,
    altKey:   false,
    metaKey:  false,
  };
}

function makeKeyEvent(key = 'x'): TimelineKeyEvent {
  return { key, code: `Key${key.toUpperCase()}`, shiftKey: false, altKey: false, metaKey: false };
}

/** Minimal valid transaction — rename the timeline. */
function makeRenameTx(name: string): Transaction {
  return {
    id:         `rename-${name}`,
    label:      `Rename to ${name}`,
    timestamp:  0,
    operations: [{ type: 'RENAME_TIMELINE', name }],
  };
}

/** Transaction that validators reject — MOVE_CLIP on a non-existent clipId. */
function makeRejectTx(): Transaction {
  return {
    id:         'reject-tx',
    label:      'Invalid move',
    timestamp:  0,
    operations: [{ type: 'MOVE_CLIP', clipId: 'ghost-id' as any, newTimelineStart: toFrame(0) }],
  };
}

/** A fake ProvisionalState with isProvisional: true. */
function makeProvisional(): ProvisionalState {
  return { clips: [], isProvisional: true };
}

/** Helper to build a custom tool that overrides specific handlers. */
function makeTool(id: string, overrides: Partial<ITool>): ITool {
  return { ...NoOpTool, id: toToolId(id), ...overrides };
}

// ── Engine factory: starts with two registered tools ────────────────────────

function makeEngine() {
  const state = makeState();
  // Two tools: NoOpTool (default) + a placeholder "alt" tool
  const altTool = makeTool('alt', {});
  return new TimelineEngine(state, [NoOpTool, altTool], toToolId('noop'));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('subscribe / getSnapshot', () => {
  it('getSnapshot() returns the same object reference until notify() fires', () => {
    const engine = makeEngine();
    const snap1 = engine.getSnapshot();
    const snap2 = engine.getSnapshot();
    expect(snap1).toBe(snap2);   // stable ref before any change
  });

  it('subscribe() returns an unsubscribe function that stops future notifications', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    const unsub = engine.subscribe(listener);
    unsub();
    engine.dispatch(makeRenameTx('after-unsub'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('listeners are called once per accepted dispatch()', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.dispatch(makeRenameTx('renamed'));
    expect(listener).toHaveBeenCalledOnce();
  });

  it('listeners are NOT called when dispatch() rejects', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    // MOVE_CLIP on a non-existent clipId — validators reject this before applying
    engine.dispatch(makeRejectTx());
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('dispatch()', () => {
  it('accepted tx updates snapshot.state and snapshot.canUndo', () => {
    const engine = makeEngine();
    engine.dispatch(makeRenameTx('NewName'));
    const snap = engine.getSnapshot();
    expect(snap.state.timeline.name).toBe('NewName');
    expect(snap.canUndo).toBe(true);
  });

  it('rejected tx leaves snapshot unchanged', () => {
    const engine = makeEngine();
    const snapBefore = engine.getSnapshot();
    // MOVE_CLIP on a non-existent clipId — validators reject before any state change
    engine.dispatch(makeRejectTx());
    // Same object reference — rejected dispatch must not call buildSnapshot()
    expect(engine.getSnapshot()).toBe(snapBefore);
  });

  it('dispatch() returns the DispatchResult from core', () => {
    const engine = makeEngine();
    const result = engine.dispatch(makeRenameTx('x'));
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.nextState.timeline.name).toBe('x');
    }
  });
});

describe('undo() / redo()', () => {
  it('undo() reverts accepted tx and canUndo becomes false', () => {
    const engine = makeEngine();
    const originalName = engine.getSnapshot().state.timeline.name;
    engine.dispatch(makeRenameTx('Changed'));
    engine.undo();
    expect(engine.getSnapshot().state.timeline.name).toBe(originalName);
    expect(engine.getSnapshot().canUndo).toBe(false);
  });

  it('redo() re-applies undone tx and canRedo becomes false', () => {
    const engine = makeEngine();
    engine.dispatch(makeRenameTx('Changed'));
    engine.undo();
    engine.redo();
    expect(engine.getSnapshot().state.timeline.name).toBe('Changed');
    expect(engine.getSnapshot().canRedo).toBe(false);
  });

  it('undo() is a no-op when canUndo is false', () => {
    const engine = makeEngine();
    const snap = engine.getSnapshot();
    engine.undo(); // nothing to undo
    expect(engine.getSnapshot()).toBe(snap); // same reference
  });
});

describe('provisional state', () => {
  it('handlePointerMove with a tool returning ProvisionalState sets snapshot.provisional', () => {
    const ghost = makeProvisional();
    const moveTool = makeTool('move', {
      onPointerMove: () => ghost,
    });
    const engine = new TimelineEngine(makeState(), [NoOpTool, moveTool], toToolId('move'));
    engine.handlePointerMove(makePointerEvent(), noModifiers);
    expect(engine.getSnapshot().provisional).toBe(ghost);
  });

  it('handlePointerMove with a tool returning null clears snapshot.provisional', () => {
    const ghost = makeProvisional();
    let callCount = 0;
    const moveTool = makeTool('move', {
      onPointerMove: () => callCount++ === 0 ? ghost : null,
    });
    const engine = new TimelineEngine(makeState(), [NoOpTool, moveTool], toToolId('move'));
    engine.handlePointerMove(makePointerEvent(), noModifiers); // sets provisional
    engine.handlePointerMove(makePointerEvent(), noModifiers); // clears provisional
    expect(engine.getSnapshot().provisional).toBeNull();
  });

  it('handlePointerUp clears provisional before dispatching tx', () => {
    const ghost = makeProvisional();
    const upTool = makeTool('up', {
      onPointerMove: () => ghost,
      onPointerUp:   () => makeRenameTx('committed'),
    });
    const engine = new TimelineEngine(makeState(), [NoOpTool, upTool], toToolId('up'));
    engine.handlePointerMove(makePointerEvent(), noModifiers); // sets provisional
    engine.handlePointerUp(makePointerEvent(), noModifiers);   // clears, dispatches
    expect(engine.getSnapshot().provisional).toBeNull();
    expect(engine.getSnapshot().state.timeline.name).toBe('committed');
  });

  it('snapshot.provisional is null after handlePointerUp even when tool returns null tx', () => {
    const ghost = makeProvisional();
    const upTool = makeTool('up', {
      onPointerMove: () => ghost,
      onPointerUp:   () => null,               // no commit
    });
    const engine = new TimelineEngine(makeState(), [NoOpTool, upTool], toToolId('up'));
    engine.handlePointerMove(makePointerEvent(), noModifiers);
    engine.handlePointerUp(makePointerEvent(), noModifiers);
    expect(engine.getSnapshot().provisional).toBeNull();
  });
});

describe('activateTool()', () => {
  it('snapshot.activeToolId changes after activateTool()', () => {
    const engine = makeEngine();
    expect(engine.getSnapshot().activeToolId).toBe(toToolId('noop'));
    engine.activateTool(toToolId('alt'));
    expect(engine.getSnapshot().activeToolId).toBe(toToolId('alt'));
  });

  it('activateTool() calls onCancel() on the outgoing tool', () => {
    const cancelSpy = vi.fn();
    const cancelTool = makeTool('cancel', { onCancel: cancelSpy });
    const engine = new TimelineEngine(
      makeState(), [cancelTool, NoOpTool], toToolId('cancel'),
    );
    engine.activateTool(toToolId('noop'));
    expect(cancelSpy).toHaveBeenCalledOnce();
  });

  it('activateTool() throws on unknown id — snapshot unchanged', () => {
    const engine = makeEngine();
    const snapBefore = engine.getSnapshot();
    expect(() => engine.activateTool(toToolId('ghost'))).toThrow();
    // snapshot must not have changed (activateTool throws, so engine doesn't rebuild)
    // We can't check same ref since activateTool rebuilds before throwing (registry throws)
    // but the activeToolId must still be noop
    expect(engine.getSnapshot().activeToolId).toBe(toToolId('noop'));
  });
});

describe('handlePointerDown', () => {
  it('notifies once per call — cursor update', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.handlePointerDown(makePointerEvent(), noModifiers);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('delegates to getActiveTool().onPointerDown', () => {
    const downSpy = vi.fn();
    const downTool = makeTool('down', { onPointerDown: downSpy });
    const engine = new TimelineEngine(makeState(), [NoOpTool, downTool], toToolId('down'));
    const event = makePointerEvent(10);
    engine.handlePointerDown(event, noModifiers);
    expect(downSpy).toHaveBeenCalledOnce();
    expect(downSpy.mock.calls[0]![0]).toBe(event);
  });
});

describe('handleKeyDown', () => {
  it('does NOT notify when tool returns null — no re-render on no-op keystrokes', () => {
    const engine = makeEngine(); // NoOpTool.onKeyDown returns null
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.handleKeyDown(makeKeyEvent('z'), noModifiers);
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies when handleKeyDown tool returns an accepted Transaction (21b)', () => {
    const keyTool = makeTool('keytool', {
      onKeyDown: (_e: TimelineKeyEvent, _ctx: ToolContext) => makeRenameTx('from-key'),
    });
    const engine = new TimelineEngine(makeState(), [NoOpTool, keyTool], toToolId('keytool'));
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.handleKeyDown(makeKeyEvent('x'), noModifiers);
    expect(listener).toHaveBeenCalledOnce();
    expect(engine.getSnapshot().state.timeline.name).toBe('from-key');
  });
});

describe('setPixelsPerFrame', () => {
  it('does NOT trigger notify — ppf is not in EngineSnapshot', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.setPixelsPerFrame(20);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('setPlayheadFrame', () => {
  it('triggers notify — playhead changes are visible state', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.setPlayheadFrame(toFrame(100));
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('NoOpTool default', () => {
  it('engine with no tools arg defaults to NoOpTool with activeToolId "noop"', () => {
    const engine = new TimelineEngine(makeState());
    expect(engine.getSnapshot().activeToolId).toBe(toToolId('noop'));
    // Confirm all pointer/key methods run without throwing
    expect(() => {
      engine.handlePointerDown(makePointerEvent(), noModifiers);
      engine.handlePointerMove(makePointerEvent(), noModifiers);
      engine.handlePointerUp(makePointerEvent(), noModifiers);
      engine.handleKeyDown(makeKeyEvent(), noModifiers);
      engine.handleKeyUp(makeKeyEvent(), noModifiers);
    }).not.toThrow();
  });
});

describe('notify() storm guard', () => {
  it('handlePointerMove calls notify() exactly ONCE regardless of tool return (25)', () => {
    const moveTool = makeTool('move', {
      onPointerMove: () => makeProvisional(),
    });
    const engine = new TimelineEngine(makeState(), [NoOpTool, moveTool], toToolId('move'));
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.handlePointerMove(makePointerEvent(), noModifiers);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('snapshot.provisional reflects the tool return value after handlePointerMove (25b)', () => {
    const ghost = makeProvisional();
    const moveTool = makeTool('movetool', {
      onPointerMove: () => ghost,
    });
    const engine = new TimelineEngine(makeState(), [NoOpTool, moveTool], toToolId('movetool'));
    engine.handlePointerMove(makePointerEvent(), noModifiers);
    // toBe not toEqual — confirms no unnecessary copying
    expect(engine.getSnapshot().provisional).toBe(ghost);
  });
});
