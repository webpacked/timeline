/**
 * Playhead types — Phase 6 Step 1 + Step 5
 *
 * Playback position and quality. No DOM deps.
 */

import type { TimelineFrame } from './frame';

export type PlaybackRate = number;
// 1.0 = normal, 0.5 = half speed, 2.0 = double,
// -1.0 = reverse, 0 = paused

export type PlaybackQuality = 'full' | 'half' | 'quarter' | 'proxy';

export type LoopRegion = {
  readonly startFrame: TimelineFrame;
  readonly endFrame: TimelineFrame; // exclusive
};

export type PlayheadState = {
  readonly currentFrame: TimelineFrame;
  readonly isPlaying: boolean;
  readonly playbackRate: PlaybackRate;
  readonly quality: PlaybackQuality;
  readonly durationFrames: number;
  readonly fps: number;
  readonly loopRegion: LoopRegion | null;
  readonly prerollFrames: number;
  readonly postrollFrames: number;
};

export type PlayheadEventType =
  | 'play'
  | 'pause'
  | 'seek'
  | 'loop'
  | 'frame-dropped'
  | 'ended'
  | 'loop-point'
  | 'state';

export type PlayheadEvent = {
  readonly type: PlayheadEventType;
  readonly frame: TimelineFrame;
  readonly data?: unknown;
};

export type PlayheadListener = (event: PlayheadEvent) => void;

/** Return type of PlayheadController.on() — call to unsubscribe. */
export type PlayheadUnsubscribe = () => void;
