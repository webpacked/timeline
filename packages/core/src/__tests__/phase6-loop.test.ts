/**
 * Phase 6 Step 5 — Playback loop region and preroll/postroll
 *
 * All tests use createTestClock(). Fixture: 30fps, durationFrames 900.
 * Loop region: startFrame 100, endFrame 200.
 */

import { describe, it, expect } from 'vitest';
import { toFrame } from '../types/frame';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset } from '../types/asset';
import { toTimecode } from '../types/frame';
import type { TimelineState } from '../types/state';
import type { LoopRegion } from '../types/playhead';
import { PlayheadController } from '../engine/playhead-controller';
import { PlaybackEngine } from '../engine/playback-engine';
import { KeyboardHandler } from '../engine/keyboard-handler';
import { createTestClock } from '../engine/clock';
import type { PipelineConfig } from '../types/pipeline';

const FPS = 30;
const DURATION = 900;
const LOOP_REGION: LoopRegion = { startFrame: toFrame(100), endFrame: toFrame(200) };

function makeLoopFixtureState(): TimelineState {
  const trackId = toTrackId('v1');
  const asset = createAsset({
    id: 'a1',
    name: 'V',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(2000),
    nativeFps: FPS,
    sourceTimecodeOffset: toFrame(0),
  });
  const clip = createClip({
    id: toClipId('c1'),
    assetId: asset.id,
    trackId,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(500),
    mediaIn: toFrame(0),
    mediaOut: toFrame(500),
  });
  const track = createTrack({ id: trackId, name: 'V1', type: 'video', clips: [clip] });
  const timeline = createTimeline({
    id: 'tl',
    name: 'LoopTest',
    fps: FPS,
    duration: toFrame(DURATION),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[asset.id, asset]]) });
}

const state = makeLoopFixtureState();
const DIMS = { width: 1920, height: 1080 };
const mockPipeline: PipelineConfig = {
  videoDecoder: async (r) => ({ ...r, width: 1920, height: 1080, bitmap: null }),
  compositor: async (r) => ({ timelineFrame: r.timelineFrame, bitmap: null }),
};

describe('Phase 6 — Loop (setLoopRegion)', () => {
  it('1. setLoopRegion sets loopRegion on state', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    c.setLoopRegion(LOOP_REGION);
    expect(c.getState().loopRegion).toEqual(LOOP_REGION);
  });

  it('2. setLoopRegion(null) clears loop region', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    c.setLoopRegion(LOOP_REGION);
    c.setLoopRegion(null);
    expect(c.getState().loopRegion).toBeNull();
  });

  it('3. setLoopRegion with startFrame >= endFrame throws', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    expect(() =>
      c.setLoopRegion({ startFrame: toFrame(200), endFrame: toFrame(100) }),
    ).toThrow();
    expect(() =>
      c.setLoopRegion({ startFrame: toFrame(100), endFrame: toFrame(100) }),
    ).toThrow();
  });
});

describe('Phase 6 — Loop (setPreroll / setPostroll)', () => {
  it('4. setPreroll(10) updates prerollFrames', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    c.setPreroll(10);
    expect(c.getState().prerollFrames).toBe(10);
  });

  it('5. setPostroll(5) updates postrollFrames', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    c.setPostroll(5);
    expect(c.getState().postrollFrames).toBe(5);
  });

  it('6. setPreroll(-1) throws', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    expect(() => c.setPreroll(-1)).toThrow();
  });

  it('7. setPostroll(-1) throws', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    expect(() => c.setPostroll(-1)).toThrow();
  });
});

