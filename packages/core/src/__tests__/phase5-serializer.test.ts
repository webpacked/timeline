/**
 * Phase 5 Step 1 — JSON schema + migrator
 *
 * Serializer, migrator, remapAssetPaths, findOfflineAssets.
 * Pure functions only. No IO.
 */

import { describe, it, expect } from 'vitest';
import {
  serializeTimeline,
  deserializeTimeline,
  SerializationError,
  remapAssetPaths,
  findOfflineAssets,
  type AssetRemapCallback,
} from '../engine/serializer';
import { migrate, CURRENT_SCHEMA_VERSION } from '../engine/migrator';
import { checkInvariants } from '../validation/invariants';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset, createGeneratorAsset, toAssetId } from '../types/asset';
import { toGeneratorId } from '../types/generator';
import { createEffect, toEffectId } from '../types/effect';
import { createTransition, toTransitionId } from '../types/transition';
import { toFrame, toTimecode } from '../types/frame';
import { toMarkerId } from '../types/marker';
import { applyOperation } from '../engine/apply';

// ── Fixture: non-trivial state for round-trips ─────────────────────────────

function makeRoundTripState() {
  const asset1 = createAsset({
    id: 'asset-1',
    name: 'V1',
    mediaType: 'video',
    filePath: '/path/a.mp4',
    intrinsicDuration: toFrame(300),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });
  const asset2 = createAsset({
    id: 'asset-2',
    name: 'V2',
    mediaType: 'video',
    filePath: '/path/b.mp4',
    intrinsicDuration: toFrame(200),
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
    trackId: 'track-1',
    timelineStart: toFrame(100),
    timelineEnd: toFrame(200),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const clip3 = createClip({
    id: 'clip-3',
    assetId: 'asset-2',
    trackId: 'track-2',
    timelineStart: toFrame(50),
    timelineEnd: toFrame(150),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const track1 = createTrack({
    id: 'track-1',
    name: 'V1',
    type: 'video',
    clips: [clip1, clip2],
  });
  const track2 = createTrack({
    id: 'track-2',
    name: 'V2',
    type: 'video',
    clips: [clip3],
  });
  const timeline = createTimeline({
    id: 'tl',
    name: 'T',
    fps: 30,
    duration: toFrame(1000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track1, track2],
  });
  let state = createTimelineState({
    timeline,
    assetRegistry: new Map([
      [asset1.id, asset1],
      [asset2.id, asset2],
    ]),
  });
  const marker = {
    type: 'point' as const,
    id: toMarkerId('m1'),
    frame: toFrame(75),
    label: 'Mark',
    color: '#f00',
    scope: 'global' as const,
    linkedClipId: null,
  };
  state = applyOperation(state, { type: 'ADD_MARKER', marker });
  const beatGrid = { bpm: 120, timeSignature: [4, 4] as const, offset: toFrame(0) };
  state = applyOperation(state, { type: 'ADD_BEAT_GRID', beatGrid });
  const effect = createEffect(toEffectId('eff-1'), 'blur', 'preComposite', []);
  state = applyOperation(state, { type: 'ADD_EFFECT', clipId: toClipId('clip-1'), effect });
  const trans = createTransition(toTransitionId('tr-1'), 'dissolve', 10);
  state = applyOperation(state, { type: 'ADD_TRANSITION', clipId: toClipId('clip-1'), transition: trans });
  expect(checkInvariants(state)).toEqual([]);
  return state;
}

// ── Serializer ─────────────────────────────────────────────────────────────

describe('Phase 5 — Serializer', () => {
  it('serializeTimeline produces valid JSON string', () => {
    const state = makeRoundTripState();
    const json = serializeTimeline(state);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.timeline).toBeDefined();
    expect(parsed.assetRegistry).toBeDefined();
  });

  it('deserializeTimeline round-trips state correctly (deep equal after parse)', () => {
    const state = makeRoundTripState();
    const json = serializeTimeline(state);
    const restored = deserializeTimeline(json);
    expect(restored.schemaVersion).toBe(state.schemaVersion);
    expect(restored.timeline.id).toBe(state.timeline.id);
    expect(restored.timeline.tracks).toHaveLength(state.timeline.tracks.length);
    expect(restored.timeline.markers).toHaveLength(state.timeline.markers.length);
    expect(restored.timeline.beatGrid).toEqual(state.timeline.beatGrid);
    expect(restored.assetRegistry.size).toBe(state.assetRegistry.size);
    const c1 = restored.timeline.tracks[0]!.clips[0]!;
    expect(c1.effects).toHaveLength(1);
    expect(c1.transition).toBeDefined();
  });

  it('deserializeTimeline preserves schemaVersion', () => {
    const state = makeRoundTripState();
    const restored = deserializeTimeline(serializeTimeline(state));
    expect(restored.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('deserializeTimeline throws SerializationError on invalid JSON', () => {
    expect(() => deserializeTimeline('not json')).toThrow(SerializationError);
    expect(() => deserializeTimeline('{')).toThrow(SerializationError);
  });

  it('deserializeTimeline throws SerializationError when schemaVersion is missing', () => {
    const bad = JSON.stringify({ timeline: {}, assetRegistry: {} });
    expect(() => deserializeTimeline(bad)).toThrow(SerializationError);
    expect(() => deserializeTimeline(bad)).toThrow(/schemaVersion/);
  });

  it('deserializeTimeline throws SerializationError when schemaVersion is higher than CURRENT', () => {
    const state = makeRoundTripState();
    const json = serializeTimeline(state);
    const parsed = JSON.parse(json);
    parsed.schemaVersion = 999;
    expect(() => deserializeTimeline(JSON.stringify(parsed))).toThrow(SerializationError);
    expect(() => deserializeTimeline(JSON.stringify(parsed))).toThrow(/Unknown schema version/);
  });

  it('deserializeTimeline throws SerializationError when state fails checkInvariants', () => {
    const state = makeRoundTripState();
    const json = serializeTimeline(state);
    const parsed = JSON.parse(json);
    parsed.timeline.tracks[0].clips[0].timelineEnd = 9999;
    expect(() => deserializeTimeline(JSON.stringify(parsed))).toThrow(SerializationError);
    try {
      deserializeTimeline(JSON.stringify(parsed));
    } catch (e) {
      expect(e).toBeInstanceOf(SerializationError);
      expect((e as SerializationError).violations).toBeDefined();
      expect((e as SerializationError).violations!.length).toBeGreaterThan(0);
    }
  });

  it('Round-trip: serialize → deserialize → serialize produces identical strings', () => {
    const state = makeRoundTripState();
    const first = serializeTimeline(state);
    const restored = deserializeTimeline(first);
    const second = serializeTimeline(restored);
    expect(second).toBe(first);
  });
});

// ── Migrator ───────────────────────────────────────────────────────────────

describe('Phase 5 — Migrator', () => {
  it('migrate throws on non-object input', () => {
    expect(() => migrate(null)).toThrow(SerializationError);
    expect(() => migrate(42)).toThrow(SerializationError);
    expect(() => migrate('string')).toThrow(SerializationError);
  });

  it('migrate throws on missing schemaVersion', () => {
    expect(() => migrate({ timeline: {}, assetRegistry: {} })).toThrow(SerializationError);
    expect(() => migrate({ timeline: {}, assetRegistry: {} })).toThrow(/Missing schemaVersion/);
  });

  it('migrate throws on version > CURRENT_SCHEMA_VERSION', () => {
    expect(() => migrate({ schemaVersion: 99, timeline: {}, assetRegistry: {} })).toThrow(
      SerializationError,
    );
    expect(() => migrate({ schemaVersion: 99, timeline: {}, assetRegistry: {} })).toThrow(
      /Unknown schema version/,
    );
  });

  it('migrate passes through v1 state unchanged', () => {
    const state = makeRoundTripState();
    const plain = {
      schemaVersion: state.schemaVersion,
      timeline: state.timeline,
      assetRegistry: Object.fromEntries(state.assetRegistry),
    };
    const result = migrate(plain);
    expect(result.schemaVersion).toBe(state.schemaVersion);
    expect(result.timeline.id).toBe(state.timeline.id);
    expect(result.assetRegistry.size).toBe(state.assetRegistry.size);
  });
});

// ── Asset remapper ─────────────────────────────────────────────────────────

describe('Phase 5 — remapAssetPaths', () => {
  it('remapAssetPaths calls remap for each FileAsset', () => {
    const state = makeRoundTripState();
    const remappedPaths: string[] = [];
    const remap: AssetRemapCallback = (asset) => {
      remappedPaths.push(asset.filePath);
      return { ...asset, filePath: asset.filePath.replace('/path/', '/remapped/') };
    };
    const next = remapAssetPaths(state, remap);
    expect(remappedPaths).toContain('/path/a.mp4');
    expect(remappedPaths).toContain('/path/b.mp4');
    expect(next.assetRegistry.get(toAssetId('asset-1'))!.kind).toBe('file');
    expect((next.assetRegistry.get(toAssetId('asset-1')) as { filePath: string }).filePath).toBe(
      '/remapped/a.mp4',
    );
  });

  it('remapAssetPaths does not call remap for GeneratorAssets', () => {
    const state = makeRoundTripState();
    let callCount = 0;
    const remap: AssetRemapCallback = () => {
      callCount++;
      return createAsset({
        id: 'x',
        name: 'X',
        mediaType: 'video',
        filePath: '/x',
        intrinsicDuration: toFrame(1),
        nativeFps: 30,
        sourceTimecodeOffset: toFrame(0),
      });
    };
    remapAssetPaths(state, remap);
    expect(callCount).toBe(2);
  });

  it('remapAssetPaths returns new state (immutable — original state.assets unchanged)', () => {
    const state = makeRoundTripState();
    const firstPath = (state.assetRegistry.get(toAssetId('asset-1')) as { filePath: string })
      .filePath;
    const remap: AssetRemapCallback = (asset) => ({ ...asset, filePath: '/new/path.mp4' });
    const next = remapAssetPaths(state, remap);
    expect((state.assetRegistry.get(toAssetId('asset-1')) as { filePath: string }).filePath).toBe(
      firstPath,
    );
    expect((next.assetRegistry.get(toAssetId('asset-1')) as { filePath: string }).filePath).toBe(
      '/new/path.mp4',
    );
    expect(next).not.toBe(state);
    expect(next.assetRegistry).not.toBe(state.assetRegistry);
  });
});

// ── Offline asset detection ────────────────────────────────────────────────

describe('Phase 5 — findOfflineAssets', () => {
  it('findOfflineAssets returns entry for each offline FileAsset', () => {
    const state = makeRoundTripState();
    const isOnline = (asset: { id: string }) => asset.id !== 'asset-1';
    const result = findOfflineAssets(state, isOnline);
    expect(result).toHaveLength(1);
    expect(result[0]!.assetId).toBe('asset-1');
    expect(result[0]!.path).toBe('/path/a.mp4');
  });

  it('findOfflineAssets includes correct clipIds for each offline asset', () => {
    const state = makeRoundTripState();
    const isOnline = (asset: { id: string }) => asset.id !== 'asset-1';
    const result = findOfflineAssets(state, isOnline);
    expect(result[0]!.clipIds).toContain('clip-1');
    expect(result[0]!.clipIds).toContain('clip-2');
    expect(result[0]!.clipIds).toHaveLength(2);
  });

  it('findOfflineAssets returns [] when all assets online', () => {
    const state = makeRoundTripState();
    const result = findOfflineAssets(state, () => true);
    expect(result).toEqual([]);
  });

  it('findOfflineAssets ignores GeneratorAssets', () => {
    const state = makeRoundTripState();
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
    const registry = new Map(state.assetRegistry);
    registry.set(genAsset.id, genAsset);
    const stateWithGen = { ...state, assetRegistry: registry };
    const isOnline = () => false;
    const result = findOfflineAssets(stateWithGen, isOnline);
    const ids = result.map((r) => r.assetId);
    expect(ids).not.toContain('gen-1');
  });
});
