/**
 * KEYFRAME MODEL — Phase 4
 *
 * Single keyframe for animatable values (effect params, transform, audio).
 */

import type { TimelineFrame } from './frame';
import type { EasingCurve } from './easing';

export type KeyframeId = string & { readonly __brand: 'KeyframeId' };
export function toKeyframeId(s: string): KeyframeId {
  return s as KeyframeId;
}

/** Value is a plain number (opacity, scale, rotation, gain, etc.). */
export type Keyframe = {
  readonly id: KeyframeId;
  readonly frame: TimelineFrame;
  readonly value: number;
  /** Easing out of this keyframe. */
  readonly easing: EasingCurve;
};
