/**
 * Phase 6 Step 4 — J/K/L jog-shuttle and keyboard contract
 *
 * Uses createTestClock() for engine. Fixture: 30fps, duration 900,
 * one track, two clips. DEFAULT_KEY_BINDINGS.
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
import type { TimelineKeyEvent } from '../tools/types';
import type { PipelineConfig } from '../types/pipeline';
import { PlaybackEngine } from '../engine/playback-engine';
import { KeyboardHandler } from '../engine/keyboard-handler';
import { createTestClock } from '../engine/clock';

const FPS = 30;
const DURATION = 900;

function makeKeyboardFixtureState(): TimelineState {
  const trackId = toTrackId('videoTrack');
  const asset = createAsset({
    id: 'asset1',
    name: 'V',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(2000),
    nativeFps: FPS,
    sourceTimecodeOffset: toFrame(0),
  });
  const clip1 = createClip({
    id: toClipId('clip1'),
    assetId: asset.id,
    trackId,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(300),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  const clip2 = createClip({
    id: toClipId('clip2'),
    assetId: asset.id,
    trackId,
    timelineStart: toFrame(400),
    timelineEnd: toFrame(700),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  const track = createTrack({
    id: trackId,
    name: 'V1',
    type: 'video',
    clips: [clip1, clip2],
  });
  const timeline = createTimeline({
    id: 'tl',
    name: 'KeyboardTest',
    fps: FPS,
    duration: toFrame(DURATION),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[asset.id, asset]]) });
}

function makeKeyEvent(
  code: string,
  mods?: { shift?: boolean; alt?: boolean; meta?: boolean; ctrl?: boolean; repeat?: boolean },
): TimelineKeyEvent {
  const ev: TimelineKeyEvent = {
    code,
    key: code.replace('Key', '').toLowerCase(),
    shiftKey: mods?.shift ?? false,
    altKey: mods?.alt ?? false,
    metaKey: mods?.meta ?? false,
    ctrlKey: mods?.ctrl ?? false,
  };
  if (mods?.repeat !== undefined) (ev as { repeat?: boolean }).repeat = mods.repeat;
  return ev;
}

const state = makeKeyboardFixtureState();
const DIMS = { width: 1920, height: 1080 };
const mockPipeline: PipelineConfig = {
  videoDecoder: async (req) => ({
    clipId: req.clipId,
    mediaFrame: req.mediaFrame,
    width: 1920,
    height: 1080,
    bitmap: null,
  }),
  compositor: async (req) => ({ timelineFrame: req.timelineFrame, bitmap: null }),
};

describe('Phase 6 — Keyboard (play-pause / stop)', () => {
  it('1. Space while paused → play', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    expect(engine.getState().isPlaying).toBe(false);
    handler.handleKeyDown(makeKeyEvent('Space'));
    expect(engine.getState().isPlaying).toBe(true);
    engine.destroy();
  });

  it('2. Space while playing → pause', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('Space'));
    expect(engine.getState().isPlaying).toBe(true);
    handler.handleKeyDown(makeKeyEvent('Space'));
    expect(engine.getState().isPlaying).toBe(false);
    engine.destroy();
  });

  it('3. K (jog-stop) while playing → pause + rate 1.0', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    expect(engine.getState().isPlaying).toBe(true);
    expect(engine.getState().playbackRate).toBe(1.0);
    handler.handleKeyDown(makeKeyEvent('KeyK'));
    expect(engine.getState().isPlaying).toBe(false);
    expect(engine.getState().playbackRate).toBe(1.0);
    engine.destroy();
  });

  it('4. stop action → pause + frame 0', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine, {
      bindings: [
        { code: 'KeyS', action: 'stop' },
        { code: 'Space', action: 'play-pause' },
      ],
    });
    engine.seekTo(toFrame(100));
    handler.handleKeyDown(makeKeyEvent('Space'));
    handler.handleKeyDown(makeKeyEvent('KeyS'));
    expect(engine.getState().isPlaying).toBe(false);
    expect(engine.getState().currentFrame).toBe(toFrame(0));
    engine.destroy();
  });
});

describe('Phase 6 — Keyboard (step-forward / step-backward)', () => {
  it('5. ArrowRight → frame advances by 1', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    engine.seekTo(toFrame(50));
    handler.handleKeyDown(makeKeyEvent('ArrowRight'));
    expect(engine.getState().currentFrame).toBe(toFrame(51));
    engine.destroy();
  });

  it('6. ArrowLeft → frame goes back by 1', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    engine.seekTo(toFrame(50));
    handler.handleKeyDown(makeKeyEvent('ArrowLeft'));
    expect(engine.getState().currentFrame).toBe(toFrame(49));
    engine.destroy();
  });

  it('7. ArrowRight at last frame → clamped, no error', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    engine.seekTo(toFrame(899));
    handler.handleKeyDown(makeKeyEvent('ArrowRight'));
    expect(engine.getState().currentFrame).toBe(toFrame(899));
    engine.destroy();
  });

  it('8. ArrowLeft at frame 0 → clamped, no error', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('ArrowLeft'));
    expect(engine.getState().currentFrame).toBe(toFrame(0));
    engine.destroy();
  });

  it('9. step-forward pauses if playing', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('Space'));
    expect(engine.getState().isPlaying).toBe(true);
    handler.handleKeyDown(makeKeyEvent('ArrowRight'));
    expect(engine.getState().isPlaying).toBe(false);
    expect(engine.getState().currentFrame).toBe(toFrame(1));
    engine.destroy();
  });
});

describe('Phase 6 — Keyboard (J/K/L jog)', () => {
  it('10. L once → rate 1.0, playing', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    expect(engine.getState().playbackRate).toBe(1.0);
    expect(engine.getState().isPlaying).toBe(true);
    engine.destroy();
  });

  it('11. L twice → rate 2.0', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    expect(engine.getState().playbackRate).toBe(2.0);
    engine.destroy();
  });

  it('12. L three times → rate 4.0', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    expect(engine.getState().playbackRate).toBe(4.0);
    engine.destroy();
  });

  it('13. L four times → still rate 4.0 (capped at 3)', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    expect(engine.getState().playbackRate).toBe(4.0);
    engine.destroy();
  });

  it('14. J once → rate -1.0, playing', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('KeyJ'));
    expect(engine.getState().playbackRate).toBe(-1.0);
    expect(engine.getState().isPlaying).toBe(true);
    engine.destroy();
  });

  it('15. J twice → rate -2.0', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('KeyJ'));
    handler.handleKeyDown(makeKeyEvent('KeyJ'));
    expect(engine.getState().playbackRate).toBe(-2.0);
    engine.destroy();
  });

  it('16. K resets jogLevel → pause, rate back to 1.0', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    expect(engine.getState().playbackRate).toBe(2.0);
    handler.handleKeyDown(makeKeyEvent('KeyK'));
    expect(engine.getState().isPlaying).toBe(false);
    expect(engine.getState().playbackRate).toBe(1.0);
    engine.destroy();
  });

  it('17. J after L (mixed) → jogLevel goes from 2 to 1, rate 1.0', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    handler.handleKeyDown(makeKeyEvent('KeyL'));
    expect(engine.getState().playbackRate).toBe(2.0);
    handler.handleKeyDown(makeKeyEvent('KeyJ'));
    expect(engine.getState().playbackRate).toBe(1.0);
    engine.destroy();
  });
});

describe('Phase 6 — Keyboard (seek actions)', () => {
  it('18. Home → seekToStart (frame 0)', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    engine.seekTo(toFrame(500));
    handler.handleKeyDown(makeKeyEvent('Home'));
    expect(engine.getState().currentFrame).toBe(toFrame(0));
    engine.destroy();
  });

  it('19. End → seekToEnd (frame 899)', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    handler.handleKeyDown(makeKeyEvent('End'));
    expect(engine.getState().currentFrame).toBe(toFrame(899));
    engine.destroy();
  });

  it('20. Shift+ArrowRight → seekToNextClipBoundary', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    engine.seekTo(toFrame(0));
    handler.handleKeyDown(makeKeyEvent('ArrowRight', { shift: true }));
    expect(engine.getState().currentFrame).toBe(toFrame(300));
    engine.destroy();
  });

  it('21. Shift+ArrowLeft → seekToPrevClipBoundary', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    engine.seekTo(toFrame(500));
    handler.handleKeyDown(makeKeyEvent('ArrowLeft', { shift: true }));
    expect(engine.getState().currentFrame).toBe(toFrame(400));
    engine.destroy();
  });

  it('22. Alt+ArrowRight (no markers in fixture) → no crash, no seek', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    engine.seekTo(toFrame(0));
    handler.handleKeyDown(makeKeyEvent('ArrowRight', { alt: true }));
    expect(engine.getState().currentFrame).toBe(toFrame(0));
    engine.destroy();
  });

  it('23. Alt+ArrowLeft → seekToPrevMarker (none → no move)', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    engine.seekTo(toFrame(500));
    handler.handleKeyDown(makeKeyEvent('ArrowLeft', { alt: true }));
    expect(engine.getState().currentFrame).toBe(toFrame(500));
    engine.destroy();
  });
});

describe('Phase 6 — Keyboard (key binding match)', () => {
  it('24. Unknown key code → returns false', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    const handled = handler.handleKeyDown(makeKeyEvent('KeyX'));
    expect(handled).toBe(false);
    engine.destroy();
  });

  it('25. Space → returns true (handled)', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    const handled = handler.handleKeyDown(makeKeyEvent('Space'));
    expect(handled).toBe(true);
    engine.destroy();
  });

  it('26. Shift+ArrowRight matches only shift binding, not plain ArrowRight', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    engine.seekTo(toFrame(10));
    handler.handleKeyDown(makeKeyEvent('ArrowRight', { shift: true }));
    expect(engine.getState().currentFrame).toBe(toFrame(300));
    engine.destroy();
  });
});

describe('Phase 6 — Keyboard (mark-in / mark-out callbacks)', () => {
  it('27. I key fires onMarkIn with currentFrame', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    let captured: number | null = null;
    const handler = new KeyboardHandler(engine, {
      onMarkIn: (frame) => { captured = frame as number; },
    });
    engine.seekTo(toFrame(42));
    handler.handleKeyDown(makeKeyEvent('KeyI'));
    expect(captured).toBe(42);
    engine.destroy();
  });

  it('28. O key fires onMarkOut with currentFrame', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    let captured: number | null = null;
    const handler = new KeyboardHandler(engine, {
      onMarkOut: (frame) => { captured = frame as number; },
    });
    engine.seekTo(toFrame(99));
    handler.handleKeyDown(makeKeyEvent('KeyO'));
    expect(captured).toBe(99);
    engine.destroy();
  });

  it('29. No callback registered → no error (silent no-op)', () => {
    const { clock } = createTestClock();
    const engine = new PlaybackEngine(state, mockPipeline, DIMS, clock);
    const handler = new KeyboardHandler(engine);
    expect(() => handler.handleKeyDown(makeKeyEvent('KeyI'))).not.toThrow();
    expect(() => handler.handleKeyDown(makeKeyEvent('KeyO'))).not.toThrow();
    engine.destroy();
  });
});
