/**
 * Phase 6 Step 1 — PlayheadController
 *
 * All tests use createTestClock(). Fixture: durationFrames 900, fps 30.
 */

import { describe, it, expect } from 'vitest';
import { toFrame } from '../types/frame';
import { createTestClock } from '../engine/clock';
import { PlayheadController } from '../engine/playhead-controller';

const FIXTURE = { durationFrames: 900, fps: 30 };

describe('Phase 6 — PlayheadController', () => {
  // Construction
  it('1. Initial state: frame 0, not playing, rate 1.0, quality "full"', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    const s = c.getState();
    expect(s.currentFrame).toBe(toFrame(0));
    expect(s.isPlaying).toBe(false);
    expect(s.playbackRate).toBe(1.0);
    expect(s.quality).toBe('full');
    expect(s.durationFrames).toBe(900);
    expect(s.fps).toBe(30);
  });

  // play / pause
  it('2. play() sets isPlaying: true', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.play();
    expect(c.getState().isPlaying).toBe(true);
  });

  it('3. play() emits "play" event', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    const events: Array<{ type: string; frame: number }> = [];
    c.on((e) => events.push({ type: e.type, frame: e.frame as number }));
    c.play();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('play');
    expect(events[0]!.frame).toBe(0);
  });

  it('4. play() twice is a no-op (no double rAF)', () => {
    const { clock, getCallbacks } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.play();
    const count1 = getCallbacks().length;
    c.play();
    const count2 = getCallbacks().length;
    expect(count2).toBe(count1);
  });

  it('5. pause() sets isPlaying: false', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.play();
    tick(1000 / 30);
    c.pause();
    expect(c.getState().isPlaying).toBe(false);
  });

  it('6. pause() emits "pause" event', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    const events: Array<{ type: string }> = [];
    c.on((e) => events.push({ type: e.type }));
    c.play();
    tick(1000 / 30);
    c.pause();
    expect(events.some((e) => e.type === 'pause')).toBe(true);
  });

  it('7. pause() when not playing is a no-op', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.pause();
    expect(c.getState().isPlaying).toBe(false);
  });

  // seekTo
  it('8. seekTo(frame 300) updates currentFrame', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.seekTo(toFrame(300));
    expect(c.getState().currentFrame).toBe(toFrame(300));
  });

  it('9. seekTo emits "seek" event', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    const events: Array<{ type: string; frame: number }> = [];
    c.on((e) => events.push({ type: e.type, frame: e.frame as number }));
    c.seekTo(toFrame(100));
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('seek');
    expect(events[0]!.frame).toBe(100);
  });

  it('10. seekTo clamps to 0 (negative input)', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.seekTo(toFrame(-100));
    expect(c.getState().currentFrame).toBe(toFrame(0));
  });

  it('11. seekTo clamps to durationFrames - 1', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.seekTo(toFrame(9999));
    expect(c.getState().currentFrame).toBe(toFrame(899));
  });

  // setPlaybackRate
  it('12. setPlaybackRate(2.0) updates state', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.setPlaybackRate(2.0);
    expect(c.getState().playbackRate).toBe(2.0);
  });

  it('13. setPlaybackRate resets accumulator (tick after rate change does not jump)', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.play();
    tick(1000 / 30); // first frame init
    tick(1000 / 30); // advance 1 frame → frame 1
    expect(c.getState().currentFrame).toBe(toFrame(1));
    c.setPlaybackRate(2.0);
    tick(1000 / 30); // first frame after rate change (reset), no advance
    tick(1000 / 30); // advance 2 frames at 2x → frame 3
    expect(c.getState().currentFrame).toBe(toFrame(3));
  });

  // Frame advance
  it('14. play() + tick(1000/30) advances exactly 1 frame at 1.0x rate, 30fps', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.play();
    tick(1000 / 30); // init
    tick(1000 / 30); // 1 frame
    expect(c.getState().currentFrame).toBe(toFrame(1));
  });

  it('15. play() + tick(1000/30 * 30) advances 30 frames', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.play();
    tick(1000 / 30); // init
    for (let i = 0; i < 30; i++) tick(1000 / 30);
    expect(c.getState().currentFrame).toBe(toFrame(30));
  });

  it('16. play() + tick(1000/30) at 2.0x rate advances 2 frames', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.setPlaybackRate(2.0);
    c.play();
    tick(1000 / 30); // init
    tick(1000 / 30); // 2 frames at 2x
    expect(c.getState().currentFrame).toBe(toFrame(2));
  });

  // Ended
  it('17. Advancing past durationFrames emits "ended" and sets isPlaying: false', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    const events: Array<{ type: string }> = [];
    c.on((e) => events.push({ type: e.type }));
    c.play();
    tick(1000 / 30); // init
    for (let i = 0; i < 950; i++) tick(1000 / 30); // advance past 900
    expect(events.some((e) => e.type === 'ended')).toBe(true);
    expect(c.getState().isPlaying).toBe(false);
    expect(c.getState().currentFrame).toBe(toFrame(899));
  });

  it('18. Reverse (rate -1.0) hitting frame 0 emits "ended"', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    const events: Array<{ type: string }> = [];
    c.on((e) => events.push({ type: e.type }));
    c.seekTo(toFrame(5));
    c.setPlaybackRate(-1.0);
    c.play();
    tick(1000 / 30); // init
    for (let i = 0; i < 10; i++) tick(1000 / 30); // 10 frames backward → hit 0
    expect(events.some((e) => e.type === 'ended')).toBe(true);
    expect(c.getState().currentFrame).toBe(toFrame(0));
    expect(c.getState().isPlaying).toBe(false);
  });

  // Frame drop detection
  it('19. tick(200ms) at 30fps emits "frame-dropped"', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    const events: Array<{ type: string; data?: unknown }> = [];
    c.on((e) => events.push({ type: e.type, data: e.data }));
    c.play();
    tick(1000 / 30); // init
    tick(200); // ~6 frames
    expect(events.some((e) => e.type === 'frame-dropped')).toBe(true);
    const drop = events.find((e) => e.type === 'frame-dropped');
    expect(drop?.data).toEqual({ dropped: expect.any(Number) });
  });

  it('20. After drop, only 1 frame actually advances', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.play();
    tick(1000 / 30); // init
    const frameBefore = c.getState().currentFrame as number;
    tick(200); // would be ~6 frames; we cap to 1
    const frameAfter = c.getState().currentFrame as number;
    expect(frameAfter - frameBefore).toBe(1);
  });

  // Event bus
  it('21. on() registers listener', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    let received = false;
    c.on(() => { received = true; });
    c.play();
    expect(received).toBe(true);
  });

  it('22. Unsubscribe function removes listener', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    let count = 0;
    const unsub = c.on(() => { count++; });
    c.play();
    expect(count).toBe(1);
    unsub();
    c.pause();
    c.play();
    expect(count).toBe(1);
  });

  it('23. destroy() clears all listeners', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    let count = 0;
    c.on(() => { count++; });
    c.play();
    tick(1000 / 30);
    c.destroy();
    expect(count).toBeGreaterThan(0);
    const before = count;
    c.play();
    tick(1000 / 30);
    expect(count).toBe(before);
  });

  // setDuration
  it('24. setDuration clamps currentFrame if beyond new duration', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController(FIXTURE, clock);
    c.seekTo(toFrame(500));
    c.setDuration(100);
    expect(c.getState().currentFrame).toBe(toFrame(99));
    expect(c.getState().durationFrames).toBe(100);
  });
});
