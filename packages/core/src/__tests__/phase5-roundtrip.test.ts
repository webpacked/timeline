/**
 * Phase 5 Step 6 — Round-trip gate test
 *
 * This file is the Phase 5 release gate.
 * No new source code is introduced here — tests only.
 */

import { describe, it, expect } from 'vitest';

import { dispatch } from '../engine/dispatcher';
import { checkInvariants } from '../validation/invariants';

import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId, type ClipId } from '../types/clip';
import { createAsset, createGeneratorAsset, toAssetId, type AssetId } from '../types/asset';
import { toGeneratorId } from '../types/generator';
import { toFrame, toTimecode } from '../types/frame';

import { createEffect, toEffectId } from '../types/effect';
import { toKeyframeId } from '../types/keyframe';
import { LINEAR_EASING } from '../types/easing';
import { createTransition, toTransitionId } from '../types/transition';
import { createAnimatableProperty } from '../types/clip-transform';
import { toMarkerId } from '../types/marker';
import { toCaptionId } from '../types/caption';
import { createLinkGroup, toLinkGroupId } from '../types/link-group';
import { createTrackGroup, toTrackGroupId } from '../types/track-group';

import { buildSnapIndex } from '../snap-index';

import { serializeTimeline, deserializeTimeline, remapAssetPaths } from '../engine/serializer';
import { exportToOTIO } from '../engine/otio-export';
import { importFromOTIO } from '../engine/otio-import';
import { exportToEDL } from '../engine/edl-export';
import { exportToAAF } from '../engine/aaf-export';
import { exportToFCPXML } from '../engine/fcpxml-export';

import { createProject, toProjectId } from '../types/project';
import { serializeProject, deserializeProject } from '../engine/project-serializer';
import { addTimeline, removeTimeline } from '../engine/project-ops';

import type { OperationPrimitive, Transaction } from '../types/operations';

let txCounter = 0;
function makeTx(label: string, operations: OperationPrimitive[]): Transaction {
  return { id: `tx-${++txCounter}`, label, timestamp: Date.now(), operations };
}

function applyTx(state: ReturnType<typeof createTimelineState>, label: string, ops: OperationPrimitive[]) {
  const result = dispatch(state, makeTx(label, ops));
  expect(result.accepted).toBe(true);
  if (!result.accepted) throw new Error(result.message);
  expect(checkInvariants(result.nextState)).toEqual([]);
  return result.nextState;
}

