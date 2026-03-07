/**
 * Frame resolver — Phase 6 Step 2 + Step 3
 *
 * Given a TimelineFrame, resolves which clips are visible and builds
 * the composite request. Pure function — no async, no decoding.
 */

import { toFrame } from '../types/frame';
import type { TimelineFrame } from '../types/frame';
import type { TimelineState } from '../types/state';
import type { Clip, ClipId } from '../types/clip';
import type { Track } from '../types/track';
import type { PlaybackQuality } from '../types/playhead';
import type { ResolvedCompositeRequest, ResolvedLayer } from '../types/pipeline';
import type { Marker } from '../types/marker';
import { DEFAULT_CLIP_TRANSFORM } from '../types/clip-transform';
import type { TrackIndex } from './track-index';

/** Anchor frame for seek: point → frame, range → frameStart. */
export function getMarkerAnchor(marker: Marker): TimelineFrame {
  return marker.type === 'point' ? marker.frame : marker.frameStart;
}

/**
 * Returns the media-space frame for a clip at the given timeline frame.
 * mediaFrame = timelineFrame - clip.timelineStart + clip.mediaIn
 */
export function mediaFrameForClip(
  clip: Clip,
  timelineFrame: TimelineFrame,
): TimelineFrame {
  const t = timelineFrame as number;
  const start = clip.timelineStart as number;
  const mediaIn = (clip.mediaIn ?? toFrame(0)) as number;
  return toFrame(mediaIn + (t - start));
}

/**
 * Returns all clips visible at the given timeline frame, with their
 * parent track and track index (z-order).
 * If index is provided and built, uses O(log n + k) lookup; else linear scan.
 */
export function getClipsAtFrame(
  state: TimelineState,
  timelineFrame: TimelineFrame,
  index?: TrackIndex,
): Array<{ clip: Clip; track: Track; trackIndex: number }> {
  const t = timelineFrame as number;
  if (index?.isBuilt) {
    return index.query(t);
  }
  const out: Array<{ clip: Clip; track: Track; trackIndex: number }> = [];
  const tracks = state.timeline.tracks;
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]!;
    for (const clip of track.clips) {
      const start = clip.timelineStart as number;
      const end = clip.timelineEnd as number;
      if (t >= start && t < end) {
        out.push({ clip, track, trackIndex: i });
      }
    }
  }
  return out;
}

/**
 * Resolves the composite request for a timeline frame: which layers are
 * visible and their transform/opacity/blend/effects. Does not decode.
 * Pass optional index for O(log n + k) clip lookup.
 */
export function resolveFrame(
  state: TimelineState,
  timelineFrame: TimelineFrame,
  quality: PlaybackQuality,
  dimensions: { width: number; height: number },
  index?: TrackIndex,
): ResolvedCompositeRequest {
  const pairs = getClipsAtFrame(state, timelineFrame, index);
  const layers: ResolvedLayer[] = pairs.map(({ clip, track, trackIndex }) => ({
    clipId: clip.id,
    trackId: track.id,
    trackIndex,
    mediaFrame: mediaFrameForClip(clip, timelineFrame),
    transform: clip.transform ?? DEFAULT_CLIP_TRANSFORM,
    opacity: track.opacity ?? 1,
    blendMode: track.blendMode ?? 'normal',
    effects: clip.effects ?? [],
  }));
  return {
    timelineFrame,
    layers,
    width: dimensions.width,
    height: dimensions.height,
    quality,
  };
}

/**
 * Returns the nearest frame strictly after fromFrame where any clip
 * starts or ends on any track. Returns null if none.
 */
export function findNextClipBoundary(
  state: TimelineState,
  fromFrame: TimelineFrame,
): TimelineFrame | null {
  const from = fromFrame as number;
  let min: number | null = null;
  for (const track of state.timeline.tracks) {
    for (const clip of track.clips) {
      const start = clip.timelineStart as number;
      const end = clip.timelineEnd as number;
      if (start > from && (min === null || start < min)) min = start;
      if (end > from && (min === null || end < min)) min = end;
    }
  }
  return min !== null ? toFrame(min) : null;
}

/**
 * Returns the nearest frame strictly before fromFrame where any clip
 * starts or ends on any track. Returns null if none.
 */
export function findPrevClipBoundary(
  state: TimelineState,
  fromFrame: TimelineFrame,
): TimelineFrame | null {
  const from = fromFrame as number;
  let max: number | null = null;
  for (const track of state.timeline.tracks) {
    for (const clip of track.clips) {
      const start = clip.timelineStart as number;
      const end = clip.timelineEnd as number;
      if (start < from && (max === null || start > max)) max = start;
      if (end < from && (max === null || end > max)) max = end;
    }
  }
  return max !== null ? toFrame(max) : null;
}

/**
 * Returns the marker with the smallest anchor strictly after fromFrame.
 * Point markers use .frame; range markers use .frameStart as anchor.
 */
export function findNextMarker(
  state: TimelineState,
  fromFrame: TimelineFrame,
): Marker | null {
  const from = fromFrame as number;
  let best: Marker | null = null;
  let bestAnchor = Infinity;
  for (const m of state.timeline.markers) {
    const anchor = getMarkerAnchor(m) as number;
    if (anchor > from && anchor < bestAnchor) {
      bestAnchor = anchor;
      best = m;
    }
  }
  return best;
}

/**
 * Returns the marker with the largest anchor strictly before fromFrame.
 */
export function findPrevMarker(
  state: TimelineState,
  fromFrame: TimelineFrame,
): Marker | null {
  const from = fromFrame as number;
  let best: Marker | null = null;
  let bestAnchor = -Infinity;
  for (const m of state.timeline.markers) {
    const anchor = getMarkerAnchor(m) as number;
    if (anchor < from && anchor > bestAnchor) {
      bestAnchor = anchor;
      best = m;
    }
  }
  return best;
}

/**
 * Searches all tracks for a clip with the given id.
 * Returns clip + parent track + trackIndex, or null if not found.
 */
export function findClipById(
  state: TimelineState,
  clipId: ClipId,
): { clip: Clip; track: Track; trackIndex: number } | null {
  const tracks = state.timeline.tracks;
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]!;
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { clip, track, trackIndex: i };
  }
  return null;
}
