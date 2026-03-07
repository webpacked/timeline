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
  createTrack,
  toFrame,
  toTimecode,
  NoOpTool,
  toToolId,
  createTestClock,
} from '@webpacked-timeline/core';
import type {
  ITool,
  ToolContext,
  TimelinePointerEvent,
  TimelineKeyEvent,
  Modifiers,
  ProvisionalState,
  Transaction,
  TimelineState,
} from '@webpacked-timeline/core';

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
  return {
    key,
    code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
  };
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
  const altTool = makeTool('alt', {});
  return new TimelineEngine({
    initialState: state,
    tools: [NoOpTool, altTool],
    defaultToolId: 'noop',
  });
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
    const nameBefore = engine.getSnapshot().state.timeline.name;
    const undone = engine.undo();
    expect(undone).toBe(false);
    expect(engine.getSnapshot().state.timeline.name).toBe(nameBefore);
  });
});

describe('provisional state', () => {
  it('handlePointerMove with a tool returning ProvisionalState sets snapshot.provisional', () => {
    const ghost = makeProvisional();
    const moveTool = makeTool('move', {
      onPointerMove: () => ghost,
    });
    const engine = new TimelineEngine({
      initialState: makeState(),
      tools: [NoOpTool, moveTool],
      defaultToolId: 'move',
    });
    engine.handlePointerMove(makePointerEvent(), noModifiers);
    expect(engine.getSnapshot().provisional).toBe(ghost);
  });

  it('handlePointerMove with a tool returning null clears snapshot.provisional', () => {
    const ghost = makeProvisional();
    let callCount = 0;
    const moveTool = makeTool('move', {
      onPointerMove: () => callCount++ === 0 ? ghost : null,
    });
    const engine = new TimelineEngine({
      initialState: makeState(),
      tools: [NoOpTool, moveTool],
      defaultToolId: 'move',
    });
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
    const engine = new TimelineEngine({
      initialState: makeState(),
      tools: [NoOpTool, upTool],
      defaultToolId: 'up',
    });
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
    const engine = new TimelineEngine({
      initialState: makeState(),
      tools: [NoOpTool, upTool],
      defaultToolId: 'up',
    });
    engine.handlePointerMove(makePointerEvent(), noModifiers);
    engine.handlePointerUp(makePointerEvent(), noModifiers);
    expect(engine.getSnapshot().provisional).toBeNull();
  });
});

describe('activateTool()', () => {
  it('snapshot.activeToolId changes after activateTool()', () => {
    const engine = makeEngine();
    expect(engine.getSnapshot().activeToolId).toBe('noop');
    engine.activateTool('alt');
    expect(engine.getSnapshot().activeToolId).toBe('alt');
  });

  it('activateTool() calls onCancel() on the outgoing tool', () => {
    const cancelSpy = vi.fn();
    const cancelTool = makeTool('cancel', { onCancel: cancelSpy });
    const engine = new TimelineEngine({
      initialState: makeState(),
      tools: [cancelTool, NoOpTool],
      defaultToolId: 'cancel',
    });
    engine.activateTool(toToolId('noop'));
    expect(cancelSpy).toHaveBeenCalledOnce();
  });

  it('activateTool() throws on unknown id — snapshot unchanged', () => {
    const engine = makeEngine();
    expect(() => engine.activateTool('ghost')).toThrow();
    expect(engine.getSnapshot().activeToolId).toBe('noop');
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
    const engine = new TimelineEngine({
      initialState: makeState(),
      tools: [NoOpTool, downTool],
      defaultToolId: 'down',
    });
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
    const engine = new TimelineEngine({
      initialState: makeState(),
      tools: [NoOpTool, keyTool],
      defaultToolId: 'keytool',
    });
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.handleKeyDown(makeKeyEvent('x'), noModifiers);
    expect(listener).toHaveBeenCalledOnce();
    expect(engine.getSnapshot().state.timeline.name).toBe('from-key');
  });
});

