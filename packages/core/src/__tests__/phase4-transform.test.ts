/**
 * Phase 4 Step 3 — Transform, Audio, Transitions, TrackGroups, LinkGroups.
 * All state-producing tests call checkInvariants().
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
import { createAnimatableProperty } from '../types/clip-transform';
import { DEFAULT_AUDIO_PROPERTIES } from '../types/audio-properties';
import { createTransition, toTransitionId } from '../types/transition';
import { createLinkGroup, toLinkGroupId } from '../types/link-group';
import { createTrackGroup, toTrackGroupId } from '../types/track-group';
import type { OperationPrimitive, Transaction } from '../types/operations';

let txCounter = 0;
function makeTx(label: string, operations: OperationPrimitive[]): Transaction {
  return { id: `tx-${++txCounter}`, label, timestamp: Date.now(), operations };
}

/** One timeline, two tracks, two clips (one per track). */
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
  const clip1 = createClip({
    id: 'clip-1',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const clip2 = createClip({
    id: 'clip-2',
    assetId: 'asset-1',
    trackId: 'track-2',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const track1 = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [clip1] });
  const track2 = createTrack({ id: 'track-2', name: 'V2', type: 'video', clips: [clip2] });
  const timeline = createTimeline({
    id: 'tl',
    name: 'T',
    fps: 30,
    duration: toFrame(1000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track1, track2],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[asset.id, asset]]) });
}

