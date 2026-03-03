/**
 * Phase 5 Step 2 — OTIO interchange
 *
 * exportToOTIO, importFromOTIO. Pure functions. No IO.
 */

import { describe, it, expect } from 'vitest';
import { exportToOTIO } from '../engine/otio-export';
import { importFromOTIO, type OTIOImportOptions } from '../engine/otio-import';
import { SerializationError } from '../engine/serialization-error';
import { checkInvariants } from '../validation/invariants';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset, createGeneratorAsset } from '../types/asset';
import { createEffect, toEffectId } from '../types/effect';
import { toFrame, toTimecode } from '../types/frame';
import { toMarkerId } from '../types/marker';
import { toGeneratorId } from '../types/generator';
import { applyOperation } from '../engine/apply';

// ── Fixture: 30fps, two tracks (video + audio), three clips with gaps, one marker, one effect on clip1 ──

function makeOTIOFixtureState() {
  const assetV1 = createAsset({
    id: 'asset-v1',
    name: 'V1',
    mediaType: 'video',
    filePath: '/media/v1.mp4',
    intrinsicDuration: toFrame(500),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });
  const assetV2 = createAsset({
    id: 'asset-v2',
    name: 'V2',
    mediaType: 'video',
    filePath: '/media/v2.mp4',
    intrinsicDuration: toFrame(400),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });
  const assetA1 = createAsset({
    id: 'asset-a1',
    name: 'A1',
    mediaType: 'audio',
    filePath: '/media/a1.wav',
    intrinsicDuration: toFrame(600),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });
  const effect1 = createEffect(toEffectId('eff-1'), 'blur', 'preComposite', [{ key: 'radius', value: 5 }]);
  const clip1 = createClip({
    id: 'clip-1',
    assetId: 'asset-v1',
    trackId: 'track-v',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(50),
    mediaIn: toFrame(0),
    mediaOut: toFrame(50),
    effects: [effect1],
  });
  const clip2 = createClip({
    id: 'clip-2',
    assetId: 'asset-v1',
    trackId: 'track-v',
    timelineStart: toFrame(100),
    timelineEnd: toFrame(150),
    mediaIn: toFrame(0),
    mediaOut: toFrame(50),
  });
  const clip3 = createClip({
    id: 'clip-3',
    assetId: 'asset-v2',
    trackId: 'track-v',
    timelineStart: toFrame(200),
    timelineEnd: toFrame(250),
    mediaIn: toFrame(0),
    mediaOut: toFrame(50),
  });
  const clipA1 = createClip({
    id: 'clip-a1',
    assetId: 'asset-a1',
    trackId: 'track-a',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(80),
    mediaIn: toFrame(0),
    mediaOut: toFrame(80),
  });
  const trackV = createTrack({
    id: 'track-v',
    name: 'V1',
    type: 'video',
    clips: [clip1, clip2, clip3],
  });
  const trackA = createTrack({
    id: 'track-a',
    name: 'A1',
    type: 'audio',
    clips: [clipA1],
  });
  const marker = {
    type: 'point' as const,
    id: toMarkerId('m1'),
    frame: toFrame(25),
    label: 'Cue',
    color: '#f00',
    scope: 'global' as const,
    linkedClipId: null,
  };
  const timeline = createTimeline({
    id: 'tl',
    name: 'OTIO Fixture',
    fps: 30,
    duration: toFrame(3000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [trackV, trackA],
    markers: [marker],
  });
  const state = createTimelineState({
    timeline,
    assetRegistry: new Map([
      [assetV1.id, assetV1],
      [assetV2.id, assetV2],
      [assetA1.id, assetA1],
    ]),
  });
  expect(checkInvariants(state)).toEqual([]);
  return state;
}

// ── Export tests ───────────────────────────────────────────────────────────

describe('Phase 5 — OTIO Export', () => {
  it('exportToOTIO produces OTIO_SCHEMA "Timeline.1"', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    expect(doc.OTIO_SCHEMA).toBe('Timeline.1');
  });

  it('Track children have correct OTIO_SCHEMA "Track.1"', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    const tracks = doc.tracks.children;
    expect(tracks.length).toBeGreaterThanOrEqual(1);
    tracks.forEach((t) => expect(t.OTIO_SCHEMA).toBe('Track.1'));
  });

  it('Clip source_range duration matches clip durationFrames', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    const videoTrack = doc.tracks.children[0]!;
    const firstClip = videoTrack.children.find((c) => (c as { OTIO_SCHEMA: string }).OTIO_SCHEMA === 'Clip.1') as {
      source_range: { duration: { value: number } };
    } | undefined;
    expect(firstClip).toBeDefined();
    expect(firstClip!.source_range.duration.value).toBe(50);
  });

  it('Gap inserted between non-adjacent clips', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    const videoTrack = doc.tracks.children[0]!;
    const gaps = videoTrack.children.filter((c) => (c as { OTIO_SCHEMA: string }).OTIO_SCHEMA === 'Gap.1');
    expect(gaps.length).toBe(2);
    expect((gaps[0] as { source_range: { duration: { value: number } } }).source_range.duration.value).toBe(50);
    expect((gaps[1] as { source_range: { duration: { value: number } } }).source_range.duration.value).toBe(50);
  });

  it('FileAsset maps to ExternalReference with target_url', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    const videoTrack = doc.tracks.children[0]!;
    const clip = videoTrack.children.find((c) => (c as { OTIO_SCHEMA: string }).OTIO_SCHEMA === 'Clip.1') as {
      media_reference: { OTIO_SCHEMA: string; target_url?: string };
    };
    expect(clip.media_reference.OTIO_SCHEMA).toBe('ExternalReference.1');
    expect(clip.media_reference.target_url).toBe('/media/v1.mp4');
  });

  it('GeneratorAsset maps to GeneratorReference', () => {
    const genAsset = createGeneratorAsset({
      id: 'gen-1',
      name: 'Solid',
      mediaType: 'video',
      generatorDef: {
        id: toGeneratorId('gen-1'),
        type: 'solid',
        params: {},
        duration: toFrame(60),
        name: 'S',
      },
      nativeFps: 30,
    });
    const clip = createClip({
      id: 'cgen',
      assetId: 'gen-1',
      trackId: 'track-v',
      timelineStart: toFrame(0),
      timelineEnd: toFrame(30),
      mediaIn: toFrame(0),
      mediaOut: toFrame(30),
    });
    const track = createTrack({ id: 'track-v', name: 'V', type: 'video', clips: [clip] });
    const timeline = createTimeline({
      id: 'tl',
      name: 'T',
      fps: 30,
      duration: toFrame(100),
      startTimecode: toTimecode('00:00:00:00'),
      tracks: [track],
    });
    const state = createTimelineState({
      timeline,
      assetRegistry: new Map([[genAsset.id, genAsset]]),
    });
    const doc = exportToOTIO(state);
    const otioClip = doc.tracks.children[0]!.children[0] as { media_reference: { OTIO_SCHEMA: string; generator_kind?: string } };
    expect(otioClip.media_reference.OTIO_SCHEMA).toBe('GeneratorReference.1');
    expect(otioClip.media_reference.generator_kind).toBe('solid');
  });

  it('Effect exported in clip effects array', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    const videoTrack = doc.tracks.children[0]!;
    const firstClip = videoTrack.children.find((c) => (c as { OTIO_SCHEMA: string }).OTIO_SCHEMA === 'Clip.1') as {
      effects?: Array<{ effect_name: string }>;
    };
    expect(firstClip.effects).toHaveLength(1);
    expect(firstClip.effects![0]!.effect_name).toBe('blur');
  });

  it('Timeline marker exported at top level', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    expect(doc.markers).toHaveLength(1);
    expect(doc.markers[0]!.name).toBe('Cue');
  });

  it('Point marker has duration 0', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    expect(doc.markers[0]!.marked_range.duration.value).toBe(0);
  });

  it('Range marker has duration = endFrame - frame', () => {
    const state = makeOTIOFixtureState();
    const rangeMarker = {
      type: 'range' as const,
      id: toMarkerId('r1'),
      frameStart: toFrame(10),
      frameEnd: toFrame(40),
      label: 'Range',
      color: '#0f0',
      scope: 'global' as const,
      linkedClipId: null,
    };
    const timeline = createTimeline({
      id: 'tl',
      name: 'T',
      fps: 30,
      duration: toFrame(100),
      startTimecode: toTimecode('00:00:00:00'),
      tracks: [],
      markers: [rangeMarker],
    });
    const state2 = createTimelineState({ timeline, assetRegistry: new Map() });
    const doc = exportToOTIO(state2);
    expect(doc.markers[0]!.marked_range.duration.value).toBe(30);
  });

  it('Audio track has kind "Audio"', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    const audioTrack = doc.tracks.children.find((t) => (t as { kind: string }).kind === 'Audio');
    expect(audioTrack).toBeDefined();
    expect((audioTrack as { kind: string }).kind).toBe('Audio');
  });
});