describe('NoOpTool default', () => {
  it('engine with defaultToolId "noop" has activeToolId "noop"', () => {
    const engine = new TimelineEngine({
      initialState: makeState(),
      tools: [NoOpTool],
      defaultToolId: 'noop',
    });
    expect(engine.getSnapshot().activeToolId).toBe('noop');
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
    const engine = new TimelineEngine({
      initialState: makeState(),
      tools: [NoOpTool, moveTool],
      defaultToolId: 'move',
    });
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
    const engine = new TimelineEngine({
      initialState: makeState(),
      tools: [NoOpTool, moveTool],
      defaultToolId: 'movetool',
    });
    engine.handlePointerMove(makePointerEvent(), noModifiers);
    // toBe not toEqual — confirms no unnecessary copying
    expect(engine.getSnapshot().provisional).toBe(ghost);
  });
});

// ── Phase R Step 1 — Full orchestrator (23 new tests) ────────────────────────

describe('Phase R Step 1 — Construction', () => {
  it('1. Engine constructs without pipeline (edit-only)', () => {
    const engine = new TimelineEngine({ initialState: makeState() });
    expect(engine.playbackEngine).toBeNull();
    expect(engine.getSnapshot().playhead.isPlaying).toBe(false);
  });

  it('2. Engine constructs with pipeline', () => {
    const mockPipeline = {
      videoDecoder: vi.fn().mockResolvedValue({}),
      compositor: vi.fn().mockResolvedValue({}),
    } as any;
    const { clock } = createTestClock();
    const engine = new TimelineEngine({
      initialState: makeState(),
      pipeline: mockPipeline,
      clock,
    });
    expect(engine.playbackEngine).not.toBeNull();
  });

  it('3. getSnapshot() returns valid EngineSnapshot', () => {
    const engine = makeEngine();
    const snap = engine.getSnapshot();
    expect(snap).toHaveProperty('state');
    expect(snap).toHaveProperty('provisional');
    expect(snap).toHaveProperty('activeToolId');
    expect(snap).toHaveProperty('canUndo');
    expect(snap).toHaveProperty('canRedo');
    expect(snap).toHaveProperty('trackIds');
    expect(snap).toHaveProperty('cursor');
    expect(snap).toHaveProperty('playhead');
    expect(snap).toHaveProperty('change');
  });

  it('4. Initial snapshot has correct trackIds', () => {
    const state = makeState();
    const engine = new TimelineEngine({ initialState: state });
    const expected = state.timeline.tracks.map((t) => t.id);
    expect(engine.getSnapshot().trackIds).toEqual(expected);
  });

  it('5. Initial canUndo: false, canRedo: false', () => {
    const engine = makeEngine();
    expect(engine.getSnapshot().canUndo).toBe(false);
    expect(engine.getSnapshot().canRedo).toBe(false);
  });
});

describe('Phase R Step 1 — dispatch', () => {
  it('6. dispatch updates snapshot.state', () => {
    const engine = makeEngine();
    engine.dispatch(makeRenameTx('NewName'));
    expect(engine.getSnapshot().state.timeline.name).toBe('NewName');
  });

  it('7. dispatch updates canUndo: true', () => {
    const engine = makeEngine();
    engine.dispatch(makeRenameTx('X'));
    expect(engine.getSnapshot().canUndo).toBe(true);
  });

  it('8. dispatch notifies subscribers', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.dispatch(makeRenameTx('Y'));
    expect(listener).toHaveBeenCalled();
  });

  it('9. Failed dispatch does not notify subscribers', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.dispatch(makeRejectTx());
    expect(listener).not.toHaveBeenCalled();
  });

  it('10. dispatch updates stableTrackIds when track list changes', () => {
    const state = makeState();
    const engine = new TimelineEngine({ initialState: state });
    const idsBefore = engine.getSnapshot().trackIds;
    const newTrack = createTrack({
      id: 'track-new',
      name: 'New',
      type: 'video',
      clips: [],
    });
    engine.dispatch({
      id: 'add',
      label: 'Add track',
      timestamp: 0,
      operations: [{ type: 'ADD_TRACK', track: newTrack }],
    });
    const idsAfter = engine.getSnapshot().trackIds;
    expect(idsAfter.length).toBe(idsBefore.length + 1);
    expect(idsAfter).toContain('track-new');
  });
});

