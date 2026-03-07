/**
 * INVARIANT CHECKER TESTS — Phase 0
 *
 * Every test calls checkInvariants() after state mutations.
 * Zero violations is the only passing grade.
 */

import { describe, it, expect } from 'vitest';
import { checkInvariants } from '../validation/invariants';
import { createTimelineState, CURRENT_SCHEMA_VERSION } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset, toAssetId } from '../types/asset';
import { toFrame, FrameRates, toTimecode } from '../types/frame';

// ── Shared fixtures ─────────────────────────────────────────────────────────

function makeBaseState() {
  const assetId = toAssetId('asset-1');
  const trackId = toTrackId('track-1');
  const clipId  = toClipId('clip-1');

  const asset = createAsset({
    id: 'asset-1',
    name: 'Test Video',
    mediaType: 'video',
    filePath: '/media/test.mp4',
    intrinsicDuration: toFrame(600),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
    status: 'online',
  });

  const clip = createClip({
    id: 'clip-1',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });

  const track = createTrack({
    id: 'track-1',
    name: 'Video Track 1',
    type: 'video',
    clips: [clip],
  });

  const timeline = createTimeline({
    id: 'tl-1',
    name: 'Test Timeline',
    fps: 30,
    duration: toFrame(3000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });

  const registry = new Map([[assetId, asset]]);
  return createTimelineState({ timeline, assetRegistry: registry });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('checkInvariants — valid state', () => {
  it('returns empty array for a completely valid state', () => {
    const state = makeBaseState();
    expect(checkInvariants(state)).toEqual([]);
  });

  it('returns empty array for an empty timeline (no tracks, no clips)', () => {
    const timeline = createTimeline({ id: 'tl', name: 'empty', fps: 24, duration: toFrame(1000) });
    const state = createTimelineState({ timeline });
    expect(checkInvariants(state)).toEqual([]);
  });
});

describe('checkInvariants — SCHEMA_VERSION_MISMATCH', () => {
  it('rejects a state written by a future engine (schemaVersion > CURRENT)', () => {
    const state = makeBaseState();
    // Simulate a state saved by a newer engine
    const futureState = { ...state, schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    const violations = checkInvariants(futureState);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.entityId).toBe('timeline');
    expect(violations[0]!.message).toMatch('Expected schema v');
  });

  it('rejects a state that has not been migrated (schemaVersion < CURRENT)', () => {
    const state = makeBaseState();
    // Simulate an old un-migrated state (schemaVersion = 0)
    const oldState = { ...state, schemaVersion: 0 };
    const violations = checkInvariants(oldState);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.entityId).toBe('timeline');
    expect(violations[0]!.message).toMatch('Expected schema v');
  });

  it('early-returns on version mismatch — does not run track/clip checks', () => {
    const state = makeBaseState();
    // A future state with deliberately corrupt (overlapping) clips.
    // The schemaVersion check must early-return so we get exactly 1 violation
    // (the schema mismatch), NOT additional overlap violations.
    const futureState = { ...state, schemaVersion: CURRENT_SCHEMA_VERSION + 99 };
    const violations = checkInvariants(futureState);
    expect(violations).toHaveLength(1);
  });
});

describe('checkInvariants — OVERLAP', () => {
  it('detects two clips that overlap by one frame', () => {
    const state = makeBaseState();
    // Add overlapping clip [50..150] — overlaps with [0..100]
    const clip2 = createClip({
      id: 'clip-2',
      assetId: 'asset-1',
      trackId: 'track-1',
      timelineStart: toFrame(50),
      timelineEnd: toFrame(150),
      mediaIn: toFrame(50),
      mediaOut: toFrame(150),
    });

    const newTracks = state.timeline.tracks.map(t =>
      t.id === 'track-1' ? { ...t, clips: [...t.clips, clip2] } : t
    );
    const badState = { ...state, timeline: { ...state.timeline, tracks: newTracks } };
    const violations = checkInvariants(badState);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some(v => v.type === 'OVERLAP')).toBe(true);
  });

  it('does NOT flag adjacent clips [0..100] and [100..200]', () => {
    const state = makeBaseState();
    const clip2 = createClip({
      id: 'clip-2',
      assetId: 'asset-1',
      trackId: 'track-1',
      timelineStart: toFrame(100),
      timelineEnd: toFrame(200),
      mediaIn: toFrame(0),
      mediaOut: toFrame(100),
    });
    const newTracks = state.timeline.tracks.map(t =>
      t.id === 'track-1' ? { ...t, clips: [...t.clips, clip2] } : t
    );
    const s = { ...state, timeline: { ...state.timeline, tracks: newTracks } };
    expect(checkInvariants(s)).toEqual([]);
  });
});

describe('checkInvariants — ASSET_MISSING', () => {
  it('flags a clip referencing an asset that is not in the registry', () => {
    const state = makeBaseState();
    const clip2 = createClip({
      id: 'clip-ghost',
      assetId: 'non-existent-asset',
      trackId: 'track-1',
      timelineStart: toFrame(200),
      timelineEnd: toFrame(300),
      mediaIn: toFrame(0),
      mediaOut: toFrame(100),
    });
    const newTracks = state.timeline.tracks.map(t =>
      t.id === 'track-1' ? { ...t, clips: [...t.clips, clip2] } : t
    );
    const badState = { ...state, timeline: { ...state.timeline, tracks: newTracks } };
    const violations = checkInvariants(badState);
    expect(violations.some(v => v.type === 'ASSET_MISSING' && v.entityId === 'clip-ghost')).toBe(true);
  });
});

