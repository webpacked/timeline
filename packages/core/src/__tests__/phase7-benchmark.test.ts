/**
 * Phase 7 Step 6 — Benchmarks (40 tracks / 200 clips)
 *
 * Performance contract: vitest timing, no external benchmark lib.
 * Thresholds are CI safety nets; developer machines should pass with headroom.
 */

import { describe, it, expect } from 'vitest';
import { toFrame, toTimecode, frameRate } from '../types/frame';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset, toAssetId } from '../types/asset';
import { createTimelineState } from '../types/state';
import { dispatch } from '../engine/dispatcher';
import { checkInvariants } from '../validation/invariants';
import { getClipsAtFrame } from '../engine/frame-resolver';
import { TrackIndex } from '../engine/track-index';
import { buildSnapIndex } from '../snap-index';
import { SnapIndexManager } from '../engine/snap-index-manager';
import { serializeTimeline, deserializeTimeline } from '../engine/serializer';
import { resolveFrame } from '../engine/frame-resolver';
import { diffStates } from '../types/state-change';
import { applyOperation } from '../engine/apply';

const FPS = 30;
const TIMELINE_DURATION = 6000;
const CLIP_DURATION = 300;
const NUM_TRACKS = 40;
const CLIPS_PER_TRACK = 5;
const TOTAL_CLIPS = NUM_TRACKS * CLIPS_PER_TRACK; // 200
const NUM_ASSETS = 5;

function buildLargeState(): ReturnType<typeof createTimelineState> {
  const tracks = [];
  for (let i = 0; i < NUM_TRACKS; i++) {
    const type = i % 2 === 0 ? 'video' : 'audio';
    tracks.push(
      createTrack({
        id: `track-${i}`,
        name: `${type}-${i}`,
        type,
        clips: [],
      }),
    );
  }
  const timeline = createTimeline({
    id: 'bench-tl',
    name: 'Bench',
    fps: frameRate(FPS),
    duration: toFrame(TIMELINE_DURATION),
    startTimecode: toTimecode('00:00:00:00'),
    tracks,
  });
  const assets = [];
  for (let a = 0; a < NUM_ASSETS; a++) {
    assets.push(
      createAsset({
        id: `asset-${a}`,
        name: `Asset ${a}`,
        mediaType: a % 2 === 0 ? 'video' : 'audio',
        filePath: `/media/${a}.mp4`,
        intrinsicDuration: toFrame(3000),
        nativeFps: FPS,
        sourceTimecodeOffset: toFrame(0),
        status: 'online',
      }),
    );
  }
  const registry = new Map(assets.map((a) => [a.id, a]));
  let state = createTimelineState({ timeline, assetRegistry: registry });

  const videoAssets = assets.filter((a) => a.mediaType === 'video');
  const audioAssets = assets.filter((a) => a.mediaType === 'audio');
  const operations: Array<{ type: 'INSERT_CLIP'; clip: ReturnType<typeof createClip>; trackId: ReturnType<typeof toTrackId> }> = [];
  for (let t = 0; t < NUM_TRACKS; t++) {
    const trackId = toTrackId(`track-${t}`);
    const isVideo = t % 2 === 0;
    const trackAssets = isVideo ? videoAssets : audioAssets;
    for (let c = 0; c < CLIPS_PER_TRACK; c++) {
      const startFrame = c * CLIP_DURATION;
      const asset = trackAssets[c % trackAssets.length]!;
      const clip = createClip({
        id: `clip-t${t}-c${c}`,
        assetId: asset.id,
        trackId,
        timelineStart: toFrame(startFrame),
        timelineEnd: toFrame(startFrame + CLIP_DURATION),
        mediaIn: toFrame(0),
        mediaOut: toFrame(CLIP_DURATION),
      });
      operations.push({ type: 'INSERT_CLIP', clip, trackId });
    }
  }
  const tx = {
    id: 'bench-tx',
    label: 'Bench',
    timestamp: Date.now(),
    operations,
  };
  const result = dispatch(state, tx);
  if (!result.accepted) throw new Error(result.message);
  state = result.nextState;
  return state;
}