// ── Import tests ───────────────────────────────────────────────────────────

describe('Phase 5 — OTIO Import', () => {
  it('importFromOTIO round-trips a simple timeline', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    const json = JSON.stringify(doc);
    const parsed = JSON.parse(json);
    const restored = importFromOTIO(parsed);
    expect(restored.timeline.tracks.length).toBe(2);
    expect(restored.timeline.tracks[0]!.clips.length).toBe(3);
    expect(restored.timeline.markers.length).toBe(1);
  });

  it('Clips placed at correct startFrame (cumulative gap + clip durations)', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    const restored = importFromOTIO(doc);
    const videoTrack = restored.timeline.tracks[0]!;
    expect(videoTrack.clips[0]!.timelineStart).toBe(0);
    expect(videoTrack.clips[1]!.timelineStart).toBe(100);
    expect(videoTrack.clips[2]!.timelineStart).toBe(200);
  });

  it('Gap.1 advances cursor without creating a clip', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    const restored = importFromOTIO(doc);
    const videoTrack = restored.timeline.tracks[0]!;
    expect(videoTrack.clips.length).toBe(3);
  });

  it('ExternalReference creates FileAsset in state', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    const restored = importFromOTIO(doc);
    expect(restored.assetRegistry.size).toBeGreaterThanOrEqual(3);
    const hasFile = Array.from(restored.assetRegistry.values()).some(
      (a) => a.kind === 'file' && a.filePath === '/media/v1.mp4',
    );
    expect(hasFile).toBe(true);
  });

  it('Markers imported: point → point, range → range', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    const restored = importFromOTIO(doc);
    expect(restored.timeline.markers[0]!.type).toBe('point');
    const rangeDoc = exportToOTIO(
      createTimelineState({
        timeline: createTimeline({
          id: 'tl',
          name: 'T',
          fps: 30,
          duration: toFrame(100),
          startTimecode: '00:00:00:00' as import('../types/frame').Timecode,
          tracks: [],
          markers: [
            {
              type: 'range',
              id: toMarkerId('r1'),
              frameStart: toFrame(10),
              frameEnd: toFrame(50),
              label: 'R',
              color: '#0f0',
              scope: 'global',
              linkedClipId: null,
            },
          ],
        }),
        assetRegistry: new Map(),
      }),
    );
    const restoredRange = importFromOTIO(rangeDoc);
    expect(restoredRange.timeline.markers[0]!.type).toBe('range');
  });

  it('importFromOTIO throws SerializationError on non-Timeline OTIO doc', () => {
    expect(() => importFromOTIO({ OTIO_SCHEMA: 'Clip.1' })).toThrow(SerializationError);
    expect(() => importFromOTIO({})).toThrow(SerializationError);
  });

  it('fps override in options is respected', () => {
    const state = makeOTIOFixtureState();
    const doc = exportToOTIO(state);
    const opts: OTIOImportOptions = { fps: 24 };
    const restored = importFromOTIO(doc, opts);
    expect(restored.timeline.fps).toBe(24);
  });

  it('Round-trip: export → JSON → parse → import → export produces structurally equivalent OTIO doc', () => {
    const state = makeOTIOFixtureState();
    const doc1 = exportToOTIO(state);
    const json = JSON.stringify(doc1);
    const parsed = JSON.parse(json);
    const restored = importFromOTIO(parsed);
    const doc2 = exportToOTIO(restored);
    expect(doc2.tracks.children.length).toBe(doc1.tracks.children.length);
    const videoTrack1 = doc1.tracks.children[0]!;
    const videoTrack2 = doc2.tracks.children[0]!;
    expect(videoTrack2.children.length).toBe(videoTrack1.children.length);
    const clips1 = videoTrack1.children.filter((c) => (c as { OTIO_SCHEMA: string }).OTIO_SCHEMA === 'Clip.1');
    const clips2 = videoTrack2.children.filter((c) => (c as { OTIO_SCHEMA: string }).OTIO_SCHEMA === 'Clip.1');
    expect(clips2.length).toBe(clips1.length);
    clips1.forEach((c, i) => {
      const d1 = (c as { source_range: { duration: { value: number } } }).source_range.duration.value;
      const d2 = (clips2[i] as { source_range: { duration: { value: number } } }).source_range.duration.value;
      expect(d2).toBe(d1);
    });
  });
});
