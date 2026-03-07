/**
 * TRACK GROUP — Phase 4
 *
 * Logical grouping of tracks (e.g. for nesting or UI collapse).
 */

import type { TrackId } from './track';

export type TrackGroupId = string & { readonly __brand: 'TrackGroupId' };
export function toTrackGroupId(s: string): TrackGroupId {
  return s as TrackGroupId;
}

export type TrackGroup = {
  readonly id: TrackGroupId;
  readonly label: string;
  readonly trackIds: readonly TrackId[];
  readonly collapsed: boolean;
};

export function createTrackGroup(
  id: TrackGroupId,
  label: string,
  trackIds: readonly TrackId[] = [],
): TrackGroup {
  return { id, label, trackIds, collapsed: false };
}
