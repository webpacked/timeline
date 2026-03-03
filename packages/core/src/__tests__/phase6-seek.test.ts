/**
 * Phase 6 Step 3 — Seek API and clip boundary navigation
 *
 * Pure function tests use no clock. PlaybackEngine tests use createTestClock().
 */

import { describe, it, expect } from 'vitest';
import { toFrame } from '../types/frame';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset } from '../types/asset';
import { toTimecode } from '../types/frame';
import { toMarkerId } from '../types/marker';
import type { TimelineState } from '../types/state';
import type { Marker } from '../types/marker';
import {
  findNextClipBoundary,
  findPrevClipBoundary,
  findNextMarker,
  findPrevMarker,
  findClipById,
} from '../engine/frame-resolver';
import { PlaybackEngine } from '../engine/playback-engine';
import { createTestClock } from '../engine/clock';
import type { PipelineConfig } from '../types/pipeline';

const FPS = 30;
const DURATION_FRAMES = 1800;

function makeSeekFixtureState(): TimelineState {
  const videoTrackId = toTrackId('videoTrack');
  const audioTrackId = toTrackId('audioTrack');
  const assetV = createAsset({
    id: 'assetV',
    name: 'V',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(5000),
    nativeFps: FPS,
    sourceTimecodeOffset: toFrame(0),
  });
  const assetA = createAsset({
    id: 'assetA',
    name: 'A',
    mediaType: 'audio',
    filePath: '/a.wav',
    intrinsicDuration: toFrame(5000),
    nativeFps: FPS,
    sourceTimecodeOffset: toFrame(0),
  });
  const clip1 = createClip({
    id: toClipId('clip1'),
    assetId: assetV.id,
    trackId: videoTrackId,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(300),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  const clip2 = createClip({
    id: toClipId('clip2'),
    assetId: assetV.id,
    trackId: videoTrackId,
    timelineStart: toFrame(400),
    timelineEnd: toFrame(700),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  const clip3 = createClip({
    id: toClipId('clip3'),
    assetId: assetV.id,
    trackId: videoTrackId,
    timelineStart: toFrame(800),
    timelineEnd: toFrame(1100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  const clip4 = createClip({
    id: toClipId('clip4'),
    assetId: assetA.id,
    trackId: audioTrackId,
    timelineStart: toFrame(100),
    timelineEnd: toFrame(500),
    mediaIn: toFrame(0),
    mediaOut: toFrame(400),
  });
  const videoTrack = createTrack({
    id: videoTrackId,
    name: 'V1',
    type: 'video',
    clips: [clip1, clip2, clip3],
  });
  const audioTrack = createTrack({
    id: audioTrackId,
    name: 'A1',
    type: 'audio',
    clips: [clip4],
  });
  const markerA: Marker = {
    type: 'point',
    id: toMarkerId('markerA'),
    frame: toFrame(150),
    label: 'A',
    color: 'red',
    scope: 'global',
    linkedClipId: null,
  };
  const markerB: Marker = {
    type: 'point',
    id: toMarkerId('markerB'),
    frame: toFrame(600),
    label: 'B',
    color: 'blue',
    scope: 'global',
    linkedClipId: null,
  };
  const markerC: Marker = {
    type: 'point',
    id: toMarkerId('markerC'),
    frame: toFrame(900),
    label: 'C',
    color: 'green',
    scope: 'global',
    linkedClipId: null,
  };
  const timeline = createTimeline({
    id: 'tl',
    name: 'SeekTest',
    fps: FPS,
    duration: toFrame(DURATION_FRAMES),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [videoTrack, audioTrack],
    markers: [markerA, markerB, markerC],
  });
  return createTimelineState({
    timeline,
    assetRegistry: new Map([
      [assetV.id, assetV],
      [assetA.id, assetA],
    ]),
  });
}

const state = makeSeekFixtureState();
const DIMS = { width: 1920, height: 1080 };
const mockPipeline: PipelineConfig = {
  videoDecoder: async (req) => ({
    clipId: req.clipId,
    mediaFrame: req.mediaFrame,
    width: 1920,
    height: 1080,
    bitmap: null,
  }),
  compositor: async (req) => ({ timelineFrame: req.timelineFrame, bitmap: null }),
};

describe('Phase 6 — Seek (findNextClipBoundary)', () => {
  it('1. From frame 0 → 100 (clip4 start on audio track)', () => {
    expect(findNextClipBoundary(state, toFrame(0))).toBe(toFrame(100));
  });
  it('2. From frame 99 → 100', () => {
    expect(findNextClipBoundary(state, toFrame(99))).toBe(toFrame(100));
  });
  it('3. From frame 100 → 300 (clip1 end)', () => {
    expect(findNextClipBoundary(state, toFrame(100))).toBe(toFrame(300));
  });
  it('4. From frame 299 → 300 (clip1 end)', () => {
    expect(findNextClipBoundary(state, toFrame(299))).toBe(toFrame(300));
  });
  it('5. From frame 300 → 400 (clip2 start)', () => {
    expect(findNextClipBoundary(state, toFrame(300))).toBe(toFrame(400));
  });
  it('6. From frame 1099 → 1100 (clip3 end)', () => {
    expect(findNextClipBoundary(state, toFrame(1099))).toBe(toFrame(1100));
  });
  it('7. From frame 1100 → null (no more boundaries)', () => {
    expect(findNextClipBoundary(state, toFrame(1100))).toBeNull();
  });
});

describe('Phase 6 — Seek (findPrevClipBoundary)', () => {
  it('8. From frame 300 → 100 (max boundary strictly before 300)', () => {
    expect(findPrevClipBoundary(state, toFrame(300))).toBe(toFrame(100));
  });
  it('9. From frame 400 → 300', () => {
    expect(findPrevClipBoundary(state, toFrame(400))).toBe(toFrame(300));
  });
  it('10. From frame 0 → null', () => {
    expect(findPrevClipBoundary(state, toFrame(0))).toBeNull();
  });
  it('11. From frame 1 → 0 (clip1 start)', () => {
    expect(findPrevClipBoundary(state, toFrame(1))).toBe(toFrame(0));
  });
});

describe('Phase 6 — Seek (findNextMarker)', () => {
  it('12. From frame 0 → markerA (anchor 150)', () => {
    const m = findNextMarker(state, toFrame(0));
    expect(m).not.toBeNull();
    expect(m!.type).toBe('point');
    expect((m as { frame: number }).frame).toBe(150);
  });
  it('13. From frame 150 → markerB (anchor 600)', () => {
    const m = findNextMarker(state, toFrame(150));
    expect(m).not.toBeNull();
    expect((m as { frame: number }).frame).toBe(600);
  });
  it('14. From frame 600 → markerC (anchor 900)', () => {
    const m = findNextMarker(state, toFrame(600));
    expect(m).not.toBeNull();
    expect((m as { frame: number }).frame).toBe(900);
  });
  it('15. From frame 900 → null', () => {
    expect(findNextMarker(state, toFrame(900))).toBeNull();
  });
});

describe('Phase 6 — Seek (findPrevMarker)', () => {
  it('16. From frame 900 → markerB (anchor 600)', () => {
    const m = findPrevMarker(state, toFrame(900));
    expect(m).not.toBeNull();
    expect((m as { frame: number }).frame).toBe(600);
  });
  it('17. From frame 600 → markerA (anchor 150)', () => {
    const m = findPrevMarker(state, toFrame(600));
    expect(m).not.toBeNull();
    expect((m as { frame: number }).frame).toBe(150);
  });
  it('18. From frame 150 → null', () => {
    expect(findPrevMarker(state, toFrame(150))).toBeNull();
  });
  it('19. From frame 1000 → markerC (anchor 900)', () => {
    const m = findPrevMarker(state, toFrame(1000));
    expect(m).not.toBeNull();
    expect((m as { frame: number }).frame).toBe(900);
  });
});

describe('Phase 6 — Seek (findClipById)', () => {
  it('20. Returns correct clip + track for valid id', () => {
    const result = findClipById(state, toClipId('clip2'));
    expect(result).not.toBeNull();
    expect(result!.clip.id).toBe(toClipId('clip2'));
    expect(result!.track.id).toBe(toTrackId('videoTrack'));
    expect(result!.trackIndex).toBe(0);
  });
  it('21. Returns null for unknown id', () => {
    expect(findClipById(state, toClipId('nonexistent'))).toBeNull();
  });
});

describe('Phase 6 — Seek (PlaybackEngine)', () => {
  it('22. seekToNextClipBoundary() advances to next boundary', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    engine.seekTo(toFrame(0));
    engine.seekToNextClipBoundary();
    expect(engine.getState().currentFrame).toBe(toFrame(100));
    engine.destroy();
  });
  it('23. seekToPrevClipBoundary() seeks to prev boundary', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    engine.seekTo(toFrame(400));
    engine.seekToPrevClipBoundary();
    expect(engine.getState().currentFrame).toBe(toFrame(300));
    engine.destroy();
  });
  it('24. seekToNextClipBoundary() at last boundary: no-op', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    engine.seekTo(toFrame(1100));
    engine.seekToNextClipBoundary();
    expect(engine.getState().currentFrame).toBe(toFrame(1100));
    engine.destroy();
  });
  it('25. seekToNextMarker() seeks to markerA from frame 0', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    engine.seekTo(toFrame(0));
    engine.seekToNextMarker();
    expect(engine.getState().currentFrame).toBe(toFrame(150));
    engine.destroy();
  });
  it('26. seekToPrevMarker() seeks to markerB from frame 900', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    engine.seekTo(toFrame(900));
    engine.seekToPrevMarker();
    expect(engine.getState().currentFrame).toBe(toFrame(600));
    engine.destroy();
  });
  it('27. seekToStart() → frame 0', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    engine.seekTo(toFrame(500));
    engine.seekToStart();
    expect(engine.getState().currentFrame).toBe(toFrame(0));
    engine.destroy();
  });
  it('28. seekToEnd() → frame 1799', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    engine.seekTo(toFrame(0));
    engine.seekToEnd();
    expect(engine.getState().currentFrame).toBe(toFrame(1799));
    engine.destroy();
  });
});
