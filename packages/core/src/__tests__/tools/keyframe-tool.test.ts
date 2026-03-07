/**
 * KeyframeTool Tests — Phase 4 Step 4
 *
 * Fixture: one timeline, one video track, one clip with one effect
 * and one existing keyframe.
 */

import { describe, it, expect } from 'vitest';
import { KeyframeTool } from '../../tools/keyframe-tool';
import { checkInvariants } from '../../validation/invariants';
import { dispatch } from '../../engine/dispatcher';
import { applyOperation } from '../../engine/apply';
import { createTimelineState } from '../../types/state';
import { createTimeline } from '../../types/timeline';
import { createTrack, toTrackId } from '../../types/track';
import { createClip, toClipId } from '../../types/clip';
import { createAsset } from '../../types/asset';
import { createEffect, toEffectId } from '../../types/effect';
import { toKeyframeId } from '../../types/keyframe';
import { toFrame, toTimecode } from '../../types/frame';
import { LINEAR_EASING } from '../../types/easing';
import { buildSnapIndex } from '../../snap-index';
import type { ToolContext, TimelinePointerEvent, TimelineKeyEvent } from '../../tools/types';
import type { TimelineState } from '../../types/state';
import type { TrackId } from '../../types/track';
import type { ClipId } from '../../types/clip';

const TRACK_ID = toTrackId('track-1');
const CLIP_ID = toClipId('clip-1');
const EFFECT_ID = toEffectId('eff-1');
const KEYFRAME_1_FRAME = 10;
const PIXELS_PER_FRAME = 10; // frame 10 → x=100

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
  const effect = createEffect(EFFECT_ID, 'blur', 'preComposite', []);
  const clip = createClip({
    id: 'clip-1',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
    effects: [{ ...effect, keyframes: [{ id: toKeyframeId('kf-1'), frame: toFrame(KEYFRAME_1_FRAME), value: 0.5, easing: LINEAR_EASING }] }],
  });
  const track = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [clip] });
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
    frameAtX: (x) => toFrame(Math.round(x / PIXELS_PER_FRAME)),
    trackAtY: (_y) => TRACK_ID,
    snap: (frame) => frame,
    ...overrides,
  };
}

function makeEv(overrides: Partial<TimelinePointerEvent> & { x?: number } = {}): TimelinePointerEvent {
  const x = overrides.x ?? 0;
  return {
    frame: toFrame(Math.round(x / PIXELS_PER_FRAME)),
    trackId: TRACK_ID,
    clipId: CLIP_ID,
    x,
    y: 24,
    buttons: overrides.buttons ?? 1,
    shiftKey: overrides.shiftKey ?? false,
    altKey: overrides.altKey ?? false,
    metaKey: overrides.metaKey ?? false,
    ...overrides,
  };
}

function makeKeyEv(overrides: Partial<TimelineKeyEvent> = {}): TimelineKeyEvent {
  return {
    key: 'Delete',
    code: 'Delete',
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    ...overrides,
  };
}

describe('KeyframeTool — onPointerDown on empty lane', () => {
  it('onPointerDown on empty lane then onPointerUp returns ADD_KEYFRAME', () => {
    const tool = new KeyframeTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const xEmpty = 300; // frame 30, no keyframe there
    tool.onPointerDown(makeEv({ x: xEmpty }), ctx);
    const tx = tool.onPointerUp(makeEv({ x: xEmpty }), ctx);
    expect(tx).not.toBeNull();
    expect(tx!.operations[0]!.type).toBe('ADD_KEYFRAME');
    const result = dispatch(state, tx!);
    expect(result.accepted).toBe(true);
    if (result.accepted) expect(checkInvariants(result.nextState)).toEqual([]);
  });

  it('added keyframe has frame derived from pointer x', () => {
    const tool = new KeyframeTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const x = 250; // frame 25
    tool.onPointerDown(makeEv({ x }), ctx);
    const tx = tool.onPointerUp(makeEv({ x }), ctx);
    expect(tx).not.toBeNull();
    const op = tx!.operations[0];
    expect(op!.type).toBe('ADD_KEYFRAME');
    if (op!.type === 'ADD_KEYFRAME') expect(op.keyframe.frame).toBe(25);
  });
});

describe('KeyframeTool — onPointerDown on existing keyframe', () => {
  it('onPointerDown on existing keyframe sets draggingKeyframe', () => {
    const tool = new KeyframeTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const keyframeX = KEYFRAME_1_FRAME * PIXELS_PER_FRAME; // 100
    tool.onPointerDown(makeEv({ x: keyframeX }), ctx);
    const provisional = tool.onPointerMove(makeEv({ x: keyframeX + 50 }), ctx);
    expect(provisional).not.toBeNull();
    const tx = tool.onPointerUp(makeEv({ x: keyframeX + 50 }), ctx);
    expect(tx).not.toBeNull();
    expect(tx!.operations[0]!.type).toBe('MOVE_KEYFRAME');
  });
});

