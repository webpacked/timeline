/**
 * EASING CURVES — Phase 4
 *
 * Discriminated union for keyframe/interpolation easing.
 */

export type EasingCurve =
  | { readonly kind: 'Linear' }
  | { readonly kind: 'Hold' }
  | { readonly kind: 'EaseIn'; readonly power: number }
  | { readonly kind: 'EaseOut'; readonly power: number }
  | { readonly kind: 'EaseBoth'; readonly power: number }
  | {
      readonly kind: 'BezierCurve';
      readonly p1x: number;
      readonly p1y: number;
      readonly p2x: number;
      readonly p2y: number;
    };

export const LINEAR_EASING: EasingCurve = { kind: 'Linear' };
export const HOLD_EASING: EasingCurve = { kind: 'Hold' };
