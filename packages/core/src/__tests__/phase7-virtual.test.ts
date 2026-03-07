/**
 * Phase 7 Step 2 — Virtual window and StateChange diff
 */

import { describe, it, expect } from 'vitest';
import { toFrame } from '../types/frame';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset } from '../types/asset';
import { toTimecode } from '../types/frame';
import type { TimelineState } from '../types/state';
import {
  getVisibleClips,
  getVisibleFrameRange,
} from '../engine/virtual-window';
import { diffStates } from '../types/state-change';

const FPS = 30;

function makeFixtureState(): TimelineState {
  const trackId = toTrackId('v1');
  const trackId2 = toTrackId('v2');
  const asset = createAsset({
    id: 'a1',
    name: 'V',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(2000),
    nativeFps: FPS,
    sourceTimecodeOffset: toFrame(0),
  });
  const clip1 = createClip({
    id: toClipId('c1'),
    assetId: asset.id,
    trackId,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(200),
    mediaIn: toFrame(0),
    mediaOut: toFrame(200),
  });
  const clip2 = createClip({
    id: toClipId('c2'),
    assetId: asset.id,
    trackId,
    timelineStart: toFrame(200),
    timelineEnd: toFrame(400),
    mediaIn: toFrame(0),
    mediaOut: toFrame(200),
  });
  const clip3 = createClip({
    id: toClipId('c3'),
    assetId: asset.id,
    trackId: trackId2,
    timelineStart: toFrame(100),
    timelineEnd: toFrame(300),
    mediaIn: toFrame(0),
    mediaOut: toFrame(200),
  });
  const t1 = createTrack({ id: trackId, name: 'V1', type: 'video', clips: [clip1, clip2] });
  const t2 = createTrack({ id: trackId2, name: 'V2', type: 'video', clips: [clip3] });
  const timeline = createTimeline({
    id: 'tl',
    name: 'Virtual',
    fps: FPS,
    duration: toFrame(900),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [t1, t2],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[asset.id, asset]]) });
}

describe('Phase 7 — getVisibleClips', () => {
  it('9. Returns all clips with isVisible flag set', () => {
    const state = makeFixtureState();
    const window = {
      startFrame: toFrame(0),
      endFrame: toFrame(500),
      pixelsPerFrame: 2,
    };
    const entries = getVisibleClips(state, window);
    expect(entries.length).toBe(3);
    entries.forEach((e) => {
      expect(typeof e.isVisible).toBe('boolean');
    });
  });

  it('10. Clip fully inside window: isVisible true', () => {
    const state = makeFixtureState();
    const window = {
      startFrame: toFrame(0),
      endFrame: toFrame(500),
      pixelsPerFrame: 2,
    };
    const entries = getVisibleClips(state, window);
    const c1 = entries.find((e) => e.clip.id === toClipId('c1'));
    expect(c1?.isVisible).toBe(true);
  });

  it('11. Clip fully outside window: isVisible false', () => {
    const state = makeFixtureState();
    const window = {
      startFrame: toFrame(500),
      endFrame: toFrame(700),
      pixelsPerFrame: 2,
    };
    const entries = getVisibleClips(state, window);
    const c1 = entries.find((e) => e.clip.id === toClipId('c1'));
    expect(c1?.isVisible).toBe(false);
  });

  it('12. Clip partially overlapping left edge: isVisible true', () => {
    const state = makeFixtureState();
    const window = {
      startFrame: toFrame(100),
      endFrame: toFrame(300),
      pixelsPerFrame: 2,
    };
    const entries = getVisibleClips(state, window);
    const c1 = entries.find((e) => e.clip.id === toClipId('c1'));
    expect(c1?.isVisible).toBe(true);
  });

  it('13. Clip partially overlapping right edge: isVisible true', () => {
    const state = makeFixtureState();
    const window = {
      startFrame: toFrame(0),
      endFrame: toFrame(150),
      pixelsPerFrame: 2,
    };
    const entries = getVisibleClips(state, window);
    const c1 = entries.find((e) => e.clip.id === toClipId('c1'));
    expect(c1?.isVisible).toBe(true);
  });

  it('14. left px computed correctly for clip at frame 100 with pixelsPerFrame 2', () => {
    const state = makeFixtureState();
    const window = {
      startFrame: toFrame(50),
      endFrame: toFrame(400),
      pixelsPerFrame: 2,
    };
    const entries = getVisibleClips(state, window);
    const c3 = entries.find((e) => e.clip.id === toClipId('c3'));
    expect(c3).toBeDefined();
    expect(c3!.clip.timelineStart).toEqual(toFrame(100));
    expect(c3!.left).toBe((100 - 50) * 2);
  });

  it('15. width computed correctly: durationFrames * ppf', () => {
    const state = makeFixtureState();
    const window = {
      startFrame: toFrame(0),
      endFrame: toFrame(500),
      pixelsPerFrame: 3,
    };
    const entries = getVisibleClips(state, window);
    const c1 = entries.find((e) => e.clip.id === toClipId('c1'));
    expect(c1!.width).toBe(200 * 3);
  });

  it('16. Results sorted by trackIndex then startFrame', () => {
    const state = makeFixtureState();
    const window = {
      startFrame: toFrame(0),
      endFrame: toFrame(500),
      pixelsPerFrame: 1,
    };
    const entries = getVisibleClips(state, window);
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1]!;
      const curr = entries[i]!;
      expect(
        prev.trackIndex < curr.trackIndex ||
          (prev.trackIndex === curr.trackIndex &&
            (prev.clip.timelineStart as number) <= (curr.clip.timelineStart as number)),
      ).toBe(true);
    }
  });
});

