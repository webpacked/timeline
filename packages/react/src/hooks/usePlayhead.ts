/**
 * usePlayhead — Phase 6 Step 6
 *
 * Subscribes to PlaybackEngine playhead state via useSyncExternalStore.
 * Returns state + stable action callbacks.
 */

import { useSyncExternalStore, useCallback } from 'react';
import type {
  PlaybackEngine,
  PlayheadState,
  PlayheadListener,
  TimelineFrame,
  PlaybackRate,
  PlaybackQuality,
  LoopRegion,
} from '@timeline/core';

export type UsePlayheadResult = {
  currentFrame: TimelineFrame;
  isPlaying: boolean;
  playbackRate: PlaybackRate;
  quality: PlaybackQuality;
  durationFrames: number;
  fps: number;
  loopRegion: LoopRegion | null;
  prerollFrames: number;
  postrollFrames: number;
  play: () => void;
  pause: () => void;
  seekTo: (frame: TimelineFrame) => void;
  setPlaybackRate: (rate: PlaybackRate) => void;
  setQuality: (quality: PlaybackQuality) => void;
  setLoopRegion: (region: LoopRegion | null) => void;
  setPreroll: (frames: number) => void;
  setPostroll: (frames: number) => void;
  seekToStart: () => void;
  seekToEnd: () => void;
  seekToNextClipBoundary: () => void;
  seekToPrevClipBoundary: () => void;
  seekToNextMarker: () => void;
  seekToPrevMarker: () => void;
  toggle: () => void;
};

function subscribe(engine: PlaybackEngine, onStoreChange: () => void): () => void {
  return engine.on((() => onStoreChange()) as PlayheadListener);
}

function getSnapshot(engine: PlaybackEngine): PlayheadState {
  return engine.getState();
}

export function usePlayhead(engine: PlaybackEngine): UsePlayheadResult {
  const state = useSyncExternalStore(
    (onStoreChange) => subscribe(engine, onStoreChange),
    () => getSnapshot(engine),
    () => getSnapshot(engine),
  );

  const play = useCallback(() => engine.play(), [engine]);
  const pause = useCallback(() => engine.pause(), [engine]);
  const seekTo = useCallback((frame: TimelineFrame) => engine.seekTo(frame), [engine]);
  const setPlaybackRate = useCallback((rate: PlaybackRate) => engine.setPlaybackRate(rate), [engine]);
  const setQuality = useCallback((quality: PlaybackQuality) => engine.setQuality(quality), [engine]);
  const setLoopRegion = useCallback((region: LoopRegion | null) => engine.setLoopRegion(region), [engine]);
  const setPreroll = useCallback((frames: number) => engine.setPreroll(frames), [engine]);
  const setPostroll = useCallback((frames: number) => engine.setPostroll(frames), [engine]);
  const seekToStart = useCallback(() => engine.seekToStart(), [engine]);
  const seekToEnd = useCallback(() => engine.seekToEnd(), [engine]);
  const seekToNextClipBoundary = useCallback(() => engine.seekToNextClipBoundary(), [engine]);
  const seekToPrevClipBoundary = useCallback(() => engine.seekToPrevClipBoundary(), [engine]);
  const seekToNextMarker = useCallback(() => engine.seekToNextMarker(), [engine]);
  const seekToPrevMarker = useCallback(() => engine.seekToPrevMarker(), [engine]);
  const toggle = useCallback(() => {
    if (engine.getState().isPlaying) engine.pause();
    else engine.play();
  }, [engine]);

  return {
    ...state,
    play,
    pause,
    seekTo,
    setPlaybackRate,
    setQuality,
    setLoopRegion,
    setPreroll,
    setPostroll,
    seekToStart,
    seekToEnd,
    seekToNextClipBoundary,
    seekToPrevClipBoundary,
    seekToNextMarker,
    seekToPrevMarker,
    toggle,
  };
}
