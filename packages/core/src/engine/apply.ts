/**
 * OPERATION APPLIER — Phase 0 compliant
 *
 * Pure functions. No validation here — validation lives in validators.ts.
 * Apply is dumb. Validate is smart.
 *
 * RULE: Every case returns a NEW TimelineState. Never mutates.
 * RULE: No imports from React, DOM, or any UI framework.
 */

import type { TimelineState } from '../types/state';
import type { OperationPrimitive } from '../types/operations';
import { sortTrackClips } from '../types/track';
import type { Clip } from '../types/clip';
import { createClip } from '../types/clip';
import type { Track } from '../types/track';
import { createGeneratorAsset } from '../types/asset';
import type { TimelineFrame } from '../types/frame';
import type { Marker } from '../types/marker';
import type { Caption } from '../types/caption';
import type { Effect, EffectParam } from '../types/effect';
import type { Keyframe } from '../types/keyframe';
import type { ClipTransform } from '../types/clip-transform';
import { DEFAULT_CLIP_TRANSFORM } from '../types/clip-transform';
import type { AudioProperties } from '../types/audio-properties';
import { DEFAULT_AUDIO_PROPERTIES } from '../types/audio-properties';
import type { Transition } from '../types/transition';
import { defaultCaptionStyle } from './subtitle-import';

// ---------------------------------------------------------------------------
// applyOperation
// ---------------------------------------------------------------------------

