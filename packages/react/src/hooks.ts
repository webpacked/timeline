/**
 * @webpacked-timeline/react — hooks
 *
 * Phase R Step 2: All hooks use useSyncExternalStore. Engine-as-first-arg hooks
 * live in hooks/index.ts. This file provides useEngine() from context and
 * context-based wrappers so existing code (useTimeline(), useTrackIds(), etc.)
 * continues to work without passing engine.
 */

import { useContext } from 'react';
import { TimelineContext } from './TimelineProvider';
import type { TimelineEngine } from './engine';
import type { TrackId, ClipId, ProvisionalState } from '@webpacked-timeline/core';

// Re-export all engine-as-first-arg hooks from hooks/index
export {
  useTimeline as useTimelineWithEngine,
  useTrackIds as useTrackIdsWithEngine,
  useTrack as useTrackWithEngine,
  useClip as useClipWithEngine,
  useClips,
  useMarkers,
  useHistory,
  useActiveToolId,
  useCursor,
  useProvisional as useProvisionalWithEngine,
  usePlayheadFrame,
  useIsPlaying,
  useChange,
  usePlaybackEngine,
  useSelectedClipIds,
} from './hooks/index';

// ---------------------------------------------------------------------------
// useEngine — from context (no subscription)
// ---------------------------------------------------------------------------

function useTimelineContext(): TimelineEngine {
  const engine = useContext(TimelineContext);
  if (!engine) {
    throw new Error(
      'Timeline hooks must be used within a <TimelineProvider>. ' +
        'Wrap your component tree with <TimelineProvider engine={engine}>.',
    );
  }
  return engine;
}

/**
 * Returns the TimelineEngine instance from context.
 * Use with Phase R hooks: useTimeline(useEngine()), etc.
 *
 * @throws If used outside TimelineProvider.
 */
export function useEngine(): TimelineEngine {
  return useTimelineContext();
}

// ---------------------------------------------------------------------------
// Context-based wrappers (engine from context, then delegate to hooks/index)
// ---------------------------------------------------------------------------

import {
  useTimeline as useTimelineFromIndex,
  useTrackIds as useTrackIdsFromIndex,
  useTrack as useTrackFromIndex,
  useClip as useClipFromIndex,
  useActiveToolId as useActiveToolIdFromIndex,
  useCursor as useCursorFromIndex,
  useProvisional as useProvisionalFromIndex,
  useHistory as useHistoryFromIndex,
} from './hooks/index';

export function useTimeline(): ReturnType<typeof useTimelineFromIndex> {
  return useTimelineFromIndex(useTimelineContext());
}

export function useTrackIds(): ReturnType<typeof useTrackIdsFromIndex> {
  return useTrackIdsFromIndex(useTimelineContext());
}

export function useTrack(id: TrackId | string): ReturnType<typeof useTrackFromIndex> {
  return useTrackFromIndex(useTimelineContext(), id);
}

export function useClip(id: ClipId | string): ReturnType<typeof useClipFromIndex> {
  return useClipFromIndex(useTimelineContext(), id);
}

/** Returns { id, cursor }. Use useActiveToolId(engine) / useCursor(engine) for separate subs. */
export function useActiveTool(): { readonly id: string; readonly cursor: string } {
  const engine = useTimelineContext();
  const id = useActiveToolIdFromIndex(engine);
  const cursor = useCursorFromIndex(engine);
  return { id, cursor };
}

export function useCanUndo(): boolean {
  return useHistoryFromIndex(useTimelineContext()).canUndo;
}

export function useCanRedo(): boolean {
  return useHistoryFromIndex(useTimelineContext()).canRedo;
}

export function useProvisional(): ProvisionalState | null {
  return useProvisionalFromIndex(useTimelineContext());
}

// ---------------------------------------------------------------------------
// Phase 6 PlaybackEngine hooks (take PlaybackEngine, not TimelineEngine)
// ---------------------------------------------------------------------------

export { usePlayhead } from './hooks/usePlayhead';
export type { UsePlayheadResult } from './hooks/usePlayhead';
export { usePlayheadEvent } from './hooks/usePlayheadEvent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { EngineSnapshot } from './engine';