describe('Phase 7 — getVisibleFrameRange', () => {
  it('17. Correct startFrame from scrollLeft + ppf', () => {
    const win = getVisibleFrameRange(100, 50, 2);
    expect(win.startFrame).toEqual(toFrame(Math.floor(50 / 2)));
    expect((win.startFrame as number)).toBe(25);
  });

  it('18. Correct endFrame from scrollLeft + width + ppf', () => {
    const win = getVisibleFrameRange(100, 50, 2);
    expect(win.endFrame).toEqual(toFrame(Math.ceil((50 + 100) / 2)));
    expect((win.endFrame as number)).toBe(75);
  });

  it('19. Returns VirtualWindow with pixelsPerFrame', () => {
    const win = getVisibleFrameRange(200, 0, 4);
    expect(win.pixelsPerFrame).toBe(4);
  });
});

describe('Phase 7 — diffStates', () => {
  it('20. Identical state reference → all false, empty set', () => {
    const state = makeFixtureState();
    const diff = diffStates(state, state);
    expect(diff.trackIds).toBe(false);
    expect(diff.clipIds.size).toBe(0);
    expect(diff.markers).toBe(false);
    expect(diff.timeline).toBe(false);
    expect(diff.playhead).toBe(false);
  });

  it('21. Adding a clip → clipIds contains new clipId', () => {
    const state = makeFixtureState();
    const newClip = createClip({
      id: toClipId('c-new'),
      assetId: state.timeline.tracks[0]!.clips[0]!.assetId,
      trackId: toTrackId('v1'),
      timelineStart: toFrame(400),
      timelineEnd: toFrame(500),
      mediaIn: toFrame(0),
      mediaOut: toFrame(100),
    });
    const newTrack = createTrack({
      id: toTrackId('v1'),
      name: 'V1',
      type: 'video',
      clips: [...state.timeline.tracks[0]!.clips, newClip],
    });
    const newTimeline = createTimeline({
      ...state.timeline,
      tracks: [newTrack, state.timeline.tracks[1]!],
    });
    const next = createTimelineState({
      timeline: newTimeline,
      assetRegistry: state.assetRegistry,
    });
    const diff = diffStates(state, next);
    expect(diff.clipIds.has(toClipId('c-new'))).toBe(true);
  });

  it('22. Modifying a clip → clipIds contains that clipId', () => {
    const state = makeFixtureState();
    const track = state.timeline.tracks[0]!;
    const modifiedClip = { ...track.clips[0]!, name: 'Renamed' };
    const newTrack = createTrack({
      ...track,
      clips: [modifiedClip, track.clips[1]!],
    });
    const newTimeline = createTimeline({
      ...state.timeline,
      tracks: [newTrack, state.timeline.tracks[1]!],
    });
    const next = createTimelineState({
      timeline: newTimeline,
      assetRegistry: state.assetRegistry,
    });
    const diff = diffStates(state, next);
    expect(diff.clipIds.has(track.clips[0]!.id)).toBe(true);
  });

  it('23. Removing a clip → clipIds contains removed clipId', () => {
    const state = makeFixtureState();
    const track = state.timeline.tracks[0]!;
    const removedId = track.clips[0]!.id;
    const newTrack = createTrack({
      ...track,
      clips: [track.clips[1]!],
    });
    const newTimeline = createTimeline({
      ...state.timeline,
      tracks: [newTrack, state.timeline.tracks[1]!],
    });
    const next = createTimelineState({
      timeline: newTimeline,
      assetRegistry: state.assetRegistry,
    });
    const diff = diffStates(state, next);
    expect(diff.clipIds.has(removedId)).toBe(true);
  });

  it('24. Changing track order → trackIds: true', () => {
    const state = makeFixtureState();
    const newTimeline = createTimeline({
      ...state.timeline,
      tracks: [state.timeline.tracks[1]!, state.timeline.tracks[0]!],
    });
    const next = createTimelineState({
      timeline: newTimeline,
      assetRegistry: state.assetRegistry,
    });
    const diff = diffStates(state, next);
    expect(diff.trackIds).toBe(true);
  });

  it('25. Changing markers → markers: true', () => {
    const state = makeFixtureState();
    const newTimeline = createTimeline({
      ...state.timeline,
      markers: [],
    });
    const next = createTimelineState({
      timeline: newTimeline,
      assetRegistry: state.assetRegistry,
    });
    const diff = diffStates(state, next);
    expect(diff.markers).toBe(true);
  });

  it('26. Changing timeline duration → timeline: true', () => {
    const state = makeFixtureState();
    const newTimeline = createTimeline({
      ...state.timeline,
      duration: toFrame(1000),
    });
    const next = createTimelineState({
      timeline: newTimeline,
      assetRegistry: state.assetRegistry,
    });
    const diff = diffStates(state, next);
    expect(diff.timeline).toBe(true);
  });

  it('27. Same clips, same tracks → clipIds empty, trackIds false', () => {
    const state = makeFixtureState();
    const next = createTimelineState({
      timeline: state.timeline,
      assetRegistry: state.assetRegistry,
    });
    const diff = diffStates(state, next);
    expect(diff.clipIds.size).toBe(0);
    expect(diff.trackIds).toBe(false);
  });
});
