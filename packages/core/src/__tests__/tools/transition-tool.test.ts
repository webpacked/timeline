/**
 * TransitionTool Tests — Phase 4 Step 4
 *
 * Fixture: one timeline, one video track, two adjacent clips.
 * Zero React. Mock ToolContext, dispatch for transactions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TransitionTool } from '../../tools/transition-tool';
import { checkInvariants } from '../../validation/invariants';
import { dispatch } from '../../engine/dispatcher';
import { applyOperation } from '../../engine/apply';
import { createTimelineState } from '../../types/state';
import { createTimeline } from '../../types/timeline';
import { createTrack, toTrackId } from '../../types/track';
import { createClip, toClipId } from '../../types/clip';
import { createAsset } from '../../types/asset';
import { toFrame, toTimecode } from '../../types/frame';
import { createTransition, toTransitionId } from '../../types/transition';
import { buildSnapIndex } from '../../snap-index';
import type { ToolContext, TimelinePointerEvent } from '../../tools/types';
import type { TimelineState } from '../../types/state';
import type { TrackId } from '../../types/track';

const TRACK_ID = toTrackId('track-1');
const CLIP_A_ID = toClipId('clip-a');
const CLIP_B_ID = toClipId('clip-b');
const PIXELS_PER_FRAME = 10; // frame 100 → x=1000

function makeState(): TimelineState {
  const asset = createAsset({
    id: 'asset-1',
    name: 'V1',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(600),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });
  const clipA = createClip({
    id: 'clip-a',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const clipB = createClip({
    id: 'clip-b',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(100),
    timelineEnd: toFrame(200),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const track = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [clipA, clipB] });
  const timeline = createTimeline({
    id: 'tl',
    name: 'T',
    fps: 30,
    duration: toFrame(1000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[asset.id, asset]]) });
}

function makeCtx(state: TimelineState, overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    state,
    snapIndex: buildSnapIndex(state, toFrame(0)),
    pixelsPerFrame: PIXELS_PER_FRAME,
    modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    frameAtX: (x) => toFrame(Math.floor(x / PIXELS_PER_FRAME)),
    trackAtY: (_y) => TRACK_ID,
    snap: (frame) => frame,
    ...overrides,
  };
}

function makeEv(overrides: Partial<TimelinePointerEvent> & { x?: number } = {}): TimelinePointerEvent {
  const x = overrides.x ?? 0;
  return {
    frame: toFrame(Math.floor(x / PIXELS_PER_FRAME)),
    trackId: TRACK_ID,
    clipId: null,
    x,
    y: 24,
    buttons: overrides.buttons ?? 1,
    shiftKey: overrides.shiftKey ?? false,
    altKey: overrides.altKey ?? false,
    metaKey: overrides.metaKey ?? false,
    ...overrides,
  };
}

describe('TransitionTool — onPointerDown near right edge sets pendingClipId', () => {
  it('onPointerDown near right edge sets pendingClipId', () => {
    const tool = new TransitionTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const rightEdgeX = 100 * PIXELS_PER_FRAME; // clip-a ends at frame 100
    tool.onPointerDown(makeEv({ x: rightEdgeX }), ctx);
    const tx = tool.onPointerUp(makeEv({ x: rightEdgeX + 50 }), ctx);
    expect(tx).not.toBeNull();
    expect(tx!.operations[0]!.type).toBe('ADD_TRANSITION');
  });

  it('onPointerDown away from edge: no pendingClipId', () => {
    const tool = new TransitionTool();
    const state = makeState();
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ x: 500 }), ctx);
    const tx = tool.onPointerUp(makeEv({ x: 500 }), ctx);
    expect(tx).toBeNull();
  });
});

describe('TransitionTool — onPointerMove', () => {
  it('onPointerMove with pendingClipId sets provisional', () => {
    const tool = new TransitionTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const rightEdgeX = 100 * PIXELS_PER_FRAME;
    tool.onPointerDown(makeEv({ x: rightEdgeX }), ctx);
    const provisional = tool.onPointerMove(makeEv({ x: rightEdgeX + 80 }), ctx);
    expect(provisional).not.toBeNull();
    expect(provisional!.isProvisional).toBe(true);
    expect(provisional!.clips).toHaveLength(1);
    expect(provisional!.clips[0]!.transition).toBeDefined();
    expect(provisional!.clips[0]!.transition!.durationFrames).toBe(8);
  });

  it('onPointerMove without pendingClipId: no provisional', () => {
    const tool = new TransitionTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const provisional = tool.onPointerMove(makeEv({ x: 100 }), ctx);
    expect(provisional).toBeNull();
  });
});

describe('TransitionTool — onPointerUp', () => {
  it('onPointerUp dispatches ADD_TRANSITION (new)', () => {
    const tool = new TransitionTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const rightEdgeX = 100 * PIXELS_PER_FRAME;
    tool.onPointerDown(makeEv({ x: rightEdgeX }), ctx);
    const tx = tool.onPointerUp(makeEv({ x: rightEdgeX + 60 }), ctx);
    expect(tx).not.toBeNull();
    expect(tx!.operations[0]!.type).toBe('ADD_TRANSITION');
    const result = dispatch(state, tx!);
    expect(result.accepted).toBe(true);
    if (result.accepted) expect(checkInvariants(result.nextState)).toEqual([]);
  });

  it('onPointerUp dispatches SET_TRANSITION_DURATION when transition already exists', () => {
    const tool = new TransitionTool();
    const trans = createTransition(toTransitionId('tr-1'), 'dissolve', 10);
    let state = makeState();
    state = applyOperation(state, { type: 'ADD_TRANSITION', clipId: CLIP_A_ID, transition: trans });
    const ctx = makeCtx(state);
    const rightEdgeX = 100 * PIXELS_PER_FRAME;
    tool.onPointerDown(makeEv({ x: rightEdgeX }), ctx);
    const tx = tool.onPointerUp(makeEv({ x: rightEdgeX + 100 }), ctx);
    expect(tx).not.toBeNull();
    expect(tx!.operations[0]!.type).toBe('SET_TRANSITION_DURATION');
    const result = dispatch(state, tx!);
    expect(result.accepted).toBe(true);
    if (result.accepted) expect(checkInvariants(result.nextState)).toEqual([]);
  });

  it('onPointerUp with durationFrames < 1: no dispatch', () => {
    const tool = new TransitionTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const rightEdgeX = 100 * PIXELS_PER_FRAME;
    tool.onPointerDown(makeEv({ x: rightEdgeX }), ctx);
    const tx = tool.onPointerUp(makeEv({ x: rightEdgeX - 5 }), ctx);
    expect(tx).toBeNull();
  });

  it('onPointerDown on existing transition area dispatches DELETE_TRANSITION on up', () => {
    const tool = new TransitionTool();
    const trans = createTransition(toTransitionId('tr-1'), 'dissolve', 15);
    let state = makeState();
    state = applyOperation(state, { type: 'ADD_TRANSITION', clipId: CLIP_A_ID, transition: trans });
    const ctx = makeCtx(state);
    const rightEdgeX = 100 * PIXELS_PER_FRAME;
    const inTransitionZoneX = rightEdgeX - 10 * PIXELS_PER_FRAME;
    tool.onPointerDown(makeEv({ x: inTransitionZoneX }), ctx);
    const tx = tool.onPointerUp(makeEv({ x: inTransitionZoneX }), ctx);
    expect(tx).not.toBeNull();
    expect(tx!.operations[0]!.type).toBe('DELETE_TRANSITION');
    const result = dispatch(state, tx!);
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(checkInvariants(result.nextState)).toEqual([]);
      expect(result.nextState.timeline.tracks[0]!.clips[0]!.transition).toBeUndefined();
    }
  });
});

describe('TransitionTool — onCancel', () => {
  it('onCancel resets state and clears provisional', () => {
    const tool = new TransitionTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const rightEdgeX = 100 * PIXELS_PER_FRAME;
    tool.onPointerDown(makeEv({ x: rightEdgeX }), ctx);
    tool.onCancel();
    const provisional = tool.onPointerMove(makeEv({ x: rightEdgeX + 50 }), ctx);
    expect(provisional).toBeNull();
    const tx = tool.onPointerUp(makeEv({ x: rightEdgeX + 50 }), ctx);
    expect(tx).toBeNull();
  });
});

describe('TransitionTool — capture-before-reset', () => {
  it('onPointerUp resets BEFORE dispatch does not cause stale-closure bug', () => {
    const tool = new TransitionTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const rightEdgeX = 100 * PIXELS_PER_FRAME;
    tool.onPointerDown(makeEv({ x: rightEdgeX }), ctx);
    const tx = tool.onPointerUp(makeEv({ x: rightEdgeX + 40 }), ctx);
    expect(tx).not.toBeNull();
    const tx2 = tool.onPointerUp(makeEv({ x: rightEdgeX + 60 }), ctx);
    expect(tx2).toBeNull();
  });
});