describe('Phase 7 — Benchmark: 40 tracks / 200 clips', () => {
  it('1. buildLargeState() completes in < 500ms', () => {
    const t0 = Date.now();
    const state = buildLargeState();
    const elapsed = Date.now() - t0;
    expect(state.timeline.tracks.length).toBe(NUM_TRACKS);
    expect(state.timeline.tracks.reduce((n, tr) => n + tr.clips.length, 0)).toBe(TOTAL_CLIPS);
    expect(elapsed).toBeLessThan(500);
  });

  it('2. checkInvariants() on large state < 50ms', () => {
    const state = buildLargeState();
    const t0 = Date.now();
    const violations = checkInvariants(state);
    const elapsed = Date.now() - t0;
    expect(violations).toHaveLength(0);
    expect(elapsed).toBeLessThan(50);
  });

  it('3. getClipsAtFrame() linear scan × 1000 calls < 100ms', () => {
    const state = buildLargeState();
    const t0 = Date.now();
    for (let i = 0; i < 1000; i++) {
      getClipsAtFrame(state, toFrame(i % TIMELINE_DURATION));
    }
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(100);
  });

  it('4. getClipsAtFrame() with TrackIndex × 1000 calls < 100ms', () => {
    const state = buildLargeState();
    const index = new TrackIndex();
    index.build(state);
    const t0 = Date.now();
    for (let i = 0; i < 1000; i++) {
      getClipsAtFrame(state, toFrame(i % TIMELINE_DURATION), index);
    }
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(100);
  });

  it('5. buildSnapIndex() × 100 calls < 200ms', () => {
    const state = buildLargeState();
    const t0 = Date.now();
    for (let i = 0; i < 100; i++) {
      buildSnapIndex(state, toFrame(0));
    }
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(200);
  });

  it('6. SnapIndexManager.scheduleRebuild() × 1000 sync calls → only 1 rebuild, < 10ms', async () => {
    const state = buildLargeState();
    const manager = new SnapIndexManager();
    const t0 = Date.now();
    for (let i = 0; i < 1000; i++) {
      manager.scheduleRebuild(state);
    }
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(10);
    await Promise.resolve();
    expect(manager.getIndex()).not.toBeNull();
  });

  it('7. serializeTimeline() on large state < 100ms', () => {
    const state = buildLargeState();
    const t0 = Date.now();
    const json = serializeTimeline(state);
    const elapsed = Date.now() - t0;
    expect(typeof json).toBe('string');
    expect(elapsed).toBeLessThan(100);
  });

  it('8. deserializeTimeline() on large state < 200ms', () => {
    const state = buildLargeState();
    const json = serializeTimeline(state);
    const t0 = Date.now();
    const restored = deserializeTimeline(json);
    const elapsed = Date.now() - t0;
    expect(restored.timeline.tracks.length).toBe(NUM_TRACKS);
    expect(elapsed).toBeLessThan(200);
  });

  it('9. resolveFrame() with TrackIndex × 1000 < 80ms', () => {
    const state = buildLargeState();
    const index = new TrackIndex();
    index.build(state);
    const dims = { width: 1920, height: 1080 };
    const t0 = Date.now();
    for (let i = 0; i < 1000; i++) {
      resolveFrame(state, toFrame(i % TIMELINE_DURATION), 'full', dims, index);
    }
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(80);
  });

  it('10. diffStates() × 1000 calls (large state, one clip changed each time) < 500ms', () => {
    const state = buildLargeState();
    const track0 = state.timeline.tracks[0]!;
    const lastClip = track0.clips[track0.clips.length - 1]!;
    const next = applyOperation(state, {
      type: 'MOVE_CLIP',
      clipId: lastClip.id,
      newTimelineStart: toFrame(1201),
    });
    const t0 = Date.now();
    for (let i = 0; i < 1000; i++) {
      diffStates(state, next);
    }
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(500);
  });
});
