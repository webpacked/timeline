/**
 * Phase 5 Step 5 — Project model + bins
 */

import { describe, it, expect } from 'vitest';

import {
  createProject,
  toProjectId,
  createBin,
  toBinId,
  type BinItem,
} from '../types/project';

import {
  addTimeline,
  removeTimeline,
  addBin,
  removeBin,
  addItemToBin,
  removeItemFromBin,
  moveItemBetweenBins,
} from '../engine/project-ops';

import { serializeProject, deserializeProject } from '../engine/project-serializer';
import { SerializationError } from '../engine/serialization-error';

import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack } from '../types/track';
import { createClip } from '../types/clip';
import { createAsset } from '../types/asset';
import { toFrame, toTimecode } from '../types/frame';

function makeTimelineState(timelineId: string) {
  const asset = createAsset({
    id: `asset-${timelineId}`,
    name: 'V1',
    mediaType: 'video',
    filePath: `/media/${timelineId}.mp4`,
    intrinsicDuration: toFrame(600),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });
  const clip = createClip({
    id: `clip-${timelineId}`,
    assetId: asset.id,
    trackId: 'track-1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const track = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [clip] });
  const timeline = createTimeline({
    id: timelineId,
    name: `Timeline ${timelineId}`,
    fps: 30,
    duration: toFrame(1000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[asset.id, asset]]) });
}

describe('Phase 5 — Project model', () => {
  it('createProject defaults: empty timelines, bins, rootBinIds; schemaVersion CURRENT', () => {
    const p = createProject(toProjectId('p1'), 'P1');
    expect(p.timelines).toEqual([]);
    expect(p.bins).toEqual([]);
    expect(p.rootBinIds).toEqual([]);
    expect(p.schemaVersion).toBe(2);
  });

  it('createBin defaults: parentId null, items []', () => {
    const b = createBin(toBinId('b1'), 'Bin');
    expect(b.parentId).toBeNull();
    expect(b.items).toEqual([]);
  });
});

describe('Phase 5 — addTimeline / removeTimeline', () => {
  it('addTimeline appends timeline to project', () => {
    const p = createProject(toProjectId('p1'), 'P1');
    const s = makeTimelineState('tl-1');
    const next = addTimeline(p, s);
    expect(next.timelines).toHaveLength(1);
    expect(next.timelines[0]!.timeline.id).toBe('tl-1');
  });

  it('removeTimeline removes by timelineId', () => {
    const p = createProject(toProjectId('p1'), 'P1', [makeTimelineState('a'), makeTimelineState('b')]);
    const next = removeTimeline(p, 'a');
    expect(next.timelines).toHaveLength(1);
    expect(next.timelines[0]!.timeline.id).toBe('b');
  });

  it('removeTimeline on missing id returns unchanged project (no error)', () => {
    const p = createProject(toProjectId('p1'), 'P1', [makeTimelineState('a')]);
    const next = removeTimeline(p, 'missing');
    expect(next).toBe(p);
  });
});

describe('Phase 5 — addBin / removeBin', () => {
  it('addBin with parentId null adds to rootBinIds', () => {
    const p = createProject(toProjectId('p1'), 'P1');
    const b = createBin(toBinId('b1'), 'Root', null);
    const next = addBin(p, b);
    expect(next.rootBinIds).toEqual(['b1']);
  });

  it('addBin with parentId does NOT add to rootBinIds', () => {
    const p = createProject(toProjectId('p1'), 'P1');
    const b = createBin(toBinId('b1'), 'Child', toBinId('parent'));
    const next = addBin(p, b);
    expect(next.rootBinIds).toEqual([]);
  });

  it('removeBin removes bin from project.bins', () => {
    const p = createProject(toProjectId('p1'), 'P1');
    const b = createBin(toBinId('b1'), 'Root', null);
    const p2 = addBin(p, b);
    const next = removeBin(p2, toBinId('b1'));
    expect(next.bins).toHaveLength(0);
  });

  it('removeBin removes from rootBinIds if present', () => {
    const p = createProject(toProjectId('p1'), 'P1');
    const b = createBin(toBinId('b1'), 'Root', null);
    const p2 = addBin(p, b);
    const next = removeBin(p2, toBinId('b1'));
    expect(next.rootBinIds).toEqual([]);
  });

  it('removeBin recursively removes child bins', () => {
    const p = createProject(toProjectId('p1'), 'P1');
    const parent = createBin(toBinId('parent'), 'Parent', null);
    const child = createBin(toBinId('child'), 'Child', toBinId('parent'));
    const p2 = addBin(addBin(p, parent), child);
    const next = removeBin(p2, toBinId('parent'));
    const ids = next.bins.map((b) => b.id);
    expect(ids).not.toContain('parent');
    expect(ids).not.toContain('child');
  });
});

describe('Phase 5 — addItemToBin / removeItemFromBin / moveItemBetweenBins', () => {
  it('addItemToBin appends item to correct bin', () => {
    const p = addBin(createProject(toProjectId('p1'), 'P1'), createBin(toBinId('b1'), 'B1'));
    const item: BinItem = { kind: 'sequence', timelineId: 'tl-1' };
    const next = addItemToBin(p, toBinId('b1'), item);
    expect(next.bins[0]!.items).toEqual([item]);
  });

  it('addItemToBin throws on missing bin', () => {
    const p = createProject(toProjectId('p1'), 'P1');
    expect(() => addItemToBin(p, toBinId('missing'), { kind: 'asset', assetId: 'a' as any })).toThrow();
  });

  it('removeItemFromBin removes matching item', () => {
    const p0 = addBin(createProject(toProjectId('p1'), 'P1'), createBin(toBinId('b1'), 'B1'));
    const item: BinItem = { kind: 'asset', assetId: 'asset-1' as any };
    const p1 = addItemToBin(p0, toBinId('b1'), item);
    const next = removeItemFromBin(p1, toBinId('b1'), item);
    expect(next.bins[0]!.items).toEqual([]);
  });

  it('moveItemBetweenBins moves item correctly', () => {
    const p0 = addBin(addBin(createProject(toProjectId('p1'), 'P1'), createBin(toBinId('a'), 'A')), createBin(toBinId('b'), 'B'));
    const item: BinItem = { kind: 'sequence', timelineId: 'tl-1' };
    const p1 = addItemToBin(p0, toBinId('a'), item);
    const next = moveItemBetweenBins(p1, toBinId('a'), toBinId('b'), item);
    expect(next.bins.find((x) => x.id === 'a')!.items).toEqual([]);
    expect(next.bins.find((x) => x.id === 'b')!.items).toEqual([item]);
  });
});

describe('Phase 5 — Project serializer', () => {
  it('serializeProject produces valid JSON', () => {
    const p = createProject(toProjectId('p1'), 'P1', [makeTimelineState('tl-1')]);
    const raw = serializeProject(p);
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('deserializeProject round-trips project', () => {
    const p0 = createProject(toProjectId('p1'), 'P1', [makeTimelineState('tl-1'), makeTimelineState('tl-2')]);
    const p1 = addBin(p0, createBin(toBinId('b1'), 'Root'));
    const raw1 = serializeProject(p1);
    const restored = deserializeProject(raw1);
    expect(restored.id).toBe(p1.id);
    expect(restored.timelines).toHaveLength(2);
    expect(restored.bins).toHaveLength(1);
    const raw2 = serializeProject(restored);
    expect(raw2).toBe(raw1);
  });

  it('deserializeProject throws SerializationError on invalid JSON', () => {
    expect(() => deserializeProject('{')).toThrow(SerializationError);
    expect(() => deserializeProject('not json')).toThrow(SerializationError);
  });

  it('deserializeProject throws on missing schemaVersion', () => {
    const p = createProject(toProjectId('p1'), 'P1', [makeTimelineState('tl-1')]);
    const parsed = JSON.parse(serializeProject(p));
    delete parsed.schemaVersion;
    expect(() => deserializeProject(JSON.stringify(parsed))).toThrow(SerializationError);
  });

  it('deserializeProject validates each timeline (corrupt one → SerializationError)', () => {
    const p = createProject(toProjectId('p1'), 'P1', [makeTimelineState('tl-1')]);
    const parsed = JSON.parse(serializeProject(p));
    // break invariants: clip beyond timeline duration
    parsed.timelines[0].timeline.duration = 10;
    expect(() => deserializeProject(JSON.stringify(parsed))).toThrow(SerializationError);
  });
});