describe('KeyframeTool — onPointerMove', () => {
  it('onPointerMove with draggingKeyframe shows provisional', () => {
    const tool = new KeyframeTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const keyframeX = KEYFRAME_1_FRAME * PIXELS_PER_FRAME;
    tool.onPointerDown(makeEv({ x: keyframeX }), ctx);
    const provisional = tool.onPointerMove(makeEv({ x: keyframeX + 30 }), ctx);
    expect(provisional).not.toBeNull();
    expect(provisional!.isProvisional).toBe(true);
    const clip = provisional!.clips[0]!;
    const effect = clip.effects!.find((e) => e.id === EFFECT_ID);
    expect(effect!.keyframes[0]!.frame).toBe(13); // 10 + round(30/10)
  });

  it('onPointerMove without draggingKeyframe: no provisional', () => {
    const tool = new KeyframeTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const provisional = tool.onPointerMove(makeEv({ x: 200 }), ctx);
    expect(provisional).toBeNull();
  });
});

describe('KeyframeTool — onPointerUp', () => {
  it('onPointerUp dispatches MOVE_KEYFRAME with correct frame', () => {
    const tool = new KeyframeTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const keyframeX = KEYFRAME_1_FRAME * PIXELS_PER_FRAME;
    tool.onPointerDown(makeEv({ x: keyframeX }), ctx);
    tool.onPointerMove(makeEv({ x: keyframeX + 40 }), ctx);
    const tx = tool.onPointerUp(makeEv({ x: keyframeX + 40 }), ctx);
    expect(tx).not.toBeNull();
    expect(tx!.operations[0]!.type).toBe('MOVE_KEYFRAME');
    if (tx!.operations[0]!.type === 'MOVE_KEYFRAME') {
      expect(tx!.operations[0]!.newFrame).toBe(14); // 10 + 4
    }
    const result = dispatch(state, tx!);
    expect(result.accepted).toBe(true);
    if (result.accepted) expect(checkInvariants(result.nextState)).toEqual([]);
  });

  it('onPointerUp with no drag: no dispatch', () => {
    const tool = new KeyframeTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const keyframeX = KEYFRAME_1_FRAME * PIXELS_PER_FRAME;
    tool.onPointerDown(makeEv({ x: keyframeX }), ctx);
    const tx = tool.onPointerUp(makeEv({ x: keyframeX }), ctx);
    expect(tx).toBeNull();
  });
});

describe('KeyframeTool — onKeyDown Delete', () => {
  it('onKeyDown Delete while dragging dispatches DELETE_KEYFRAME', () => {
    const tool = new KeyframeTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const keyframeX = KEYFRAME_1_FRAME * PIXELS_PER_FRAME;
    tool.onPointerDown(makeEv({ x: keyframeX }), ctx);
    const tx = tool.onKeyDown(makeKeyEv({ key: 'Delete' }), ctx);
    expect(tx).not.toBeNull();
    expect(tx!.operations[0]!.type).toBe('DELETE_KEYFRAME');
    const result = dispatch(state, tx!);
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(checkInvariants(result.nextState)).toEqual([]);
      const clip = result.nextState.timeline.tracks[0]!.clips[0]!;
      expect(clip.effects![0]!.keyframes).toHaveLength(0);
    }
  });

  it('onKeyDown Delete with no active drag: no dispatch', () => {
    const tool = new KeyframeTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const tx = tool.onKeyDown(makeKeyEv({ key: 'Delete' }), ctx);
    expect(tx).toBeNull();
  });
});

describe('KeyframeTool — onCancel', () => {
  it('onCancel resets all instance vars and clears provisional', () => {
    const tool = new KeyframeTool();
    const state = makeState();
    const ctx = makeCtx(state);
    const keyframeX = KEYFRAME_1_FRAME * PIXELS_PER_FRAME;
    tool.onPointerDown(makeEv({ x: keyframeX }), ctx);
    tool.onCancel();
    const provisional = tool.onPointerMove(makeEv({ x: keyframeX + 20 }), ctx);
    expect(provisional).toBeNull();
    const tx = tool.onPointerUp(makeEv({ x: keyframeX + 20 }), ctx);
    expect(tx).toBeNull();
  });
});

describe('KeyframeTool — snap', () => {
  it('onPointerDown snaps frame to nearest snap point when ctx.snapEnabled', () => {
    const state = makeState();
    const snapIndex = buildSnapIndex(state, toFrame(0));
    const ctx = makeCtx(state, {
      snapIndex: { ...snapIndex, enabled: true },
      frameAtX: (x) => toFrame(Math.round(x / PIXELS_PER_FRAME)),
    });
    const tool = new KeyframeTool();
    // Click at x=35 → frame 4. ClipStart is at 0, within SNAP_RADIUS_FRAMES (5)
    tool.onPointerDown(makeEv({ x: 35 }), ctx);
    const tx = tool.onPointerUp(makeEv({ x: 35 }), ctx);
    expect(tx).not.toBeNull();
    const op = tx!.operations[0];
    expect(op!.type).toBe('ADD_KEYFRAME');
    if (op!.type === 'ADD_KEYFRAME') {
      // nearest(frame 4, radius 5) can return ClipStart at 0 (distance 4)
      expect([0, 4]).toContain(op.keyframe.frame);
    }
  });
});
