/**
 * Phase 4 Step 2 — Effect and Keyframe operations.
 * All state-producing tests call checkInvariants() and expect zero violations.
 */

import { describe, it, expect } from 'vitest';
import { dispatch } from '../engine/dispatcher';
import { applyOperation } from '../engine/apply';
import { checkInvariants } from '../validation/invariants';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset } from '../types/asset';
import { toFrame, toTimecode } from '../types/frame';
import { createEffect, toEffectId } from '../types/effect';
import { toKeyframeId } from '../types/keyframe';
import { LINEAR_EASING } from '../types/easing';
import type { OperationPrimitive, Transaction } from '../types/operations';

let txCounter = 0;
function makeTx(label: string, operations: OperationPrimitive[]): Transaction {
  return { id: `tx-${++txCounter}`, label, timestamp: Date.now(), operations };
}

/** State: one timeline, one video track, one clip (no effects). */
function makeBaseState() {
  const asset = createAsset({
    id: 'asset-1',
    name: 'V1',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(600),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });
  const clip = createClip({
    id: 'clip-1',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
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

/** State with one clip that has one effect with two keyframes. */
function makeStateWithEffectAndKeyframes() {
  const clipId = toClipId('clip-1');
  const effectId = toEffectId('eff-1');
  const effect = createEffect(effectId, 'blur', 'preComposite', [
    { key: 'radius', value: 5 },
  ]);
  let state = makeBaseState();
  state = applyOperation(state, { type: 'ADD_EFFECT', clipId, effect });
  state = applyOperation(state, {
    type: 'ADD_KEYFRAME',
    clipId,
    effectId,
    keyframe: { id: toKeyframeId('kf-1'), frame: toFrame(10), value: 2, easing: LINEAR_EASING },
  });
  state = applyOperation(state, {
    type: 'ADD_KEYFRAME',
    clipId,
    effectId,
    keyframe: { id: toKeyframeId('kf-2'), frame: toFrame(50), value: 8, easing: LINEAR_EASING },
  });
  return state;
}

describe('Phase 4 — ADD_EFFECT', () => {
  it('ADD_EFFECT appends effect to clip', () => {
    const state = makeBaseState();
    const effect = createEffect(toEffectId('eff-1'), 'blur');
    const next = applyOperation(state, { type: 'ADD_EFFECT', clipId: toClipId('clip-1'), effect });
    const clip = next.timeline.tracks[0]!.clips[0]!;
    expect(clip.effects).toHaveLength(1);
    expect(clip.effects![0]!.id).toBe('eff-1');
    expect(checkInvariants(next)).toEqual([]);
  });

  it('ADD_EFFECT with duplicate effectId is rejected', () => {
    const state = makeBaseState();
    const effect = createEffect(toEffectId('eff-1'), 'blur');
    let next = applyOperation(state, { type: 'ADD_EFFECT', clipId: toClipId('clip-1'), effect });
    const result = dispatch(next, makeTx('Dup', [{ type: 'ADD_EFFECT', clipId: toClipId('clip-1'), effect }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('DUPLICATE_EFFECT_ID');
  });

  it('ADD_EFFECT on missing clip is rejected', () => {
    const state = makeBaseState();
    const effect = createEffect(toEffectId('eff-1'), 'blur');
    const result = dispatch(state, makeTx('Add', [{ type: 'ADD_EFFECT', clipId: toClipId('none'), effect }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('CLIP_NOT_FOUND');
  });
});

describe('Phase 4 — REMOVE_EFFECT', () => {
  it('REMOVE_EFFECT removes effect from clip', () => {
    const state = makeStateWithEffectAndKeyframes();
    const next = applyOperation(state, {
      type: 'REMOVE_EFFECT',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
    });
    expect(next.timeline.tracks[0]!.clips[0]!.effects).toHaveLength(0);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('REMOVE_EFFECT on missing effectId is rejected', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('Rm', [{ type: 'REMOVE_EFFECT', clipId: toClipId('clip-1'), effectId: toEffectId('nope') }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('EFFECT_NOT_FOUND');
  });
});

describe('Phase 4 — REORDER_EFFECT', () => {
  it('REORDER_EFFECT moves effect to newIndex correctly', () => {
    const state = makeBaseState();
    const e1 = createEffect(toEffectId('e1'), 'blur');
    const e2 = createEffect(toEffectId('e2'), 'lut');
    const cid = toClipId('clip-1');
    let next = applyOperation(state, { type: 'ADD_EFFECT', clipId: cid, effect: e1 });
    next = applyOperation(next, { type: 'ADD_EFFECT', clipId: cid, effect: e2 });
    next = applyOperation(next, { type: 'REORDER_EFFECT', clipId: cid, effectId: toEffectId('e2'), newIndex: 0 });
    expect(next.timeline.tracks[0]!.clips[0]!.effects![0]!.id).toBe('e2');
    expect(next.timeline.tracks[0]!.clips[0]!.effects![1]!.id).toBe('e1');
    expect(checkInvariants(next)).toEqual([]);
  });

  it('REORDER_EFFECT with out-of-range index is rejected', () => {
    const state = makeStateWithEffectAndKeyframes();
    const result = dispatch(state, makeTx('Reorder', [
      { type: 'REORDER_EFFECT', clipId: toClipId('clip-1'), effectId: toEffectId('eff-1'), newIndex: 5 },
    ]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('EFFECT_INDEX_OUT_OF_RANGE');
  });
});

describe('Phase 4 — SET_EFFECT_ENABLED', () => {
  it('SET_EFFECT_ENABLED false disables effect', () => {
    const state = makeStateWithEffectAndKeyframes();
    const next = applyOperation(state, {
      type: 'SET_EFFECT_ENABLED',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
      enabled: false,
    });
    expect(next.timeline.tracks[0]!.clips[0]!.effects![0]!.enabled).toBe(false);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('SET_EFFECT_ENABLED true re-enables effect', () => {
    const state = makeStateWithEffectAndKeyframes();
    let next = applyOperation(state, {
      type: 'SET_EFFECT_ENABLED',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
      enabled: false,
    });
    next = applyOperation(next, {
      type: 'SET_EFFECT_ENABLED',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
      enabled: true,
    });
    expect(next.timeline.tracks[0]!.clips[0]!.effects![0]!.enabled).toBe(true);
    expect(checkInvariants(next)).toEqual([]);
  });
});

describe('Phase 4 — SET_EFFECT_PARAM', () => {
  it('SET_EFFECT_PARAM updates existing param value', () => {
    const state = makeStateWithEffectAndKeyframes();
    const next = applyOperation(state, {
      type: 'SET_EFFECT_PARAM',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
      key: 'radius',
      value: 10,
    });
    const param = next.timeline.tracks[0]!.clips[0]!.effects![0]!.params.find((p) => p.key === 'radius');
    expect(param!.value).toBe(10);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('SET_EFFECT_PARAM appends new param if key missing', () => {
    const state = makeStateWithEffectAndKeyframes();
    const next = applyOperation(state, {
      type: 'SET_EFFECT_PARAM',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
      key: 'quality',
      value: 0.9,
    });
    const params = next.timeline.tracks[0]!.clips[0]!.effects![0]!.params;
    expect(params.some((p) => p.key === 'quality' && p.value === 0.9)).toBe(true);
    expect(checkInvariants(next)).toEqual([]);
  });
});

describe('Phase 4 — ADD_KEYFRAME', () => {
  it('ADD_KEYFRAME appends and sorts keyframes by frame', () => {
    const state = makeBaseState();
    const cid = toClipId('clip-1');
    const eid = toEffectId('eff-1');
    let next = applyOperation(state, { type: 'ADD_EFFECT', clipId: cid, effect: createEffect(eid, 'blur') });
    next = applyOperation(next, {
      type: 'ADD_KEYFRAME',
      clipId: cid,
      effectId: eid,
      keyframe: { id: toKeyframeId('kf-2'), frame: toFrame(50), value: 5, easing: LINEAR_EASING },
    });
    next = applyOperation(next, {
      type: 'ADD_KEYFRAME',
      clipId: cid,
      effectId: eid,
      keyframe: { id: toKeyframeId('kf-1'), frame: toFrame(10), value: 2, easing: LINEAR_EASING },
    });
    const kfs = next.timeline.tracks[0]!.clips[0]!.effects![0]!.keyframes;
    expect(kfs[0]!.frame).toBe(10);
    expect(kfs[1]!.frame).toBe(50);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('ADD_KEYFRAME with duplicate keyframeId is rejected', () => {
    const state = makeStateWithEffectAndKeyframes();
    const result = dispatch(state, makeTx('DupKf', [{
      type: 'ADD_KEYFRAME',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
      keyframe: { id: toKeyframeId('kf-1'), frame: toFrame(99), value: 1, easing: LINEAR_EASING },
    }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('DUPLICATE_KEYFRAME_ID');
  });

  it('ADD_KEYFRAME with frame < 0 is rejected', () => {
    const state = makeStateWithEffectAndKeyframes();
    const result = dispatch(state, makeTx('Neg', [{
      type: 'ADD_KEYFRAME',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
      keyframe: { id: toKeyframeId('kf-3'), frame: toFrame(-1), value: 0, easing: LINEAR_EASING },
    }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('INVALID_RANGE');
  });
});

describe('Phase 4 — MOVE_KEYFRAME', () => {
  it('MOVE_KEYFRAME updates frame and re-sorts', () => {
    const state = makeStateWithEffectAndKeyframes();
    const next = applyOperation(state, {
      type: 'MOVE_KEYFRAME',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
      keyframeId: toKeyframeId('kf-1'),
      newFrame: toFrame(60),
    });
    const kfs = next.timeline.tracks[0]!.clips[0]!.effects![0]!.keyframes;
    const kf1 = kfs.find((k) => k.id === 'kf-1');
    expect(kf1!.frame).toBe(60);
    expect(kfs[0]!.frame).toBe(50);
    expect(kfs[1]!.frame).toBe(60);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('MOVE_KEYFRAME with newFrame < 0 is rejected', () => {
    const state = makeStateWithEffectAndKeyframes();
    const result = dispatch(state, makeTx('Neg', [{
      type: 'MOVE_KEYFRAME',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
      keyframeId: toKeyframeId('kf-1'),
      newFrame: toFrame(-1),
    }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('INVALID_RANGE');
  });
});

describe('Phase 4 — DELETE_KEYFRAME', () => {
  it('DELETE_KEYFRAME removes keyframe from effect', () => {
    const state = makeStateWithEffectAndKeyframes();
    const next = applyOperation(state, {
      type: 'DELETE_KEYFRAME',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
      keyframeId: toKeyframeId('kf-1'),
    });
    expect(next.timeline.tracks[0]!.clips[0]!.effects![0]!.keyframes).toHaveLength(1);
    expect(next.timeline.tracks[0]!.clips[0]!.effects![0]!.keyframes[0]!.id).toBe('kf-2');
    expect(checkInvariants(next)).toEqual([]);
  });
});

describe('Phase 4 — SET_KEYFRAME_EASING', () => {
  it('SET_KEYFRAME_EASING updates easing on target keyframe', () => {
    const state = makeStateWithEffectAndKeyframes();
    const hold = { kind: 'Hold' as const };
    const next = applyOperation(state, {
      type: 'SET_KEYFRAME_EASING',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
      keyframeId: toKeyframeId('kf-1'),
      easing: hold,
    });
    const kf = next.timeline.tracks[0]!.clips[0]!.effects![0]!.keyframes.find((k) => k.id === 'kf-1');
    expect(kf!.easing).toEqual(hold);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('SET_KEYFRAME_EASING on missing keyframe is rejected', () => {
    const state = makeStateWithEffectAndKeyframes();
    const result = dispatch(state, makeTx('Ease', [{
      type: 'SET_KEYFRAME_EASING',
      clipId: toClipId('clip-1'),
      effectId: toEffectId('eff-1'),
      keyframeId: toKeyframeId('nope'),
      easing: LINEAR_EASING,
    }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('KEYFRAME_NOT_FOUND');
  });
});

describe('Phase 4 — Effect/keyframe invariants', () => {
  it('checkInvariants catches unsorted keyframes', () => {
    const state = makeBaseState();
    const cid = toClipId('clip-1');
    const eid = toEffectId('eff-1');
    const effect = createEffect(eid, 'blur');
    const effWithBadKeyframes = {
      ...effect,
      keyframes: [
        { id: toKeyframeId('a'), frame: toFrame(50), value: 1, easing: LINEAR_EASING },
        { id: toKeyframeId('b'), frame: toFrame(10), value: 2, easing: LINEAR_EASING },
      ],
    };
    let next = applyOperation(state, { type: 'ADD_EFFECT', clipId: cid, effect: effWithBadKeyframes });
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'KEYFRAME_ORDER_VIOLATION')).toBe(true);
  });

  it('checkInvariants catches duplicate keyframe frames', () => {
    const state = makeBaseState();
    const cid = toClipId('clip-1');
    const eid = toEffectId('eff-1');
    const effect = createEffect(eid, 'blur');
    const effWithDupFrames = {
      ...effect,
      keyframes: [
        { id: toKeyframeId('a'), frame: toFrame(10), value: 1, easing: LINEAR_EASING },
        { id: toKeyframeId('b'), frame: toFrame(10), value: 2, easing: LINEAR_EASING },
      ],
    };
    let next = applyOperation(state, { type: 'ADD_EFFECT', clipId: cid, effect: effWithDupFrames });
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'KEYFRAME_ORDER_VIOLATION')).toBe(true);
  });
});