function buildComplexState() {
  const fps = 30;
  const durationFrames = 5400;

  const timeline = createTimeline({
    id: 'rt',
    name: 'RoundTripTest',
    fps,
    duration: toFrame(durationFrames),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [],
  });
  let state = createTimelineState({ timeline, assetRegistry: new Map() });

  // Tracks (4)
  const videoTrack1Id = toTrackId('videoTrack1');
  const videoTrack2Id = toTrackId('videoTrack2');
  const audioTrack1Id = toTrackId('audioTrack1');
  const audioTrack2Id = toTrackId('audioTrack2');

  state = applyTx(state, 'Add tracks', [
    { type: 'ADD_TRACK', track: createTrack({ id: videoTrack1Id, name: 'V1', type: 'video', clips: [] }) },
    { type: 'ADD_TRACK', track: createTrack({ id: videoTrack2Id, name: 'V2', type: 'video', clips: [] }) },
    { type: 'ADD_TRACK', track: createTrack({ id: audioTrack1Id, name: 'A1', type: 'audio', clips: [] }) },
    { type: 'ADD_TRACK', track: createTrack({ id: audioTrack2Id, name: 'A2', type: 'audio', clips: [] }) },
  ]);

  // Assets (3)
  const fileAsset1 = createAsset({
    id: 'fileAsset1',
    name: 'clip-a',
    mediaType: 'video',
    filePath: '/media/clip-a.mp4',
    intrinsicDuration: toFrame(10000),
    nativeFps: fps,
    sourceTimecodeOffset: toFrame(0),
  });
  const fileAsset2 = createAsset({
    id: 'fileAsset2',
    name: 'clip-b',
    mediaType: 'video',
    filePath: '/media/clip-b.mp4',
    intrinsicDuration: toFrame(10000),
    nativeFps: fps,
    sourceTimecodeOffset: toFrame(0),
  });
  // Audio assets (core enforces asset.mediaType === track.type)
  const fileAsset1Audio = createAsset({
    id: 'fileAsset1Audio',
    name: 'clip-a-audio',
    mediaType: 'audio',
    filePath: '/media/clip-a.wav',
    intrinsicDuration: toFrame(10000),
    nativeFps: fps,
    sourceTimecodeOffset: toFrame(0),
  });
  const fileAsset2Audio = createAsset({
    id: 'fileAsset2Audio',
    name: 'clip-b-audio',
    mediaType: 'audio',
    filePath: '/media/clip-b.wav',
    intrinsicDuration: toFrame(10000),
    nativeFps: fps,
    sourceTimecodeOffset: toFrame(0),
  });
  const genAsset = createGeneratorAsset({
    id: 'genAsset',
    name: 'Solid',
    mediaType: 'video',
    generatorDef: {
      id: toGeneratorId('gen-1'),
      type: 'solid',
      params: { color: '#fff' },
      duration: toFrame(10000),
      name: 'Solid',
    },
    nativeFps: fps,
  });

  state = applyTx(state, 'Register assets', [
    { type: 'REGISTER_ASSET', asset: fileAsset1 },
    { type: 'REGISTER_ASSET', asset: fileAsset2 },
    { type: 'REGISTER_ASSET', asset: fileAsset1Audio },
    { type: 'REGISTER_ASSET', asset: fileAsset2Audio },
    { type: 'REGISTER_ASSET', asset: genAsset },
  ]);

  // Timeline metadata: in/out + beat grid
  state = applyTx(state, 'Set in/out + beat grid', [
    { type: 'SET_IN_POINT', frame: toFrame(30) },
    { type: 'SET_OUT_POINT', frame: toFrame(5370) },
    { type: 'ADD_BEAT_GRID', beatGrid: { bpm: 120, timeSignature: [4, 4] as const, offset: toFrame(0) } },
  ]);

  // Clips (6 total)
  const clip1Id = toClipId('clip1');
  const clip2Id = toClipId('clip2');
  const clip3Id = toClipId('clip3');
  const clip4Id = toClipId('clip4');
  const clip5Id = toClipId('clip5');
  const clip6Id = toClipId('clip6');

  const clip1 = createClip({
    id: clip1Id,
    assetId: fileAsset1.id,
    trackId: videoTrack1Id,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(900),
    mediaIn: toFrame(0),
    mediaOut: toFrame(900),
  });
  const clip2 = createClip({
    id: clip2Id,
    assetId: fileAsset2.id,
    trackId: videoTrack1Id,
    timelineStart: toFrame(1000),
    timelineEnd: toFrame(1900),
    mediaIn: toFrame(0),
    mediaOut: toFrame(900),
  });
  const clip3 = createClip({
    id: clip3Id,
    assetId: genAsset.id,
    trackId: videoTrack1Id,
    timelineStart: toFrame(2000),
    timelineEnd: toFrame(2900),
    mediaIn: toFrame(0),
    mediaOut: toFrame(900),
  });
  const clip4 = createClip({
    id: clip4Id,
    assetId: fileAsset1.id,
    trackId: videoTrack2Id,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(3000),
    mediaIn: toFrame(0),
    mediaOut: toFrame(3000),
  });
  const clip5 = createClip({
    id: clip5Id,
    assetId: fileAsset1Audio.id,
    trackId: audioTrack1Id,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(900),
    mediaIn: toFrame(0),
    mediaOut: toFrame(900),
  });
  const clip6 = createClip({
    id: clip6Id,
    assetId: fileAsset2Audio.id,
    trackId: audioTrack2Id,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(900),
    mediaIn: toFrame(0),
    mediaOut: toFrame(900),
  });

  state = applyTx(state, 'Insert clips', [
    { type: 'INSERT_CLIP', clip: clip1, trackId: videoTrack1Id },
    { type: 'INSERT_CLIP', clip: clip2, trackId: videoTrack1Id },
    { type: 'INSERT_CLIP', clip: clip3, trackId: videoTrack1Id },
    { type: 'INSERT_CLIP', clip: clip4, trackId: videoTrack2Id },
    { type: 'INSERT_CLIP', clip: clip5, trackId: audioTrack1Id },
    { type: 'INSERT_CLIP', clip: clip6, trackId: audioTrack2Id },
  ]);

  // Effect + keyframes on clip1
  const effectId = toEffectId('effect1');
  const effect = createEffect(effectId, 'blur', 'preComposite', [{ key: 'radius', value: 5 }]);
  state = applyTx(state, 'Add effect', [{ type: 'ADD_EFFECT', clipId: clip1Id, effect }]);
  state = applyTx(state, 'Add keyframes', [
    {
      type: 'ADD_KEYFRAME',
      clipId: clip1Id,
      effectId,
      keyframe: { id: toKeyframeId('kf1'), frame: toFrame(0), value: 0, easing: LINEAR_EASING },
    },
    {
      type: 'ADD_KEYFRAME',
      clipId: clip1Id,
      effectId,
      keyframe: { id: toKeyframeId('kf2'), frame: toFrame(899), value: 10, easing: LINEAR_EASING },
    },
  ]);

  // Transition on clip1
  state = applyTx(state, 'Add transition', [
    {
      type: 'ADD_TRANSITION',
      clipId: clip1Id,
      transition: createTransition(
        toTransitionId('tr1'),
        'dissolve',
        15,
        'centerOnCut',
        LINEAR_EASING,
      ),
    },
  ]);

  // Clip transform on clip2: opacity.value = 0.8
  state = applyTx(state, 'Set clip2 opacity', [
    {
      type: 'SET_CLIP_TRANSFORM',
      clipId: clip2Id,
      transform: { opacity: createAnimatableProperty(0.8) },
    },
  ]);

  // Audio properties on clip5: gain = -3, mute false
  state = applyTx(state, 'Set clip5 audio', [
    {
      type: 'SET_AUDIO_PROPERTIES',
      clipId: clip5Id,
      properties: { gain: createAnimatableProperty(-3), mute: false },
    },
  ]);

  // Markers (3)
  state = applyTx(state, 'Add markers', [
    {
      type: 'ADD_MARKER',
      marker: {
        type: 'point',
        id: toMarkerId('m-scene2'),
        frame: toFrame(900),
        label: 'Scene 2',
        color: 'red',
        scope: 'global',
        linkedClipId: null,
      },
    },
    {
      type: 'ADD_MARKER',
      marker: {
        type: 'range',
        id: toMarkerId('m-act1'),
        frameStart: toFrame(1000),
        frameEnd: toFrame(1900),
        label: 'Act 1',
        color: 'blue',
        scope: 'global',
        linkedClipId: null,
      },
    },
    {
      type: 'ADD_MARKER',
      marker: {
        type: 'point',
        id: toMarkerId('m-vfx'),
        frame: toFrame(450),
        label: 'VFX shot',
        color: 'green',
        scope: 'global',
        linkedClipId: clip1Id,
        clipId: clip1Id,
      },
    },
  ]);

  // LinkGroup: clip1 + clip5
  state = applyTx(state, 'Link A/V', [
    {
      type: 'LINK_CLIPS',
      linkGroup: createLinkGroup(toLinkGroupId('lg1'), [clip1Id, clip5Id]),
    },
  ]);

  // TrackGroup: videoTrack1 + audioTrack1
  state = applyTx(state, 'Track group', [
    {
      type: 'ADD_TRACK_GROUP',
      trackGroup: createTrackGroup(toTrackGroupId('tg1'), 'Cam A', [videoTrack1Id, audioTrack1Id]),
    },
  ]);

  // Caption on audioTrack1
  state = applyTx(state, 'Add caption', [
    {
      type: 'ADD_CAPTION',
      trackId: audioTrack1Id,
      caption: {
        id: toCaptionId('cap1'),
        text: 'Hello world',
        startFrame: toFrame(0),
        endFrame: toFrame(90),
        language: 'en-US',
        burnIn: false,
      },
    },
  ]);

  return {
    state,
    ids: {
      clip1Id,
      clip2Id,
      clip3Id,
      clip4Id,
      clip5Id,
      clip6Id,
      fileAsset1Id: fileAsset1.id as AssetId,
      fileAsset2Id: fileAsset2.id as AssetId,
      genAssetId: genAsset.id as AssetId,
      videoTrack1Id,
      videoTrack2Id,
      audioTrack1Id,
      audioTrack2Id,
    },
  };
}

