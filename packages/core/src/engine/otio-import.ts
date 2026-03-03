/**
 * OTIO import — Phase 5 Step 2
 *
 * Pure function. Builds TimelineState from OTIO document.
 * Throws SerializationError on invalid doc or invariant violations.
 */

import { SerializationError } from './serialization-error';
import { checkInvariants } from '../validation/invariants';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset, createGeneratorAsset, toAssetId } from '../types/asset';
import { createEffect, toEffectId } from '../types/effect';
import { toFrame, frameRate } from '../types/frame';
import { toMarkerId } from '../types/marker';
import { toGeneratorId, type GeneratorType } from '../types/generator';
import type { TimelineState, AssetRegistry } from '../types/state';
import type { Clip } from '../types/clip';
import type { Marker } from '../types/marker';
import type { Asset, AssetId } from '../types/asset';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type OTIOImportOptions = {
  /** Override fps; default: from doc global_start_time.rate or first clip rate, fallback 30 */
  fps?: number;
  /** Override timeline name */
  name?: string;
};

// ---------------------------------------------------------------------------
// OTIO shape (minimal for parsing)
// ---------------------------------------------------------------------------

type OTIORationalTime = { value: number; rate: number };
type OTIOTimeRange = {
  start_time?: OTIORationalTime;
  duration?: OTIORationalTime;
};
type OTIOMediaRef = {
  OTIO_SCHEMA?: string;
  target_url?: string;
  available_range?: OTIOTimeRange;
  generator_kind?: string;
};
type OTIOItem = {
  OTIO_SCHEMA?: string;
  name?: string;
  source_range?: OTIOTimeRange;
  media_reference?: OTIOMediaRef;
  effects?: Array<{ name?: string; effect_name?: string; enabled?: boolean; metadata?: { params?: unknown[] } }>;
};
type OTIOTrack = { OTIO_SCHEMA?: string; kind?: string; children?: OTIOItem[] };
type OTIODoc = {
  OTIO_SCHEMA?: string;
  name?: string;
  global_start_time?: OTIORationalTime;
  tracks?: { children?: OTIOTrack[] };
  markers?: Array<{
    name?: string;
    color?: string;
    marked_range?: OTIOTimeRange;
  }>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let clipIdCounter = 0;
function generateClipId(): string {
  return `clip-${++clipIdCounter}`;
}

function parseFps(doc: OTIODoc, options?: OTIOImportOptions): number {
  if (options?.fps != null) return options.fps;
  const global = doc.global_start_time;
  if (global?.rate != null) return global.rate;
  const tracks = doc.tracks?.children;
  if (tracks) {
    for (const track of tracks) {
      const children = track?.children ?? [];
      for (const item of children) {
        const sr = item?.source_range;
        if (sr?.duration?.rate != null) return sr.duration.rate;
      }
    }
  }
  return 30;
}

function rationalTimeToFrames(rt: OTIORationalTime | undefined, targetFps: number): number {
  if (!rt) return 0;
  const value = rt.value ?? 0;
  const rate = rt.rate ?? targetFps;
  return Math.round(value * (targetFps / rate));
}

function ensureFrameRate(fps: number): import('../types/frame').FrameRate {
  const valid = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
  if (!valid.includes(fps)) return 30 as import('../types/frame').FrameRate;
  return frameRate(fps);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export function importFromOTIO(doc: unknown, options?: OTIOImportOptions): TimelineState {
  if (typeof doc !== 'object' || doc === null) {
    throw new SerializationError('Invalid OTIO document');
  }
  const d = doc as OTIODoc;
  const schema = d.OTIO_SCHEMA;
  if (typeof schema !== 'string' || !schema.startsWith('Timeline')) {
    throw new SerializationError('Invalid OTIO document: OTIO_SCHEMA must be Timeline');
  }

  const targetFps = parseFps(d, options);
  const fps = ensureFrameRate(targetFps);
  const timelineName = options?.name ?? d.name ?? 'Untitled';

  const assetRegistry = new Map<AssetId, Asset>();
  const tracks: import('../types/track').Track[] = [];
  const trackList = d.tracks?.children ?? [];

  for (let ti = 0; ti < trackList.length; ti++) {
    const otioTrack = trackList[ti]!;
    const kind = otioTrack.kind ?? 'Video';
    const trackType = kind === 'Audio' ? 'audio' : 'video';
    const trackId = toTrackId(`track-${ti + 1}`);
    const clips: Clip[] = [];
    let cursorFrames = 0;
    const children = otioTrack.children ?? [];

    for (const item of children) {
      const itemSchema = item?.OTIO_SCHEMA ?? '';
      if (itemSchema === 'Gap.1') {
        const dur = item?.source_range?.duration;
        const gapFrames = rationalTimeToFrames(dur, targetFps);
        cursorFrames += gapFrames;
        continue;
      }
      if (itemSchema === 'Clip.1') {
        const sr = item.source_range;
        const durationFrames = rationalTimeToFrames(sr?.duration, targetFps);
        const mediaStartFrames = rationalTimeToFrames(sr?.start_time, targetFps);
        const clipName = item.name ?? generateClipId();
        const clipId = toClipId(clipName);
        const mediaRef = item.media_reference;
        let assetId: AssetId;
        if (mediaRef?.OTIO_SCHEMA === 'GeneratorReference.1') {
          const genKind = mediaRef.generator_kind ?? 'solid';
          const assetIdStr = `gen-${ti}-${clips.length}`;
          assetId = toAssetId(assetIdStr);
          if (!assetRegistry.has(assetId)) {
            const genAsset = createGeneratorAsset({
              id: assetIdStr,
              name: genKind,
              mediaType: trackType,
              generatorDef: {
                id: toGeneratorId(assetIdStr),
                type: (['solid', 'bars', 'countdown', 'noise', 'text'].includes(genKind) ? genKind : 'solid') as GeneratorType,
                params: {},
                duration: toFrame(Math.max(1, durationFrames)),
                name: genKind,
              },
              nativeFps: fps,
            });
            assetRegistry.set(assetId, genAsset);
          }
        } else if (mediaRef?.OTIO_SCHEMA === 'ExternalReference.1' && mediaRef.target_url != null) {
          const url = mediaRef.target_url;
          const avail = mediaRef.available_range;
          const intrinsicDuration = rationalTimeToFrames(avail?.duration, targetFps) || 1;
          const aidStr = `asset-${url}-${intrinsicDuration}`;
          assetId = toAssetId(aidStr);
          if (!assetRegistry.has(assetId)) {
            const fileAsset = createAsset({
              id: aidStr,
              name: url.split('/').pop() ?? 'media',
              mediaType: trackType,
              filePath: url,
              intrinsicDuration: toFrame(Math.max(1, intrinsicDuration)),
              nativeFps: fps,
              sourceTimecodeOffset: toFrame(0),
            });
            assetRegistry.set(assetId, fileAsset);
          }
        } else {
          const aidStr = `missing-${ti}-${clips.length}`;
          assetId = toAssetId(aidStr);
          if (!assetRegistry.has(assetId)) {
            const fileAsset = createAsset({
              id: aidStr,
              name: 'Missing',
              mediaType: trackType,
              filePath: '',
              intrinsicDuration: toFrame(Math.max(1, durationFrames)),
              nativeFps: fps,
              sourceTimecodeOffset: toFrame(0),
              status: 'missing',
            });
            assetRegistry.set(assetId, fileAsset);
          }
        }

        const timelineStart = toFrame(cursorFrames);
        const timelineEnd = toFrame(cursorFrames + durationFrames);
        const mediaIn = toFrame(mediaStartFrames);
        const mediaOut = toFrame(mediaStartFrames + durationFrames);

        let effects: Clip['effects'];
        const otioEffects = item.effects;
        if (otioEffects && otioEffects.length > 0) {
          effects = otioEffects.map((e, idx) => {
            const effectType = e.effect_name ?? e.name ?? 'effect';
            return createEffect(
              toEffectId(`eff-${clipId}-${idx}`),
              effectType,
              'preComposite',
              (e.metadata?.params as { key: string; value: number | string | boolean }[]) ?? [],
            );
          });
        }

        const clipParams: Parameters<typeof createClip>[0] = {
          id: clipId,
          assetId: assetId as unknown as string,
          trackId,
          timelineStart,
          timelineEnd,
          mediaIn,
          mediaOut,
        };
        if (effects?.length) clipParams.effects = effects;
        const clip = createClip(clipParams);
        clips.push(clip);
        cursorFrames += durationFrames;
      }
    }

    tracks.push(
      createTrack({
        id: trackId,
        name: kind === 'Audio' ? `Audio ${ti + 1}` : `Video ${ti + 1}`,
        type: trackType,
        clips,
      }),
    );
  }

  const markers: Marker[] = [];
  const otioMarkers = d.markers ?? [];
  for (let i = 0; i < otioMarkers.length; i++) {
    const m = otioMarkers[i]!;
    const range = m.marked_range;
    const startFrames = rationalTimeToFrames(range?.start_time, targetFps);
    const durationFrames = rationalTimeToFrames(range?.duration, targetFps);
    if (durationFrames <= 0) {
      markers.push({
        type: 'point',
        id: toMarkerId(`m${i + 1}`),
        frame: toFrame(startFrames),
        label: m.name ?? '',
        color: m.color ?? 'RED',
        scope: 'global',
        linkedClipId: null,
      });
    } else {
      markers.push({
        type: 'range',
        id: toMarkerId(`m${i + 1}`),
        frameStart: toFrame(startFrames),
        frameEnd: toFrame(startFrames + durationFrames),
        label: m.name ?? '',
        color: m.color ?? 'RED',
        scope: 'global',
        linkedClipId: null,
      });
    }
  }

  const timeline = createTimeline({
    id: 'tl',
    name: timelineName,
    fps,
    duration: toFrame(Math.max(1, 86400)),
    startTimecode: '00:00:00:00' as import('../types/frame').Timecode,
    tracks,
    markers,
  });

  const state = createTimelineState({
    timeline,
    assetRegistry: assetRegistry as AssetRegistry,
  });

  const violations = checkInvariants(state);
  if (violations.length > 0) {
    throw new SerializationError('OTIO import produced invalid state', violations);
  }
  return state;
}
