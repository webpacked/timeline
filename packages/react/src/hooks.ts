/**
 * @timeline/react — hooks.ts
 *
 * All eight Phase 1 hooks. Every hook uses useSyncExternalStore.
 *
 * RULES (from adapter/HOOKS.md):
 *   - Never use useState to mirror engine state — useSyncExternalStore only
 *   - Each hook selects the minimum slice of the snapshot it needs
 *   - No hook imports directly from @timeline/core — all via engine or EngineSnapshot
 *   - useClip selector defined inline to close over `id` correctly per instance
 *
 * CONTEXT:
 *   All hooks call useTimelineContext() which throws if used outside TimelineProvider.
 */

import { useContext, useSyncExternalStore } from 'react';
import { TimelineContext } from './TimelineProvider';

import type { TimelineEngine, EngineSnapshot } from './engine';
import type { Timeline, Track, Clip, TrackId, ClipId, ToolId, ProvisionalState } from '@timeline/core';

// ---------------------------------------------------------------------------
// Internal context accessor
// ---------------------------------------------------------------------------

/**
 * Internal hook — throws a descriptive error if used outside TimelineProvider.
 * All public hooks call this first.
 */
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

// ---------------------------------------------------------------------------
// useEngine — raw engine access (no subscription, no re-render on state change)
// ---------------------------------------------------------------------------

/**
 * Returns the TimelineEngine instance from context.
 *
 * Use this when you need to call engine methods (dispatch, undo, activateTool)
 * without subscribing to state changes. Does NOT cause re-renders on state updates.
 *
 * @throws If used outside TimelineProvider.
 */
export function useEngine(): TimelineEngine {
  return useTimelineContext();
}

// ---------------------------------------------------------------------------
// useTimeline — subscribe to the top-level Timeline object
// ---------------------------------------------------------------------------

/**
 * Returns the Timeline object (name, fps, duration, startTimecode, tracks).
 *
 * Re-renders when the Timeline object reference changes — i.e., when any
 * timeline-level field changes (name, fps, duration) or when tracks are
 * added/removed. Does NOT re-render when clip data within a track changes,
 * because clip mutations replace the individual clip object, not timeline.
 *
 * @throws If used outside TimelineProvider.
 */
export function useTimeline(): Timeline {
  const engine = useTimelineContext();
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().state.timeline,
  );
}

// ---------------------------------------------------------------------------
// useTrackIds — stable array reference for the track list
// ---------------------------------------------------------------------------

/**
 * Returns a stable `readonly TrackId[]` that changes reference only when
 * tracks are added or removed.
 *
 * The array is built once inside buildSnapshot() and cached until the next
 * notify(). Calling .map() here would create a new array on every selector
 * call, causing an infinite re-render loop via useSyncExternalStore.
 *
 * @throws If used outside TimelineProvider.
 */
export function useTrackIds(): readonly TrackId[] {
  const engine = useTimelineContext();
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().trackIds,
  );
}

// ---------------------------------------------------------------------------
// useTrack — subscribe to a specific track
// ---------------------------------------------------------------------------

/**
 * Returns the Track with the given id, or undefined if not found.
 *
 * Re-renders when that track's data changes (including its clips[]).
 * Does NOT re-render when other tracks change.
 *
 * @throws If used outside TimelineProvider.
 */
export function useTrack(id: TrackId): Track | undefined {
  const engine = useTimelineContext();
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().state.timeline.tracks.find(t => t.id === id),
  );
}

// ---------------------------------------------------------------------------
// useClip — provisional-aware clip selector
// ---------------------------------------------------------------------------

/**
 * Returns the Clip with the given id, or undefined if the clip has been deleted.
 *
 * Checks provisional state first (ghost clip during drag), committed state second.
 * Re-renders when that clip's committed OR provisional data changes.
 * Does NOT re-render when other clips change.
 *
 * IMPORTANT: Always handle the undefined case — the clip may be deleted mid-drag:
 *   const clip = useClip(id)
 *   if (!clip) return null  ← required, not optional
 *
 * @throws If used outside TimelineProvider.
 */
export function useClip(id: ClipId): Clip | undefined {
  const engine = useTimelineContext();
  return useSyncExternalStore(
    engine.subscribe,
    (): Clip | undefined => {
      const snap = engine.getSnapshot();

      // Priority 1 — provisional ghost (clip being dragged)
      if (snap.provisional !== null) {
        const ghost = snap.provisional.clips.find(c => c.id === id);
        if (ghost) return ghost;
      }

      // Priority 2 — committed state
      for (const track of snap.state.timeline.tracks) {
        const clip = track.clips.find(c => c.id === id);
        if (clip) return clip;
      }

      // Priority 3 — absent from both (deleted)
      return undefined;
    },
  );
}

// ---------------------------------------------------------------------------
// useActiveTool — current tool id + display cursor
// ---------------------------------------------------------------------------

/**
 * Returns the active tool id and the display cursor string.
 *
 * `cursor` is computed at snapshot time using idle modifiers (all false).
 * It reflects the cursor the tool wants to show when no keys are held
 * and no drag is in progress.
 *
 * Re-renders when the engine notifies (tool switch, pointer down, etc.).
 *
 * @throws If used outside TimelineProvider.
 */
export function useActiveTool(): { readonly id: ToolId; readonly cursor: string } {
  const engine = useTimelineContext();
  const snap   = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  return { id: snap.activeToolId, cursor: snap.cursor };
}

// ---------------------------------------------------------------------------
// useCanUndo / useCanRedo
// ---------------------------------------------------------------------------

/**
 * Returns true when there is a committed transaction available to undo.
 *
 * @throws If used outside TimelineProvider.
 */
export function useCanUndo(): boolean {
  const engine = useTimelineContext();
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().canUndo,
  );
}

/**
 * Returns true when there is an undone transaction available to redo.
 *
 * @throws If used outside TimelineProvider.
 */
export function useCanRedo(): boolean {
  const engine = useTimelineContext();
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().canRedo,
  );
}

// ---------------------------------------------------------------------------
// useProvisional — provisional ghost state
// ---------------------------------------------------------------------------

/**
 * Returns the current ProvisionalState, or null when not dragging.
 *
 * This is the raw provisional state — use useClip() instead if you
 * want a single clip resolved from committed + provisional.
 *
 * Re-renders on every pointer move during a drag (hot path).
 * Use only in components that directly render ghost overlays.
 *
 * @throws If used outside TimelineProvider.
 */
export function useProvisional(): ProvisionalState | null {
  const engine = useTimelineContext();
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().provisional,
  );
}

// ---------------------------------------------------------------------------
// Phase 6 Step 6: Playhead hooks (PlaybackEngine, not TimelineEngine)
// ---------------------------------------------------------------------------

export { usePlayhead } from './hooks/usePlayhead';
export type { UsePlayheadResult } from './hooks/usePlayhead';
export { usePlayheadEvent } from './hooks/usePlayheadEvent';

// ---------------------------------------------------------------------------
// Re-export EngineSnapshot type for consumers
// ---------------------------------------------------------------------------

export type { EngineSnapshot };
