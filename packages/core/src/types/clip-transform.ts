/**
 * CLIP TRANSFORM — Phase 4
 *
 * Animatable position, scale, rotation, opacity, anchor.
 * Each property: base value + optional keyframes.
 */

import type { Keyframe } from './keyframe';

export type AnimatableProperty = {
  readonly value: number;
  readonly keyframes: readonly Keyframe[];
};

export function createAnimatableProperty(value: number): AnimatableProperty {
  return { value, keyframes: [] };
}

export type ClipTransform = {
  readonly positionX: AnimatableProperty;  // pixels, default 0
  readonly positionY: AnimatableProperty;  // pixels, default 0
  readonly scaleX: AnimatableProperty;     // multiplier, default 1
  readonly scaleY: AnimatableProperty;     // multiplier, default 1
  readonly rotation: AnimatableProperty;    // degrees, default 0
  readonly opacity: AnimatableProperty;    // 0–1, default 1
  readonly anchorX: AnimatableProperty;    // pixels, default 0
  readonly anchorY: AnimatableProperty;    // pixels, default 0
};

export const DEFAULT_CLIP_TRANSFORM: ClipTransform = {
  positionX: createAnimatableProperty(0),
  positionY: createAnimatableProperty(0),
  scaleX: createAnimatableProperty(1),
  scaleY: createAnimatableProperty(1),
  rotation: createAnimatableProperty(0),
  opacity: createAnimatableProperty(1),
  anchorX: createAnimatableProperty(0),
  anchorY: createAnimatableProperty(0),
};
