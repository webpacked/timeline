import {
  createTimelineState,
  createTimeline,
  createTrack,
  createClip,
  createAsset,
  toTrackId,
  toClipId,
  toAssetId,
  toFrame,
  frameRate,
} from '@timeline/core';
import type { AssetRegistry } from '@timeline/core';

const fps = 30 as const;
const duration = toFrame(fps * 120); // 2 minutes

export function buildMockState() {
  const assetMap = new Map<string, import('@timeline/core').Asset>();

  function addAsset(
    id: string,
    name: string,
    dur: number,
    mediaType: 'video' | 'audio',
  ) {
    const asset = createAsset({
      id,
      name,
      mediaType,
      filePath: `generator://${id}`,
      intrinsicDuration: toFrame(dur),
      nativeFps: frameRate(fps),
      sourceTimecodeOffset: toFrame(0),
    });
    assetMap.set(id, asset);
  }

  const clips_v1 = [
    { id: 'c1', start: 0, dur: 90, label: 'Intro' },
    { id: 'c2', start: 100, dur: 120, label: 'Scene 1' },
    { id: 'c3', start: 230, dur: 80, label: 'Scene 2' },
    { id: 'c4', start: 320, dur: 150, label: 'Scene 3' },
  ].map((c) => {
    const aid = `asset-${c.id}`;
    addAsset(aid, c.label, c.dur, 'video');
    return createClip({
      id: toClipId(c.id),
      assetId: toAssetId(aid),
      trackId: toTrackId('v1'),
      timelineStart: toFrame(c.start),
      timelineEnd: toFrame(c.start + c.dur),
      mediaIn: toFrame(0),
      mediaOut: toFrame(c.dur),
      name: c.label,
    });
  });

  const clips_v2 = [
    { id: 'c5', start: 50, dur: 60, label: 'B-Roll 1' },
    { id: 'c6', start: 200, dur: 100, label: 'B-Roll 2' },
  ].map((c) => {
    const aid = `asset-${c.id}`;
    addAsset(aid, c.label, c.dur, 'video');
    return createClip({
      id: toClipId(c.id),
      assetId: toAssetId(aid),
      trackId: toTrackId('v2'),
      timelineStart: toFrame(c.start),
      timelineEnd: toFrame(c.start + c.dur),
      mediaIn: toFrame(0),
      mediaOut: toFrame(c.dur),
      name: c.label,
    });
  });

  const clips_a1 = [{ id: 'c7', start: 0, dur: 300, label: 'Music' }].map(
    (c) => {
      const aid = `asset-${c.id}`;
      addAsset(aid, c.label, c.dur, 'audio');
      return createClip({
        id: toClipId(c.id),
        assetId: toAssetId(aid),
        trackId: toTrackId('a1'),
        timelineStart: toFrame(c.start),
        timelineEnd: toFrame(c.start + c.dur),
        mediaIn: toFrame(0),
        mediaOut: toFrame(c.dur),
        name: c.label,
      });
    },
  );

  const clips_a2 = [
    { id: 'c8', start: 10, dur: 80, label: 'SFX 1' },
    { id: 'c9', start: 150, dur: 60, label: 'SFX 2' },
  ].map((c) => {
    const aid = `asset-${c.id}`;
    addAsset(aid, c.label, c.dur, 'audio');
    return createClip({
      id: toClipId(c.id),
      assetId: toAssetId(aid),
      trackId: toTrackId('a2'),
      timelineStart: toFrame(c.start),
      timelineEnd: toFrame(c.start + c.dur),
      mediaIn: toFrame(0),
      mediaOut: toFrame(c.dur),
      name: c.label,
    });
  });

  const v1 = createTrack({ id: 'v1', name: 'Video 1', type: 'video', clips: clips_v1 });
  const v2 = createTrack({ id: 'v2', name: 'Video 2', type: 'video', clips: clips_v2 });
  const a1 = createTrack({ id: 'a1', name: 'Audio 1', type: 'audio', clips: clips_a1 });
  const a2 = createTrack({ id: 'a2', name: 'Audio 2', type: 'audio', clips: clips_a2 });

  const timeline = createTimeline({
    id: 'tl-1',
    name: 'Demo',
    fps: frameRate(fps),
    duration,
    tracks: [v1, v2, a1, a2],
  });

  return createTimelineState({
    timeline,
    assetRegistry: assetMap as unknown as AssetRegistry,
  });
}
