/**
 * Virtual rendering hooks — Phase R Step 3
 *
 * useVirtualWindow: derived from viewport/scroll/zoom (useMemo).
 * useVisibleClips: subscribes to engine and returns clips in window (useSyncExternalStore).
 * Result is cached so same (state, window) returns same reference (avoids infinite loop).
 */

import { useMemo, useSyncExternalStore, useRef } from 'react';
import type { TimelineEngine } from '../engine';
import type { VirtualWindow, VirtualClipEntry, TimelineState } from '@webpacked-timeline/core';
import { getVisibleFrameRange, getVisibleClips } from '@webpacked-timeline/core';

export function useVirtualWindow(
  _engine: TimelineEngine,
  viewportWidth: number,
  scrollLeft: number,
  pixelsPerFrame: number,
): VirtualWindow {
  return useMemo(
    () => getVisibleFrameRange(viewportWidth, scrollLeft, pixelsPerFrame),
    [viewportWidth, scrollLeft, pixelsPerFrame],
  );
}

function getVisibleClipsCached(
  state: TimelineState,
  window: VirtualWindow,
  cache: { state: TimelineState | null; window: VirtualWindow | null; result: VirtualClipEntry[] },
): VirtualClipEntry[] {
  if (cache.state === state && cache.window === window) return cache.result;
  cache.state = state;
  cache.window = window;
  cache.result = getVisibleClips(state, window);
  return cache.result;
}

export function useVisibleClips(
  engine: TimelineEngine,
  window: VirtualWindow,
): VirtualClipEntry[] {
  const cache = useRef<{
    state: TimelineState | null;
    window: VirtualWindow | null;
    result: VirtualClipEntry[];
  }>({ state: null, window: null, result: [] });
  return useSyncExternalStore(
    engine.subscribe,
    () =>
      getVisibleClipsCached(
        engine.getSnapshot().state,
        window,
        cache.current,
      ),
    () =>
      getVisibleClipsCached(
        engine.getSnapshot().state,
        window,
        cache.current,
      ),
  );
}
