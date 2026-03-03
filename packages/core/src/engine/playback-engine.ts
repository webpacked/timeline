/**
 * PlaybackEngine — Phase 6 Step 2
 *
 * Orchestrates PlayheadController + pipeline contracts.
 * Host app instantiates this with its PipelineConfig.
 */

import type { TimelineFrame } from '../types/frame';
import type { TimelineState } from '../types/state';
import type { PlaybackRate, PlaybackQuality, LoopRegion } from '../types/playhead';
import type { PlayheadListener } from '../types/playhead';
import type {
  PipelineConfig,
  CompositeRequest,
  CompositeResult,
  VideoFrameRequest,
} from '../types/pipeline';
import type { Clock } from './clock';
import { nodeClock } from './clock';
import { toFrame } from '../types/frame';
import { PlayheadController } from './playhead-controller';
import {
  resolveFrame,
  findNextClipBoundary,
  findPrevClipBoundary,
  findNextMarker,
  findPrevMarker,
  getMarkerAnchor,
} from './frame-resolver';
import { TrackIndex } from './track-index';
import { SnapIndexManager } from './snap-index-manager';

export class PlaybackEngine {
  private controller: PlayheadController;
  private pipeline: PipelineConfig;
  private state: TimelineState;
  private dimensions: { width: number; height: number };
  private trackIndex: TrackIndex = new TrackIndex();
  private snapManager: SnapIndexManager = new SnapIndexManager();
  private unsubscribe: (() => void) | null = null;

  constructor(
    state: TimelineState,
    pipeline: PipelineConfig,
    dimensions: { width: number; height: number },
    clock?: Clock,
  ) {
    this.state = state;
    this.pipeline = pipeline;
    this.dimensions = dimensions;
    this.trackIndex.build(state);
    this.snapManager.rebuildSync(state);
    const durationFrames = (state.timeline.duration as number) ?? 0;
    const fps = (state.timeline.fps as number) || 30;
    this.controller = new PlayheadController(
      { durationFrames, fps },
      clock ?? nodeClock,
    );
  }

  updateState(state: TimelineState): void {
    this.state = state;
    this.trackIndex.build(state);
    this.snapManager.scheduleRebuild(state);
    const durationFrames = (state.timeline.duration as number) ?? 0;
    this.controller.setDuration(durationFrames);
  }

  play(): void {
    this.controller.play();
  }

  pause(): void {
    this.controller.pause();
  }

  seekTo(frame: TimelineFrame): void {
    this.controller.seekTo(frame);
  }

  seekToNextClipBoundary(): void {
    const next = findNextClipBoundary(
      this.state,
      this.controller.getState().currentFrame,
    );
    if (next !== null) this.controller.seekTo(next);
  }

  seekToPrevClipBoundary(): void {
    const prev = findPrevClipBoundary(
      this.state,
      this.controller.getState().currentFrame,
    );
    if (prev !== null) this.controller.seekTo(prev);
  }

  seekToNextMarker(): void {
    const marker = findNextMarker(
      this.state,
      this.controller.getState().currentFrame,
    );
    if (marker !== null) this.controller.seekTo(getMarkerAnchor(marker));
  }

  seekToPrevMarker(): void {
    const marker = findPrevMarker(
      this.state,
      this.controller.getState().currentFrame,
    );
    if (marker !== null) this.controller.seekTo(getMarkerAnchor(marker));
  }

  seekToStart(): void {
    this.controller.seekTo(toFrame(0));
  }

  seekToEnd(): void {
    const duration = this.state.timeline.duration as number;
    this.controller.seekTo(toFrame(Math.max(0, duration - 1)));
  }

  setPlaybackRate(rate: PlaybackRate): void {
    this.controller.setPlaybackRate(rate);
  }

  setQuality(quality: PlaybackQuality): void {
    this.controller.setQuality(quality);
  }

  setLoopRegion(region: LoopRegion | null): void {
    this.controller.setLoopRegion(region);
  }

  setPreroll(frames: number): void {
    this.controller.setPreroll(frames);
  }

  setPostroll(frames: number): void {
    this.controller.setPostroll(frames);
  }

  getState() {
    return this.controller.getState();
  }

  getCurrentTimelineState(): TimelineState {
    return this.state;
  }

  on(listener: PlayheadListener): () => void {
    return this.controller.on(listener);
  }

  async renderFrame(timelineFrame: TimelineFrame): Promise<CompositeResult> {
    const resolved = resolveFrame(
      this.state,
      timelineFrame,
      this.controller.getState().quality,
      this.dimensions,
      this.trackIndex,
    );
    const decoded = await Promise.all(
      resolved.layers.map((layer) => {
        const req: VideoFrameRequest = {
          clipId: layer.clipId,
          mediaFrame: layer.mediaFrame,
          quality: resolved.quality,
        };
        return this.pipeline.videoDecoder(req);
      }),
    );
    const layers = resolved.layers.map((layer, i) => ({
      clipId: layer.clipId,
      trackId: layer.trackId,
      trackIndex: layer.trackIndex,
      frame: decoded[i]!,
      transform: layer.transform,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      effects: layer.effects,
    }));
    const request: CompositeRequest = {
      timelineFrame: resolved.timelineFrame,
      layers,
      width: resolved.width,
      height: resolved.height,
      quality: resolved.quality,
    };
    return this.pipeline.compositor(request);
  }

  destroy(): void {
    this.controller.destroy();
  }
}
