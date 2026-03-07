/**
 * MARKER TYPES — Phase 3
 *
 * Discriminated union: point (single frame) or range (frameStart..frameEnd).
 * Markers live on Timeline.markers[]. linkedClipId moves with clip on ripple.
 */

import type { TimelineFrame } from './frame';
import type { ClipId } from './clip';

// ---------------------------------------------------------------------------
// Branded ID
// ---------------------------------------------------------------------------

export type MarkerId = string & { readonly __brand: 'MarkerId' };
export const toMarkerId = (s: string): MarkerId => s as MarkerId;

// ---------------------------------------------------------------------------
// MarkerScope
// ---------------------------------------------------------------------------

export type MarkerScope = 'global' | 'personal' | 'export';

// ---------------------------------------------------------------------------
// Marker — discriminated union (Option A)
// ---------------------------------------------------------------------------

export type Marker =
  | {
      readonly type: 'point';
      readonly id: MarkerId;
      readonly frame: TimelineFrame;
      readonly label: string;
      readonly color: string;
      readonly scope: MarkerScope;
      readonly linkedClipId: ClipId | null;
      readonly clipId?: ClipId;
    }
  | {
      readonly type: 'range';
      readonly id: MarkerId;
      readonly frameStart: TimelineFrame;
      readonly frameEnd: TimelineFrame;
      readonly label: string;
      readonly color: string;
      readonly scope: MarkerScope;
      readonly linkedClipId: ClipId | null;
      readonly clipId?: ClipId;
    };

// ---------------------------------------------------------------------------
// BeatGrid — timeline-level, generates snap points
// ---------------------------------------------------------------------------

export type BeatGrid = {
  readonly bpm: number;
  readonly timeSignature: readonly [number, number];
  readonly offset: TimelineFrame;
};
