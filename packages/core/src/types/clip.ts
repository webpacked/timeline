/**
 * CLIP MODEL — Phase 0 compliant
 *
 * A Clip is a time-bound reference to an Asset placed on a Track.
 * All fields are readonly. Never mutate — always return a new object.
 */

import type { TimelineFrame } from './frame';
import type { AssetId } from './asset';
import type { TrackId } from './track';
import type { Effect } from './effect';
import type { ClipTransform } from './clip-transform';
import type { AudioProperties } from './audio-properties';
import type { Transition } from './transition';

// ---------------------------------------------------------------------------
// Branded ID
// ---------------------------------------------------------------------------

export type ClipId = string & { readonly __brand: 'ClipId' };
export const toClipId = (s: string): ClipId => s as ClipId;

// ---------------------------------------------------------------------------
// Clip
// ---------------------------------------------------------------------------

/**
 * Clip — a time-bound viewport into an Asset on a Track.
 *
 * TIMELINE BOUNDS: timelineStart / timelineEnd — where it sits on the track.
 * MEDIA BOUNDS:    mediaIn / mediaOut         — which portion of the asset plays.
 *
 * INVARIANTS (Phase 0, speed=1.0):
 *   timelineEnd > timelineStart
 *   mediaOut > mediaIn
 *   (mediaOut - mediaIn) === (timelineEnd - timelineStart)
 *   mediaIn >= 0
 *   mediaOut <= asset.intrinsicDuration
 *   timelineEnd <= timeline.duration
 *   speed > 0
 */
export type Clip = {
  readonly id: ClipId;
  readonly assetId: AssetId;
  readonly trackId: TrackId;

  // — Timeline bounds —
  readonly timelineStart: TimelineFrame;
  readonly timelineEnd: TimelineFrame;

  // — Media bounds —
  readonly mediaIn: TimelineFrame;
  readonly mediaOut: TimelineFrame;

  readonly speed: number;       // 1.0 = normal, > 0 always
  readonly enabled: boolean;
  readonly reversed: boolean;
  readonly name: string | null;
  readonly color: string | null;
  readonly metadata: Record<string, string>;
  // — Phase 4 —
  readonly effects?: readonly Effect[];
  readonly transform?: ClipTransform;
  readonly audio?: AudioProperties;
  readonly transition?: Transition;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createClip(params: {
  id: string;
  assetId: string;
  trackId: string;
  timelineStart: TimelineFrame;
  timelineEnd: TimelineFrame;
  mediaIn: TimelineFrame;
  mediaOut: TimelineFrame;
  speed?: number;
  enabled?: boolean;
  reversed?: boolean;
  name?: string | null;
  color?: string | null;
  metadata?: Record<string, string>;
  effects?: readonly Effect[];
  transform?: ClipTransform;
  audio?: AudioProperties;
  transition?: Transition;
}): Clip {
  return {
    id: params.id as ClipId,
    assetId: params.assetId as AssetId,
    trackId: params.trackId as TrackId,
    timelineStart: params.timelineStart,
    timelineEnd: params.timelineEnd,
    mediaIn: params.mediaIn,
    mediaOut: params.mediaOut,
    speed: params.speed ?? 1.0,
    enabled: params.enabled ?? true,
    reversed: params.reversed ?? false,
    name: params.name ?? null,
    color: params.color ?? null,
    metadata: params.metadata ?? {},
    ...(params.effects !== undefined && { effects: params.effects }),
    ...(params.transform !== undefined && { transform: params.transform }),
    ...(params.audio !== undefined && { audio: params.audio }),
    ...(params.transition !== undefined && { transition: params.transition }),
  };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function getClipDuration(clip: Clip): TimelineFrame {
  return (clip.timelineEnd - clip.timelineStart) as TimelineFrame;
}

export function getClipMediaDuration(clip: Clip): TimelineFrame {
  return (clip.mediaOut - clip.mediaIn) as TimelineFrame;
}

export function clipContainsFrame(clip: Clip, f: TimelineFrame): boolean {
  return f >= clip.timelineStart && f < clip.timelineEnd;
}

export function clipsOverlap(a: Clip, b: Clip): boolean {
  return a.timelineStart < b.timelineEnd && b.timelineStart < a.timelineEnd;
}
