/**
 * FRAME TYPE TESTS — Phase 0
 *
 * Verifies the FrameRate discriminated union and TimelineFrame brand enforce
 * the spec rules at the TypeScript level.
 */

import { describe, it, expect } from 'vitest';
import {
  frame,
  frameRate,
  toFrame,
  FrameRates,
  isDropFrame,
  isValidFrame,
} from '../types/frame';

describe('TimelineFrame', () => {
  it('frame() rounds floating-point inputs to nearest integer', () => {
    expect(frame(29.7)).toBe(30);
    expect(frame(0.4)).toBe(0);
  });

  it('frame() throws on negative values', () => {
    expect(() => frame(-1)).toThrow();
  });

  it('toFrame() creates branded TimelineFrame without rounding', () => {
    const f = toFrame(100);
    expect(f).toBe(100);
  });

  it('isValidFrame() accepts non-negative integers only', () => {
    expect(isValidFrame(0)).toBe(true);
    expect(isValidFrame(1000)).toBe(true);
    expect(isValidFrame(-1)).toBe(false);
    expect(isValidFrame(1.5)).toBe(false);
  });
});

describe('FrameRate discriminated union', () => {
  it('frameRate() accepts every member of the literal union', () => {
    const valid = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
    for (const v of valid) {
      expect(() => frameRate(v)).not.toThrow();
    }
  });

  it('frameRate() rejects values outside the union', () => {
    expect(() => frameRate(29.975)).toThrow();
    expect(() => frameRate(0)).toThrow();
    expect(() => frameRate(120)).toThrow();
  });

  it('FrameRates constants are all valid union members', () => {
    expect(() => frameRate(FrameRates.NTSC)).not.toThrow();
    expect(() => frameRate(FrameRates.PAL)).not.toThrow();
    expect(() => frameRate(FrameRates.NTSC_DF)).not.toThrow();
    expect(() => frameRate(FrameRates.CINEMA)).not.toThrow();
  });

  it('isDropFrame() correctly identifies drop-frame rates', () => {
    expect(isDropFrame(29.97)).toBe(true);
    expect(isDropFrame(59.94)).toBe(true);
    expect(isDropFrame(30)).toBe(false);
    expect(isDropFrame(24)).toBe(false);
  });
});
