/**
 * Transaction compression policy — Phase 7 Step 3
 *
 * Rapid same-type ops within a time window can be merged
 * into a single history entry (last-write-wins).
 */

export type CompressionPolicy =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'last-write-wins';
      readonly windowMs: number;
    };

export type CompressibleOpType =
  | 'MOVE_CLIP'
  | 'SET_CLIP_TRANSFORM'
  | 'SET_AUDIO_PROPERTIES'
  | 'SET_EFFECT_PARAM'
  | 'MOVE_KEYFRAME'
  | 'SET_TRANSITION_DURATION'
  | 'MOVE_MARKER'
  | 'SET_IN_POINT'
  | 'SET_OUT_POINT'
  | 'SET_TRACK_OPACITY';

const COMPRESSIBLE_OP_TYPES: ReadonlySet<CompressibleOpType> = new Set([
  'MOVE_CLIP',
  'SET_CLIP_TRANSFORM',
  'SET_AUDIO_PROPERTIES',
  'SET_EFFECT_PARAM',
  'MOVE_KEYFRAME',
  'SET_TRANSITION_DURATION',
  'MOVE_MARKER',
  'SET_IN_POINT',
  'SET_OUT_POINT',
  'SET_TRACK_OPACITY',
]);

export function isCompressibleOpType(type: string): type is CompressibleOpType {
  return COMPRESSIBLE_OP_TYPES.has(type as CompressibleOpType);
}

export const DEFAULT_COMPRESSION_POLICY: CompressionPolicy = {
  kind: 'last-write-wins',
  windowMs: 300,
};

export const NO_COMPRESSION: CompressionPolicy = {
  kind: 'none',
};
