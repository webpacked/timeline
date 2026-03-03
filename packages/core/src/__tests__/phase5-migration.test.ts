/**
 * Phase 5 Addendum — Migration chain hardening
 *
 * Migration gate: tests 6 and 14 are GATE tests (invariant check after migration).
 */

import { describe, it, expect } from 'vitest';

import { dispatch } from '../engine/dispatcher';
import { checkInvariants } from '../validation/invariants';
import { createTimelineState, CURRENT_SCHEMA_VERSION } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset } from '../types/asset';
import { toFrame, toTimecode } from '../types/frame';
import { toMarkerId } from '../types/marker';
import type { OperationPrimitive, Transaction } from '../types/operations';

import { serializeTimeline, deserializeTimeline } from '../engine/serializer';
import { migrate } from '../engine/migrator';
import { SerializationError } from '../engine/serialization-error';

import { createProject, toProjectId } from '../types/project';
import { serializeProject, deserializeProject } from '../engine/project-serializer';

let txCounter = 0;
function makeTx(label: string, operations: OperationPrimitive[]): Transaction {
  return { id: `tx-${++txCounter}`, label, timestamp: Date.now(), operations };
}

function applyTx(
  state: ReturnType<typeof createTimelineState>,
  label: string,
  ops: OperationPrimitive[],
) {
  const result = dispatch(state, makeTx(label, ops));
  expect(result.accepted).toBe(true);
  if (!result.accepted) throw new Error(result.message);
  expect(checkInvariants(result.nextState)).toEqual([]);
  return result.nextState;
}