export function applyOperation(
  state: TimelineState,
  op: OperationPrimitive,
): TimelineState {
  switch (op.type) {

    // — Clip operations ——————————————————————————————————————————————————

    case 'INSERT_CLIP': {
      return updateTrack(state, op.trackId, (track) =>
        sortTrackClips({ ...track, clips: [...track.clips, op.clip] }),
      );
    }

    case 'DELETE_CLIP': {
      return updateTrackOfClip(state, op.clipId, (track) => ({
        ...track,
        clips: track.clips.filter((c) => c.id !== op.clipId),
      }));
    }

    case 'MOVE_CLIP': {
      const targetTrackId = op.targetTrackId;

      // Find the clip first so we know where it currently lives
      let foundClip: Clip | undefined;
      for (const track of state.timeline.tracks) {
        const c = track.clips.find((c) => c.id === op.clipId);
        if (c) { foundClip = c; break; }
      }
      if (!foundClip) return state;

      const delta = op.newTimelineStart - foundClip.timelineStart;
      const movedClip: Clip = {
        ...foundClip,
        trackId: (targetTrackId ?? foundClip.trackId) as typeof foundClip.trackId,
        timelineStart: op.newTimelineStart,
        timelineEnd: (foundClip.timelineEnd + delta) as typeof foundClip.timelineEnd,
      };

      const effectiveTargetTrackId = targetTrackId ?? foundClip.trackId;
      const isCrossTrack = effectiveTargetTrackId !== foundClip.trackId;

      let stateWithMovedClip: TimelineState;
      if (!isCrossTrack) {
        stateWithMovedClip = updateClip(state, op.clipId, () => movedClip);
      } else {
        const newTracks = state.timeline.tracks.map((track) => {
          if (track.id === foundClip!.trackId) {
            return { ...track, clips: track.clips.filter((c) => c.id !== op.clipId) };
          }
          if (track.id === effectiveTargetTrackId) {
            return sortTrackClips({ ...track, clips: [...track.clips, movedClip] });
          }
          return track;
        });
        stateWithMovedClip = { ...state, timeline: { ...state.timeline, tracks: newTracks } };
      }

      // Shift clip-linked markers by the same delta (Part 2)
      const shiftedMarkers = shiftLinkedMarkers(
        stateWithMovedClip.timeline.markers,
        op.clipId,
        delta,
      );
      return {
        ...stateWithMovedClip,
        timeline: { ...stateWithMovedClip.timeline, markers: shiftedMarkers },
      };
    }


    case 'RESIZE_CLIP': {
      return updateClip(state, op.clipId, (clip) => {
        if (op.edge === 'start') {
          const delta = op.newFrame - clip.timelineStart;
          return {
            ...clip,
            timelineStart: op.newFrame,
            mediaIn: (clip.mediaIn + delta) as typeof clip.mediaIn,
          };
        } else {
          const delta = op.newFrame - clip.timelineEnd;
          return {
            ...clip,
            timelineEnd: op.newFrame,
            mediaOut: (clip.mediaOut + delta) as typeof clip.mediaOut,
          };
        }
      });
    }

    case 'SLICE_CLIP': {
      // SLICE_CLIP is always wrapped in a Transaction with DELETE_CLIP + INSERT_CLIP×2.
      // If called in isolation, it's a no-op — slicing is a compound operation.
      return state;
    }

    case 'SET_MEDIA_BOUNDS': {
      return updateClip(state, op.clipId, (clip) => ({
        ...clip,
        mediaIn: op.mediaIn,
        mediaOut: op.mediaOut,
      }));
    }

    case 'SET_CLIP_ENABLED': {
      return updateClip(state, op.clipId, (clip) => ({ ...clip, enabled: op.enabled }));
    }

    case 'SET_CLIP_REVERSED': {
      return updateClip(state, op.clipId, (clip) => ({ ...clip, reversed: op.reversed }));
    }

    case 'SET_CLIP_SPEED': {
      return updateClip(state, op.clipId, (clip) => ({ ...clip, speed: op.speed }));
    }

    case 'SET_CLIP_COLOR': {
      return updateClip(state, op.clipId, (clip) => ({ ...clip, color: op.color }));
    }

    case 'SET_CLIP_NAME': {
      return updateClip(state, op.clipId, (clip) => ({ ...clip, name: op.name }));
    }

    // — Track operations ——————————————————————————————————————————————————

    case 'ADD_TRACK': {
      return {
        ...state,
        timeline: {
          ...state.timeline,
          tracks: [...state.timeline.tracks, op.track],
        },
      };
    }

    case 'DELETE_TRACK': {
      return {
        ...state,
        timeline: {
          ...state.timeline,
          tracks: state.timeline.tracks.filter((t) => t.id !== op.trackId),
        },
      };
    }

    case 'REORDER_TRACK': {
      const tracks = [...state.timeline.tracks];
      const idx = tracks.findIndex((t) => t.id === op.trackId);
      if (idx === -1) return state;
      const [track] = tracks.splice(idx, 1);
      if (!track) return state;
      tracks.splice(op.newIndex, 0, track);
      return { ...state, timeline: { ...state.timeline, tracks } };
    }

    case 'SET_TRACK_HEIGHT': {
      return updateTrack(state, op.trackId, (t) => ({ ...t, height: op.height }));
    }

    case 'SET_TRACK_NAME': {
      return updateTrack(state, op.trackId, (t) => ({ ...t, name: op.name }));
    }

    // — Asset operations ——————————————————————————————————————————————————

    case 'REGISTER_ASSET': {
      const next = new Map(state.assetRegistry);
      next.set(op.asset.id, op.asset);
      return { ...state, assetRegistry: next };
    }

    case 'UNREGISTER_ASSET': {
      const next = new Map(state.assetRegistry);
      next.delete(op.assetId);
      return { ...state, assetRegistry: next };
    }

    case 'SET_ASSET_STATUS': {
      const asset = state.assetRegistry.get(op.assetId);
      if (!asset) return state;
      const next = new Map(state.assetRegistry);
      next.set(op.assetId, { ...asset, status: op.status });
      return { ...state, assetRegistry: next };
    }

    // — Timeline operations ———————————————————————————————————————————————

    case 'RENAME_TIMELINE': {
      return { ...state, timeline: { ...state.timeline, name: op.name } };
    }

    case 'SET_TIMELINE_DURATION': {
      return { ...state, timeline: { ...state.timeline, duration: op.duration } };
    }

    case 'SET_TIMELINE_START_TC': {
      return { ...state, timeline: { ...state.timeline, startTimecode: op.startTimecode } };
    }

    case 'SET_SEQUENCE_SETTINGS': {
      return {
        ...state,
        timeline: {
          ...state.timeline,
          sequenceSettings: { ...state.timeline.sequenceSettings, ...op.settings },
        },
      };
    }

    // — Phase 3: Marker operations ————————————————————————————————————————

    case 'ADD_MARKER': {
      const markers = [...state.timeline.markers, op.marker].sort(sortMarkersByAnchor);
      return { ...state, timeline: { ...state.timeline, markers } };
    }

    case 'MOVE_MARKER': {
      const marker = state.timeline.markers.find((m) => m.id === op.markerId);
      if (!marker) return state;
      const updated =
        marker.type === 'point'
          ? { ...marker, frame: op.newFrame }
          : {
              ...marker,
              frameStart: op.newFrame,
              frameEnd: (op.newFrame + (marker.frameEnd - marker.frameStart)) as TimelineFrame,
            };
      const markers = state.timeline.markers
        .map((m) => (m.id === op.markerId ? updated : m))
        .sort(sortMarkersByAnchor);
      return { ...state, timeline: { ...state.timeline, markers } };
    }

    case 'DELETE_MARKER': {
      const markers = state.timeline.markers.filter((m) => m.id !== op.markerId);
      return { ...state, timeline: { ...state.timeline, markers } };
    }

    case 'SET_IN_POINT': {
      return { ...state, timeline: { ...state.timeline, inPoint: op.frame } };
    }

    case 'SET_OUT_POINT': {
      return { ...state, timeline: { ...state.timeline, outPoint: op.frame } };
    }

    case 'ADD_BEAT_GRID': {
      return { ...state, timeline: { ...state.timeline, beatGrid: op.beatGrid } };
    }

    case 'REMOVE_BEAT_GRID': {
      return { ...state, timeline: { ...state.timeline, beatGrid: null } };
    }

    case 'INSERT_GENERATOR': {
      const track = state.timeline.tracks.find((t) => t.id === op.trackId);
      if (!track) return state;
      const genAsset = createGeneratorAsset({
        id: op.generator.id as unknown as string,
        name: op.generator.name,
        mediaType: track.type,
        generatorDef: op.generator,
        nativeFps: state.timeline.fps,
      });
      const clip = createClip({
        id: `gen-clip-${op.generator.id}`,
        assetId: genAsset.id as unknown as string,
        trackId: op.trackId as unknown as string,
        timelineStart: op.atFrame,
        timelineEnd: (op.atFrame + op.generator.duration) as TimelineFrame,
        mediaIn: 0 as TimelineFrame,
        mediaOut: op.generator.duration,
      });
      const nextRegistry = new Map(state.assetRegistry);
      nextRegistry.set(genAsset.id, genAsset);
      return updateTrack(
        { ...state, assetRegistry: nextRegistry },
        op.trackId,
        (t) => sortTrackClips({ ...t, clips: [...t.clips, clip] }),
      );
    }

    case 'ADD_CAPTION': {
      const captionToAdd: Caption = {
        ...op.caption,
        style: op.caption.style ?? defaultCaptionStyle,
      };
      return updateTrack(state, op.trackId, (track) => {
        const captions = [...track.captions, captionToAdd].sort(
          (a, b) => a.startFrame - b.startFrame,
        );
        return { ...track, captions };
      });
    }

    case 'EDIT_CAPTION': {
      return updateTrack(state, op.trackId, (track) => {
        const cap = track.captions.find((c) => c.id === op.captionId);
        if (!cap) return track;
        const updated = {
          ...cap,
          ...(op.text !== undefined && { text: op.text }),
          ...(op.language !== undefined && { language: op.language }),
          ...(op.style !== undefined && { style: { ...cap.style, ...op.style } }),
          ...(op.burnIn !== undefined && { burnIn: op.burnIn }),
          ...(op.startFrame !== undefined && { startFrame: op.startFrame }),
          ...(op.endFrame !== undefined && { endFrame: op.endFrame }),
        };
        const captions = track.captions
          .map((c) => (c.id === op.captionId ? updated : c))
          .sort((a, b) => a.startFrame - b.startFrame);
        return { ...track, captions };
      });
    }

    case 'DELETE_CAPTION': {
      return updateTrack(state, op.trackId, (track) => ({
        ...track,
        captions: track.captions.filter((c) => c.id !== op.captionId),
      }));
    }

    // — Phase 4: Effect & Keyframe ————————————————————————————————————————

    case 'ADD_EFFECT': {
      return updateClipEffects(state, op.clipId, (effects) => [...effects, op.effect]);
    }

    case 'REMOVE_EFFECT': {
      return updateClipEffects(state, op.clipId, (effects) =>
        effects.filter((e) => e.id !== op.effectId),
      );
    }

    case 'REORDER_EFFECT': {
      return updateClipEffects(state, op.clipId, (effects) => {
        const idx = effects.findIndex((e) => e.id === op.effectId);
        if (idx < 0) return effects;
        const arr = [...effects];
        const [removed] = arr.splice(idx, 1);
        if (!removed) return effects;
        arr.splice(op.newIndex, 0, removed);
        return arr;
      });
    }

    case 'SET_EFFECT_ENABLED': {
      return updateClipEffects(state, op.clipId, (effects) =>
        effects.map((e) => (e.id === op.effectId ? { ...e, enabled: op.enabled } : e)),
      );
    }

    case 'SET_EFFECT_PARAM': {
      return updateClipEffects(state, op.clipId, (effects) =>
        effects.map((e) => {
          if (e.id !== op.effectId) return e;
          const idx = e.params.findIndex((p) => p.key === op.key);
          const newParams: EffectParam[] =
            idx >= 0
              ? e.params.map((p, i) => (i === idx ? { key: op.key, value: op.value } : p))
              : [...e.params, { key: op.key, value: op.value }];
          return { ...e, params: newParams };
        }),
      );
    }

    case 'ADD_KEYFRAME': {
      return updateClipEffects(state, op.clipId, (effects) =>
        effects.map((e) => {
          if (e.id !== op.effectId) return e;
          const keyframes = [...e.keyframes, op.keyframe].sort((a, b) => a.frame - b.frame);
          return { ...e, keyframes };
        }),
      );
    }

    case 'MOVE_KEYFRAME': {
      return updateClipEffects(state, op.clipId, (effects) =>
        effects.map((e) => {
          if (e.id !== op.effectId) return e;
          const keyframes = e.keyframes
            .map((k) => (k.id === op.keyframeId ? { ...k, frame: op.newFrame } as Keyframe : k))
            .sort((a, b) => a.frame - b.frame);
          return { ...e, keyframes };
        }),
      );
    }

    case 'DELETE_KEYFRAME': {
      return updateClipEffects(state, op.clipId, (effects) =>
        effects.map((e) =>
          e.id === op.effectId
            ? { ...e, keyframes: e.keyframes.filter((k) => k.id !== op.keyframeId) }
            : e,
        ),
      );
    }

    case 'SET_KEYFRAME_EASING': {
      return updateClipEffects(state, op.clipId, (effects) =>
        effects.map((e) => ({
          ...e,
          keyframes: e.keyframes.map((k) =>
            k.id === op.keyframeId ? { ...k, easing: op.easing } : k,
          ),
        })),
      );
    }

    // — Phase 4 Step 3: Transform, Audio, Transitions, Groups ———————————————

    case 'SET_CLIP_TRANSFORM': {
      return updateClip(state, op.clipId, (clip) => {
        const base = clip.transform ?? DEFAULT_CLIP_TRANSFORM;
        const p = op.transform;
        const merged: ClipTransform = {
          positionX: p.positionX ?? base.positionX,
          positionY: p.positionY ?? base.positionY,
          scaleX: p.scaleX ?? base.scaleX,
          scaleY: p.scaleY ?? base.scaleY,
          rotation: p.rotation ?? base.rotation,
          opacity: p.opacity ?? base.opacity,
          anchorX: p.anchorX ?? base.anchorX,
          anchorY: p.anchorY ?? base.anchorY,
        };
        return { ...clip, transform: merged };
      });
    }

    case 'SET_AUDIO_PROPERTIES': {
      return updateClip(state, op.clipId, (clip) => {
        const base = clip.audio ?? DEFAULT_AUDIO_PROPERTIES;
        const merged: AudioProperties = { ...base, ...op.properties };
        return { ...clip, audio: merged };
      });
    }

    case 'ADD_TRANSITION': {
      return updateClip(state, op.clipId, (clip) => ({ ...clip, transition: op.transition }));
    }

    case 'DELETE_TRANSITION': {
      return updateClip(state, op.clipId, (clip) => {
        const { transition: _, ...rest } = clip;
        return rest as Clip;
      });
    }

    case 'SET_TRANSITION_DURATION': {
      return updateClip(state, op.clipId, (clip) => {
        if (!clip.transition) return clip;
        return { ...clip, transition: { ...clip.transition, durationFrames: op.durationFrames } };
      });
    }

    case 'SET_TRANSITION_ALIGNMENT': {
      return updateClip(state, op.clipId, (clip) => {
        if (!clip.transition) return clip;
        return { ...clip, transition: { ...clip.transition, alignment: op.alignment } };
      });
    }

    case 'LINK_CLIPS': {
      const linkGroups = [...(state.timeline.linkGroups ?? []), op.linkGroup];
      return { ...state, timeline: { ...state.timeline, linkGroups } };
    }

    case 'UNLINK_CLIPS': {
      const linkGroups = (state.timeline.linkGroups ?? []).filter((g) => g.id !== op.linkGroupId);
      return { ...state, timeline: { ...state.timeline, linkGroups } };
    }

    case 'ADD_TRACK_GROUP': {
      const trackGroups = [...(state.timeline.trackGroups ?? []), op.trackGroup];
      const tracks = state.timeline.tracks.map((t) =>
        op.trackGroup.trackIds.some((id) => id === t.id)
          ? { ...t, groupId: op.trackGroup.id }
          : t,
      );
      return {
        ...state,
        timeline: { ...state.timeline, trackGroups, tracks },
      };
    }

    case 'DELETE_TRACK_GROUP': {
      const trackGroups = (state.timeline.trackGroups ?? []).filter((g) => g.id !== op.trackGroupId);
      const tracks = state.timeline.tracks.map((t) => {
        if (t.groupId !== op.trackGroupId) return t;
        const { groupId: _, ...rest } = t;
        return rest as Track;
      });
      return {
        ...state,
        timeline: { ...state.timeline, trackGroups, tracks },
      };
    }

    case 'SET_TRACK_BLEND_MODE': {
      return updateTrack(state, op.trackId, (t) => ({ ...t, blendMode: op.blendMode }));
    }

    case 'SET_TRACK_OPACITY': {
      return updateTrack(state, op.trackId, (t) => ({ ...t, opacity: op.opacity }));
    }
  }
}

