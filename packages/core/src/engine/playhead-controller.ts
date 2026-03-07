/**
 * PlayheadController — Phase 6 Step 1
 *
 * Manages playback position only. Decoupled from Dispatcher and TimelineState.
 * Never calls dispatch(). Uses clock abstraction for testability.
 */

import { toFrame } from '../types/frame';
import type { TimelineFrame } from '../types/frame';
import type {
  PlayheadState,
  PlaybackRate,
  PlaybackQuality,
  PlayheadEventType,
  PlayheadEvent,
  PlayheadListener,
  PlayheadUnsubscribe,
  LoopRegion,
} from '../types/playhead';
import type { Clock } from './clock';
import { nodeClock } from './clock';

export class PlayheadController {
  private state: PlayheadState;
  private listeners: Set<PlayheadListener> = new Set();
  private rafId: number | null = null;
  private lastTimestamp: number | null = null;
  private frameAccum = 0;
  private clock: Clock;

  constructor(
    initialState: Pick<PlayheadState, 'durationFrames' | 'fps'>,
    clock: Clock = nodeClock,
  ) {
    this.clock = clock;
    this.state = {
      currentFrame: toFrame(0),
      isPlaying: false,
      playbackRate: 1.0,
      quality: 'full',
      durationFrames: initialState.durationFrames,
      fps: initialState.fps,
      loopRegion: null,
      prerollFrames: 0,
      postrollFrames: 0,
    };
  }

  getState(): PlayheadState {
    return this.state;
  }

  play(): void {
    if (this.state.isPlaying) return;
    this.lastTimestamp = null;
    if (
      this.state.loopRegion !== null &&
      this.state.prerollFrames > 0
    ) {
      const start = this.state.loopRegion.startFrame as number;
      const seekFrame = Math.max(0, start - this.state.prerollFrames);
      this.state = { ...this.state, currentFrame: toFrame(seekFrame) };
    }
    this.state = { ...this.state, isPlaying: true };
    this.scheduleFrame();
    this.emit('play', this.state.currentFrame);
  }

  pause(): void {
    if (!this.state.isPlaying) return;
    this.state = { ...this.state, isPlaying: false };
    if (this.rafId !== null) {
      this.clock.cancelFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTimestamp = null;
    this.emit('pause', this.state.currentFrame);
  }

  seekTo(frame: TimelineFrame): void {
    const n = Math.max(0, Math.min(this.state.durationFrames - 1, frame as number));
    const clamped = toFrame(n);
    this.state = { ...this.state, currentFrame: clamped };
    this.emit('seek', clamped);
  }

  setPlaybackRate(rate: PlaybackRate): void {
    this.lastTimestamp = null;
    this.state = { ...this.state, playbackRate: rate };
    this.emit('state', this.state.currentFrame);
  }

  setQuality(quality: PlaybackQuality): void {
    this.state = { ...this.state, quality };
    this.emit('state', this.state.currentFrame);
  }

  setDuration(durationFrames: number): void {
    let currentFrame = this.state.currentFrame;
    const cur = currentFrame as number;
    if (cur >= durationFrames) {
      currentFrame = toFrame(Math.max(0, durationFrames - 1));
    }
    this.state = {
      ...this.state,
      durationFrames,
      currentFrame,
    };
  }

  setLoopRegion(region: LoopRegion | null): void {
    if (region !== null) {
      const start = region.startFrame as number;
      const end = region.endFrame as number;
      if (start >= end) throw new Error('LoopRegion startFrame must be < endFrame');
    }
    this.state = { ...this.state, loopRegion: region };
    this.emit('state', this.state.currentFrame);
  }

  setPreroll(frames: number): void {
    if (frames < 0) throw new Error('prerollFrames must be >= 0');
    this.state = { ...this.state, prerollFrames: frames };
    this.emit('state', this.state.currentFrame);
  }

  setPostroll(frames: number): void {
    if (frames < 0) throw new Error('postrollFrames must be >= 0');
    this.state = { ...this.state, postrollFrames: frames };
    this.emit('state', this.state.currentFrame);
  }

  private scheduleFrame(): void {
    this.rafId = this.clock.requestFrame(this.onFrame.bind(this));
  }

  private onFrame(timestamp: number): void {
    if (!this.state.isPlaying) return;

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      this.scheduleFrame();
      return;
    }

    const elapsed = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    const frameAdvance = (elapsed * (this.state.fps * this.state.playbackRate)) / 1000;
    this.frameAccum += frameAdvance;

    const wholeFrames = Math.floor(Math.abs(this.frameAccum));
    if (wholeFrames === 0) {
      this.scheduleFrame();
      return;
    }

    let advanceBy = wholeFrames;
    if (wholeFrames > 2) {
      this.emit('frame-dropped', this.state.currentFrame, { dropped: wholeFrames - 1 });
      advanceBy = 1;
    }

    const direction = this.state.playbackRate >= 0 ? 1 : -1;
    const currentN = this.state.currentFrame as number;
    let newFrame = currentN + direction * advanceBy;
    this.frameAccum -= direction * advanceBy;

    if (this.state.loopRegion !== null && direction > 0) {
      const region = this.state.loopRegion;
      const effectiveEnd = (region.endFrame as number) + this.state.postrollFrames;
      if (newFrame >= effectiveEnd) {
        let wrapFrame = (region.startFrame as number) - this.state.prerollFrames;
        if (wrapFrame < 0) wrapFrame = 0;
        this.state = { ...this.state, currentFrame: toFrame(wrapFrame) };
        this.emit('loop-point', this.state.currentFrame);
        this.scheduleFrame();
        return;
      }
    }

    if (newFrame >= this.state.durationFrames) {
      this.state = {
        ...this.state,
        currentFrame: toFrame(this.state.durationFrames - 1),
        isPlaying: false,
      };
      this.rafId = null;
      this.lastTimestamp = null;
      this.frameAccum = 0;
      this.emit('ended', this.state.currentFrame);
      return;
    }

    if (newFrame < 0) {
      this.state = {
        ...this.state,
        currentFrame: toFrame(0),
        isPlaying: false,
      };
      this.rafId = null;
      this.lastTimestamp = null;
      this.frameAccum = 0;
      this.emit('ended', this.state.currentFrame);
      return;
    }

    this.state = { ...this.state, currentFrame: toFrame(newFrame) };
    this.scheduleFrame();
  }

  on(listener: PlayheadListener): PlayheadUnsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(type: PlayheadEventType, frame: TimelineFrame, data?: unknown): void {
    const event: PlayheadEvent = { type, frame, data };
    this.listeners.forEach((fn) => fn(event));
  }

  destroy(): void {
    if (this.state.isPlaying) this.pause();
    this.listeners.clear();
  }
}
