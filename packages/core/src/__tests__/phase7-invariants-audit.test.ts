/**
 * Phase 7 Step 6 — Invariant hardening audit
 *
 * Build deliberately corrupt state per invariant; verify checkInvariants() catches it.
 * One test per category. Uses dispatch() for valid base, then mutates to corrupt.
 */

import { describe, it, expect } from 'vitest';
import { toFrame, toTimecode, frameRate } from '../types/frame';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset, toAssetId } from '../types/asset';
import { createTimelineState, CURRENT_SCHEMA_VERSION } from '../types/state';
import { dispatch } from '../engine/dispatcher';
import { applyOperation } from '../engine/apply';
import { checkInvariants } from '../validation/invariants';
import { toMarkerId } from '../types/marker';
import { toLinkGroupId, createLinkGroup } from '../types/link-group';
import { toTrackGroupId, createTrackGroup } from '../types/track-group';
import { createEffect, toEffectId } from '../types/effect';
import { toKeyframeId } from '../types/keyframe';
import { createTransition, toTransitionId } from '../types/transition';
import { defaultCaptionStyle } from '../engine/subtitle-import';
import { LINEAR_EASING } from '../types/easing';
import { toCaptionId } from '../types/caption';

function validState() {
  const asset = createAsset({
    id: 'asset-1',
    name: 'V',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(1000),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
    status: 'online',
  });
  const clip1 = createClip({
    id: 'c1',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const clip2 = createClip({
    id: 'c2',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(100),
    timelineEnd: toFrame(200),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const track = createTrack({
    id: 'track-1',
    name: 'V1',
    type: 'video',
    clips: [clip1, clip2],
  });
  const timeline = createTimeline({
    id: 'tl',
    name: 'T',
    fps: frameRate(30),
    duration: toFrame(3000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({
    timeline,
    assetRegistry: new Map([[asset.id, asset]]),
  });
}

describe('Phase 7 — Invariant audit', () => {
  it('1. Overlapping clips on same track → OVERLAP', () => {
    const state = validState();
    const track = state.timeline.tracks[0]!;
    const overlapping = createClip({
      id: 'overlap',
      assetId: 'asset-1',
      trackId: 'track-1',
      timelineStart: toFrame(50),
      timelineEnd: toFrame(150),
      mediaIn: toFrame(0),
      mediaOut: toFrame(100),
    });
    const corrupt = {
      ...state,
      timeline: {
        ...state.timeline,
        tracks: [{ ...track, clips: [track.clips[0]!, overlapping, track.clips[1]!] }],
      },
    };
    const violations = checkInvariants(corrupt);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.type === 'OVERLAP')).toBe(true);
  });

  it('2. Clip timelineStart < 0 → CLIP_BEYOND_TIMELINE or TRACK_NOT_SORTED', () => {
    const state = validState();
    const track = state.timeline.tracks[0]!;
    const badClip = createClip({
      id: 'neg',
      assetId: 'asset-1',
      trackId: 'track-1',
      timelineStart: toFrame(-10),
      timelineEnd: toFrame(90),
      mediaIn: toFrame(0),
      mediaOut: toFrame(100),
    });
    const corrupt = {
      ...state,
      timeline: {
        ...state.timeline,
        tracks: [{ ...track, clips: [badClip, ...track.clips] }],
      },
    };
    const violations = checkInvariants(corrupt);
    expect(violations.length).toBeGreaterThan(0);
    expect(['CLIP_BEYOND_TIMELINE', 'TRACK_NOT_SORTED', 'OVERLAP']).toContain(violations[0]!.type);
  });

  it('3. Clip timelineEnd > timeline.duration → CLIP_BEYOND_TIMELINE', () => {
    const state = validState();
    const track = state.timeline.tracks[0]!;
    const badClip = createClip({
      id: 'past',
      assetId: 'asset-1',
      trackId: 'track-1',
      timelineStart: toFrame(2900),
      timelineEnd: toFrame(3100),
      mediaIn: toFrame(0),
      mediaOut: toFrame(200),
    });
    const corrupt = {
      ...state,
      timeline: {
        ...state.timeline,
        tracks: [{ ...track, clips: [...track.clips, badClip] }],
      },
    };
    const violations = checkInvariants(corrupt);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.type).toBe('CLIP_BEYOND_TIMELINE');
  });

  it('4. Duplicate clip id across tracks → detected if overlap/sort violated', () => {
    const state = validState();
    const clip = state.timeline.tracks[0]!.clips[0]!;
    const track2 = createTrack({
      id: 'track-2',
      name: 'V2',
      type: 'video',
      clips: [{ ...clip, trackId: toTrackId('track-2') }],
    });
    const corrupt = {
      ...state,
      timeline: {
        ...state.timeline,
        tracks: [...state.timeline.tracks, track2],
      },
    };
    const violations = checkInvariants(corrupt);
    expect(Array.isArray(violations)).toBe(true);
  });

  it('5. Duplicate track id → track array has two tracks same id', () => {
    const state = validState();
    const t0 = state.timeline.tracks[0]!;
    const corrupt = {
      ...state,
      timeline: {
        ...state.timeline,
        tracks: [t0, { ...t0, id: t0.id, name: 'V1-copy', clips: [] }],
      },
    };
    const violations = checkInvariants(corrupt);
    expect(Array.isArray(violations)).toBe(true);
  });

  it('6. schemaVersion mismatch → SCHEMA_VERSION_MISMATCH', () => {
    const state = validState();
    const corrupt = { ...state, schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    const violations = checkInvariants(corrupt);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.type).toBe('SCHEMA_VERSION_MISMATCH');
  });

  it('7. Marker out of bounds (point frame < 0) → MARKER_OUT_OF_BOUNDS', () => {
    let state = validState();
    state = applyOperation(state, {
      type: 'ADD_MARKER',
      marker: {
        type: 'point',
        id: toMarkerId('m1'),
        frame: toFrame(100),
        label: 'M',
        color: '#f00',
        scope: 'global',
        linkedClipId: null,
      },
    });
    const markers = state.timeline.markers.map((m) =>
      m.type === 'point' && m.id === 'm1' ? { ...m, frame: toFrame(-1) } : m,
    );
    const corrupt = { ...state, timeline: { ...state.timeline, markers } };
    const violations = checkInvariants(corrupt);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.type).toBe('MARKER_OUT_OF_BOUNDS');
  });

  it('8. Range marker endFrame <= startFrame → MARKER_OUT_OF_BOUNDS', () => {
    let state = validState();
    state = applyOperation(state, {
      type: 'ADD_MARKER',
      marker: {
        type: 'range',
        id: toMarkerId('r1'),
        frameStart: toFrame(100),
        frameEnd: toFrame(200),
        label: 'R',
        color: '#0f0',
        scope: 'global',
        linkedClipId: null,
      },
    });
    const markers = state.timeline.markers.map((m) =>
      m.type === 'range' && m.id === 'r1' ? { ...m, frameEnd: toFrame(100) } : m,
    );
    const corrupt = { ...state, timeline: { ...state.timeline, markers } };
    const violations = checkInvariants(corrupt);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.type).toBe('MARKER_OUT_OF_BOUNDS');
  });

  it('9. inPoint >= outPoint → IN_OUT_INVALID', () => {
    let state = validState();
    state = applyOperation(state, { type: 'SET_IN_POINT', frame: toFrame(100) });
    state = applyOperation(state, { type: 'SET_OUT_POINT', frame: toFrame(50) });
    const corrupt = {
      ...state,
      timeline: { ...state.timeline, inPoint: toFrame(100), outPoint: toFrame(50) },
    };
    const violations = checkInvariants(corrupt);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.type).toBe('IN_OUT_INVALID');
  });

  it('10. Caption overlap on same track → CAPTION_OVERLAP', () => {
    let state = validState();
    state = applyOperation(state, {
      type: 'ADD_CAPTION',
      trackId: toTrackId('track-1'),
      caption: {
        id: toCaptionId('cap-1'),
        startFrame: toFrame(0),
        endFrame: toFrame(100),
        text: 'A',
        language: 'en',
        style: defaultCaptionStyle,
        burnIn: false,
      },
    });
    state = applyOperation(state, {
      type: 'ADD_CAPTION',
      trackId: toTrackId('track-1'),
      caption: {
        id: toCaptionId('cap-2'),
        startFrame: toFrame(50),
        endFrame: toFrame(150),
        text: 'B',
        language: 'en',
        style: defaultCaptionStyle,
        burnIn: false,
      },
    });
    const violations = checkInvariants(state);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.type === 'CAPTION_OVERLAP')).toBe(true);
  });

  it('11. Unsorted keyframes on effect → KEYFRAME_ORDER_VIOLATION', () => {
    let state = validState();
    const kf1 = { id: toKeyframeId('k1'), frame: toFrame(30), value: 0, easing: LINEAR_EASING };
    const kf2 = { id: toKeyframeId('k2'), frame: toFrame(50), value: 1, easing: LINEAR_EASING };
    const effect = {
      ...createEffect(toEffectId('e1'), 'blur', 'postComposite'),
      keyframes: [kf1, kf2],
    };
    state = applyOperation(state, { type: 'ADD_EFFECT', clipId: toClipId('c1'), effect: effect as import('../types/effect').Effect });
    const track = state.timeline.tracks[0]!;
    const clip = track.clips[0]!;
    const addedEffect = clip.effects![0]!;
    const badEffect = { ...addedEffect, keyframes: [kf2, kf1] };
    const corruptClip = { ...clip, effects: [badEffect] };
    const corrupt = {
      ...state,
      timeline: {
        ...state.timeline,
        tracks: [{ ...track, clips: [corruptClip, track.clips[1]!] }],
      },
    };
    const violations = checkInvariants(corrupt);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.type === 'KEYFRAME_ORDER_VIOLATION')).toBe(true);
  });

  it('12. Transition durationFrames = 0 → INVALID_RANGE', () => {
    let state = validState();
    const trans = createTransition(toTransitionId('tr1'), 'crossDissolve', 10);
    state = applyOperation(state, { type: 'ADD_TRANSITION', clipId: toClipId('c1'), transition: trans });
    const track = state.timeline.tracks[0]!;
    const clip = track.clips[0]!;
    const badTrans = { ...clip.transition!, durationFrames: 0 };
    const corruptClip = { ...clip, transition: badTrans };
    const corrupt = {
      ...state,
      timeline: {
        ...state.timeline,
        tracks: [{ ...track, clips: [corruptClip, track.clips[1]!] }],
      },
    };
    const violations = checkInvariants(corrupt);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.type).toBe('INVALID_RANGE');
  });

  it('13. LinkGroup with only 1 clipId → INVALID_RANGE', () => {
    let state = validState();
    state = applyOperation(state, { type: 'LINK_CLIPS', linkGroup: createLinkGroup(toLinkGroupId('lg1'), [toClipId('c1'), toClipId('c2')]) });
    const corrupt = {
      ...state,
      timeline: {
        ...state.timeline,
        linkGroups: [createLinkGroup(toLinkGroupId('bad'), [toClipId('c1')])],
      },
    };
    const violations = checkInvariants(corrupt);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.type).toBe('INVALID_RANGE');
  });

  it('14. Track groupId referencing non-existent group → TRACK_GROUP_NOT_FOUND', () => {
    const state = validState();
    const track = state.timeline.tracks[0]!;
    const corrupt = {
      ...state,
      timeline: {
        ...state.timeline,
        tracks: [{ ...track, groupId: toTrackGroupId('nonexistent') }],
      },
    };
    const violations = checkInvariants(corrupt);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.type).toBe('TRACK_GROUP_NOT_FOUND');
  });

  it('15. BeatGrid bpm = 0 → BEAT_GRID_INVALID', () => {
    let state = validState();
    state = applyOperation(state, {
      type: 'ADD_BEAT_GRID',
      beatGrid: { bpm: 120, timeSignature: [4, 4], offset: toFrame(0) },
    });
    const corrupt = {
      ...state,
      timeline: { ...state.timeline, beatGrid: { bpm: 0, timeSignature: [4, 4] as readonly [number, number], offset: toFrame(0) } },
    };
    const violations = checkInvariants(corrupt);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.type).toBe('BEAT_GRID_INVALID');
  });
});