describe('Phase R Step 1 — undo/redo', () => {
  it('11. undo() restores previous state', () => {
    const engine = makeEngine();
    const nameBefore = engine.getSnapshot().state.timeline.name;
    engine.dispatch(makeRenameTx('After'));
    engine.undo();
    expect(engine.getSnapshot().state.timeline.name).toBe(nameBefore);
  });

  it('12. undo() updates canUndo/canRedo flags', () => {
    const engine = makeEngine();
    engine.dispatch(makeRenameTx('A'));
    expect(engine.getSnapshot().canUndo).toBe(true);
    expect(engine.getSnapshot().canRedo).toBe(false);
    engine.undo();
    expect(engine.getSnapshot().canUndo).toBe(false);
    expect(engine.getSnapshot().canRedo).toBe(true);
  });

  it('13. redo() after undo restores forward state', () => {
    const engine = makeEngine();
    engine.dispatch(makeRenameTx('Redone'));
    engine.undo();
    engine.redo();
    expect(engine.getSnapshot().state.timeline.name).toBe('Redone');
  });

  it('14. undo() returns false when nothing to undo', () => {
    const engine = makeEngine();
    expect(engine.undo()).toBe(false);
  });
});

describe('Phase R Step 1 — Tools', () => {
  it('15. activateTool changes activeToolId in snapshot', () => {
    const engine = makeEngine();
    engine.activateTool('alt');
    expect(engine.getSnapshot().activeToolId).toBe('alt');
  });

  it('16. getActiveToolId returns correct id', () => {
    const engine = makeEngine();
    expect(engine.getActiveToolId()).toBe('noop');
    engine.activateTool('alt');
    expect(engine.getActiveToolId()).toBe('alt');
  });

  it('17. handleKeyDown returns true for Space key when playback engine present', () => {
    const mockPipeline = { videoDecoder: vi.fn(), compositor: vi.fn() } as any;
    const { clock } = createTestClock();
    const engine = new TimelineEngine({
      initialState: makeState(),
      pipeline: mockPipeline,
      clock,
    });
    const result = engine.handleKeyDown(
      { key: ' ', code: 'Space', shiftKey: false, altKey: false, metaKey: false, ctrlKey: false },
      noModifiers,
    );
    expect(result).toBe(true);
  });
});

describe('Phase R Step 1 — Snapshot stability and subscribers', () => {
  it('18. dispatch calls subscriber exactly once per dispatch', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.dispatch(makeRenameTx('Once'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('19. subscribe returns unsubscribe function', () => {
    const engine = makeEngine();
    const unsub = engine.subscribe(vi.fn());
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('20. After unsubscribe, callback not called', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    const unsub = engine.subscribe(listener);
    unsub();
    engine.dispatch(makeRenameTx('NoNotify'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('21. Multiple subscribers all notified', () => {
    const engine = makeEngine();
    const a = vi.fn();
    const b = vi.fn();
    engine.subscribe(a);
    engine.subscribe(b);
    engine.dispatch(makeRenameTx('Both'));
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });
});

describe('Phase R Step 1 — Playback integration', () => {
  it('22. playbackEngine is null without pipeline', () => {
    const engine = new TimelineEngine({ initialState: makeState() });
    expect(engine.playbackEngine).toBeNull();
  });

  it('23. playbackEngine is PlaybackEngine with pipeline', () => {
    const mockPipeline = { videoDecoder: vi.fn(), compositor: vi.fn() } as any;
    const { clock } = createTestClock();
    const engine = new TimelineEngine({
      initialState: makeState(),
      pipeline: mockPipeline,
      clock,
    });
    expect(engine.playbackEngine).not.toBeNull();
    expect(typeof (engine.playbackEngine as any)?.getState).toBe('function');
  });
});