function countAllClips(state: ReturnType<typeof buildComplexState>['state']): number {
  return state.timeline.tracks.reduce((acc, t) => acc + t.clips.length, 0);
}

describe('Phase 5 — Round-trip gate', () => {
  // Baseline
  it('buildComplexState() passes checkInvariants() with 0 violations', () => {
    const { state } = buildComplexState();
    expect(checkInvariants(state)).toEqual([]);
  });

  // JSON round-trip
  it('serialize → deserialize produces 0 invariant violations', () => {
    const { state } = buildComplexState();
    const round = deserializeTimeline(serializeTimeline(state));
    expect(checkInvariants(round)).toEqual([]);
  });

  it('clip count preserved after round-trip (6 clips)', () => {
    const { state } = buildComplexState();
    const round = deserializeTimeline(serializeTimeline(state));
    expect(countAllClips(round)).toBe(6);
  });

  it('marker count preserved (3 markers)', () => {
    const { state } = buildComplexState();
    const round = deserializeTimeline(serializeTimeline(state));
    expect(round.timeline.markers).toHaveLength(3);
  });

  it('effect on clip1 preserved (keyframes intact)', () => {
    const { state, ids } = buildComplexState();
    const round = deserializeTimeline(serializeTimeline(state));
    const clip1 = round.timeline.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === ids.clip1Id)!;
    expect(clip1.effects).toBeDefined();
    expect(clip1.effects![0]!.effectType).toBe('blur');
    expect(clip1.effects![0]!.keyframes).toHaveLength(2);
    expect(clip1.effects![0]!.keyframes[0]!.frame).toBe(0);
    expect(clip1.effects![0]!.keyframes[1]!.frame).toBe(899);
  });

  it('transition on clip1 preserved', () => {
    const { state, ids } = buildComplexState();
    const round = deserializeTimeline(serializeTimeline(state));
    const clip1 = round.timeline.tracks.flatMap((t) => t.clips).find((c) => c.id === ids.clip1Id)!;
    expect(clip1.transition).toBeDefined();
    expect(clip1.transition!.type).toBe('dissolve');
    expect(clip1.transition!.durationFrames).toBe(15);
  });

  it('LinkGroup preserved (clip1 + clip5)', () => {
    const { state, ids } = buildComplexState();
    const round = deserializeTimeline(serializeTimeline(state));
    const groups = round.timeline.linkGroups ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0]!.clipIds).toEqual([ids.clip1Id, ids.clip5Id]);
  });

  it('TrackGroup preserved with correct trackIds', () => {
    const { state, ids } = buildComplexState();
    const round = deserializeTimeline(serializeTimeline(state));
    const groups = round.timeline.trackGroups ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0]!.trackIds).toEqual([ids.videoTrack1Id, ids.audioTrack1Id]);
  });

  it('Caption on audioTrack1 preserved', () => {
    const { state, ids } = buildComplexState();
    const round = deserializeTimeline(serializeTimeline(state));
    const t = round.timeline.tracks.find((x) => x.id === ids.audioTrack1Id)!;
    expect(t.captions).toHaveLength(1);
    expect(t.captions[0]!.text).toBe('Hello world');
  });

  it('serialize → deserialize → serialize produces identical JSON strings (idempotent)', () => {
    const { state } = buildComplexState();
    const s1 = serializeTimeline(state);
    const s2 = serializeTimeline(deserializeTimeline(s1));
    expect(s2).toBe(s1);
  });

  // Asset remapper
  it('remapAssetPaths replaces all FileAsset paths (new present, old gone)', () => {
    const { state } = buildComplexState();
    const remapped = remapAssetPaths(state, (a) => ({ ...a, filePath: `/rel${a.filePath}` }));
    const values = Array.from(remapped.assetRegistry.values());
    const paths = values.filter((a) => a.kind === 'file').map((a) => (a as any).filePath);
    expect(paths).toContain('/rel/media/clip-a.mp4');
    expect(paths).toContain('/rel/media/clip-b.mp4');
    expect(paths).not.toContain('/media/clip-a.mp4');
    expect(paths).not.toContain('/media/clip-b.mp4');
    expect(checkInvariants(remapped)).toEqual([]);
  });

  it('GeneratorAsset unchanged after remap', () => {
    const { state, ids } = buildComplexState();
    const remapped = remapAssetPaths(state, (a) => ({ ...a, filePath: `/rel${a.filePath}` }));
    const gen = remapped.assetRegistry.get(ids.genAssetId)!;
    expect(gen.kind).toBe('generator');
    expect((gen as any).generatorDef.type).toBe('solid');
  });

  // OTIO round-trip
  it('exportToOTIO produces 4 Track children (one per track)', () => {
    const { state } = buildComplexState();
    const doc = exportToOTIO(state);
    expect(doc.tracks.children).toHaveLength(4);
  });

  it('importFromOTIO(exportToOTIO(state)) gives state with 6 clips total', () => {
    const { state } = buildComplexState();
    const round = importFromOTIO(exportToOTIO(state));
    expect(checkInvariants(round)).toEqual([]);
    expect(countAllClips(round)).toBe(6);
  });

  it('OTIO round-trip: clip durations preserved', () => {
    const { state, ids } = buildComplexState();
    const round = importFromOTIO(exportToOTIO(state));
    const clip1 = round.timeline.tracks.flatMap((t) => t.clips).find((c) => c.id === ids.clip1Id)!;
    expect((clip1.timelineEnd - clip1.timelineStart) as number).toBe(900);
  });

  it('OTIO round-trip: gap between clip1 and clip2 produces Gap in export', () => {
    const { state } = buildComplexState();
    const doc = exportToOTIO(state);
    const v1 = doc.tracks.children.find((t) => t.kind === 'Video')!;
    const gaps = v1.children.filter((c) => (c as any).OTIO_SCHEMA === 'Gap.1');
    expect(gaps.length).toBeGreaterThan(0);
    const has100 = gaps.some((g) => (g as any).source_range.duration.value === 100);
    expect(has100).toBe(true);
  });

  // EDL
  it('exportToEDL produces correct event count for videoTrack1 (3 events)', () => {
    const { state } = buildComplexState();
    const edl = exportToEDL(state, { trackIndex: 0 });
    const events = edl.split('\n').filter((l) => /^\d{3}\s+/.test(l));
    expect(events).toHaveLength(3);
  });

  it('EDL timecode for clip1 recIn = \"00:00:00:00\"', () => {
    const { state } = buildComplexState();
    const edl = exportToEDL(state, { trackIndex: 0 });
    const line1 = edl.split('\n').find((l) => l.startsWith('001 '))!;
    expect(line1).toContain('00:00:00:00');
  });

  it('EDL timecode for clip2 recIn = \"00:00:33:10\" (frame 1000 @30fps)', () => {
    const { state } = buildComplexState();
    const edl = exportToEDL(state, { trackIndex: 0 });
    const line2 = edl.split('\n').find((l) => l.startsWith('002 '))!;
    expect(line2).toContain('00:00:33:10');
  });

  // AAF
  it('exportToAAF contains MasterMob for each of the 6 clips', () => {
    const { state, ids } = buildComplexState();
    const xml = exportToAAF(state);
    const clipIds: ClipId[] = [ids.clip1Id, ids.clip2Id, ids.clip3Id, ids.clip4Id, ids.clip5Id, ids.clip6Id];
    clipIds.forEach((id) => expect(xml).toContain(`mobID="${id}"`));
  });

  it('CompositionMob has 4 TimelineMobSlots', () => {
    const { state } = buildComplexState();
    const xml = exportToAAF(state);
    const slots = (xml.match(/<TimelineMobSlot slotID=/g)) ?? [];
    expect(slots).toHaveLength(4);
  });

  // FCPXML
  it('exportToFCPXML contains <asset> for fileAsset1 and fileAsset2', () => {
    const { state, ids } = buildComplexState();
    const xml = exportToFCPXML(state);
    expect(xml).toContain(`<asset id="${ids.fileAsset1Id}"`);
    expect(xml).toContain(`<asset id="${ids.fileAsset2Id}"`);
  });

  it('exportToFCPXML contains <effect> for genAsset', () => {
    const { state, ids } = buildComplexState();
    const xml = exportToFCPXML(state);
    expect(xml).toContain(`<effect id="${ids.genAssetId}"`);
  });

  it('Clip1 offset in FCPXML = \"0/30s\" → \"0s\"', () => {
    const { state } = buildComplexState();
    const xml = exportToFCPXML(state);
    expect(xml).toContain('offset="0s"');
  });

  // BeatGrid snap
  it('buildSnapIndex(state) includes frame 15', () => {
    const { state } = buildComplexState();
    const idx = buildSnapIndex(state, toFrame(0));
    const has15 = idx.points.some((p) => p.type === 'BeatGrid' && (p.frame as number) === 15);
    expect(has15).toBe(true);
  });

  it('buildSnapIndex(state) includes frame 30', () => {
    const { state } = buildComplexState();
    const idx = buildSnapIndex(state, toFrame(0));
    const has30 = idx.points.some((p) => p.type === 'BeatGrid' && (p.frame as number) === 30);
    expect(has30).toBe(true);
  });

  it('No beat frame exceeds durationFrames (5400)', () => {
    const { state } = buildComplexState();
    const idx = buildSnapIndex(state, toFrame(0));
    const beats = idx.points.filter((p) => p.type === 'BeatGrid');
    expect(beats.every((b) => (b.frame as number) < 5400)).toBe(true);
  });

  // Project round-trip
  it('createProject with complexState round-trips via serializeProject → deserializeProject', () => {
    const { state } = buildComplexState();
    const p = createProject(toProjectId('proj1'), 'Project', [state]);
    const raw = serializeProject(p);
    const restored = deserializeProject(raw);
    expect(restored.timelines).toHaveLength(1);
    expect(checkInvariants(restored.timelines[0]!)).toEqual([]);
  });

  it('Deserialized project has 1 timeline with 6 clips', () => {
    const { state } = buildComplexState();
    const p = createProject(toProjectId('proj1'), 'Project', [state]);
    const restored = deserializeProject(serializeProject(p));
    expect(countAllClips(restored.timelines[0]!)).toBe(6);
  });

  it('addTimeline → removeTimeline → timeline count returns to original', () => {
    const { state } = buildComplexState();
    const p0 = createProject(toProjectId('proj1'), 'Project', [state]);
    const extra = makeMinimalTimelineState('extra');
    const p1 = addTimeline(p0, extra);
    expect(p1.timelines).toHaveLength(2);
    const p2 = removeTimeline(p1, extra.timeline.id);
    expect(p2.timelines).toHaveLength(1);
  });
});

function makeMinimalTimelineState(timelineId: string) {
  const asset = createAsset({
    id: `asset-${timelineId}`,
    name: 'V',
    mediaType: 'video',
    filePath: `/media/${timelineId}.mp4`,
    intrinsicDuration: toFrame(1000),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });
  const trackId = toTrackId('t1');
  const clip = createClip({
    id: toClipId(`clip-${timelineId}`),
    assetId: asset.id,
    trackId,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(10),
    mediaIn: toFrame(0),
    mediaOut: toFrame(10),
  });
  const track = createTrack({ id: trackId, name: 'V', type: 'video', clips: [clip] });
  const timeline = createTimeline({
    id: timelineId,
    name: timelineId,
    fps: 30,
    duration: toFrame(1000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[asset.id, asset]]) });
}