describe('Phase 4 Step 3 — SET_CLIP_TRANSFORM', () => {
  it('sets transform fields on clip', () => {
    const state = makeBaseState();
    const next = applyOperation(state, {
      type: 'SET_CLIP_TRANSFORM',
      clipId: toClipId('clip-1'),
      transform: { opacity: createAnimatableProperty(0.5) },
    });
    expect(next.timeline.tracks[0]!.clips[0]!.transform!.opacity.value).toBe(0.5);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('partial merge preserves untouched fields', () => {
    const state = makeBaseState();
    const next = applyOperation(state, {
      type: 'SET_CLIP_TRANSFORM',
      clipId: toClipId('clip-1'),
      transform: { positionX: createAnimatableProperty(10) },
    });
    const t = next.timeline.tracks[0]!.clips[0]!.transform!;
    expect(t.positionX.value).toBe(10);
    expect(t.scaleX.value).toBe(1);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('missing clip is rejected', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('X', [{
      type: 'SET_CLIP_TRANSFORM',
      clipId: toClipId('none'),
      transform: { opacity: createAnimatableProperty(0.5) },
    }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('CLIP_NOT_FOUND');
  });
});

describe('Phase 4 Step 3 — SET_AUDIO_PROPERTIES', () => {
  it('sets gain and mute on clip', () => {
    const state = makeBaseState();
    const next = applyOperation(state, {
      type: 'SET_AUDIO_PROPERTIES',
      clipId: toClipId('clip-1'),
      properties: { mute: true, gain: createAnimatableProperty(-6) },
    });
    expect(next.timeline.tracks[0]!.clips[0]!.audio!.mute).toBe(true);
    expect(next.timeline.tracks[0]!.clips[0]!.audio!.gain.value).toBe(-6);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('pan out of range [-1,1] is rejected', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('X', [{
      type: 'SET_AUDIO_PROPERTIES',
      clipId: toClipId('clip-1'),
      properties: { pan: createAnimatableProperty(1.5) },
    }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('INVALID_RANGE');
  });

  it('normalizationGain < 0 is rejected', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('X', [{
      type: 'SET_AUDIO_PROPERTIES',
      clipId: toClipId('clip-1'),
      properties: { normalizationGain: -1 },
    }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('INVALID_RANGE');
  });
});

describe('Phase 4 Step 3 — ADD_TRANSITION / DELETE_TRANSITION', () => {
  it('ADD_TRANSITION sets transition on clip', () => {
    const state = makeBaseState();
    const trans = createTransition(toTransitionId('tr-1'), 'dissolve', 15);
    const next = applyOperation(state, { type: 'ADD_TRANSITION', clipId: toClipId('clip-1'), transition: trans });
    expect(next.timeline.tracks[0]!.clips[0]!.transition).toBeDefined();
    expect(next.timeline.tracks[0]!.clips[0]!.transition!.durationFrames).toBe(15);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('ADD_TRANSITION overwrites existing (no rejection)', () => {
    const state = makeBaseState();
    const t1 = createTransition(toTransitionId('tr-1'), 'dissolve', 10);
    const t2 = createTransition(toTransitionId('tr-2'), 'wipe', 20);
    let next = applyOperation(state, { type: 'ADD_TRANSITION', clipId: toClipId('clip-1'), transition: t1 });
    next = applyOperation(next, { type: 'ADD_TRANSITION', clipId: toClipId('clip-1'), transition: t2 });
    expect(next.timeline.tracks[0]!.clips[0]!.transition!.id).toBe('tr-2');
    expect(next.timeline.tracks[0]!.clips[0]!.transition!.durationFrames).toBe(20);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('DELETE_TRANSITION removes transition', () => {
    const state = makeBaseState();
    const trans = createTransition(toTransitionId('tr-1'), 'dissolve', 15);
    let next = applyOperation(state, { type: 'ADD_TRANSITION', clipId: toClipId('clip-1'), transition: trans });
    next = applyOperation(next, { type: 'DELETE_TRANSITION', clipId: toClipId('clip-1') });
    expect(next.timeline.tracks[0]!.clips[0]!.transition).toBeUndefined();
    expect(checkInvariants(next)).toEqual([]);
  });

  it('DELETE_TRANSITION on clip with no transition rejected', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('X', [{ type: 'DELETE_TRANSITION', clipId: toClipId('clip-1') }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('TRANSITION_NOT_FOUND');
  });
});

describe('Phase 4 Step 3 — SET_TRANSITION_DURATION / ALIGNMENT', () => {
  it('SET_TRANSITION_DURATION updates durationFrames', () => {
    const state = makeBaseState();
    const trans = createTransition(toTransitionId('tr-1'), 'dissolve', 15);
    let next = applyOperation(state, { type: 'ADD_TRANSITION', clipId: toClipId('clip-1'), transition: trans });
    next = applyOperation(next, { type: 'SET_TRANSITION_DURATION', clipId: toClipId('clip-1'), durationFrames: 30 });
    expect(next.timeline.tracks[0]!.clips[0]!.transition!.durationFrames).toBe(30);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('SET_TRANSITION_DURATION <= 0 is rejected', () => {
    const state = makeBaseState();
    const trans = createTransition(toTransitionId('tr-1'), 'dissolve', 15);
    let next = applyOperation(state, { type: 'ADD_TRANSITION', clipId: toClipId('clip-1'), transition: trans });
    const result = dispatch(next, makeTx('X', [{ type: 'SET_TRANSITION_DURATION', clipId: toClipId('clip-1'), durationFrames: 0 }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('INVALID_RANGE');
  });

  it('SET_TRANSITION_ALIGNMENT updates alignment', () => {
    const state = makeBaseState();
    const trans = createTransition(toTransitionId('tr-1'), 'dissolve', 15);
    let next = applyOperation(state, { type: 'ADD_TRANSITION', clipId: toClipId('clip-1'), transition: trans });
    next = applyOperation(next, { type: 'SET_TRANSITION_ALIGNMENT', clipId: toClipId('clip-1'), alignment: 'endAtCut' });
    expect(next.timeline.tracks[0]!.clips[0]!.transition!.alignment).toBe('endAtCut');
    expect(checkInvariants(next)).toEqual([]);
  });
});

describe('Phase 4 Step 3 — LINK_CLIPS / UNLINK_CLIPS', () => {
  it('LINK_CLIPS creates link group with both clipIds', () => {
    const state = makeBaseState();
    const linkGroup = createLinkGroup(toLinkGroupId('link-1'), [toClipId('clip-1'), toClipId('clip-2')]);
    const next = applyOperation(state, { type: 'LINK_CLIPS', linkGroup });
    expect(next.timeline.linkGroups).toHaveLength(1);
    expect(next.timeline.linkGroups![0]!.clipIds).toHaveLength(2);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('LINK_CLIPS with only 1 clipId is rejected', () => {
    const state = makeBaseState();
    const linkGroup = createLinkGroup(toLinkGroupId('link-1'), [toClipId('clip-1')]);
    const result = dispatch(state, makeTx('X', [{ type: 'LINK_CLIPS', linkGroup }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('INVALID_RANGE');
  });

  it('LINK_CLIPS with missing clipId is rejected', () => {
    const state = makeBaseState();
    const linkGroup = createLinkGroup(toLinkGroupId('link-1'), [toClipId('clip-1'), toClipId('nope')]);
    const result = dispatch(state, makeTx('X', [{ type: 'LINK_CLIPS', linkGroup }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('CLIP_NOT_FOUND');
  });

  it('UNLINK_CLIPS removes link group', () => {
    const state = makeBaseState();
    const linkGroup = createLinkGroup(toLinkGroupId('link-1'), [toClipId('clip-1'), toClipId('clip-2')]);
    let next = applyOperation(state, { type: 'LINK_CLIPS', linkGroup });
    next = applyOperation(next, { type: 'UNLINK_CLIPS', linkGroupId: toLinkGroupId('link-1') });
    expect(next.timeline.linkGroups).toHaveLength(0);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('UNLINK_CLIPS with missing groupId is rejected', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('X', [{ type: 'UNLINK_CLIPS', linkGroupId: toLinkGroupId('nope') }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('LINK_GROUP_NOT_FOUND');
  });
});

describe('Phase 4 Step 3 — ADD_TRACK_GROUP / DELETE_TRACK_GROUP', () => {
  it('ADD_TRACK_GROUP creates group and sets groupId on tracks', () => {
    const state = makeBaseState();
    const group = createTrackGroup(toTrackGroupId('grp-1'), 'Group', [toTrackId('track-1'), toTrackId('track-2')]);
    const next = applyOperation(state, { type: 'ADD_TRACK_GROUP', trackGroup: group });
    expect(next.timeline.trackGroups).toHaveLength(1);
    expect(next.timeline.tracks[0]!.groupId).toBe('grp-1');
    expect(next.timeline.tracks[1]!.groupId).toBe('grp-1');
    expect(checkInvariants(next)).toEqual([]);
  });

  it('DELETE_TRACK_GROUP removes group and clears groupId', () => {
    const state = makeBaseState();
    const group = createTrackGroup(toTrackGroupId('grp-1'), 'G', [toTrackId('track-1'), toTrackId('track-2')]);
    let next = applyOperation(state, { type: 'ADD_TRACK_GROUP', trackGroup: group });
    next = applyOperation(next, { type: 'DELETE_TRACK_GROUP', trackGroupId: toTrackGroupId('grp-1') });
    expect(next.timeline.trackGroups).toHaveLength(0);
    expect(next.timeline.tracks[0]!.groupId).toBeUndefined();
    expect(next.timeline.tracks[1]!.groupId).toBeUndefined();
    expect(checkInvariants(next)).toEqual([]);
  });

  it('DELETE_TRACK_GROUP with missing id is rejected', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('X', [{ type: 'DELETE_TRACK_GROUP', trackGroupId: toTrackGroupId('nope') }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('TRACK_GROUP_NOT_FOUND');
  });
});

describe('Phase 4 Step 3 — SET_TRACK_BLEND_MODE / SET_TRACK_OPACITY', () => {
  it('SET_TRACK_BLEND_MODE sets blendMode on track', () => {
    const state = makeBaseState();
    const next = applyOperation(state, { type: 'SET_TRACK_BLEND_MODE', trackId: toTrackId('track-1'), blendMode: 'multiply' });
    expect(next.timeline.tracks[0]!.blendMode).toBe('multiply');
    expect(checkInvariants(next)).toEqual([]);
  });

  it('SET_TRACK_OPACITY sets opacity on track', () => {
    const state = makeBaseState();
    const next = applyOperation(state, { type: 'SET_TRACK_OPACITY', trackId: toTrackId('track-1'), opacity: 0.7 });
    expect(next.timeline.tracks[0]!.opacity).toBe(0.7);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('SET_TRACK_OPACITY > 1 is rejected', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('X', [{ type: 'SET_TRACK_OPACITY', trackId: toTrackId('track-1'), opacity: 1.5 }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('INVALID_OPACITY');
  });

  it('SET_TRACK_OPACITY < 0 is rejected', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('X', [{ type: 'SET_TRACK_OPACITY', trackId: toTrackId('track-1'), opacity: -0.1 }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('INVALID_OPACITY');
  });
});

describe('Phase 4 Step 3 — Invariants', () => {
  it('checkInvariants catches transition durationFrames = 0', () => {
    const state = makeBaseState();
    const trans = createTransition(toTransitionId('tr-1'), 'dissolve', 0);
    const next = applyOperation(state, { type: 'ADD_TRANSITION', clipId: toClipId('clip-1'), transition: trans });
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'INVALID_RANGE' && v.message.includes('durationFrames'))).toBe(true);
  });

  it('checkInvariants catches clipId in two link groups', () => {
    const state = makeBaseState();
    const g1 = createLinkGroup(toLinkGroupId('l1'), [toClipId('clip-1'), toClipId('clip-2')]);
    let next = applyOperation(state, { type: 'LINK_CLIPS', linkGroup: g1 });
    const g2 = createLinkGroup(toLinkGroupId('l2'), [toClipId('clip-1'), toClipId('clip-2')]);
    next = applyOperation(next, { type: 'LINK_CLIPS', linkGroup: g2 });
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'INVALID_RANGE' && v.message.includes('more than one link group'))).toBe(true);
  });

  it('checkInvariants catches orphaned track.groupId', () => {
    const state = makeBaseState();
    const track1 = state.timeline.tracks[0]!;
    const track2 = state.timeline.tracks[1]!;
    const tracksWithOrphan = [
      { ...track1, groupId: toTrackGroupId('orphan') },
      track2,
    ];
    const timeline = { ...state.timeline, tracks: tracksWithOrphan };
    const next = { ...state, timeline };
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'TRACK_GROUP_NOT_FOUND' && v.message.includes('orphan'))).toBe(true);
  });
});
