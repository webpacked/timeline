/**
 * Phase R Step 2 — Full hook set
 *
 * All hooks take engine: TimelineEngine as first arg and use useSyncExternalStore
 * with a pure selector. Referential stability of the returned value controls re-renders.
 */

import { useSyncExternalStore } from 'react';
import type { TimelineEngine } from '../engine';
import type { EngineSnapshot } from '../types/engine-snapshot';
import type { Timeline, Track, Clip } from '@webpacked-timeline/core';
import type { TrackId, ClipId } from '@webpacked-timeline/core';
import type { TimelineFrame, ProvisionalState, StateChange } from '@webpacked-timeline/core';

type Marker = Timeline['markers'][number];

const EMPTY_CLIPS: readonly Clip[] = [];
const EMPTY_MARKERS: readonly Marker[] = [];

function getServerSnapshot<T>(engine: TimelineEngine, selector: (snap: EngineSnapshot) => T): T {
  return selector(engine.getSnapshot());
}

// ---------------------------------------------------------------------------
// useTimeline
// ---------------------------------------------------------------------------

export function useTimeline(engine: TimelineEngine): Timeline {
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().state.timeline,
    () => getServerSnapshot(engine, (snap) => snap.state.timeline),
  );
}

// ---------------------------------------------------------------------------
// useTrackIds
// ---------------------------------------------------------------------------

export function useTrackIds(engine: TimelineEngine): readonly string[] {
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().trackIds,
    () => getServerSnapshot(engine, (snap) => snap.trackIds),
  );
}

// ---------------------------------------------------------------------------
// useTrack
// ---------------------------------------------------------------------------

export function useTrack(engine: TimelineEngine, trackId: TrackId | string): Track | null {
  const id = typeof trackId === 'string' ? trackId : (trackId as string);
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().state.timeline.tracks.find((t) => t.id === id) ?? null,
    () =>
      getServerSnapshot(
        engine,
        (snap) => snap.state.timeline.tracks.find((t) => t.id === id) ?? null,
      ),
  );
}

// ---------------------------------------------------------------------------
// useClip — provisional-aware; isolation: clip A change does not re-render clip B
// ---------------------------------------------------------------------------

export function useClip(engine: TimelineEngine, clipId: ClipId | string): Clip | null {
  const id = typeof clipId === 'string' ? clipId : (clipId as string);
  return useSyncExternalStore(
    engine.subscribe,
    () => {
      const snap = engine.getSnapshot();
      if (snap.provisional !== null) {
        const ghost = snap.provisional.clips.find((c) => c.id === id);
        if (ghost) return ghost;
      }
      for (const track of snap.state.timeline.tracks) {
        const clip = track.clips.find((c) => c.id === id);
        if (clip) return clip;
      }
      return null;
    },
    () => {
      const snap = engine.getSnapshot();
      if (snap.provisional !== null) {
        const ghost = snap.provisional.clips.find((c) => c.id === id);
        if (ghost) return ghost;
      }
      for (const track of snap.state.timeline.tracks) {
        const clip = track.clips.find((c) => c.id === id);
        if (clip) return clip;
      }
      return null;
    },
  );
}

// ---------------------------------------------------------------------------
// useClips
// ---------------------------------------------------------------------------

export function useClips(
  engine: TimelineEngine,
  trackId: TrackId | string,
): readonly Clip[] {
  const id = typeof trackId === 'string' ? trackId : (trackId as string);
  return useSyncExternalStore(
    engine.subscribe,
    () =>
      engine.getSnapshot().state.timeline.tracks.find((t) => t.id === id)?.clips ?? EMPTY_CLIPS,
    () =>
      getServerSnapshot(
        engine,
        (snap) => snap.state.timeline.tracks.find((t) => t.id === id)?.clips ?? EMPTY_CLIPS,
      ),
  );
}

// ---------------------------------------------------------------------------
// useMarkers
// ---------------------------------------------------------------------------

export function useMarkers(engine: TimelineEngine): readonly Marker[] {
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().state.timeline.markers ?? EMPTY_MARKERS,
    () =>
      getServerSnapshot(
        engine,
        (snap) => snap.state.timeline.markers ?? EMPTY_MARKERS,
      ),
  );
}

// ---------------------------------------------------------------------------
// useHistory — stable object ref when canUndo/canRedo unchanged
// ---------------------------------------------------------------------------

export function useHistory(engine: TimelineEngine): {
  canUndo: boolean;
  canRedo: boolean;
} {
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().history,
    () => getServerSnapshot(engine, (snap) => snap.history),
  );
}

// ---------------------------------------------------------------------------
// useActiveToolId
// ---------------------------------------------------------------------------

export function useActiveToolId(engine: TimelineEngine): string {
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().activeToolId,
    () => getServerSnapshot(engine, (snap) => snap.activeToolId),
  );
}

// ---------------------------------------------------------------------------
// useCursor
// ---------------------------------------------------------------------------

export function useCursor(engine: TimelineEngine): string {
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().cursor,
    () => getServerSnapshot(engine, (snap) => snap.cursor),
  );
}

// ---------------------------------------------------------------------------
// useProvisional
// ---------------------------------------------------------------------------

export function useProvisional(engine: TimelineEngine): ProvisionalState | null {
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().provisional,
    () => getServerSnapshot(engine, (snap) => snap.provisional),
  );
}

// ---------------------------------------------------------------------------
// usePlayheadFrame — re-renders every frame during playback
// ---------------------------------------------------------------------------

export function usePlayheadFrame(engine: TimelineEngine): TimelineFrame {
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().playhead.currentFrame,
    () => getServerSnapshot(engine, (snap) => snap.playhead.currentFrame),
  );
}

// ---------------------------------------------------------------------------
// useIsPlaying
// ---------------------------------------------------------------------------

export function useIsPlaying(engine: TimelineEngine): boolean {
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().playhead.isPlaying,
    () => getServerSnapshot(engine, (snap) => snap.playhead.isPlaying),
  );
}

// ---------------------------------------------------------------------------
// useChange — advanced: subscribe to diff for custom bailout
// ---------------------------------------------------------------------------

export function useChange(engine: TimelineEngine): StateChange {
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().change,
    () => getServerSnapshot(engine, (snap) => snap.change),
  );
}

// ---------------------------------------------------------------------------
// usePlaybackEngine
// ---------------------------------------------------------------------------

import type { PlaybackEngine } from '@webpacked-timeline/core';

export function usePlaybackEngine(engine: TimelineEngine): PlaybackEngine | null {
  return engine.playbackEngine;
}

// ---------------------------------------------------------------------------
// useSelectedClipIds — re-renders when selection changes
// ---------------------------------------------------------------------------

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

export function useSelectedClipIds(engine: TimelineEngine): ReadonlySet<string> {
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getSnapshot().selectedClipIds ?? EMPTY_SELECTION,
    () => getServerSnapshot(engine, (snap) => snap.selectedClipIds ?? EMPTY_SELECTION),
  );
}
