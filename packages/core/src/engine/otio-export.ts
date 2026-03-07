/**
 * OTIO export — Phase 5 Step 2
 *
 * Pure function. Produces OTIO JSON-serializable document from TimelineState.
 * No external OTIO library. Hand-rolled mapping.
 */

import type { TimelineState } from '../types/state';
import type { Clip } from '../types/clip';
import type { Track } from '../types/track';
import type { FileAsset, GeneratorAsset } from '../types/asset';
import type { Marker } from '../types/marker';
import type { Effect } from '../types/effect';

// ---------------------------------------------------------------------------
// Internal OTIO types (not exported)
// ---------------------------------------------------------------------------

type OTIORationalTime = { value: number; rate: number };
type OTIOTimeRange = {
  OTIO_SCHEMA: string;
  start_time: OTIORationalTime;
  duration: OTIORationalTime;
};

type OTIOExternalReference = {
  OTIO_SCHEMA: string;
  target_url: string;
  available_range: OTIOTimeRange;
};
type OTIOGeneratorReference = {
  OTIO_SCHEMA: string;
  generator_kind: string;
};
type OTIOMissingReference = { OTIO_SCHEMA: string };

type OTIOClip = {
  OTIO_SCHEMA: string;
  name: string;
  source_range: OTIOTimeRange;
  media_reference: OTIOExternalReference | OTIOGeneratorReference | OTIOMissingReference;
  effects?: OTIOEffect[];
};
type OTIOGap = {
  OTIO_SCHEMA: string;
  source_range: OTIOTimeRange;
};
type OTIOEffect = {
  OTIO_SCHEMA: string;
  name: string;
  effect_name: string;
  enabled: boolean;
  metadata: { params: readonly { key: string; value: number | string | boolean }[] };
};
type OTIOTrack = {
  OTIO_SCHEMA: string;
  kind: string;
  children: (OTIOClip | OTIOGap)[];
};
type OTIOStack = {
  OTIO_SCHEMA: string;
  children: OTIOTrack[];
};
type OTIOMarker = {
  OTIO_SCHEMA: string;
  name: string;
  color: string;
  marked_range: OTIOTimeRange;
};
export type OTIODocument = {
  OTIO_SCHEMA: string;
  name: string;
  global_start_time: OTIORationalTime;
  tracks: OTIOStack;
  markers: OTIOMarker[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rationalTime(value: number, rate: number): OTIORationalTime {
  return { value, rate };
}

function timeRange(start: number, duration: number, rate: number): OTIOTimeRange {
  return {
    OTIO_SCHEMA: 'TimeRange.1',
    start_time: rationalTime(start, rate),
    duration: rationalTime(duration, rate),
  };
}

function fpsFromTimeline(state: TimelineState): number {
  return state.timeline.fps as number;
}

function clipDurationFrames(clip: Clip): number {
  return (clip.timelineEnd - clip.timelineStart) as number;
}

// ---------------------------------------------------------------------------
// Media reference
// ---------------------------------------------------------------------------

function mediaReferenceForClip(
  state: TimelineState,
  clip: Clip,
  fps: number,
): OTIOExternalReference | OTIOGeneratorReference | OTIOMissingReference {
  const asset = state.assetRegistry.get(clip.assetId);
  if (!asset) {
    return { OTIO_SCHEMA: 'MissingReference.1' };
  }
  if (asset.kind === 'file') {
    const fa = asset as FileAsset;
    const dur = fa.intrinsicDuration as number;
    return {
      OTIO_SCHEMA: 'ExternalReference.1',
      target_url: fa.filePath,
      available_range: timeRange(0, dur, fps),
    };
  }
  const ga = asset as GeneratorAsset;
  return {
    OTIO_SCHEMA: 'GeneratorReference.1',
    generator_kind: ga.generatorDef.type,
  };
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

function effectToOTIO(e: Effect): OTIOEffect {
  return {
    OTIO_SCHEMA: 'Effect.1',
    name: e.effectType,
    effect_name: e.effectType,
    enabled: e.enabled,
    metadata: { params: e.params ?? [] },
  };
}

// ---------------------------------------------------------------------------
// Clip to OTIO (single clip, no gap)
// ---------------------------------------------------------------------------

function clipToOTIO(state: TimelineState, clip: Clip, fps: number): OTIOClip {
  const durationFrames = clipDurationFrames(clip);
  const mediaStart = clip.mediaIn as number;
  const otioClip: OTIOClip = {
    OTIO_SCHEMA: 'Clip.1',
    name: clip.name ?? clip.id,
    source_range: {
      OTIO_SCHEMA: 'TimeRange.1',
      start_time: rationalTime(mediaStart, fps),
      duration: rationalTime(durationFrames, fps),
    },
    media_reference: mediaReferenceForClip(state, clip, fps),
  };
  const effects = clip.effects;
  if (effects && effects.length > 0) {
    otioClip.effects = effects.map(effectToOTIO);
  }
  return otioClip;
}

// ---------------------------------------------------------------------------
// Track to OTIO (clips + gaps)
// ---------------------------------------------------------------------------

function trackToOTIO(state: TimelineState, track: Track, fps: number): OTIOTrack {
  const children: (OTIOClip | OTIOGap)[] = [];
  const clips = track.clips;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]!;
    const clipStart = clip.timelineStart as number;
    const prevEnd = i === 0 ? 0 : (clips[i - 1]!.timelineEnd as number);
    const gapFrames = clipStart - prevEnd;
    if (gapFrames > 0) {
      children.push({
        OTIO_SCHEMA: 'Gap.1',
        source_range: timeRange(0, gapFrames, fps),
      });
    }
    children.push(clipToOTIO(state, clip, fps));
  }
  const kind = track.type === 'video' ? 'Video' : track.type === 'audio' ? 'Audio' : 'Video';
  return {
    OTIO_SCHEMA: 'Track.1',
    kind,
    children,
  };
}

// ---------------------------------------------------------------------------
// Markers (timeline-level; export all timeline.markers)
// ---------------------------------------------------------------------------

function markerToOTIO(marker: Marker, fps: number): OTIOMarker {
  if (marker.type === 'point') {
    const frame = marker.frame as number;
    return {
      OTIO_SCHEMA: 'Marker.1',
      name: marker.label ?? '',
      color: marker.color ?? 'RED',
      marked_range: timeRange(frame, 0, fps),
    };
  }
  const start = marker.frameStart as number;
  const duration = (marker.frameEnd - marker.frameStart) as number;
  return {
    OTIO_SCHEMA: 'Marker.1',
    name: marker.label ?? '',
    color: marker.color ?? 'RED',
    marked_range: timeRange(start, duration, fps),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export TimelineState to an OTIO document (plain object).
 * Caller can JSON.stringify the result.
 */
export function exportToOTIO(state: TimelineState): OTIODocument {
  const fps = fpsFromTimeline(state);
  const timeline = state.timeline;
  const tracks: OTIOTrack[] = timeline.tracks.map((t) => trackToOTIO(state, t, fps));
  const markers: OTIOMarker[] = (timeline.markers ?? []).map((m) => markerToOTIO(m, fps));
  return {
    OTIO_SCHEMA: 'Timeline.1',
    name: timeline.name ?? 'Untitled',
    global_start_time: rationalTime(0, fps),
    tracks: {
      OTIO_SCHEMA: 'Stack.1',
      children: tracks,
    },
    markers,
  };
}
