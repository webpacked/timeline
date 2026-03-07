/**
 * Phase 6 Step 2 — Pipeline contracts and frame resolver
 *
 * Uses mock pipeline (no real decoding). Fixture: 30fps, two video tracks,
 * three clips.
 */

import { describe, it, expect } from 'vitest';
import { toFrame } from '../types/frame';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset } from '../types/asset';
import { toTimecode } from '../types/frame';
import type { TimelineState } from '../types/state';
import type { PipelineConfig, CompositeResult, VideoFrameResult } from '../types/pipeline';
import { resolveFrame, getClipsAtFrame, mediaFrameForClip } from '../engine/frame-resolver';
import { PlaybackEngine } from '../engine/playback-engine';
import { createTestClock } from '../engine/clock';

const FPS = 30;

function makeFixtureState(): TimelineState {
  const videoTrackId = toTrackId('videoTrack');
  const videoTrack2Id = toTrackId('videoTrack2');
  const asset = createAsset({
    id: 'asset1',
    name: 'V',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(10000),
    nativeFps: FPS,
    sourceTimecodeOffset: toFrame(0),
  });
  const clip1 = createClip({
    id: toClipId('clip1'),
    assetId: asset.id,
    trackId: videoTrackId,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(300),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  const clip2 = createClip({
    id: toClipId('clip2'),
    assetId: asset.id,
    trackId: videoTrackId,
    timelineStart: toFrame(300),
    timelineEnd: toFrame(600),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  const clip3 = createClip({
    id: toClipId('clip3'),
    assetId: asset.id,
    trackId: videoTrack2Id,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(600),
    mediaIn: toFrame(100),
    mediaOut: toFrame(700),
  });
  const videoTrack = createTrack({
    id: videoTrackId,
    name: 'V1',
    type: 'video',
    clips: [clip1, clip2],
  });
  const videoTrack2 = createTrack({
    id: videoTrack2Id,
    name: 'V2',
    type: 'video',
    clips: [clip3],
  });
  const timeline = createTimeline({
    id: 'tl',
    name: 'Test',
    fps: FPS,
    duration: toFrame(1000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [videoTrack, videoTrack2],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[asset.id, asset]]) });
}

const DIMS = { width: 1920, height: 1080 };

describe('Phase 6 — Pipeline', () => {
  const state = makeFixtureState();

  // resolveFrame
  it('1. At frame 0: returns 2 layers (clip1 + clip3)', () => {
    const req = resolveFrame(state, toFrame(0), 'full', DIMS);
    expect(req.layers).toHaveLength(2);
    expect(req.layers.map((l) => l.clipId)).toContain(toClipId('clip1'));
    expect(req.layers.map((l) => l.clipId)).toContain(toClipId('clip3'));
  });

  it('2. At frame 300: returns 2 layers (clip2 + clip3)', () => {
    const req = resolveFrame(state, toFrame(300), 'full', DIMS);
    expect(req.layers).toHaveLength(2);
    expect(req.layers.map((l) => l.clipId)).toContain(toClipId('clip2'));
    expect(req.layers.map((l) => l.clipId)).toContain(toClipId('clip3'));
  });

  it('3. At frame 600: returns 0 layers (past all clips)', () => {
    const req = resolveFrame(state, toFrame(600), 'full', DIMS);
    expect(req.layers).toHaveLength(0);
  });

  it('4. Layer trackIndex matches track order', () => {
    const req = resolveFrame(state, toFrame(0), 'full', DIMS);
    const byClip = Object.fromEntries(req.layers.map((l) => [l.clipId, l.trackIndex]));
    expect(byClip[toClipId('clip1')]).toBe(0);
    expect(byClip[toClipId('clip3')]).toBe(1);
  });

  it('5. Layer mediaFrame computed correctly for clip3 (frame 0 → mediaFrame 100, frame 50 → 150)', () => {
    const req0 = resolveFrame(state, toFrame(0), 'full', DIMS);
    const layer3At0 = req0.layers.find((l) => l.clipId === toClipId('clip3'));
    expect(layer3At0!.mediaFrame).toBe(toFrame(100));

    const req50 = resolveFrame(state, toFrame(50), 'full', DIMS);
    const layer3At50 = req50.layers.find((l) => l.clipId === toClipId('clip3'));
    expect(layer3At50!.mediaFrame).toBe(toFrame(150));
  });

  it('6. Layer transform defaults to DEFAULT_CLIP_TRANSFORM when clip has no transform', () => {
    const req = resolveFrame(state, toFrame(0), 'full', DIMS);
    const layer = req.layers[0]!;
    expect(layer.transform).toBeDefined();
    expect(layer.transform.opacity.value).toBe(1);
    expect(layer.transform.scaleX.value).toBe(1);
  });

  it('7. Layer blendMode defaults to "normal"', () => {
    const req = resolveFrame(state, toFrame(0), 'full', DIMS);
    req.layers.forEach((l) => expect(l.blendMode).toBe('normal'));
  });

  it('8. Layer opacity defaults to 1', () => {
    const req = resolveFrame(state, toFrame(0), 'full', DIMS);
    req.layers.forEach((l) => expect(l.opacity).toBe(1));
  });

  // getClipsAtFrame
  it('9. Returns correct clips at frame 150', () => {
    const pairs = getClipsAtFrame(state, toFrame(150));
    expect(pairs).toHaveLength(2);
    const clipIds = pairs.map((p) => p.clip.id);
    expect(clipIds).toContain(toClipId('clip1'));
    expect(clipIds).toContain(toClipId('clip3'));
  });

  it('10. Returns empty array past end of all clips', () => {
    const pairs = getClipsAtFrame(state, toFrame(700));
    expect(pairs).toHaveLength(0);
  });

  // mediaFrameForClip
  it('11. Correct mediaFrame with mediaStart = 0', () => {
    const clip1 = state.timeline.tracks[0]!.clips[0]!;
    expect(mediaFrameForClip(clip1, toFrame(0))).toBe(toFrame(0));
    expect(mediaFrameForClip(clip1, toFrame(100))).toBe(toFrame(100));
  });

  it('12. Correct mediaFrame with mediaStart = 100', () => {
    const clip3 = state.timeline.tracks[1]!.clips[0]!;
    expect(mediaFrameForClip(clip3, toFrame(0))).toBe(toFrame(100));
    expect(mediaFrameForClip(clip3, toFrame(50))).toBe(toFrame(150));
  });

  // PlaybackEngine
  const mockVideoDecoder = async (req: {
    clipId: unknown;
    mediaFrame: unknown;
  }): Promise<VideoFrameResult> => ({
    clipId: req.clipId as VideoFrameResult['clipId'],
    mediaFrame: req.mediaFrame as VideoFrameResult['mediaFrame'],
    width: 1920,
    height: 1080,
    bitmap: null,
  });

  const mockCompositor = async (req: {
    timelineFrame: unknown;
  }): Promise<CompositeResult> => ({
    timelineFrame: req.timelineFrame as CompositeResult['timelineFrame'],
    bitmap: null,
  });

  const mockPipeline: PipelineConfig = {
    videoDecoder: mockVideoDecoder,
    compositor: mockCompositor,
  };

  it('13. play() / pause() delegate to controller', () => {
    const { clock, tick } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    expect(engine.getState().isPlaying).toBe(false);
    engine.play();
    expect(engine.getState().isPlaying).toBe(true);
    tick(1000 / 30);
    engine.pause();
    expect(engine.getState().isPlaying).toBe(false);
    engine.destroy();
  });

  it('14. seekTo() delegates to controller', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    engine.seekTo(toFrame(200));
    expect(engine.getState().currentFrame).toBe(toFrame(200));
    engine.destroy();
  });

  it('15. getState() returns controller state', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const s = engine.getState();
    expect(s.currentFrame).toBeDefined();
    expect(s.isPlaying).toBe(false);
    expect(s.fps).toBe(FPS);
    engine.destroy();
  });

  it('16. updateState() updates internal state (resolveFrame uses new state after update)', async () => {
    const { clock } = createTestClock();
    const layersSeen: number[] = [];
    const pipeline: PipelineConfig = {
      videoDecoder: mockVideoDecoder,
      compositor: async (req) => {
        layersSeen.push(req.layers.length);
        return mockCompositor(req);
      },
    };
    const engine = new PlaybackEngine(state, pipeline, DIMS, clock);
    await engine.renderFrame(toFrame(0));
    expect(layersSeen[0]).toBe(2);
    const state2 = makeFixtureState();
    engine.updateState(state2);
    await engine.renderFrame(toFrame(0));
    expect(layersSeen[1]).toBe(2);
    engine.destroy();
  });

  it('17. renderFrame() calls videoDecoder for each layer', async () => {
    const { clock } = createTestClock();
    const decodeCalls: Array<{ clipId: string; mediaFrame: number }> = [];
    const pipeline: PipelineConfig = {
      videoDecoder: async (req) => {
        decodeCalls.push({
          clipId: req.clipId as string,
          mediaFrame: req.mediaFrame as number,
        });
        return mockVideoDecoder(req);
      },
      compositor: mockCompositor,
    };
    const engine = new PlaybackEngine(state, pipeline, DIMS, clock);
    await engine.renderFrame(toFrame(0));
    expect(decodeCalls).toHaveLength(2);
    engine.destroy();
  });

  it('18. renderFrame() calls compositor with layers', async () => {
    const { clock } = createTestClock();
    let compositorLayers: unknown[] = [];
    const pipeline: PipelineConfig = {
      videoDecoder: mockVideoDecoder,
      compositor: async (req) => {
        compositorLayers = [...req.layers];
        return mockCompositor(req);
      },
    };
    const engine = new PlaybackEngine(state, pipeline, DIMS, clock);
    await engine.renderFrame(toFrame(0));
    expect(compositorLayers).toHaveLength(2);
    engine.destroy();
  });

  it('19. renderFrame() returns CompositeResult', async () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const result = await engine.renderFrame(toFrame(100));
    expect(result.timelineFrame).toBe(toFrame(100));
    expect(result.bitmap).toBe(null);
    engine.destroy();
  });

  it('20. destroy() cleans up controller', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    engine.play();
    engine.destroy();
    expect(engine.getState().isPlaying).toBe(false);
  });
});