/** Build state with 2 tracks, 3 clips, 2 markers (for v1 fixture and gate). */
function buildStateWithTracksClipsAndMarkers() {
  const fps = 30;
  const timeline = createTimeline({
    id: 'mig',
    name: 'MigrationTest',
    fps,
    duration: toFrame(3000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [],
  });
  let state = createTimelineState({ timeline, assetRegistry: new Map() });

  const videoTrackId = toTrackId('v1');
  const audioTrackId = toTrackId('a1');
  state = applyTx(state, 'Add tracks', [
    createTrack({ id: videoTrackId, name: 'V1', type: 'video', clips: [] }),
    createTrack({ id: audioTrackId, name: 'A1', type: 'audio', clips: [] }),
  ].map(t => ({ type: 'ADD_TRACK' as const, track: t })));

  const fileAssetV = createAsset({
    id: 'asset-v',
    name: 'V',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(1000),
    nativeFps: fps,
    sourceTimecodeOffset: toFrame(0),
  });
  const fileAssetA = createAsset({
    id: 'asset-a',
    name: 'A',
    mediaType: 'audio',
    filePath: '/a.wav',
    intrinsicDuration: toFrame(1000),
    nativeFps: fps,
    sourceTimecodeOffset: toFrame(0),
  });
  state = applyTx(state, 'Register assets', [
    { type: 'REGISTER_ASSET', asset: fileAssetV },
    { type: 'REGISTER_ASSET', asset: fileAssetA },
  ]);

  const clip1 = createClip({
    id: toClipId('c1'),
    assetId: fileAssetV.id,
    trackId: videoTrackId,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(300),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  const clip2 = createClip({
    id: toClipId('c2'),
    assetId: fileAssetV.id,
    trackId: videoTrackId,
    timelineStart: toFrame(400),
    timelineEnd: toFrame(700),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  const clip3 = createClip({
    id: toClipId('c3'),
    assetId: fileAssetA.id,
    trackId: audioTrackId,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(300),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  state = applyTx(state, 'Insert clips', [
    { type: 'INSERT_CLIP', clip: clip1, trackId: videoTrackId },
    { type: 'INSERT_CLIP', clip: clip2, trackId: videoTrackId },
    { type: 'INSERT_CLIP', clip: clip3, trackId: audioTrackId },
  ]);

  state = applyTx(state, 'Add markers', [
    {
      type: 'ADD_MARKER',
      marker: {
        type: 'point',
        id: toMarkerId('m1'),
        frame: toFrame(150),
        label: 'M1',
        color: 'red',
        scope: 'global',
        linkedClipId: null,
      },
    },
    {
      type: 'ADD_MARKER',
      marker: {
        type: 'point',
        id: toMarkerId('m2'),
        frame: toFrame(500),
        label: 'M2',
        color: 'blue',
        scope: 'global',
        linkedClipId: null,
      },
    },
  ]);

  return state;
}

/** Returns a JSON string that looks like v1 (schemaVersion: 1) for migration tests. */
function toV1JsonString(state: ReturnType<typeof buildStateWithTracksClipsAndMarkers>): string {
  const json = serializeTimeline(state);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  parsed.schemaVersion = 1;
  return JSON.stringify(parsed, null, 2);
}

describe('Phase 5 Addendum — Migration', () => {
  // ─── Version constant ───────────────────────────────────────────────────
  it('1. CURRENT_SCHEMA_VERSION === 2', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });

  // ─── V1 → V2 migration ───────────────────────────────────────────────────
  it('2. A v1 JSON string deserializes successfully via deserializeTimeline()', () => {
    const state = buildStateWithTracksClipsAndMarkers();
    const v1Json = toV1JsonString(state);
    expect(() => deserializeTimeline(v1Json)).not.toThrow();
    const restored = deserializeTimeline(v1Json);
    expect(restored.timeline).toBeDefined();
    expect(restored.assetRegistry).toBeDefined();
  });

  it('3. Deserialized v1 state has schemaVersion === 2 (migrated up)', () => {
    const state = buildStateWithTracksClipsAndMarkers();
    const v1Json = toV1JsonString(state);
    const restored = deserializeTimeline(v1Json);
    expect(restored.schemaVersion).toBe(2);
  });

  it('4. V1 → V2 migration preserves all clips (2 tracks, 3 clips)', () => {
    const state = buildStateWithTracksClipsAndMarkers();
    const v1Json = toV1JsonString(state);
    const restored = deserializeTimeline(v1Json);
    const clipCount = restored.timeline.tracks.reduce((n, t) => n + t.clips.length, 0);
    expect(restored.timeline.tracks).toHaveLength(2);
    expect(clipCount).toBe(3);
  });

  it('5. V1 → V2 migration preserves all markers', () => {
    const state = buildStateWithTracksClipsAndMarkers();
    const v1Json = toV1JsonString(state);
    const restored = deserializeTimeline(v1Json);
    expect(restored.timeline.markers).toHaveLength(2);
  });

  // GATE: migration must produce valid state
  it('6. V1 → V2 migration passes checkInvariants() with 0 violations — GATE', () => {
    const state = buildStateWithTracksClipsAndMarkers();
    const v1Json = toV1JsonString(state);
    const restored = deserializeTimeline(v1Json);
    const violations = checkInvariants(restored);
    expect(violations).toHaveLength(0);
  });

  // ─── Current version ─────────────────────────────────────────────────────
  it('7. A v2 JSON string passes through migrate() unchanged (schemaVersion stays 2)', () => {
    const state = buildStateWithTracksClipsAndMarkers();
    const json = serializeTimeline(state);
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(2);
    const result = migrate(parsed);
    expect(result.schemaVersion).toBe(2);
  });

  it('8. New state created with createTimeline() has schemaVersion === 2', () => {
    const timeline = createTimeline({
      id: 't1',
      name: 'T1',
      fps: 30,
      duration: toFrame(1000),
      startTimecode: toTimecode('00:00:00:00'),
      tracks: [],
    });
    const state = createTimelineState({ timeline, assetRegistry: new Map() });
    expect(state.schemaVersion).toBe(2);
  });

  // ─── Error cases ───────────────────────────────────────────────────────
  it('9. schemaVersion: 3 (future) throws SerializationError with "Unknown schema version"', () => {
    const state = buildStateWithTracksClipsAndMarkers();
    const json = serializeTimeline(state);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    parsed.schemaVersion = 3;
    expect(() => deserializeTimeline(JSON.stringify(parsed))).toThrow(SerializationError);
    expect(() => deserializeTimeline(JSON.stringify(parsed))).toThrow(/Unknown schema version/);
  });

  it('10. schemaVersion missing throws SerializationError', () => {
    const json = JSON.stringify({ timeline: {}, assetRegistry: {} });
    expect(() => deserializeTimeline(json)).toThrow(SerializationError);
    expect(() => deserializeTimeline(json)).toThrow(/schemaVersion/);
  });

  it('11. Non-object input throws SerializationError', () => {
    expect(() => migrate(null)).toThrow(SerializationError);
    expect(() => migrate(42)).toThrow(SerializationError);
    expect(() => migrate('string')).toThrow(SerializationError);
  });

  // ─── Project migration ──────────────────────────────────────────────────
  it('12. createProject stamps CURRENT_SCHEMA_VERSION (2), not hardcoded 1', () => {
    const p = createProject(toProjectId('p1'), 'P1');
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(p.schemaVersion).toBe(2);
  });

  it('13. serializeProject → deserializeProject round-trip works with schemaVersion 2', () => {
    const state = buildStateWithTracksClipsAndMarkers();
    const p = createProject(toProjectId('proj'), 'Proj', [state]);
    const json = serializeProject(p);
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(2);
    const restored = deserializeProject(json);
    expect(restored.schemaVersion).toBe(2);
    expect(restored.timelines).toHaveLength(1);
    expect(checkInvariants(restored.timelines[0]!)).toEqual([]);
  });

  // GATE: full round-trip via v1 migration
  it('14. Full gate: serialize → corrupt schemaVersion to 1 → deserialize → checkInvariants() → 0 violations — GATE', () => {
    const state = buildStateWithTracksClipsAndMarkers();
    const json = serializeTimeline(state);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    parsed.schemaVersion = 1;
    const v1Json = JSON.stringify(parsed, null, 2);
    const restored = deserializeTimeline(v1Json);
    const violations = checkInvariants(restored);
    expect(violations).toHaveLength(0);
  });
});
