/**
 * TRACK MODEL — Phase 0 + Phase 3
 *
 * A Track is a horizontal container for Clips, always sorted by timelineStart.
 * Phase 3: captions[] for subtitle/caption items.
 */

import type { Clip } from './clip';
import type { Caption } from './caption';
import type { TrackGroupId } from './track-group';

// ---------------------------------------------------------------------------
// Branded ID
// ---------------------------------------------------------------------------

export type TrackId = string & { readonly __brand: 'TrackId' };
export const toTrackId = (s: string): TrackId => s as TrackId;

// ---------------------------------------------------------------------------
// TrackType — must match Asset.mediaType for any clip placed on the track
// ---------------------------------------------------------------------------

export type TrackType = 'video' | 'audio' | 'subtitle' | 'title';

// ---------------------------------------------------------------------------
// Track
// ---------------------------------------------------------------------------

export type Track = {
  readonly id: TrackId;
  readonly name: string;
  readonly type: TrackType;
  readonly locked: boolean;
  readonly muted: boolean;
  readonly solo: boolean;
  readonly height: number;
  /** Always sorted ascending by timelineStart — invariant enforced by checkInvariants. */
  readonly clips: readonly Clip[];
  /** Phase 3: captions on this track (e.g. subtitle/title). */
  readonly captions: readonly Caption[];
  // — Phase 4 —
  readonly blendMode?: string;
  readonly opacity?: number;   // 0–1, default 1
  readonly groupId?: TrackGroupId;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTrack(params: {
  id: string;
  name: string;
  type: TrackType;
  clips?: readonly Clip[];
  captions?: readonly Caption[];
  locked?: boolean;
  muted?: boolean;
  solo?: boolean;
  height?: number;
  blendMode?: string;
  opacity?: number;
  groupId?: TrackGroupId;
}): Track {
  return {
    id: params.id as TrackId,
    name: params.name,
    type: params.type,
    clips: params.clips ?? [],
    captions: params.captions ?? [],
    locked: params.locked ?? false,
    muted: params.muted ?? false,
    solo: params.solo ?? false,
    height: params.height ?? 56,
    ...(params.blendMode !== undefined && { blendMode: params.blendMode }),
    ...(params.opacity !== undefined && { opacity: params.opacity }),
    ...(params.groupId !== undefined && { groupId: params.groupId }),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a new track with clips sorted ascending by timelineStart. */
export function sortTrackClips(track: Track): Track {
  return {
    ...track,
    clips: [...track.clips].sort((a, b) => a.timelineStart - b.timelineStart),
  };
}
