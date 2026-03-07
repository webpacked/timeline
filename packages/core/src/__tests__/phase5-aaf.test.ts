/**
 * Phase 5 Step 4 — AAF and FCP XML export
 *
 * Fixture: 30fps, two tracks (video + audio), three clips, one gap,
 * one FileAsset, one GeneratorAsset.
 */

import { describe, it, expect } from 'vitest';
import { exportToAAF, type AAFExportOptions } from '../engine/aaf-export';
import { exportToFCPXML, toFCPTime, type FCPXMLExportOptions } from '../engine/fcpxml-export';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset, createGeneratorAsset, type AssetId, type Asset } from '../types/asset';
import { toGeneratorId } from '../types/generator';
import { toFrame, toTimecode } from '../types/frame';

// ── Fixture: 30fps, video + audio, 3 clips, 1 gap, FileAsset + GeneratorAsset ──

function makeAAFFixtureState() {
  const fileAsset = createAsset({
    id: 'asset-file',
    name: 'My File',
    mediaType: 'video',
    filePath: '/path/to/file.mp4',
    intrinsicDuration: toFrame(300),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });
  const genAsset = createGeneratorAsset({
    id: 'asset-gen',
    name: 'Solid',
    mediaType: 'video',
    generatorDef: {
      id: toGeneratorId('gen-1'),
      type: 'solid',
      params: {},
      duration: toFrame(100),
      name: 'S',
    },
    nativeFps: 30,
  });
  const clip1 = createClip({
    id: 'clip-1',
    assetId: 'asset-file',
    trackId: 'track-v',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(50),
    mediaIn: toFrame(0),
    mediaOut: toFrame(50),
  });
  const clip2 = createClip({
    id: 'clip-2',
    assetId: 'asset-gen',
    trackId: 'track-v',
    timelineStart: toFrame(100),
    timelineEnd: toFrame(150),
    mediaIn: toFrame(0),
    mediaOut: toFrame(50),
  });
  const clip3 = createClip({
    id: 'clip-3',
    assetId: 'asset-file',
    trackId: 'track-v',
    timelineStart: toFrame(150),
    timelineEnd: toFrame(200),
    mediaIn: toFrame(0),
    mediaOut: toFrame(50),
  });
  const clipA1 = createClip({
    id: 'clip-a1',
    assetId: 'asset-file',
    trackId: 'track-a',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(80),
    mediaIn: toFrame(0),
    mediaOut: toFrame(80),
  });
  const clipA2 = createClip({
    id: 'clip-a2',
    assetId: 'asset-file',
    trackId: 'track-a',
    timelineStart: toFrame(100),
    timelineEnd: toFrame(150),
    mediaIn: toFrame(0),
    mediaOut: toFrame(50),
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
    clips: [clipA1, clipA2],
  });
  const timeline = createTimeline({
    id: 'tl',
    name: 'AAF Fixture',
    fps: 30,
    duration: toFrame(1000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [trackV, trackA],
  });
  const registry = new Map<AssetId, Asset>([
    [fileAsset.id, fileAsset],
    [genAsset.id, genAsset],
  ]);
  return createTimelineState({ timeline, assetRegistry: registry });
}

// ── AAF tests ─────────────────────────────────────────────────────────────

describe('Phase 5 — AAF export', () => {
  it('output starts with <?xml and contains <AAF', () => {
    const state = makeAAFFixtureState();
    const aaf = exportToAAF(state);
    expect(aaf.startsWith('<?xml')).toBe(true);
    expect(aaf).toContain('<AAF');
  });

  it('projectName from options.projectName', () => {
    const state = makeAAFFixtureState();
    const aaf = exportToAAF(state, { projectName: 'My Project' });
    expect(aaf).toContain('projectName="My Project"');
  });

  it('one MasterMob per clip', () => {
    const state = makeAAFFixtureState();
    const aaf = exportToAAF(state);
    const masterMobs = (aaf.match(/<MasterMob/g)) ?? [];
    expect(masterMobs.length).toBe(5);
  });

  it('MasterMob has correct mobID (= clipId)', () => {
    const state = makeAAFFixtureState();
    const aaf = exportToAAF(state);
    expect(aaf).toContain('mobID="clip-1"');
    expect(aaf).toContain('mobID="clip-2"');
  });

  it('CompositionMob has one TimelineMobSlot per track', () => {
    const state = makeAAFFixtureState();
    const aaf = exportToAAF(state);
    const slots = (aaf.match(/<TimelineMobSlot slotID=/g)) ?? [];
    expect(slots.length).toBe(2);
  });

  it('video track → dataDefinition Picture', () => {
    const state = makeAAFFixtureState();
    const aaf = exportToAAF(state);
    expect(aaf).toContain('dataDefinition="Picture"');
  });

  it('audio track → dataDefinition Sound', () => {
    const state = makeAAFFixtureState();
    const aaf = exportToAAF(state);
    expect(aaf).toContain('dataDefinition="Sound"');
  });

  it('gap emits <Filler> with correct length', () => {
    const state = makeAAFFixtureState();
    const aaf = exportToAAF(state);
    expect(aaf).toContain('<Filler');
    expect(aaf).toContain('length="50"');
  });

  it('FileAsset sourceRef = asset path', () => {
    const state = makeAAFFixtureState();
    const aaf = exportToAAF(state);
    expect(aaf).toContain('sourceRef="/path/to/file.mp4"');
  });

  it('GeneratorAsset sourceRef = generatorType', () => {
    const state = makeAAFFixtureState();
    const aaf = exportToAAF(state);
    expect(aaf).toContain('sourceRef="solid"');
  });

  it('XML special chars in clip name are escaped', () => {
    const state = makeAAFFixtureState();
    const clipAmp = createClip({
      id: 'clip-&<>',
      assetId: 'asset-file',
      trackId: 'track-v',
      timelineStart: toFrame(0),
      timelineEnd: toFrame(10),
      mediaIn: toFrame(0),
      mediaOut: toFrame(10),
    });
    const track = createTrack({
      id: 'track-v',
      name: 'V',
      type: 'video',
      clips: [clipAmp],
    });
    const timeline = createTimeline({
      id: 'tl',
      name: 'T',
      fps: 30,
      duration: toFrame(100),
      startTimecode: toTimecode('00:00:00:00'),
      tracks: [track],
    });
    const state2 = createTimelineState({
      timeline,
      assetRegistry: state.assetRegistry,
    });
    const aaf = exportToAAF(state2);
    expect(aaf).toContain('&amp;');
    expect(aaf).toContain('&lt;');
    expect(aaf).toContain('&gt;');
  });
});

// ── FCPXML tests ───────────────────────────────────────────────────────────

describe('Phase 5 — FCPXML export', () => {
  it('output starts with <?xml and contains <fcpxml', () => {
    const state = makeAAFFixtureState();
    const xml = exportToFCPXML(state);
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<fcpxml');
  });

  it('fcpxml version="1.10"', () => {
    const state = makeAAFFixtureState();
    const xml = exportToFCPXML(state);
    expect(xml).toContain('version="1.10"');
  });

  it('<format> element present in resources', () => {
    const state = makeAAFFixtureState();
    const xml = exportToFCPXML(state);
    expect(xml).toContain('<format id="r1"');
    expect(xml).toContain('FFVideoFormat');
  });

  it('FileAsset emits <asset> with src="file://{path}"', () => {
    const state = makeAAFFixtureState();
    const xml = exportToFCPXML(state);
    expect(xml).toContain('<asset');
    expect(xml).toContain('file://');
    expect(xml).toContain('file.mp4');
  });

  it('GeneratorAsset emits <effect> in resources', () => {
    const state = makeAAFFixtureState();
    const xml = exportToFCPXML(state);
    expect(xml).toContain('<effect id="asset-gen"');
    expect(xml).toContain('Generators.localized');
  });

  it('clip offset is correct rational time string', () => {
    const state = makeAAFFixtureState();
    const xml = exportToFCPXML(state);
    expect(xml).toContain('offset="0s"');
    expect(xml).toContain('offset="100/30s"');
  });

  it('gap emits <gap> element', () => {
    const state = makeAAFFixtureState();
    const xml = exportToFCPXML(state);
    expect(xml).toContain('<gap name="Gap"');
  });

  it('toFCPTime(90, 30) === "90/30s"', () => {
    expect(toFCPTime(90, 30)).toBe('90/30s');
  });

  it('toFCPTime(0, 30) === "0s"', () => {
    expect(toFCPTime(0, 30)).toBe('0s');
  });

  it('options.libraryName and options.eventName applied', () => {
    const state = makeAAFFixtureState();
    const xml = exportToFCPXML(state, {
      libraryName: 'MyLib',
      eventName: 'MyEvent',
    });
    expect(xml).toContain('name="MyLib"');
    expect(xml).toContain('name="MyEvent"');
  });
});
