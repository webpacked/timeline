/**
 * usePlayhead / usePlayheadEvent — Phase 6 Step 6
 *
 * Uses @testing-library/react renderHook + act.
 * Fixture: minimal TimelineState (one track, no clips, 900 frames, 30fps),
 * mock PipelineConfig, PlaybackEngine with createTestClock().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  createTimelineState,
  createTimeline,
  createTrack,
  toFrame,
  toTimecode,
  frameRate,
  toTrackId,
  createTestClock,
  PlaybackEngine,
} from '@timeline/core';
import type { TimelineState } from '@timeline/core';
import type { PipelineConfig } from '@timeline/core';
import { usePlayhead, usePlayheadEvent } from '../hooks';

const FPS = 30;
const DURATION = 900;
const DIMS = { width: 1920, height: 1080 };

function makeMinimalState(): TimelineState {
  const track = createTrack({
    id: toTrackId('v1'),
    name: 'V1',
    type: 'video',
    clips: [],
  });
  const timeline = createTimeline({
    id: 'tl',
    name: 'Playhead Test',
    fps: frameRate(FPS),
    duration: toFrame(DURATION),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({ timeline, assetRegistry: new Map() });
}

const mockPipeline: PipelineConfig = {
  videoDecoder: vi.fn().mockResolvedValue({
    clipId: 'x',
    mediaFrame: toFrame(0),
    width: DIMS.width,
    height: DIMS.height,
    bitmap: null,
  }),
  compositor: vi.fn().mockResolvedValue({
    timelineFrame: toFrame(0),
    bitmap: null,
  }),
};

function makeEngine() {
  const { clock } = createTestClock();
  return new PlaybackEngine(makeMinimalState(), mockPipeline, DIMS, clock);
}

describe('usePlayhead — state', () => {
  it('1. initial state: frame 0, not playing, rate 1.0', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayhead(engine));
    expect(result.current.currentFrame).toEqual(toFrame(0));
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.playbackRate).toBe(1.0);
    expect(result.current.durationFrames).toBe(DURATION);
    expect(result.current.fps).toBe(FPS);
  });

  it('2. play() via hook updates isPlaying to true after act()', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayhead(engine));
    expect(result.current.isPlaying).toBe(false);
    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);
  });

  it('3. pause() via hook updates isPlaying to false', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayhead(engine));
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    act(() => result.current.pause());
    expect(result.current.isPlaying).toBe(false);
  });

  it('4. seekTo(300) updates currentFrame to 300', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayhead(engine));
    act(() => result.current.seekTo(toFrame(300)));
    expect(result.current.currentFrame).toEqual(toFrame(300));
  });

  it('5. setPlaybackRate(2.0) updates playbackRate', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayhead(engine));
    act(() => result.current.setPlaybackRate(2.0));
    expect(result.current.playbackRate).toBe(2.0);
  });

  it('6. setLoopRegion updates loopRegion', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayhead(engine));
    const region = { startFrame: toFrame(100), endFrame: toFrame(200) };
    act(() => result.current.setLoopRegion(region));
    expect(result.current.loopRegion).toEqual(region);
  });

  it('7. toggle() plays when paused', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayhead(engine));
    expect(result.current.isPlaying).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(true);
  });

  it('8. toggle() pauses when playing', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => usePlayhead(engine));
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
  });
});

describe('usePlayhead — referential stability', () => {
  it('9. play callback reference is stable across re-renders', () => {
    const engine = makeEngine();
    const { result, rerender } = renderHook(() => usePlayhead(engine));
    const playRef1 = result.current.play;
    act(() => result.current.play());
    rerender();
    const playRef2 = result.current.play;
    expect(playRef2).toBe(playRef1);
  });

  it('10. seekTo callback reference is stable across re-renders', () => {
    const engine = makeEngine();
    const { result, rerender } = renderHook(() => usePlayhead(engine));
    const seekToRef1 = result.current.seekTo;
    act(() => result.current.seekTo(toFrame(100)));
    rerender();
    const seekToRef2 = result.current.seekTo;
    expect(seekToRef2).toBe(seekToRef1);
  });
});

describe('usePlayheadEvent', () => {
  it('11. handler called when matching event type fires', () => {
    const engine = makeEngine();
    const handler = vi.fn();
    renderHook(() => usePlayheadEvent(engine, 'seek', handler));
    act(() => engine.seekTo(toFrame(50)));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].type).toBe('seek');
    expect(handler.mock.calls[0][0].frame).toEqual(toFrame(50));
  });

  it('12. handler NOT called for non-matching event type', () => {
    const engine = makeEngine();
    const handler = vi.fn();
    renderHook(() => usePlayheadEvent(engine, 'loop-point', handler));
    act(() => engine.seekTo(toFrame(50)));
    expect(handler).not.toHaveBeenCalled();
  });

  it('13. unsubscribes on unmount (no memory leak)', () => {
    const engine = makeEngine();
    const handler = vi.fn();
    const { unmount } = renderHook(() => usePlayheadEvent(engine, 'seek', handler));
    act(() => engine.seekTo(toFrame(10)));
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
    handler.mockClear();
    act(() => engine.seekTo(toFrame(20)));
    expect(handler).not.toHaveBeenCalled();
  });
});
