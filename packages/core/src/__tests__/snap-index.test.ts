/**
 * SNAP INDEX TESTS — Phase 1
 *
 * Gate conditions (all must pass before Step 2):
 * ✓ 3 clips → 6 points (ClipStart + ClipEnd each)
 * ✓ Points sorted ascending by frame
 * ✓ nearest() snaps within radius, returns null outside
 * ✓ nearest() respects exclusion list (sourceId)
 * ✓ nearest() respects allowedTypes filter
 * ✓ Priority tiebreak: Marker (100) beats ClipStart (80) at same frame
 * ✓ toggleSnap(index, false) → nearest() always returns null
 */

import { describe, it, expect } from 'vitest';
import {
  buildSnapIndex,
  nearest,
  toggleSnap,
  type SnapPoint,
  type SnapIndex,
} from '../snap-index';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset, toAssetId } from '../types/asset';
import { toFrame, toTimecode } from '../types/frame';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeStateWithClips(clips: Array<{ id: string; start: number; end: number }>) {
  const assetId = toAssetId('asset-1');
  const asset = createAsset({
    id: 'asset-1', name: 'A', mediaType: 'video',
    filePath: '/a.mp4', intrinsicDuration: toFrame(10000),
    nativeFps: 30, sourceTimecodeOffset: toFrame(0),
  });

  const trackClips = clips.map(({ id, start, end }) =>
    createClip({
      id, assetId: 'asset-1', trackId: 'track-1',
      timelineStart: toFrame(start), timelineEnd: toFrame(end),
      mediaIn: toFrame(0), mediaOut: toFrame(end - start),
    })
  );

  const track = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: trackClips });
  const timeline = createTimeline({
    id: 'tl', name: 'T', fps: 30, duration: toFrame(9000),
    startTimecode: toTimecode('00:00:00:00'), tracks: [track],
  });

  return createTimelineState({ timeline, assetRegistry: new Map([[assetId, asset]]) });
}

// ── buildSnapIndex ────────────────────────────────────────────────────────────

describe('buildSnapIndex — point generation', () => {
  it('3 clips produce 6 clip boundary points + 1 playhead = 7 total', () => {
    const state = makeStateWithClips([
      { id: 'c1', start: 0,   end: 100 },
      { id: 'c2', start: 200, end: 300 },
      { id: 'c3', start: 400, end: 500 },
    ]);

    const index = buildSnapIndex(state, toFrame(150));
    // 6 clip boundaries + 1 playhead
    expect(index.points.length).toBe(7);

    const types = index.points.map(p => p.type);
    expect(types.filter(t => t === 'ClipStart').length).toBe(3);
    expect(types.filter(t => t === 'ClipEnd').length).toBe(3);
    expect(types.filter(t => t === 'Playhead').length).toBe(1);
  });

  it('points are sorted ascending by frame', () => {
    const state = makeStateWithClips([
      { id: 'c1', start: 400, end: 500 },
      { id: 'c2', start: 0,   end: 100 },
      { id: 'c3', start: 200, end: 300 },
    ]);

    const index = buildSnapIndex(state, toFrame(999));
    const frames = index.points.map(p => p.frame);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]).toBeGreaterThanOrEqual(frames[i - 1]!);
    }
  });

  it('each clip point carries the correct sourceId (clipId)', () => {
    const state = makeStateWithClips([{ id: 'clip-xyz', start: 100, end: 200 }]);
    const index = buildSnapIndex(state, toFrame(0));
    const clipPoints = index.points.filter(p => p.sourceId === 'clip-xyz');
    expect(clipPoints.length).toBe(2); // ClipStart + ClipEnd
  });

  it('playhead point has sourceId "__playhead__" and trackId null', () => {
    const state = makeStateWithClips([]);
    const index = buildSnapIndex(state, toFrame(500));
    const ph = index.points.find(p => p.type === 'Playhead');
    expect(ph).toBeDefined();
    expect(ph!.sourceId).toBe('__playhead__');
    expect(ph!.trackId).toBeNull();
    expect(ph!.frame).toBe(500);
  });

  it('enabled defaults to true', () => {
    const state = makeStateWithClips([]);
    const index = buildSnapIndex(state, toFrame(0));
    expect(index.enabled).toBe(true);
  });

  it('enabled can be set to false at build time', () => {
    const state = makeStateWithClips([]);
    const index = buildSnapIndex(state, toFrame(0), false);
    expect(index.enabled).toBe(false);
  });

  it('empty timeline produces only the playhead point', () => {
    const timeline = createTimeline({ id: 'tl', name: 'T', fps: 30, duration: toFrame(1000) });
    const state = createTimelineState({ timeline });
    const index = buildSnapIndex(state, toFrame(0));
    expect(index.points.length).toBe(1);
    expect(index.points[0]!.type).toBe('Playhead');
  });
});

