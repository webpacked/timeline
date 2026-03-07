/**
 * FRAME-BASED TIME REPRESENTATION
 *
 * Phase 0 compliant. All time values in state are TimelineFrame branded integers.
 * FrameRate is a discriminated literal union — never a raw float.
 *
 * THREE INVIOLABLE RULES:
 * 1. Core has ZERO UI framework imports.
 * 2. Every function that changes state returns a NEW object.
 * 3. Every frame value is a branded TimelineFrame integer — never a raw number.
 */

// ---------------------------------------------------------------------------
// TimelineFrame
// ---------------------------------------------------------------------------

/**
 * TimelineFrame — A discrete, non-negative integer point in time measured in frames.
 *
 * Branded so TypeScript prevents raw numbers from sneaking into frame positions.
 * The ONLY way to create one is via toFrame().
 */
export type TimelineFrame = number & { readonly __brand: "TimelineFrame" };

/** The canonical factory. Use this everywhere instead of casting. */
export const toFrame = (n: number): TimelineFrame => n as TimelineFrame;

/**
 * Legacy alias kept for backward-compat during transition.
 * Prefer toFrame() for new code.
 */
export function frame(value: number): TimelineFrame {
  const rounded = Math.round(value);
  if (rounded < 0) {
    throw new Error(`TimelineFrame must be non-negative, got: ${value}`);
  }
  return rounded as TimelineFrame;
}

// ---------------------------------------------------------------------------
// FrameRate — Discriminated literal union, never a raw float
// ---------------------------------------------------------------------------

/**
 * FrameRate — The exact set of supported frame rates.
 *
 * RULE: Never pass 29.97 as a plain number. Use the literal type.
 * This is a discriminated union — TypeScript enforces membership at compile time.
 */
export type FrameRate = 23.976 | 24 | 25 | 29.97 | 30 | 50 | 59.94 | 60;

/**
 * Named constants for the most common rates.
 * Prefer these over raw literals where possible.
 */
export const FrameRates = {
  CINEMA: 24 as FrameRate,
  PAL: 25 as FrameRate,
  NTSC_DF: 29.97 as FrameRate,
  NTSC: 30 as FrameRate,
  PAL_HFR: 50 as FrameRate,
  NTSC_HFR: 59.94 as FrameRate,
  HFR: 60 as FrameRate,
} as const;

/**
 * Legacy factory — kept for backward-compat with existing tests.
 * This now validates that the value is a member of the FrameRate union.
 * @throws if the value is not a recognised frame rate.
 */
export function frameRate(value: number): FrameRate {
  const valid: FrameRate[] = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
  if (!valid.includes(value as FrameRate)) {
    throw new Error(
      `FrameRate must be one of ${valid.join(", ")}, got: ${value}`,
    );
  }
  return value as FrameRate;
}

// ---------------------------------------------------------------------------
// Derived time types
// ---------------------------------------------------------------------------

/**
 * RationalTime — a frame count at a specific rate. Used only at
 * ingest/export boundaries. Never stored in TimelineState.
 */
export type RationalTime = {
  readonly value: number;
  readonly rate: FrameRate;
};

/**
 * Timecode — SMPTE timecode string, display-only. Never use for arithmetic.
 */
export type Timecode = string & { readonly __brand: "Timecode" };
export const toTimecode = (s: string): Timecode => s as Timecode;

/**
 * TimeRange — a start + duration pair, both in TimelineFrame units.
 */
export type TimeRange = {
  readonly startFrame: TimelineFrame;
  readonly duration: TimelineFrame;
};

// ---------------------------------------------------------------------------
// Guard helpers
// ---------------------------------------------------------------------------

export function isValidFrame(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function isDropFrame(fps: FrameRate): boolean {
  return fps === 29.97 || fps === 59.94;
}
