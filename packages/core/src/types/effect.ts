/**
 * EFFECT MODEL — Phase 4
 *
 * Effect applied to a clip (blur, LUT, color correct, host-defined).
 */

import type { Keyframe } from './keyframe';

export type EffectId = string & { readonly __brand: 'EffectId' };
export function toEffectId(s: string): EffectId {
  return s as EffectId;
}

/** Open string: 'blur', 'lut', 'colorCorrect', host-defined. */
export type EffectType = string;

export type RenderStage =
  | 'preComposite'   // applied before track composite
  | 'postComposite'  // applied after track composite
  | 'output';        // applied to final output

export type EffectParam = {
  readonly key: string;
  readonly value: number | string | boolean;
};

export type Effect = {
  readonly id: EffectId;
  readonly effectType: EffectType;
  readonly enabled: boolean;
  readonly renderStage: RenderStage;
  readonly params: readonly EffectParam[];
  readonly keyframes: readonly Keyframe[];
};

export function createEffect(
  id: EffectId,
  effectType: EffectType,
  renderStage: RenderStage = 'preComposite',
  params: readonly EffectParam[] = [],
): Effect {
  return { id, effectType, enabled: true, renderStage, params, keyframes: [] };
}