// ── nearest ───────────────────────────────────────────────────────────────────

describe('nearest — radius behaviour', () => {
  // Clip at [100..200]: ClipStart at frame 100, ClipEnd at frame 200
  function makeIndexWithClip() {
    const state = makeStateWithClips([{ id: 'c1', start: 100, end: 200 }]);
    return buildSnapIndex(state, toFrame(999)); // playhead far away
  }

  it('returns null when index.enabled is false regardless of proximity', () => {
    const index = toggleSnap(makeIndexWithClip(), false);
    const result = nearest(index, toFrame(100), 10);
    expect(result).toBeNull();
  });

  it('snaps to ClipStart at exact frame distance 0', () => {
    const index = makeIndexWithClip();
    const result = nearest(index, toFrame(100), 5);
    expect(result).not.toBeNull();
    expect(result!.frame).toBe(100);
    expect(result!.type).toBe('ClipStart');
  });

  it('snaps to a boundary within radius (frame 98, radius 5 → boundary at 100)', () => {
    const index = makeIndexWithClip();
    const result = nearest(index, toFrame(98), 5); // distance = 2, ≤ 5
    expect(result).not.toBeNull();
    expect(result!.frame).toBe(100);
  });

  it('returns null when nothing is within radius', () => {
    const index = makeIndexWithClip();
    const result = nearest(index, toFrame(150), 5); // nearest is 50 frames away
    expect(result).toBeNull();
  });

  it('snaps at exactly radiusFrames distance (boundary case — inclusive)', () => {
    const index = makeIndexWithClip();
    // frame 95, radius 5 → distance to 100 is exactly 5
    const result = nearest(index, toFrame(95), 5);
    expect(result).not.toBeNull();
    expect(result!.frame).toBe(100);
  });

  it('does not snap at radiusFrames + 1 (just outside)', () => {
    const index = makeIndexWithClip();
    // frame 94, radius 5 → distance to 100 is 6
    const result = nearest(index, toFrame(94), 5);
    expect(result).toBeNull();
  });
});

describe('nearest — exclusion list', () => {
  it('skips snap points whose sourceId is in the exclude list', () => {
    const state = makeStateWithClips([
      { id: 'dragging', start: 0,   end: 100 },
      { id: 'anchor',   start: 200, end: 300 },
    ]);
    const index = buildSnapIndex(state, toFrame(999));

    // Frame 0 would snap to 'dragging' ClipStart — but it's excluded
    const result = nearest(index, toFrame(0), 10, ['dragging']);
    // Should not return a point from 'dragging'
    expect(result).toBeNull();
  });

  it('still snaps to non-excluded points near the same frame', () => {
    // Two clips: c1 starts at 100, c2 ends at 102 (different sourceId)
    const state = makeStateWithClips([
      { id: 'c1', start: 100, end: 200 },
      { id: 'c2', start: 0,   end: 102 },
    ]);
    const index = buildSnapIndex(state, toFrame(999));

    // Exclude c1 — c2's ClipEnd at 102 is within radius 5 of frame 100
    const result = nearest(index, toFrame(100), 5, ['c1']);
    expect(result).not.toBeNull();
    expect(result!.sourceId).toBe('c2');
  });
});

