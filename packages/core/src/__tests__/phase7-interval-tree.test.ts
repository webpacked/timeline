/**
 * Phase 7 Step 1 — Interval tree and TrackIndex for O(log n) frame lookup
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
import type { PipelineConfig } from '../types/pipeline';
import { IntervalTree } from '../engine/interval-tree';
import { TrackIndex } from '../engine/track-index';
import * as frameResolver from '../engine/frame-resolver';
import { PlaybackEngine } from '../engine/playback-engine';
import { createTestClock } from '../engine/clock';

const FPS = 30;
const DURATION = 900;
const DIMS = { width: 1920, height: 1080 };

const mockPipeline: PipelineConfig = {
  videoDecoder: vi.fn().mockResolvedValue({
    clipId: 'x',
    mediaFrame: toFrame(0),
    width: DIMS.width,
    height: DIMS.height,
    bitmap: null,
  }),
  compositor: vi.fn().mockResolvedValue({
    timelineFrame: toFrame(0),
    bitmap: null,
  }),
};

function makeFixtureState(): TimelineState {
  const trackId = toTrackId('v1');
  const trackId2 = toTrackId('v2');
  const asset = createAsset({
    id: 'a1',
    name: 'V',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(2000),
    nativeFps: FPS,
    sourceTimecodeOffset: toFrame(0),
  });
  const clip1 = createClip({
    id: toClipId('c1'),
    assetId: asset.id,
    trackId,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(200),
    mediaIn: toFrame(0),
    mediaOut: toFrame(200),
  });
  const clip2 = createClip({
    id: toClipId('c2'),
    assetId: asset.id,
    trackId,
    timelineStart: toFrame(200),
    timelineEnd: toFrame(400),
    mediaIn: toFrame(0),
    mediaOut: toFrame(200),
  });
  const clip3 = createClip({
    id: toClipId('c3'),
    assetId: asset.id,
    trackId: trackId2,
    timelineStart: toFrame(100),
    timelineEnd: toFrame(300),
    mediaIn: toFrame(0),
    mediaOut: toFrame(200),
  });
  const t1 = createTrack({ id: trackId, name: 'V1', type: 'video', clips: [clip1, clip2] });
  const t2 = createTrack({ id: trackId2, name: 'V2', type: 'video', clips: [clip3] });
  const timeline = createTimeline({
    id: 'tl',
    name: 'Phase7',
    fps: FPS,
    duration: toFrame(DURATION),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [t1, t2],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[asset.id, asset]]) });
}

describe('Phase 7 — IntervalTree', () => {
  it('1. query on empty tree returns []', () => {
    const tree = new IntervalTree<number>();
    tree.build([]);
    expect(tree.query(0)).toEqual([]);
  });

  it('2. single interval: query inside returns data', () => {
    const tree = new IntervalTree<string>();
    tree.build([{ start: 10, end: 20, data: 'x' }]);
    expect(tree.query(15)).toEqual(['x']);
  });

  it('3. single interval: query at start (inclusive)', () => {
    const tree = new IntervalTree<string>();
    tree.build([{ start: 10, end: 20, data: 'x' }]);
    expect(tree.query(10)).toEqual(['x']);
  });

  it('4. single interval: query at end - 1 (inclusive)', () => {
    const tree = new IntervalTree<string>();
    tree.build([{ start: 10, end: 20, data: 'x' }]);
    expect(tree.query(19)).toEqual(['x']);
  });

  it('5. single interval: query at end (exclusive) → []', () => {
    const tree = new IntervalTree<string>();
    tree.build([{ start: 10, end: 20, data: 'x' }]);
    expect(tree.query(20)).toEqual([]);
  });

  it('6. two non-overlapping intervals: query returns only the matching one', () => {
    const tree = new IntervalTree<string>();
    tree.build([
      { start: 0, end: 10, data: 'a' },
      { start: 20, end: 30, data: 'b' },
    ]);
    expect(tree.query(5)).toEqual(['a']);
    expect(tree.query(25)).toEqual(['b']);
  });

  it('7. two overlapping intervals: query at overlap returns both', () => {
    const tree = new IntervalTree<string>();
    tree.build([
      { start: 0, end: 100, data: 'a' },
      { start: 50, end: 150, data: 'b' },
    ]);
    expect(tree.query(75)).toEqual(expect.arrayContaining(['a', 'b']));
    expect(tree.query(75).length).toBe(2);
  });

  it('8. 100 intervals (stress): query at midpoint returns correct subset', () => {
    const tree = new IntervalTree<number>();
    const intervals = Array.from({ length: 100 }, (_, i) => ({
      start: i * 10,
      end: i * 10 + 20,
      data: i,
    }));
    tree.build(intervals);
    // Point 15 is inside [10,30) and [0,20) -> indices 1 and 0
    const result = tree.query(15);
    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result.length).toBe(2);
  });

  it('9. tree.size() returns interval count', () => {
    const tree = new IntervalTree<string>();
    expect(tree.size()).toBe(0);
    tree.build([{ start: 0, end: 10, data: 'a' }]);
    expect(tree.size()).toBe(1);
    tree.build([{ start: 0, end: 10, data: 'a' }, { start: 10, end: 20, data: 'b' }]);
    expect(tree.size()).toBe(2);
  });
});

describe('Phase 7 — TrackIndex', () => {
  it('10. build() then query returns clips at frame', () => {
    const state = makeFixtureState();
    const index = new TrackIndex();
    index.build(state);
    const at150 = index.query(150);
    expect(at150.length).toBe(2); // clip1 [0,200) and clip3 [100,300)
    const at250 = index.query(250);
    expect(at250.length).toBe(2); // clip2 [200,400) and clip3 [100,300)
  });

  it('11. query sorts by trackIndex ascending', () => {
    const state = makeFixtureState();
    const index = new TrackIndex();
    index.build(state);
    const at150 = index.query(150);
    expect(at150[0]!.trackIndex).toBe(0);
    expect(at150[1]!.trackIndex).toBe(1);
  });

  it('12. query returns [] for frame with no clips', () => {
    const state = makeFixtureState();
    const index = new TrackIndex();
    index.build(state);
    expect(index.query(500)).toEqual([]);
  });

  it('13. invalidate() causes isBuilt to be false', () => {
    const state = makeFixtureState();
    const index = new TrackIndex();
    index.build(state);
    expect(index.isBuilt).toBe(true);
    index.invalidate();
    expect(index.isBuilt).toBe(false);
  });

  it('14. query on unbuilt index throws', () => {
    const index = new TrackIndex();
    expect(() => index.query(0)).toThrow('TrackIndex not built');
  });
});

describe('Phase 7 — frame-resolver integration', () => {
  it('15. getClipsAtFrame with built TrackIndex returns same results as without index', () => {
    const state = makeFixtureState();
    const index = new TrackIndex();
    index.build(state);
    const frame = toFrame(150);
    const withIndex = frameResolver.getClipsAtFrame(state, frame, index);
    const withoutIndex = frameResolver.getClipsAtFrame(state, frame);
    expect(withIndex.length).toBe(withoutIndex.length);
    expect(withIndex.map((e) => e.clip.id)).toEqual(withoutIndex.map((e) => e.clip.id));
  });

  it('16. getClipsAtFrame with unbuilt index falls back to linear scan (no throw)', () => {
    const state = makeFixtureState();
    const index = new TrackIndex();
    const frame = toFrame(150);
    const result = frameResolver.getClipsAtFrame(state, frame, index);
    expect(result.length).toBe(2);
  });

  it('17. resolveFrame with index returns same layers as without index', () => {
    const state = makeFixtureState();
    const index = new TrackIndex();
    index.build(state);
    const frame = toFrame(150);
    const withIndex = frameResolver.resolveFrame(state, frame, 'full', DIMS, index);
    const withoutIndex = frameResolver.resolveFrame(state, frame, 'full', DIMS);
    expect(withIndex.layers.length).toBe(withoutIndex.layers.length);
    expect(withIndex.layers.map((l) => l.clipId)).toEqual(withoutIndex.layers.map((l) => l.clipId));
  });
});

describe('Phase 7 — PlaybackEngine', () => {
  it('18. renderFrame uses index (resolveFrame called with index)', async () => {
    const state = makeFixtureState();
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const resolveSpy = vi.spyOn(frameResolver, 'resolveFrame');
    await engine.renderFrame(toFrame(150));
    expect(resolveSpy).toHaveBeenCalledWith(
      state,
      toFrame(150),
      expect.anything(),
      DIMS,
      expect.anything(),
    );
    const indexArg = resolveSpy.mock.calls[0]![4];
    expect(indexArg).toBeDefined();
    expect(indexArg?.isBuilt).toBe(true);
    resolveSpy.mockRestore();
  });

  it('19. updateState rebuilds index (build called after updateState)', () => {
    const state = makeFixtureState();
    const buildSpy = vi.spyOn(TrackIndex.prototype, 'build');
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    expect(buildSpy).toHaveBeenCalledTimes(1);
    const newState = makeFixtureState();
    engine.updateState(newState);
    expect(buildSpy).toHaveBeenCalledTimes(2);
    buildSpy.mockRestore();
  });
});
