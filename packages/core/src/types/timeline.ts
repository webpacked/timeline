/**
 * TIMELINE MODEL — Phase 0 + Phase 3
 */

import type { TimelineFrame, FrameRate, Timecode } from './frame';
import type { Track } from './track';
import type { Marker, BeatGrid } from './marker';
import type { TrackGroup } from './track-group';
import type { LinkGroup } from './link-group';

// ---------------------------------------------------------------------------
// SequenceSettings
// ---------------------------------------------------------------------------

export type SequenceSettings = {
  readonly pixelAspectRatio: number;
  readonly fieldOrder: 'progressive' | 'upper' | 'lower';
  readonly colorSpace: string;
  readonly audioSampleRate: number;
  readonly audioChannelCount: number;
};

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type Timeline = {
  readonly id: string;
  readonly name: string;
  readonly fps: FrameRate;
  readonly duration: TimelineFrame;
  readonly startTimecode: Timecode;
  readonly tracks: readonly Track[];
  readonly sequenceSettings: SequenceSettings;
  /**
   * Increments by 1 on every successfully committed Transaction.
   * Use this to detect stale references without deep equality checks.
   */
  readonly version: number;
  // — Phase 3 —
  readonly markers: readonly Marker[];
  readonly beatGrid: BeatGrid | null;
  readonly inPoint: TimelineFrame | null;
  readonly outPoint: TimelineFrame | null;
  // — Phase 4 —
  readonly trackGroups?: readonly TrackGroup[];
  readonly linkGroups?: readonly LinkGroup[];
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const DEFAULT_SEQUENCE_SETTINGS: SequenceSettings = {
  pixelAspectRatio: 1,
  fieldOrder: 'progressive',
  colorSpace: 'sRGB',
  audioSampleRate: 48000,
  audioChannelCount: 2,
};

export function createTimeline(params: {
  id: string;
  name: string;
  fps: FrameRate;
  duration: TimelineFrame;
  startTimecode?: Timecode;
  tracks?: readonly Track[];
  sequenceSettings?: Partial<SequenceSettings>;
  markers?: readonly Marker[];
  beatGrid?: BeatGrid | null;
  inPoint?: TimelineFrame | null;
  outPoint?: TimelineFrame | null;
  trackGroups?: readonly TrackGroup[];
  linkGroups?: readonly LinkGroup[];
}): Timeline {
  return {
    id: params.id,
    name: params.name,
    fps: params.fps,
    duration: params.duration,
    startTimecode: params.startTimecode ?? ('00:00:00:00' as Timecode),
    tracks: params.tracks ?? [],
    sequenceSettings: { ...DEFAULT_SEQUENCE_SETTINGS, ...params.sequenceSettings },
    version: 0,
    markers: params.markers ?? [],
    beatGrid: params.beatGrid ?? null,
    inPoint: params.inPoint ?? null,
    outPoint: params.outPoint ?? null,
    ...(params.trackGroups !== undefined && { trackGroups: params.trackGroups }),
    ...(params.linkGroups !== undefined && { linkGroups: params.linkGroups }),
  };
}