describe('nearest — allowedTypes filter', () => {
  it('ignores Playhead when allowedTypes excludes Playhead', () => {
    const state = makeStateWithClips([]);
    // Only point is Playhead at frame 100
    const index = buildSnapIndex(state, toFrame(100));
    const result = nearest(index, toFrame(100), 10, [], ['ClipStart', 'ClipEnd']);
    expect(result).toBeNull(); // Playhead filtered out
  });

  it('returns Playhead when allowedTypes includes it', () => {
    const state = makeStateWithClips([]);
    const index = buildSnapIndex(state, toFrame(100));
    const result = nearest(index, toFrame(100), 10, [], ['Playhead']);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('Playhead');
  });

  it('only returns ClipEnd points when allowedTypes = ["ClipEnd"]', () => {
    const state = makeStateWithClips([{ id: 'c1', start: 100, end: 105 }]);
    const index = buildSnapIndex(state, toFrame(999));

    // Both ClipStart(100) and ClipEnd(105) are within radius 10 of frame 102
    const result = nearest(index, toFrame(102), 10, [], ['ClipEnd']);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ClipEnd');
    expect(result!.frame).toBe(105);
  });
});

describe('nearest — priority tiebreak', () => {
  it('returns higher-priority point when two points are equidistant', () => {
    // Simulate a Marker at the same frame as a ClipStart
    // Inject a Marker-type point manually into a custom SnapIndex
    const state = makeStateWithClips([{ id: 'c1', start: 100, end: 200 }]);
    const base = buildSnapIndex(state, toFrame(999));

    // Inject a Marker at frame 100 with priority 100
    const markerPoint: SnapPoint = {
      frame: toFrame(100), type: 'Marker', priority: 100,
      trackId: null, sourceId: 'marker-1',
    };
    const withMarker: SnapIndex = {
      ...base,
      points: [...base.points, markerPoint].sort((a, b) => a.frame - b.frame),
    };

    const result = nearest(withMarker, toFrame(100), 5);
    // Marker (priority 100) > ClipStart (priority 80) → Marker wins
    expect(result).not.toBeNull();
    expect(result!.type).toBe('Marker');
    expect(result!.sourceId).toBe('marker-1');
  });

  it('returns closer point when two candidates have different distances and same priority', () => {
    const state = makeStateWithClips([
      { id: 'c1', start: 97,  end: 500 },  // ClipStart at 97, dist = 3
      { id: 'c2', start: 103, end: 500 },  // ClipStart at 103, dist = 3 — equal!
    ]);
    const index = buildSnapIndex(state, toFrame(999));
    // At frame 100 both are equidistant (distance 3). Same priority.
    // First in sorted order (frame 97) should win.
    const result = nearest(index, toFrame(100), 10);
    expect(result).not.toBeNull();
    expect(result!.frame).toBe(97);
  });
});

// ── toggleSnap ────────────────────────────────────────────────────────────────

describe('toggleSnap', () => {
  it('returns a new SnapIndex with enabled: false', () => {
    const state = makeStateWithClips([{ id: 'c1', start: 100, end: 200 }]);
    const index = buildSnapIndex(state, toFrame(999));

    const disabled = toggleSnap(index, false);
    expect(disabled.enabled).toBe(false);
    // Points unchanged
    expect(disabled.points.length).toBe(index.points.length);
  });

  it('nearest() always returns null when enabled is false', () => {
    const state = makeStateWithClips([{ id: 'c1', start: 100, end: 200 }]);
    const disabled = toggleSnap(buildSnapIndex(state, toFrame(999)), false);

    // Frame exactly on a clip boundary — still null
    expect(nearest(disabled, toFrame(100), 100)).toBeNull();
    expect(nearest(disabled, toFrame(200), 100)).toBeNull();
  });

  it('does not mutate the original index', () => {
    const state = makeStateWithClips([]);
    const original = buildSnapIndex(state, toFrame(0));
    toggleSnap(original, false);
    expect(original.enabled).toBe(true); // untouched
  });

  it('re-enabling with toggleSnap(index, true) restores snap', () => {
    const state = makeStateWithClips([{ id: 'c1', start: 100, end: 200 }]);
    const index   = buildSnapIndex(state, toFrame(999));
    const disabled = toggleSnap(index, false);
    const restored = toggleSnap(disabled, true);

    const result = nearest(restored, toFrame(100), 5);
    expect(result).not.toBeNull();
  });
});
