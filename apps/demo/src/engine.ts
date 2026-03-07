import { TimelineEngine } from '@webpacked-timeline/react';
import { buildMockState } from './mock-data';
import type { PipelineConfig } from '@webpacked-timeline/core';
import { browserClock } from '@webpacked-timeline/core';

/**
 * Singleton engine instance for the demo app.
 *
 * _ppf is a plain module-level variable captured by the
 * getPixelsPerFrame closure. It is safe to read during the
 * constructor (unlike a self-reference to `engine` which is
 * still in the TDZ at construction time).
 *
 * Call setEnginePixelsPerFrame(v) whenever zoom changes so
 * tool contexts always receive the current ppf.
 */
const DEFAULT_PPF = 4;
let _ppf = DEFAULT_PPF;

/** Late-bound zoom callback — set by the React component on mount. */
let _onZoomChange: (ppf: number) => void = () => {};

export function setEnginePixelsPerFrame(ppf: number): void {
  _ppf = ppf;
}

export function setOnZoomChange(cb: (ppf: number) => void): void {
  _onZoomChange = cb;
}

/**
 * Stub pipeline — enables PlaybackEngine without real media decoding.
 * The demo only needs the playhead to tick; no actual frames are rendered.
 */
const stubPipeline: PipelineConfig = {
  videoDecoder: async (req) => ({
    clipId: req.clipId,
    mediaFrame: req.mediaFrame,
    bitmap: null,
    width: 1920,
    height: 1080,
  }),
  compositor: async (req) => ({
    timelineFrame: req.timelineFrame,
    bitmap: null,
  }),
};

/**
 * Notifying clock — wraps browserClock so that every rAF tick also
 * triggers an engine snapshot rebuild + React notification.
 *
 * PlayheadController in core updates its internal currentFrame on each
 * rAF frame but does not emit an event for normal frame advancement.
 * Wrapping the clock lets us call seekTo(currentFrame) after each tick,
 * which emits a 'seek' event → engine listener → rebuildSnapshot → notify.
 */
let _afterTick: (() => void) | null = null;

const notifyingClock = {
  requestFrame: (cb: (ts: number) => void) =>
    browserClock.requestFrame((ts: number) => {
      cb(ts);
      _afterTick?.();
    }),
  cancelFrame: (id: number) => browserClock.cancelFrame(id),
  now: () => browserClock.now(),
};

export const engine = new TimelineEngine({
  initialState: buildMockState(),
  onZoomChange: (ppf: number) => _onZoomChange(ppf),
  getPixelsPerFrame: () => _ppf,
  pipeline: stubPipeline,
  clock: notifyingClock,
});

/**
 * After each PlayheadController tick, force an engine notification by
 * seeking to the current frame. This is a data no-op (same frame value)
 * but emits the 'seek' event needed to trigger snapshot rebuild + React
 * re-render. Only fires when the frame has actually changed to avoid
 * unnecessary work.
 */
let _lastNotifiedFrame = -1;
_afterTick = () => {
  const pb = engine.playbackEngine;
  if (pb?.getState().isPlaying) {
    const current = engine.getPlayheadFrame() as number;
    if (current !== _lastNotifiedFrame) {
      _lastNotifiedFrame = current;
      engine.seekTo(engine.getPlayheadFrame());
    }
  }
};
