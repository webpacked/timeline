/**
 * Phase 5 Step 3 — EDL export
 *
 * CMX3600 EDL, single video track. Pure function, no IO.
 */

import { describe, it, expect } from 'vitest';
import { exportToEDL, frameToTimecode, reelName, type EDLExportOptions } from '../engine/edl-export';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset, createGeneratorAsset } from '../types/asset';
import { toGeneratorId } from '../types/generator';
import { createTransition, toTransitionId } from '../types/transition';
import { toFrame, toTimecode } from '../types/frame';
import { applyOperation } from '../engine/apply';

// ── Fixture: 30fps, one video track, three clips (no gaps), one with dissolve ──

function makeEDLFixtureState() {
  const asset1 = createAsset({
    id: 'asset-1',
    name: 'A1',
    mediaType: 'video',
    filePath: '/path/to/my-clip.mp4',
    intrinsicDuration: toFrame(300),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });
  const asset2 = createAsset({
    id: 'asset-2',
    name: 'A2',
    mediaType: 'video',
    filePath: '/reels/longfilename.mp4',
    intrinsicDuration: toFrame(300),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });
  const clip1 = createClip({
    id: 'clip-1',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const clip2 = createClip({
    id: 'clip-2',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(100),
    timelineEnd: toFrame(200),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const clip3 = createClip({
    id: 'clip-3',
    assetId: 'asset-2',
    trackId: 'track-1',
    timelineStart: toFrame(200),
    timelineEnd: toFrame(300),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const track = createTrack({
    id: 'track-1',
    name: 'V1',
    type: 'video',
    clips: [clip1, clip2, clip3],
  });
  const timeline = createTimeline({
    id: 'tl',
    name: 'My Timeline',
    fps: 30,
    duration: toFrame(1000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  let state = createTimelineState({
    timeline,
    assetRegistry: new Map([
      [asset1.id, asset1],
      [asset2.id, asset2],
    ]),
  });
  const trans = createTransition(toTransitionId('tr-1'), 'dissolve', 10);
  state = applyOperation(state, { type: 'ADD_TRANSITION', clipId: toClipId('clip-2'), transition: trans });
  return state;
}

describe('Phase 5 — EDL Export', () => {
  it('output starts with TITLE:', () => {
    const state = makeEDLFixtureState();
    const edl = exportToEDL(state);
    expect(edl.startsWith('TITLE:')).toBe(true);
  });

  it('output contains FCM: NON-DROP FRAME', () => {
    const state = makeEDLFixtureState();
    const edl = exportToEDL(state);
    expect(edl).toContain('FCM: NON-DROP FRAME');
  });

  it('event count matches clip count', () => {
    const state = makeEDLFixtureState();
    const edl = exportToEDL(state);
    const eventLines = edl.split('\n').filter((l) => /^\d{3}\s+/.test(l));
    expect(eventLines.length).toBe(3);
  });

  it('event numbers are zero-padded (001, 002, 003)', () => {
    const state = makeEDLFixtureState();
    const edl = exportToEDL(state);
    expect(edl).toContain('001 ');
    expect(edl).toContain('002 ');
    expect(edl).toContain('003 ');
  });

  it('reel name derived from asset filename (truncated, uppercased, max 8 chars)', () => {
    const state = makeEDLFixtureState();
    const edl = exportToEDL(state);
    expect(edl).toContain('MY-CLIP');
    expect(edl).toMatch(/LONGFILE/);
  });

  it('GeneratorAsset clip uses reel AX', () => {
    const genAsset = createGeneratorAsset({
      id: 'gen-1',
      name: 'Solid',
      mediaType: 'video',
      generatorDef: {
        id: toGeneratorId('gen-1'),
        type: 'solid',
        params: {},
        duration: toFrame(60),
        name: 'S',
      },
      nativeFps: 30,
    });
    const clip = createClip({
      id: 'cgen',
      assetId: 'gen-1',
      trackId: 'track-1',
      timelineStart: toFrame(0),
      timelineEnd: toFrame(30),
      mediaIn: toFrame(0),
      mediaOut: toFrame(30),
    });
    const track = createTrack({ id: 'track-1', name: 'V', type: 'video', clips: [clip] });
    const timeline = createTimeline({
      id: 'tl',
      name: 'T',
      fps: 30,
      duration: toFrame(100),
      startTimecode: toTimecode('00:00:00:00'),
      tracks: [track],
    });
    const state = createTimelineState({
      timeline,
      assetRegistry: new Map([[genAsset.id, genAsset]]),
    });
    const edl = exportToEDL(state);
    expect(edl).toContain('AX ');
  });

  it('clip with dissolve transition uses D not C', () => {
    const state = makeEDLFixtureState();
    const edl = exportToEDL(state);
    const lines = edl.split('\n');
    const event2 = lines.find((l) => l.startsWith('002 '));
    expect(event2).toContain('D ');
  });

  it('srcIn timecode matches clip.mediaIn at 30fps', () => {
    const state = makeEDLFixtureState();
    const edl = exportToEDL(state);
    expect(edl).toContain('00:00:00:00');
  });

  it('recIn timecode matches clip.timelineStart at 30fps', () => {
    const state = makeEDLFixtureState();
    const edl = exportToEDL(state);
    expect(edl).toContain('00:00:00:00');
    expect(edl).toContain('00:00:03:10');
    expect(edl).toContain('00:00:06:20');
  });

  it('srcOut = srcIn + durationFrames', () => {
    const state = makeEDLFixtureState();
    const clip = state.timeline.tracks[0]!.clips[0]!;
    const dur = (clip.timelineEnd - clip.timelineStart) as number;
    const edl = exportToEDL(state);
    const firstEvent = edl.split('\n').find((l) => l.startsWith('001 '))!;
    expect(firstEvent).toContain('00:00:00:00');
    expect(firstEvent).toContain('00:00:03:10');
  });

  it('recOut = recIn + durationFrames', () => {
    const state = makeEDLFixtureState();
    const edl = exportToEDL(state);
    const firstEvent = edl.split('\n').find((l) => l.startsWith('001 '))!;
    expect(firstEvent).toContain('00:00:00:00 00:00:03:10 00:00:00:00 00:00:03:10');
  });

  it('comment line * FROM CLIP NAME: present per event', () => {
    const state = makeEDLFixtureState();
    const edl = exportToEDL(state);
    const comments = edl.split('\n').filter((l) => l.startsWith('* FROM CLIP NAME:'));
    expect(comments.length).toBe(3);
  });

  it('options.title overrides timeline name', () => {
    const state = makeEDLFixtureState();
    const edl = exportToEDL(state, { title: 'Custom Title' });
    expect(edl.startsWith('TITLE: Custom Title')).toBe(true);
  });

  it('options.trackIndex selects correct track', () => {
    const state = makeEDLFixtureState();
    const track2 = createTrack({
      id: 'track-2',
      name: 'V2',
      type: 'video',
      clips: [
        createClip({
          id: 'only',
          assetId: 'asset-1',
          trackId: 'track-2',
          timelineStart: toFrame(0),
          timelineEnd: toFrame(50),
          mediaIn: toFrame(0),
          mediaOut: toFrame(50),
        }),
      ],
    });
    const timeline = createTimeline({
      id: 'tl',
      name: 'T',
      fps: 30,
      duration: toFrame(1000),
      startTimecode: toTimecode('00:00:00:00'),
      tracks: [state.timeline.tracks[0]!, track2],
    });
    const state2 = createTimelineState({
      timeline,
      assetRegistry: state.assetRegistry,
    });
    const edl0 = exportToEDL(state2, { trackIndex: 0 });
    const edl1 = exportToEDL(state2, { trackIndex: 1 });
    const events0 = edl0.split('\n').filter((l) => /^\d{3}\s+/.test(l));
    const events1 = edl1.split('\n').filter((l) => /^\d{3}\s+/.test(l));
    expect(events0.length).toBe(3);
    expect(events1.length).toBe(1);
  });
});

describe('Phase 5 — frameToTimecode', () => {
  it('frame 0 → 00:00:00:00', () => {
    expect(frameToTimecode(0, 30, false)).toBe('00:00:00:00');
  });

  it('frame 90 at 30fps → 00:00:03:00', () => {
    expect(frameToTimecode(90, 30, false)).toBe('00:00:03:00');
  });

  it('frame 1800 at 30fps → 00:01:00:00', () => {
    expect(frameToTimecode(1800, 30, false)).toBe('00:01:00:00');
  });
});

describe('Phase 5 — EDL dropFrame fallback', () => {
  it('dropFrame fallback comment when fps != 29.97', () => {
    const state = makeEDLFixtureState();
    const edl = exportToEDL(state, { dropFrame: true });
    expect(edl).toContain('* DROP FRAME NOT SUPPORTED FOR THIS FRAME RATE');
  });
});
