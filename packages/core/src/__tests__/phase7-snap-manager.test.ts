/**
 * Phase 7 Step 2 — SnapIndexManager microtask debounce
 */

import { describe, it, expect, vi } from 'vitest';
import { toFrame } from '../types/frame';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset } from '../types/asset';
import { toTimecode } from '../types/frame';
import type { TimelineState } from '../types/state';
import { SnapIndexManager } from '../engine/snap-index-manager';
import * as snapIndexModule from '../snap-index';

function makeState(): TimelineState {
  const trackId = toTrackId('t1');
  const asset = createAsset({
    id: 'a1',
    name: 'V',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(1000),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });
  const clip = createClip({
    id: toClipId('c1'),
    assetId: asset.id,
    trackId,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const track = createTrack({ id: trackId, name: 'T1', type: 'video', clips: [clip] });
  const timeline = createTimeline({
    id: 'tl',
    name: 'Test',
    fps: 30,
    duration: toFrame(500),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[asset.id, asset]]) });
}

describe('Phase 7 — SnapIndexManager', () => {
  it('1. getIndex() returns null before any build', () => {
    const manager = new SnapIndexManager();
    expect(manager.getIndex()).toBeNull();
  });

  it('2. rebuildSync() builds index immediately', () => {
    const manager = new SnapIndexManager();
    const state = makeState();
    manager.rebuildSync(state);
    expect(manager.getIndex()).not.toBeNull();
  });

  it('3. rebuildSync() index contains expected snap points', () => {
    const manager = new SnapIndexManager();
    const state = makeState();
    manager.rebuildSync(state);
    const index = manager.getIndex()!;
    expect(index.points.length).toBeGreaterThan(0);
    const clipStarts = index.points.filter((p) => p.type === 'ClipStart');
    expect(clipStarts.some((p) => p.frame === 0)).toBe(true);
  });

  it('4. scheduleRebuild() sets isPending: true', () => {
    const manager = new SnapIndexManager();
    const state = makeState();
    manager.scheduleRebuild(state);
    expect(manager.isPending).toBe(true);
  });

  it('5. scheduleRebuild() index is null until microtask resolves', async () => {
    const manager = new SnapIndexManager();
    const state = makeState();
    manager.scheduleRebuild(state);
    expect(manager.getIndex()).toBeNull();
    await Promise.resolve();
    expect(manager.getIndex()).not.toBeNull();
  });

  it('6. After await Promise.resolve(): isPending false, index is built', async () => {
    const manager = new SnapIndexManager();
    const state = makeState();
    manager.scheduleRebuild(state);
    await Promise.resolve();
    expect(manager.isPending).toBe(false);
    expect(manager.getIndex()).not.toBeNull();
  });

  it('7. scheduleRebuild() called 3 times synchronously: only ONE rebuild', async () => {
    const buildSpy = vi.spyOn(snapIndexModule, 'buildSnapIndex');
    const manager = new SnapIndexManager();
    const state = makeState();
    manager.scheduleRebuild(state);
    manager.scheduleRebuild(state);
    manager.scheduleRebuild(state);
    await Promise.resolve();
    expect(buildSpy).toHaveBeenCalledTimes(1);
    buildSpy.mockRestore();
  });

  it('8. scheduleRebuild() captures latest state', async () => {
    const stateA = makeState();
    const trackId = toTrackId('t1');
    const asset = createAsset({
      id: 'a1',
      name: 'V',
      mediaType: 'video',
      filePath: '/v.mp4',
      intrinsicDuration: toFrame(1000),
      nativeFps: 30,
      sourceTimecodeOffset: toFrame(0),
    });
    const clip1 = createClip({
      id: toClipId('c1'),
      assetId: asset.id,
      trackId,
      timelineStart: toFrame(0),
      timelineEnd: toFrame(50),
      mediaIn: toFrame(0),
      mediaOut: toFrame(50),
    });
    const clip2 = createClip({
      id: toClipId('c2'),
      assetId: asset.id,
      trackId,
      timelineStart: toFrame(50),
      timelineEnd: toFrame(150),
      mediaIn: toFrame(0),
      mediaOut: toFrame(100),
    });
    const track = createTrack({ id: trackId, name: 'T1', type: 'video', clips: [clip1, clip2] });
    const timeline = createTimeline({
      id: 'tl',
      name: 'Test',
      fps: 30,
      duration: toFrame(500),
      startTimecode: toTimecode('00:00:00:00'),
      tracks: [track],
    });
    const stateB = createTimelineState({ timeline, assetRegistry: new Map([[asset.id, asset]]) });
    const manager = new SnapIndexManager();
    manager.scheduleRebuild(stateA);
    manager.scheduleRebuild(stateB);
    await Promise.resolve();
    const index = manager.getIndex()!;
    expect(index).not.toBeNull();
    const clipPoints = index.points.filter((p) => p.type === 'ClipStart' || p.type === 'ClipEnd');
    expect(clipPoints.length).toBe(4);
  });
});