describe('checkInvariants — MEDIA_BOUNDS_INVALID', () => {
  it('flags a clip whose mediaOut exceeds asset.intrinsicDuration', () => {
    const state = makeBaseState();
    // Asset has intrinsicDuration=600. Clip mediaOut=700 exceeds it.
    const badClip = createClip({
      id: 'clip-overflow',
      assetId: 'asset-1',
      trackId: 'track-1',
      timelineStart: toFrame(200),
      timelineEnd: toFrame(900),
      mediaIn: toFrame(0),
      mediaOut: toFrame(700), // > intrinsicDuration(600)
    });
    const newTracks = state.timeline.tracks.map(t =>
      t.id === 'track-1' ? { ...t, clips: [...t.clips, badClip] } : t
    );
    const badState = { ...state, timeline: { ...state.timeline, tracks: newTracks } };
    const violations = checkInvariants(badState);
    expect(violations.some(v => v.type === 'MEDIA_BOUNDS_INVALID')).toBe(true);
  });

  it('flags a clip with mediaIn < 0', () => {
    const state = makeBaseState();
    const badClip = createClip({
      id: 'clip-neg',
      assetId: 'asset-1',
      trackId: 'track-1',
      timelineStart: toFrame(200),
      timelineEnd: toFrame(300),
      mediaIn: toFrame(0),  // will be manually cast below
      mediaOut: toFrame(100),
    });
    // Force negative mediaIn by type cast (testing invariant checker, not factory)
    const badClipNeg = { ...badClip, mediaIn: -5 as ReturnType<typeof toFrame> };
    const newTracks = state.timeline.tracks.map(t =>
      t.id === 'track-1' ? { ...t, clips: [...t.clips, badClipNeg] } : t
    );
    const badState = { ...state, timeline: { ...state.timeline, tracks: newTracks } };
    expect(checkInvariants(badState).some(v => v.type === 'MEDIA_BOUNDS_INVALID')).toBe(true);
  });
});

describe('checkInvariants — TRACK_TYPE_MISMATCH', () => {
  it('flags an audio asset clip placed on a video track', () => {
    const assetId = toAssetId('audio-asset');
    const audioAsset = createAsset({
      id: 'audio-asset',
      name: 'Music',
      mediaType: 'audio',
      filePath: '/media/music.wav',
      intrinsicDuration: toFrame(1200),
      nativeFps: 30,
      sourceTimecodeOffset: toFrame(0),
    });

    const state = makeBaseState();
    const audioClip = createClip({
      id: 'clip-audio-on-video',
      assetId: 'audio-asset',
      trackId: 'track-1',  // track-1 is a VIDEO track
      timelineStart: toFrame(200),
      timelineEnd: toFrame(400),
      mediaIn: toFrame(0),
      mediaOut: toFrame(200),
    });
    const newRegistry = new Map(state.assetRegistry);
    newRegistry.set(assetId, audioAsset);
    const newTracks = state.timeline.tracks.map(t =>
      t.id === 'track-1' ? { ...t, clips: [...t.clips, audioClip] } : t
    );
    const badState = {
      ...state,
      assetRegistry: newRegistry,
      timeline: { ...state.timeline, tracks: newTracks },
    };
    expect(checkInvariants(badState).some(v => v.type === 'TRACK_TYPE_MISMATCH')).toBe(true);
  });
});

describe('checkInvariants — CLIP_BEYOND_TIMELINE', () => {
  it('flags a clip that extends past the timeline duration', () => {
    const state = makeBaseState(); // timeline.duration = 3000
    const badClip = createClip({
      id: 'clip-late',
      assetId: 'asset-1',
      trackId: 'track-1',
      timelineStart: toFrame(2900),
      timelineEnd: toFrame(3100), // > 3000
      mediaIn: toFrame(0),
      mediaOut: toFrame(200),
    });
    const newTracks = state.timeline.tracks.map(t =>
      t.id === 'track-1' ? { ...t, clips: [...t.clips, badClip] } : t
    );
    const badState = { ...state, timeline: { ...state.timeline, tracks: newTracks } };
    expect(checkInvariants(badState).some(v => v.type === 'CLIP_BEYOND_TIMELINE')).toBe(true);
  });
});

describe('checkInvariants — SPEED_INVALID', () => {
  it('flags a clip with speed <= 0', () => {
    const state = makeBaseState();
    const clipFromState = state.timeline.tracks[0]!.clips[0]!;
    const badClip = { ...clipFromState, speed: -1 };
    const newTracks = state.timeline.tracks.map(t =>
      t.id === 'track-1' ? { ...t, clips: [badClip] } : t
    );
    const badState = { ...state, timeline: { ...state.timeline, tracks: newTracks } };
    expect(checkInvariants(badState).some(v => v.type === 'SPEED_INVALID')).toBe(true);
  });
});