describe('Phase 6 — Loop (loop behavior)', () => {
  it('8. Play from frame 100 with loop 100–200: after advancing to frame 200, wraps to frame 100', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    c.setLoopRegion(LOOP_REGION);
    c.seekTo(toFrame(100));
    c.play();
    tick(1000 / 30);
    for (let i = 0; i < 100; i++) tick(1000 / 30);
    expect(c.getState().currentFrame).toBe(toFrame(100));
  });

  it('9. Wrap emits "loop-point" event', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    const events: Array<{ type: string }> = [];
    c.on((e) => events.push({ type: e.type }));
    c.setLoopRegion(LOOP_REGION);
    c.seekTo(toFrame(100));
    c.play();
    tick(1000 / 30);
    for (let i = 0; i < 100; i++) tick(1000 / 30);
    expect(events.some((e) => e.type === 'loop-point')).toBe(true);
  });

  it('10. After wrap, does NOT emit "ended"', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    const events: Array<{ type: string }> = [];
    c.on((e) => events.push({ type: e.type }));
    c.setLoopRegion(LOOP_REGION);
    c.seekTo(toFrame(100));
    c.play();
    tick(1000 / 30);
    for (let i = 0; i < 100; i++) tick(1000 / 30);
    expect(events.some((e) => e.type === 'ended')).toBe(false);
  });

  it('11. Without loop region, reaching end emits "ended"', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    const events: Array<{ type: string }> = [];
    c.on((e) => events.push({ type: e.type }));
    c.seekTo(toFrame(895));
    c.play();
    tick(1000 / 30);
    for (let i = 0; i < 10; i++) tick(1000 / 30);
    expect(events.some((e) => e.type === 'ended')).toBe(true);
  });

  it('12. Loop with postroll: region 100–200, postroll 10 → wraps at frame 210', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    c.setLoopRegion(LOOP_REGION);
    c.setPostroll(10);
    c.seekTo(toFrame(100));
    c.play();
    tick(1000 / 30);
    for (let i = 0; i < 110; i++) tick(1000 / 30);
    expect(c.getState().currentFrame).toBe(toFrame(100));
  });

  it('13. Loop with preroll: region 100–200, preroll 15 → after wrap, starts at frame 85', () => {
    const { clock, tick } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    c.setLoopRegion(LOOP_REGION);
    c.setPreroll(15);
    c.seekTo(toFrame(100));
    c.play(); // with preroll, play() seeks to 85 before starting
    expect(c.getState().currentFrame).toBe(toFrame(85));
    tick(1000 / 30); // init
    // Advance 115 frames: 85 + 115 = 200, then wrap to 85
    for (let i = 0; i < 115; i++) tick(1000 / 30);
    expect(c.getState().currentFrame).toBe(toFrame(85));
  });
});

describe('Phase 6 — Loop (play with preroll)', () => {
  it('14. play() with loop region + preroll 15 seeks to startFrame - 15 before playing', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    c.setLoopRegion(LOOP_REGION);
    c.setPreroll(15);
    c.seekTo(toFrame(50));
    c.play();
    expect(c.getState().currentFrame).toBe(toFrame(85));
  });

  it('15. play() with no loop region: starts from currentFrame unchanged', () => {
    const { clock } = createTestClock();
    const c = new PlayheadController({ durationFrames: DURATION, fps: FPS }, clock);
    c.seekTo(toFrame(50));
    c.play();
    expect(c.getState().currentFrame).toBe(toFrame(50));
  });
});

describe('Phase 6 — Loop (toggle-loop keyboard)', () => {
  it('16. Q key with inPoint/outPoint set → sets loop region to in/out range', () => {
    const { clock } = createTestClock();
    const base = makeLoopFixtureState();
    const timelineWithInOut = createTimeline({
      id: base.timeline.id,
      name: base.timeline.name,
      fps: base.timeline.fps,
      duration: base.timeline.duration,
      startTimecode: base.timeline.startTimecode,
      tracks: base.timeline.tracks,
      inPoint: toFrame(50),
      outPoint: toFrame(150),
    });
    const state2: TimelineState = { ...base, timeline: timelineWithInOut };
    const engine = new PlaybackEngine(state2, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine, {
      getTimelineState: () => engine.getCurrentTimelineState(),
    });
    handler.handleKeyDown({
      code: 'KeyQ',
      key: 'q',
      shiftKey: false,
      altKey: false,
      metaKey: false,
      ctrlKey: false,
    });
    expect(engine.getState().loopRegion).toEqual({
      startFrame: toFrame(50),
      endFrame: toFrame(150),
    });
    engine.destroy();
  });

  it('17. Q key with loop active → clears loop region', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    engine.setLoopRegion(LOOP_REGION);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown({
      code: 'KeyQ',
      key: 'q',
      shiftKey: false,
      altKey: false,
      metaKey: false,
      ctrlKey: false,
    });
    expect(engine.getState().loopRegion).toBeNull();
    engine.destroy();
  });

  it('18. Q key with no in/out and no loop → no-op', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine, {
      getTimelineState: () => engine.getCurrentTimelineState(),
    });
    handler.handleKeyDown({
      code: 'KeyQ',
      key: 'q',
      shiftKey: false,
      altKey: false,
      metaKey: false,
      ctrlKey: false,
    });
    expect(engine.getState().loopRegion).toBeNull();
    engine.destroy();
  });
});

describe('Phase 6 — Loop (PlaybackEngine delegation)', () => {
  it('19. setLoopRegion delegates to controller', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    engine.setLoopRegion(LOOP_REGION);
    expect(engine.getState().loopRegion).toEqual(LOOP_REGION);
    engine.destroy();
  });

  it('20. setPreroll / setPostroll delegate to controller', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    engine.setPreroll(10);
    engine.setPostroll(5);
    expect(engine.getState().prerollFrames).toBe(10);
    expect(engine.getState().postrollFrames).toBe(5);
    engine.destroy();
  });
});