function shiftLinkedMarkers(
  markers: readonly Marker[],
  clipId: string,
  delta: number,
): Marker[] {
  const shifted = markers.map((m) => {
    if (m.clipId !== clipId) return m;
    if (m.type === 'point') {
      return { ...m, frame: (m.frame + delta) as TimelineFrame };
    }
    return {
      ...m,
      frameStart: (m.frameStart + delta) as TimelineFrame,
      frameEnd: (m.frameEnd + delta) as TimelineFrame,
    };
  });
  return [...shifted].sort(sortMarkersByAnchor);
}

function sortMarkersByAnchor(
  a: { type: 'point'; frame: TimelineFrame } | { type: 'range'; frameStart: TimelineFrame },
  b: { type: 'point'; frame: TimelineFrame } | { type: 'range'; frameStart: TimelineFrame },
): number {
  const anchorA = a.type === 'point' ? a.frame : a.frameStart;
  const anchorB = b.type === 'point' ? b.frame : b.frameStart;
  return anchorA - anchorB;
}

// ---------------------------------------------------------------------------
// Internal helpers — keep these private to this file
// ---------------------------------------------------------------------------

function updateClipEffects(
  state: TimelineState,
  clipId: string,
  fn: (effects: readonly Effect[]) => readonly Effect[],
): TimelineState {
  return updateClip(state, clipId, (clip) => ({
    ...clip,
    effects: fn(clip.effects ?? []),
  }));
}

function updateTrack(
  state: TimelineState,
  trackId: string,
  fn: (track: Track) => Track,
): TimelineState {
  return {
    ...state,
    timeline: {
      ...state.timeline,
      tracks: state.timeline.tracks.map((t) => (t.id === trackId ? fn(t) : t)),
    },
  };
}

function updateTrackOfClip(
  state: TimelineState,
  clipId: string,
  fn: (track: Track) => Track,
): TimelineState {
  return {
    ...state,
    timeline: {
      ...state.timeline,
      tracks: state.timeline.tracks.map((t) =>
        t.clips.some((c) => c.id === clipId) ? fn(t) : t,
      ),
    },
  };
}

function updateClip(
  state: TimelineState,
  clipId: string,
  fn: (clip: Clip) => Clip,
): TimelineState {
  return {
    ...state,
    timeline: {
      ...state.timeline,
      tracks: state.timeline.tracks.map((track) => {
        if (!track.clips.some((c) => c.id === clipId)) return track;
        const updatedTrack = {
          ...track,
          clips: track.clips.map((c) => (c.id === clipId ? fn(c) : c)),
        };
        return sortTrackClips(updatedTrack);
      }),
    },
  };
}
