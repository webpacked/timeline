/**
 * DISPATCHER TESTS — Phase 0
 *
 * Verifies the atomic dispatch() contract:
 * - Successful transactions bump state.timeline.version
 * - Failed transactions leave state COMPLETELY unchanged
 * - One bad primitive in a multi-primitive Transaction rejects the entire batch
 */

import { describe, it, expect } from 'vitest';
import { dispatch } from '../engine/dispatcher';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset, toAssetId } from '../types/asset';
import { toFrame, toTimecode } from '../types/frame';
import type { Transaction, OperationPrimitive } from '../types/operations';

// ── Helpers ──────────────────────────────────────────────────────────────────

let txCounter = 0;
function makeTx(label: string, operations: OperationPrimitive[]): Transaction {
  return {
    id: `tx-${++txCounter}`,
    label,
    timestamp: Date.now(),
    operations,
  };
}

function makeState() {
  const assetId = toAssetId('asset-1');
  const trackId = toTrackId('video-1');

  const asset = createAsset({
    id: 'asset-1',
    name: 'Clip A',
    mediaType: 'video',
    filePath: '/clips/a.mp4',
    intrinsicDuration: toFrame(600),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
  });

  const clip = createClip({
    id: 'clip-a',
    assetId: 'asset-1',
    trackId: 'video-1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });

  const track = createTrack({ id: 'video-1', name: 'V1', type: 'video', clips: [clip] });
  const timeline = createTimeline({
    id: 'tl',
    name: 'Dispatch Test',
    fps: 30,
    duration: toFrame(3000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });

  return createTimelineState({ timeline, assetRegistry: new Map([[assetId, asset]]) });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('dispatch — accepted transactions', () => {
  it('returns accepted: true on a valid single-primitive transaction', () => {
    const state = makeState();
    const tx = makeTx('Rename', [{ type: 'RENAME_TIMELINE', name: 'New Name' }]);
    const result = dispatch(state, tx);
    expect(result.accepted).toBe(true);
  });

  it('bumps timeline.version by exactly 1 on acceptance', () => {
    const state = makeState();
    expect(state.timeline.version).toBe(0);
    const tx = makeTx('Rename', [{ type: 'RENAME_TIMELINE', name: 'v1' }]);
    const result = dispatch(state, tx);
    if (!result.accepted) throw new Error('Expected accepted');
    expect(result.nextState.timeline.version).toBe(1);
  });

  it('applies RENAME_TIMELINE correctly', () => {
    const state = makeState();
    const tx = makeTx('Rename', [{ type: 'RENAME_TIMELINE', name: 'My Edit' }]);
    const result = dispatch(state, tx);
    if (!result.accepted) throw new Error('Expected accepted');
    expect(result.nextState.timeline.name).toBe('My Edit');
  });

  it('applies MOVE_CLIP to a valid position', () => {
    const state = makeState();
    const tx = makeTx('Move clip', [{
      type: 'MOVE_CLIP',
      clipId: toClipId('clip-a'),
      newTimelineStart: toFrame(200),
    }]);
    const result = dispatch(state, tx);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    const clip = result.nextState.timeline.tracks[0]!.clips[0]!;
    expect(clip.timelineStart).toBe(200);
    expect(clip.timelineEnd).toBe(300); // duration preserved
  });

  it('multi-primitive transaction applies all ops atomically', () => {
    const state = makeState();
    const tx = makeTx('Multi-op', [
      { type: 'RENAME_TIMELINE', name: 'Step 1' },
      { type: 'SET_TIMELINE_DURATION', duration: toFrame(6000) },
    ]);
    const result = dispatch(state, tx);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.nextState.timeline.name).toBe('Step 1');
    expect(result.nextState.timeline.duration).toBe(6000);
  });

  it('DELETE_CLIP removes a clip and leaves state valid', () => {
    const state = makeState();
    const tx = makeTx('Delete', [{ type: 'DELETE_CLIP', clipId: toClipId('clip-a') }]);
    const result = dispatch(state, tx);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    const clips = result.nextState.timeline.tracks[0]!.clips;
    expect(clips.length).toBe(0);
  });
});

describe('dispatch — rejected transactions', () => {
  it('rejects MOVE_CLIP that would create an OVERLAP', () => {
    // Add a second clip at [200..300], then try to move clip-a to [150..250]
    const state = makeState();
    const clip2 = createClip({
      id: 'clip-b',
      assetId: 'asset-1',
      trackId: 'video-1',
      timelineStart: toFrame(200),
      timelineEnd: toFrame(300),
      mediaIn: toFrame(0),
      mediaOut: toFrame(100),
    });
    const stateWith2 = {
      ...state,
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map(t =>
          t.id === 'video-1' ? { ...t, clips: [...t.clips, clip2] } : t
        ),
      },
    };

    const tx = makeTx('Move to overlap', [{
      type: 'MOVE_CLIP',
      clipId: toClipId('clip-a'),
      newTimelineStart: toFrame(150), // clip-a [150..250] overlaps clip-b [200..300]
    }]);
    const result = dispatch(stateWith2, tx);
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toBe('OVERLAP');
  });

  it('rejects MOVE_CLIP on a locked track', () => {
    const state = makeState();
    const stateWithLock = {
      ...state,
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map(t =>
          t.id === 'video-1' ? { ...t, locked: true } : t
        ),
      },
    };
    const tx = makeTx('Move locked', [{
      type: 'MOVE_CLIP',
      clipId: toClipId('clip-a'),
      newTimelineStart: toFrame(500),
    }]);
    const result = dispatch(stateWithLock, tx);
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toBe('LOCKED_TRACK');
  });

  it('rejects DELETE_CLIP when clip does not exist', () => {
    const state = makeState();
    const tx = makeTx('Delete ghost', [{ type: 'DELETE_CLIP', clipId: toClipId('no-such-clip') }]);
    const result = dispatch(state, tx);
    expect(result.accepted).toBe(false);
  });

  it('rejects UNREGISTER_ASSET when asset is still in use', () => {
    const state = makeState();
    const tx = makeTx('Unregister in-use', [{ type: 'UNREGISTER_ASSET', assetId: toAssetId('asset-1') }]);
    const result = dispatch(state, tx);
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toBe('ASSET_IN_USE');
  });

  it('all-or-nothing: one bad primitive in a 3-op transaction rejects all', () => {
    const state = makeState();
    const tx = makeTx('Partial fail', [
      { type: 'RENAME_TIMELINE', name: 'Good Op 1' },
      // This op should fail — clip does not exist
      { type: 'DELETE_CLIP', clipId: toClipId('no-such-clip') },
      { type: 'SET_TIMELINE_DURATION', duration: toFrame(9000) },
    ]);
    const result = dispatch(state, tx);
    expect(result.accepted).toBe(false);
    // State must be completely unchanged
    expect(state.timeline.name).toBe('Dispatch Test');
    expect(state.timeline.duration).toBe(3000);
  });

  it('state is completely unchanged when transaction is rejected', () => {
    const state = makeState();
    const tx = makeTx('Bad', [{ type: 'DELETE_CLIP', clipId: toClipId('not-here') }]);
    dispatch(state, tx);
    // Original state must be reference-identical (not mutated)
    expect(state.timeline.name).toBe('Dispatch Test');
    expect(state.timeline.version).toBe(0);
  });

  it('rejects SET_CLIP_SPEED with speed=0', () => {
    const state = makeState();
    const tx = makeTx('Zero speed', [{
      type: 'SET_CLIP_SPEED',
      clipId: toClipId('clip-a'),
      speed: 0,
    }]);
    const result = dispatch(state, tx);
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toBe('SPEED_INVALID');
  });
});

describe('dispatch — REGISTER_ASSET + INSERT_CLIP flow', () => {
  it('registers an asset and inserts a clip in two separate transactions', () => {
    let state = makeState();

    // Transaction 1: register a new asset
    const asset2 = createAsset({
      id: 'asset-2',
      name: 'Clip B',
      mediaType: 'video',
      filePath: '/clips/b.mp4',
      intrinsicDuration: toFrame(300),
      nativeFps: 30,
      sourceTimecodeOffset: toFrame(0),
    });
    const tx1 = makeTx('Register asset', [{ type: 'REGISTER_ASSET', asset: asset2 }]);
    const r1 = dispatch(state, tx1);
    expect(r1.accepted).toBe(true);
    if (!r1.accepted) return;
    state = r1.nextState;
    expect(state.assetRegistry.has(toAssetId('asset-2'))).toBe(true);

    // Transaction 2: insert a clip using the new asset
    const newClip = createClip({
      id: 'clip-b',
      assetId: 'asset-2',
      trackId: 'video-1',
      timelineStart: toFrame(200),
      timelineEnd: toFrame(500),
      mediaIn: toFrame(0),
      mediaOut: toFrame(300),
    });
    const tx2 = makeTx('Insert clip', [{
      type: 'INSERT_CLIP',
      clip: newClip,
      trackId: toTrackId('video-1'),
    }]);
    const r2 = dispatch(state, tx2);
    expect(r2.accepted).toBe(true);
    if (!r2.accepted) return;
    const clips = r2.nextState.timeline.tracks[0]!.clips;
    expect(clips.length).toBe(2);
    expect(clips.find(c => c.id === 'clip-b')).toBeDefined();
  });
});

// ── Targeted verification tests (pre-Phase 1 sign-off) ───────────────────────

describe('dispatch — MOVE_CLIP cross-track', () => {
  it('physically moves the clip from source track to target track', () => {
    const state = makeState();
    // Add a second video track
    const track2 = createTrack({ id: 'video-2', name: 'V2', type: 'video', clips: [] });
    const stateWith2Tracks = {
      ...state,
      timeline: {
        ...state.timeline,
        tracks: [...state.timeline.tracks, track2],
      },
    };

    const tx = makeTx('Cross-track move', [{
      type: 'MOVE_CLIP',
      clipId: toClipId('clip-a'),
      newTimelineStart: toFrame(0),
      targetTrackId: toTrackId('video-2'),
    }]);

    const result = dispatch(stateWith2Tracks, tx);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    const tracks = result.nextState.timeline.tracks;
    const sourceTrack = tracks.find(t => t.id === 'video-1')!;
    const targetTrack = tracks.find(t => t.id === 'video-2')!;

    // Clip must be GONE from source
    expect(sourceTrack.clips.length).toBe(0);
    // Clip must be IN target
    expect(targetTrack.clips.length).toBe(1);
    const movedClip = targetTrack.clips[0]!;
    // clip.trackId must match the new track
    expect(movedClip.trackId).toBe('video-2');
    expect(movedClip.timelineStart).toBe(0);
    expect(movedClip.timelineEnd).toBe(100);
  });
});

describe('dispatch — version bump is exactly +1 per Transaction', () => {
  it('a 5-op transaction increments version by exactly 1, not 5', () => {
    const state = makeState();
    expect(state.timeline.version).toBe(0);

    const tx = makeTx('5-op tx', [
      { type: 'RENAME_TIMELINE', name: 'Op1' },
      { type: 'SET_TIMELINE_DURATION', duration: toFrame(1000) },
      { type: 'SET_TIMELINE_DURATION', duration: toFrame(2000) },
      { type: 'SET_TIMELINE_DURATION', duration: toFrame(3000) },
      { type: 'RENAME_TIMELINE', name: 'Op5' },
    ]);

    const result = dispatch(state, tx);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    // Version must be exactly 1, not 5
    expect(result.nextState.timeline.version).toBe(1);
    // And two sequential transactions → version 2
    const result2 = dispatch(result.nextState, makeTx('tx2', [
      { type: 'RENAME_TIMELINE', name: 'Op6' },
    ]));
    expect(result2.accepted).toBe(true);
    if (!result2.accepted) return;
    expect(result2.nextState.timeline.version).toBe(2);
  });
});

describe('dispatch — RESIZE_CLIP start-edge moves mediaIn by same delta', () => {
  it('trimming start by +30 frames advances timelineStart and mediaIn by identical delta', () => {
    const state = makeState();
    // clip-a: timelineStart=0, timelineEnd=100, mediaIn=0, mediaOut=100
    const tx = makeTx('Trim start', [{
      type: 'RESIZE_CLIP',
      clipId: toClipId('clip-a'),
      edge: 'start',
      newFrame: toFrame(30),  // trim 30 frames off the start
    }]);

    const result = dispatch(state, tx);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    const clip = result.nextState.timeline.tracks[0]!.clips[0]!;
    expect(clip.timelineStart).toBe(30);  // moved forward
    expect(clip.timelineEnd).toBe(100);   // unchanged
    expect(clip.mediaIn).toBe(30);        // MUST advance by same delta (+30)
    expect(clip.mediaOut).toBe(100);      // unchanged
  });

  it('trimming end-edge adjusts mediaOut, not mediaIn', () => {
    const state = makeState();
    const tx = makeTx('Trim end', [{
      type: 'RESIZE_CLIP',
      clipId: toClipId('clip-a'),
      edge: 'end',
      newFrame: toFrame(70),  // trim 30 frames off the end
    }]);

    const result = dispatch(state, tx);
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    const clip = result.nextState.timeline.tracks[0]!.clips[0]!;
    expect(clip.timelineStart).toBe(0);   // unchanged
    expect(clip.timelineEnd).toBe(70);    // moved backward
    expect(clip.mediaIn).toBe(0);         // unchanged
    expect(clip.mediaOut).toBe(70);       // MUST retract by same delta (-30)
  });
});

