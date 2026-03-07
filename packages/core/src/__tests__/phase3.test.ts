/**
 * PHASE 3 STEP 1 TESTS — Markers, Generators, In/Out, BeatGrid, Captions
 *
 * Covers: 11 new primitives, 4 new invariants, Asset discriminated union.
 * Every test that produces new state runs checkInvariants().
 */

import { describe, it, expect } from 'vitest';
import { dispatch } from '../engine/dispatcher';
import { applyOperation } from '../engine/apply';
import { checkInvariants } from '../validation/invariants';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset, createGeneratorAsset, toAssetId } from '../types/asset';
import { toFrame, frameRate, toTimecode } from '../types/frame';
import { toMarkerId } from '../types/marker';
import { toGeneratorId } from '../types/generator';
import { toCaptionId } from '../types/caption';
import type { OperationPrimitive, Transaction } from '../types/operations';
import { buildSnapIndex } from '../snap-index';
import { findMarkersByColor, findMarkersByLabel } from '../engine/marker-search';
import { defaultCaptionStyle as defaultCaptionStyleFromCore } from '../engine/subtitle-import';

// ── Helpers ─────────────────────────────────────────────────────────────────

let txCounter = 0;
function makeTx(label: string, operations: OperationPrimitive[]): Transaction {
  return { id: `tx-${++txCounter}`, label, timestamp: Date.now(), operations };
}

function makeBaseState() {
  const asset = createAsset({
    id: 'asset-1',
    name: 'V1',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(600),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
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
  const track = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [clip] });
  const timeline = createTimeline({
    id: 'tl',
    name: 'T',
    fps: 30,
    duration: toFrame(1000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[asset.id, asset]]) });
}

const defaultCaptionStyle = {
  fontFamily: 'Arial',
  fontSize: 24,
  color: '#fff',
  backgroundColor: '#000',
  hAlign: 'center' as const,
  vAlign: 'bottom' as const,
};

// ── 1. Branded IDs and factories ─────────────────────────────────────────────

describe('Phase 3 — IDs and factories', () => {
  it('toMarkerId, toGeneratorId, toCaptionId return branded ids', () => {
    expect(toMarkerId('m1')).toBe('m1');
    expect(toGeneratorId('g1')).toBe('g1');
    expect(toCaptionId('c1')).toBe('c1');
  });

  it('createGeneratorAsset produces GeneratorAsset with kind "generator"', () => {
    const gen = createGeneratorAsset({
      id: 'gen-1',
      name: 'Solid',
      mediaType: 'video',
      generatorDef: {
        id: toGeneratorId('gen-1'),
        type: 'solid',
        params: { color: '#ff0000' },
        duration: toFrame(60),
        name: 'Red',
      },
      nativeFps: 30,
    });
    expect(gen.kind).toBe('generator');
    expect(gen.generatorDef.duration).toBe(60);
    expect(gen.intrinsicDuration).toBe(60);
    expect(gen.sourceTimecodeOffset).toBe(0);
  });
});

// ── 2. Timeline/Track defaults ───────────────────────────────────────────────

describe('Phase 3 — createTimeline/createTrack defaults', () => {
  it('createTimeline without Phase 3 params has markers=[], beatGrid=null, in/out=null', () => {
    const tl = createTimeline({ id: 'tl', name: 'T', fps: 24, duration: toFrame(100) });
    expect(tl.markers).toEqual([]);
    expect(tl.beatGrid).toBeNull();
    expect(tl.inPoint).toBeNull();
    expect(tl.outPoint).toBeNull();
  });

  it('createTrack without captions has captions=[]', () => {
    const track = createTrack({ id: 't1', name: 'V1', type: 'video' });
    expect(track.captions).toEqual([]);
  });
});

// ── 3. ADD_MARKER ───────────────────────────────────────────────────────────

describe('Phase 3 — ADD_MARKER', () => {
  it('adds point marker to timeline.markers sorted by frame', () => {
    const state = makeBaseState();
    const marker = {
      type: 'point' as const,
      id: toMarkerId('m1'),
      frame: toFrame(50),
      label: 'A',
      color: '#f00',
      scope: 'global' as const,
      linkedClipId: null,
    };
    const next = applyOperation(state, { type: 'ADD_MARKER', marker });
    expect(next.timeline.markers).toHaveLength(1);
    expect(next.timeline.markers[0]!.type).toBe('point');
    expect((next.timeline.markers[0] as { frame: number }).frame).toBe(50);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('adds range marker with frameStart/frameEnd', () => {
    const state = makeBaseState();
    const marker = {
      type: 'range' as const,
      id: toMarkerId('r1'),
      frameStart: toFrame(10),
      frameEnd: toFrame(90),
      label: 'Range',
      color: '#0f0',
      scope: 'global' as const,
      linkedClipId: null,
    };
    const next = applyOperation(state, { type: 'ADD_MARKER', marker });
    expect(next.timeline.markers).toHaveLength(1);
    expect(next.timeline.markers[0]!.type).toBe('range');
    const r = next.timeline.markers[0] as { frameStart: number; frameEnd: number };
    expect(r.frameStart).toBe(10);
    expect(r.frameEnd).toBe(90);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('dispatch ADD_MARKER accepts and invariants pass', () => {
    const state = makeBaseState();
    const marker = {
      type: 'point' as const,
      id: toMarkerId('m2'),
      frame: toFrame(200),
      label: 'B',
      color: '#00f',
      scope: 'global' as const,
      linkedClipId: null,
    };
    const result = dispatch(state, makeTx('Add marker', [{ type: 'ADD_MARKER', marker }]));
    expect(result.accepted).toBe(true);
    if (result.accepted) expect(checkInvariants(result.nextState)).toEqual([]);
  });
});

// ── 4. MOVE_MARKER ──────────────────────────────────────────────────────────

describe('Phase 3 — MOVE_MARKER', () => {
  it('moves point marker to newFrame', () => {
    const state = makeBaseState();
    const marker = {
      type: 'point' as const,
      id: toMarkerId('m1'),
      frame: toFrame(50),
      label: 'A',
      color: '#f00',
      scope: 'global' as const,
      linkedClipId: null,
    };
    let next = applyOperation(state, { type: 'ADD_MARKER', marker });
    next = applyOperation(next, { type: 'MOVE_MARKER', markerId: toMarkerId('m1'), newFrame: toFrame(100) });
    const m = next.timeline.markers[0] as { type: 'point'; frame: number };
    expect(m.frame).toBe(100);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('moves range marker preserving duration', () => {
    const state = makeBaseState();
    const marker = {
      type: 'range' as const,
      id: toMarkerId('r1'),
      frameStart: toFrame(10),
      frameEnd: toFrame(50),
      label: 'R',
      color: '#f00',
      scope: 'global' as const,
      linkedClipId: null,
    };
    let next = applyOperation(state, { type: 'ADD_MARKER', marker });
    next = applyOperation(next, { type: 'MOVE_MARKER', markerId: toMarkerId('r1'), newFrame: toFrame(100) });
    const r = next.timeline.markers[0] as { frameStart: number; frameEnd: number };
    expect(r.frameStart).toBe(100);
    expect(r.frameEnd).toBe(140); // 100 + 40
    expect(checkInvariants(next)).toEqual([]);
  });

  it('dispatch MOVE_MARKER with invalid id returns NOT_FOUND', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('Move', [{ type: 'MOVE_MARKER', markerId: toMarkerId('none'), newFrame: toFrame(10) }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('NOT_FOUND');
  });
});

// ── 5. DELETE_MARKER ────────────────────────────────────────────────────────

describe('Phase 3 — DELETE_MARKER', () => {
  it('removes marker from timeline.markers', () => {
    const state = makeBaseState();
    const marker = {
      type: 'point' as const,
      id: toMarkerId('m1'),
      frame: toFrame(50),
      label: 'A',
      color: '#f00',
      scope: 'global' as const,
      linkedClipId: null,
    };
    let next = applyOperation(state, { type: 'ADD_MARKER', marker });
    next = applyOperation(next, { type: 'DELETE_MARKER', markerId: toMarkerId('m1') });
    expect(next.timeline.markers).toHaveLength(0);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('dispatch DELETE_MARKER with invalid id returns NOT_FOUND', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('Del', [{ type: 'DELETE_MARKER', markerId: toMarkerId('none') }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('NOT_FOUND');
  });
});

// ── 6. SET_IN_POINT / SET_OUT_POINT ────────────────────────────────────────

describe('Phase 3 — SET_IN_POINT / SET_OUT_POINT', () => {
  it('SET_IN_POINT sets timeline.inPoint, null clears', () => {
    const state = makeBaseState();
    let next = applyOperation(state, { type: 'SET_IN_POINT', frame: toFrame(100) });
    expect(next.timeline.inPoint).toBe(100);
    next = applyOperation(next, { type: 'SET_IN_POINT', frame: null });
    expect(next.timeline.inPoint).toBeNull();
    expect(checkInvariants(next)).toEqual([]);
  });

  it('SET_OUT_POINT sets timeline.outPoint', () => {
    const state = makeBaseState();
    const next = applyOperation(state, { type: 'SET_OUT_POINT', frame: toFrame(500) });
    expect(next.timeline.outPoint).toBe(500);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('dispatch rejects SET_IN_POINT when >= outPoint', () => {
    const state = makeBaseState();
    let next = applyOperation(state, { type: 'SET_OUT_POINT', frame: toFrame(200) });
    const result = dispatch(next, makeTx('In', [{ type: 'SET_IN_POINT', frame: toFrame(200) }]));
    expect(result.accepted).toBe(false);
  });
});

// ── 7. ADD_BEAT_GRID / REMOVE_BEAT_GRID ─────────────────────────────────────

describe('Phase 3 — ADD_BEAT_GRID / REMOVE_BEAT_GRID', () => {
  it('ADD_BEAT_GRID sets timeline.beatGrid', () => {
    const state = makeBaseState();
    const beatGrid = { bpm: 120, timeSignature: [4, 4] as const, offset: toFrame(0) };
    const next = applyOperation(state, { type: 'ADD_BEAT_GRID', beatGrid });
    expect(next.timeline.beatGrid).toEqual(beatGrid);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('REMOVE_BEAT_GRID sets beatGrid to null', () => {
    const state = makeBaseState();
    const beatGrid = { bpm: 120, timeSignature: [4, 4] as const, offset: toFrame(0) };
    let next = applyOperation(state, { type: 'ADD_BEAT_GRID', beatGrid });
    next = applyOperation(next, { type: 'REMOVE_BEAT_GRID' });
    expect(next.timeline.beatGrid).toBeNull();
    expect(checkInvariants(next)).toEqual([]);
  });

  it('dispatch ADD_BEAT_GRID when one exists returns BEAT_GRID_EXISTS', () => {
    const state = makeBaseState();
    const beatGrid = { bpm: 120, timeSignature: [4, 4] as const, offset: toFrame(0) };
    const tx = makeTx('BG', [
      { type: 'ADD_BEAT_GRID', beatGrid },
      { type: 'ADD_BEAT_GRID', beatGrid: { ...beatGrid, bpm: 90 } },
    ]);
    const result = dispatch(state, tx);
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('BEAT_GRID_EXISTS');
  });

  it('REMOVE_BEAT_GRID when already null is idempotent (no error)', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('Remove BG', [{ type: 'REMOVE_BEAT_GRID' }]));
    expect(result.accepted).toBe(true);
    if (result.accepted) expect(checkInvariants(result.nextState)).toEqual([]);
  });
});

// ── 9. INSERT_GENERATOR ─────────────────────────────────────────────────────

describe('Phase 3 — INSERT_GENERATOR', () => {
  it('registers GeneratorAsset and inserts clip at atFrame; nativeFps from state.timeline.fps', () => {
    const state = makeBaseState();
    const generator = {
      id: toGeneratorId('gen-1'),
      type: 'solid' as const,
      params: { color: '#f00' },
      duration: toFrame(60),
      name: 'Red Solid',
    };
    const next = applyOperation(state, {
      type: 'INSERT_GENERATOR',
      generator,
      trackId: toTrackId('track-1'),
      atFrame: toFrame(200),
    });
    const assetEntry = next.assetRegistry.get(toAssetId(generator.id as unknown as string));
    expect(assetEntry).toBeDefined();
    const asset = assetEntry!;
    expect(asset.kind).toBe('generator');
    if (asset.kind === 'generator') {
      expect(asset.nativeFps).toBe(30);
      expect(asset.generatorDef.duration).toBe(60);
    }
    const track = next.timeline.tracks.find((t) => t.id === 'track-1')!;
    expect(track.clips).toHaveLength(2);
    const genClip = track.clips.find((c) => c.timelineStart === 200);
    expect(genClip).toBeDefined();
    expect(genClip!.timelineEnd).toBe(260);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('dispatch INSERT_GENERATOR with invalid trackId rejects', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('Gen', [{
      type: 'INSERT_GENERATOR',
      generator: {
        id: toGeneratorId('g1'),
        type: 'solid',
        params: {},
        duration: toFrame(50),
        name: 'S',
      },
      trackId: toTrackId('none'),
      atFrame: toFrame(0),
    }]));
    expect(result.accepted).toBe(false);
  });
});

// ── 10. ADD_CAPTION ─────────────────────────────────────────────────────────

describe('Phase 3 — ADD_CAPTION', () => {
  it('adds caption to track.captions', () => {
    const state = makeBaseState();
    const caption = {
      id: toCaptionId('cap-1'),
      text: 'Hello',
      startFrame: toFrame(0),
      endFrame: toFrame(100),
      language: 'en-US',
      style: defaultCaptionStyle,
      burnIn: false,
    };
    const next = applyOperation(state, { type: 'ADD_CAPTION', caption, trackId: toTrackId('track-1') });
    const track = next.timeline.tracks[0]!;
    expect(track.captions).toHaveLength(1);
    expect(track.captions[0]!.text).toBe('Hello');
    expect(checkInvariants(next)).toEqual([]);
  });

  it('ADD_CAPTION without style uses defaultCaptionStyle', () => {
    const state = makeBaseState();
    const caption = {
      id: toCaptionId('cap-1'),
      text: 'Hello',
      startFrame: toFrame(0),
      endFrame: toFrame(100),
      language: 'en-US',
      burnIn: false,
    };
    const next = applyOperation(state, { type: 'ADD_CAPTION', caption, trackId: toTrackId('track-1') });
    expect(next.timeline.tracks[0]!.captions[0]!.style).toEqual(defaultCaptionStyleFromCore);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('ADD_CAPTION sorts captions by startFrame', () => {
    const state = makeBaseState();
    const c1 = { id: toCaptionId('cap-1'), text: 'First', startFrame: toFrame(100), endFrame: toFrame(200), language: 'en', style: defaultCaptionStyle, burnIn: false };
    const c2 = { id: toCaptionId('cap-2'), text: 'Second', startFrame: toFrame(0), endFrame: toFrame(50), language: 'en', style: defaultCaptionStyle, burnIn: false };
    let next = applyOperation(state, { type: 'ADD_CAPTION', caption: c1, trackId: toTrackId('track-1') });
    next = applyOperation(next, { type: 'ADD_CAPTION', caption: c2, trackId: toTrackId('track-1') });
    const captions = next.timeline.tracks[0]!.captions;
    expect(captions[0]!.startFrame).toBe(0);
    expect(captions[1]!.startFrame).toBe(100);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('ADD_CAPTION with overlapping caption is rejected by validator', () => {
    const state = makeBaseState();
    const c1 = { id: toCaptionId('cap-1'), text: 'A', startFrame: toFrame(0), endFrame: toFrame(100), language: 'en', style: defaultCaptionStyle, burnIn: false };
    let next = applyOperation(state, { type: 'ADD_CAPTION', caption: c1, trackId: toTrackId('track-1') });
    const c2 = { id: toCaptionId('cap-2'), text: 'B', startFrame: toFrame(50), endFrame: toFrame(150), language: 'en', style: defaultCaptionStyle, burnIn: false };
    const result = dispatch(next, makeTx('Add overlapping', [{ type: 'ADD_CAPTION', caption: c2, trackId: toTrackId('track-1') }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('OVERLAP');
  });
});

// ── 11. EDIT_CAPTION (with trackId) ─────────────────────────────────────────

describe('Phase 3 — EDIT_CAPTION', () => {
  it('updates caption on specified track by trackId', () => {
    const state = makeBaseState();
    const caption = {
      id: toCaptionId('cap-1'),
      text: 'Hi',
      startFrame: toFrame(0),
      endFrame: toFrame(50),
      language: 'en',
      style: defaultCaptionStyle,
      burnIn: false,
    };
    let next = applyOperation(state, { type: 'ADD_CAPTION', caption, trackId: toTrackId('track-1') });
    next = applyOperation(next, {
      type: 'EDIT_CAPTION',
      captionId: toCaptionId('cap-1'),
      trackId: toTrackId('track-1'),
      text: 'Updated',
    });
    expect(next.timeline.tracks[0]!.captions[0]!.text).toBe('Updated');
    expect(checkInvariants(next)).toEqual([]);
  });

  it('dispatch EDIT_CAPTION with captionId not on track returns NOT_FOUND', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('Edit', [{
      type: 'EDIT_CAPTION',
      captionId: toCaptionId('nope'),
      trackId: toTrackId('track-1'),
      text: 'x',
    }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('NOT_FOUND');
  });

  it('EDIT_CAPTION supports partial updates for language and burnIn', () => {
    const state = makeBaseState();
    const caption = {
      id: toCaptionId('cap-1'),
      text: 'Hi',
      startFrame: toFrame(0),
      endFrame: toFrame(50),
      language: 'en',
      style: defaultCaptionStyle,
      burnIn: false,
    };
    let next = applyOperation(state, { type: 'ADD_CAPTION', caption, trackId: toTrackId('track-1') });
    next = applyOperation(next, {
      type: 'EDIT_CAPTION',
      captionId: toCaptionId('cap-1'),
      trackId: toTrackId('track-1'),
      language: 'fr-FR',
      burnIn: true,
    });
    const cap = next.timeline.tracks[0]!.captions[0]!;
    expect(cap.language).toBe('fr-FR');
    expect(cap.burnIn).toBe(true);
    expect(cap.text).toBe('Hi');
    expect(checkInvariants(next)).toEqual([]);
  });
});

// ── 12. DELETE_CAPTION (with trackId) ───────────────────────────────────────

describe('Phase 3 — DELETE_CAPTION', () => {
  it('removes caption from specified track', () => {
    const state = makeBaseState();
    const caption = {
      id: toCaptionId('cap-1'),
      text: 'x',
      startFrame: toFrame(0),
      endFrame: toFrame(50),
      language: 'en',
      style: defaultCaptionStyle,
      burnIn: false,
    };
    let next = applyOperation(state, { type: 'ADD_CAPTION', caption, trackId: toTrackId('track-1') });
    next = applyOperation(next, { type: 'DELETE_CAPTION', captionId: toCaptionId('cap-1'), trackId: toTrackId('track-1') });
    expect(next.timeline.tracks[0]!.captions).toHaveLength(0);
    expect(checkInvariants(next)).toEqual([]);
  });
});

// ── 13. Invariants (4 new) ──────────────────────────────────────────────────

describe('Phase 3 — MARKER_OUT_OF_BOUNDS', () => {
  it('point marker frame > timeline.duration violates', () => {
    const state = makeBaseState();
    const marker = {
      type: 'point' as const,
      id: toMarkerId('m1'),
      frame: toFrame(2000),
      label: 'X',
      color: '#f00',
      scope: 'global' as const,
      linkedClipId: null,
    };
    const next = applyOperation(state, { type: 'ADD_MARKER', marker });
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'MARKER_OUT_OF_BOUNDS')).toBe(true);
  });

  it('point marker with frame = -1 violates', () => {
    const state = makeBaseState();
    const marker = {
      type: 'point' as const,
      id: toMarkerId('m1'),
      frame: toFrame(-1),
      label: 'X',
      color: '#f00',
      scope: 'global' as const,
      linkedClipId: null,
    };
    const next = applyOperation(state, { type: 'ADD_MARKER', marker });
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'MARKER_OUT_OF_BOUNDS')).toBe(true);
  });

  it('range marker with frameStart = -5 violates', () => {
    const state = makeBaseState();
    const marker = {
      type: 'range' as const,
      id: toMarkerId('r1'),
      frameStart: toFrame(-5),
      frameEnd: toFrame(50),
      label: 'R',
      color: '#f00',
      scope: 'global' as const,
      linkedClipId: null,
    };
    const next = applyOperation(state, { type: 'ADD_MARKER', marker });
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'MARKER_OUT_OF_BOUNDS')).toBe(true);
  });
});

describe('Phase 3 — IN_OUT_INVALID', () => {
  it('inPoint >= outPoint when both set violates', () => {
    const state = makeBaseState();
    let next = applyOperation(state, { type: 'SET_IN_POINT', frame: toFrame(100) });
    next = applyOperation(next, { type: 'SET_OUT_POINT', frame: toFrame(50) });
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'IN_OUT_INVALID')).toBe(true);
  });

  it('outPoint > timeline.duration violates', () => {
    const state = makeBaseState();
    const next = applyOperation(state, { type: 'SET_OUT_POINT', frame: toFrame(2000) });
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'IN_OUT_INVALID')).toBe(true);
  });
});

describe('Phase 3 — BEAT_GRID_INVALID', () => {
  it('beatGrid.bpm <= 0 violates', () => {
    const state = makeBaseState();
    const next = applyOperation(state, {
      type: 'ADD_BEAT_GRID',
      beatGrid: { bpm: 0, timeSignature: [4, 4], offset: toFrame(0) },
    });
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'BEAT_GRID_INVALID')).toBe(true);
  });
});

describe('Phase 3 — CAPTION_OUT_OF_BOUNDS', () => {
  it('caption endFrame > timeline.duration violates', () => {
    const state = makeBaseState();
    const caption = {
      id: toCaptionId('c1'),
      text: 'x',
      startFrame: toFrame(0),
      endFrame: toFrame(2000),
      language: 'en',
      style: defaultCaptionStyle,
      burnIn: false,
    };
    const next = applyOperation(state, { type: 'ADD_CAPTION', caption, trackId: toTrackId('track-1') });
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'CAPTION_OUT_OF_BOUNDS')).toBe(true);
  });
});

describe('Phase 3 — CAPTION_OVERLAP', () => {
  it('overlapping captions on same track violate invariant', () => {
    const state = makeBaseState();
    const c1 = { id: toCaptionId('cap-1'), text: 'A', startFrame: toFrame(0), endFrame: toFrame(100), language: 'en', style: defaultCaptionStyle, burnIn: false };
    const c2 = { id: toCaptionId('cap-2'), text: 'B', startFrame: toFrame(50), endFrame: toFrame(150), language: 'en', style: defaultCaptionStyle, burnIn: false };
    let next = applyOperation(state, { type: 'ADD_CAPTION', caption: c1, trackId: toTrackId('track-1') });
    next = applyOperation(next, { type: 'ADD_CAPTION', caption: c2, trackId: toTrackId('track-1') });
    const violations = checkInvariants(next);
    expect(violations.some((v) => v.type === 'CAPTION_OVERLAP')).toBe(true);
  });
});

// ── 14. Dispatcher / transactions ────────────────────────────────────────────

describe('Phase 3 — dispatch mixed Phase 3 ops', () => {
  it('transaction with ADD_MARKER + SET_IN_POINT applies both', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('Mixed', [
      { type: 'ADD_MARKER', marker: { type: 'point', id: toMarkerId('m1'), frame: toFrame(10), label: 'A', color: '#f00', scope: 'global', linkedClipId: null } },
      { type: 'SET_IN_POINT', frame: toFrame(5) },
    ]));
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.nextState.timeline.markers).toHaveLength(1);
      expect(result.nextState.timeline.inPoint).toBe(5);
      expect(checkInvariants(result.nextState)).toEqual([]);
    }
  });

  it('ADD_MARKER then MOVE_MARKER in same tx works', () => {
    const state = makeBaseState();
    const result = dispatch(state, makeTx('Add+Move', [
      { type: 'ADD_MARKER', marker: { type: 'point', id: toMarkerId('m1'), frame: toFrame(20), label: 'A', color: '#f00', scope: 'global', linkedClipId: null } },
      { type: 'MOVE_MARKER', markerId: toMarkerId('m1'), newFrame: toFrame(80) },
    ]));
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      const m = result.nextState.timeline.markers[0] as { frame: number };
      expect(m.frame).toBe(80);
      expect(checkInvariants(result.nextState)).toEqual([]);
    }
  });
});

// ── 15. Backward compat ─────────────────────────────────────────────────────

describe('Phase 3 — backward compat', () => {
  it('checkInvariants on state with no markers/captions/beatGrid returns []', () => {
    const state = makeBaseState();
    expect(checkInvariants(state)).toEqual([]);
  });

  it('existing createTimeline/createTrack call sites still produce valid state', () => {
    const track = createTrack({ id: 't1', name: 'V1', type: 'video', clips: [] });
    const timeline = createTimeline({ id: 'tl', name: 'T', fps: 24, duration: toFrame(100), tracks: [track] });
    const state = createTimelineState({ timeline, assetRegistry: new Map() });
    expect(checkInvariants(state)).toEqual([]);
  });
});

// ── Phase 3 Step 2: Clip-linked markers, BeatGrid snaps, Marker search ───────

describe('Phase 3 Step 2 — clip-linked markers', () => {
  it('ADD_MARKER with valid clipId succeeds', () => {
    const state = makeBaseState();
    const marker = {
      type: 'point' as const,
      id: toMarkerId('m1'),
      frame: toFrame(50),
      label: 'A',
      color: '#f00',
      scope: 'global' as const,
      linkedClipId: null,
      clipId: toClipId('clip-1'),
    };
    const result = dispatch(state, makeTx('Add', [{ type: 'ADD_MARKER', marker }]));
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.nextState.timeline.markers).toHaveLength(1);
      expect(checkInvariants(result.nextState)).toEqual([]);
    }
  });

  it('ADD_MARKER with invalid clipId returns NOT_FOUND', () => {
    const state = makeBaseState();
    const marker = {
      type: 'point' as const,
      id: toMarkerId('m1'),
      frame: toFrame(50),
      label: 'A',
      color: '#f00',
      scope: 'global' as const,
      linkedClipId: null,
      clipId: toClipId('nonexistent'),
    };
    const result = dispatch(state, makeTx('Add', [{ type: 'ADD_MARKER', marker }]));
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('NOT_FOUND');
  });

  it('MOVE_CLIP shifts a linked point marker by the same delta', () => {
    const state = makeBaseState();
    const marker = {
      type: 'point' as const,
      id: toMarkerId('m1'),
      frame: toFrame(50),
      label: 'A',
      color: '#f00',
      scope: 'global' as const,
      linkedClipId: null,
      clipId: toClipId('clip-1'),
    };
    let next = applyOperation(state, { type: 'ADD_MARKER', marker });
    next = applyOperation(next, { type: 'MOVE_CLIP', clipId: toClipId('clip-1'), newTimelineStart: toFrame(200) });
    expect(next.timeline.markers).toHaveLength(1);
    const m = next.timeline.markers[0] as { type: 'point'; frame: number };
    expect(m.frame).toBe(250); // 50 + 200
    expect(checkInvariants(next)).toEqual([]);
  });

  it('MOVE_CLIP shifts a linked range marker (frameStart and frameEnd) by the same delta', () => {
    const state = makeBaseState();
    const marker = {
      type: 'range' as const,
      id: toMarkerId('r1'),
      frameStart: toFrame(10),
      frameEnd: toFrame(40),
      label: 'R',
      color: '#f00',
      scope: 'global' as const,
      linkedClipId: null,
      clipId: toClipId('clip-1'),
    };
    let next = applyOperation(state, { type: 'ADD_MARKER', marker });
    next = applyOperation(next, { type: 'MOVE_CLIP', clipId: toClipId('clip-1'), newTimelineStart: toFrame(100) });
    const r = next.timeline.markers[0] as { frameStart: number; frameEnd: number };
    expect(r.frameStart).toBe(110); // 10 + 100 (delta: clip was at 0, moved to 100)
    expect(r.frameEnd).toBe(140);   // 40 + 100
    expect(checkInvariants(next)).toEqual([]);
  });

  it('MOVE_CLIP does NOT shift markers with a different clipId', () => {
    const state = makeBaseState();
    const clip2 = createClip({
      id: 'clip-2',
      assetId: 'asset-1',
      trackId: 'track-1',
      timelineStart: toFrame(200),
      timelineEnd: toFrame(300),
      mediaIn: toFrame(0),
      mediaOut: toFrame(100),
    });
    const trackWithTwo = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [state.timeline.tracks[0]!.clips[0]!, clip2] });
    const tl = createTimeline({ ...state.timeline, tracks: [trackWithTwo] });
    const state2 = createTimelineState({ timeline: tl, assetRegistry: state.assetRegistry });
    const marker = {
      type: 'point' as const,
      id: toMarkerId('m1'),
      frame: toFrame(250),
      label: 'B',
      color: '#0f0',
      scope: 'global' as const,
      linkedClipId: null,
      clipId: toClipId('clip-2'),
    };
    let next = applyOperation(state2, { type: 'ADD_MARKER', marker });
    next = applyOperation(next, { type: 'MOVE_CLIP', clipId: toClipId('clip-1'), newTimelineStart: toFrame(50) });
    const m = next.timeline.markers[0] as { frame: number };
    expect(m.frame).toBe(250); // unchanged — linked to clip-2, not clip-1
    expect(checkInvariants(next)).toEqual([]);
  });

  it('MOVE_CLIP does NOT shift unlinked markers (no clipId)', () => {
    const state = makeBaseState();
    const marker = {
      type: 'point' as const,
      id: toMarkerId('m1'),
      frame: toFrame(50),
      label: 'A',
      color: '#f00',
      scope: 'global' as const,
      linkedClipId: null,
    };
    let next = applyOperation(state, { type: 'ADD_MARKER', marker });
    next = applyOperation(next, { type: 'MOVE_CLIP', clipId: toClipId('clip-1'), newTimelineStart: toFrame(200) });
    const m = next.timeline.markers[0] as { frame: number };
    expect(m.frame).toBe(50); // unchanged — no clipId
    expect(checkInvariants(next)).toEqual([]);
  });
});

describe('Phase 3 Step 2 — BeatGrid snap points', () => {
  it('buildSnapIndex with a beat grid includes beat frames', () => {
    const state = makeBaseState();
    const beatGrid = { bpm: 60, timeSignature: [4, 4] as const, offset: toFrame(0) };
    const next = applyOperation(state, { type: 'ADD_BEAT_GRID', beatGrid });
    const index = buildSnapIndex(next, toFrame(0));
    const beatPoints = index.points.filter((p) => p.type === 'BeatGrid');
    expect(beatPoints.length).toBeGreaterThan(0);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('buildSnapIndex without a beat grid: beat frames absent', () => {
    const state = makeBaseState();
    const index = buildSnapIndex(state, toFrame(0));
    const beatPoints = index.points.filter((p) => p.type === 'BeatGrid');
    expect(beatPoints).toHaveLength(0);
  });

  it('Beat frames do not exceed timeline.duration', () => {
    const state = makeBaseState();
    const beatGrid = { bpm: 120, timeSignature: [4, 4] as const, offset: toFrame(0) };
    const next = applyOperation(state, { type: 'ADD_BEAT_GRID', beatGrid });
    const index = buildSnapIndex(next, toFrame(0));
    const dur = next.timeline.duration;
    for (const p of index.points) {
      if (p.type === 'BeatGrid') expect(p.frame).toBeLessThan(dur);
    }
    expect(checkInvariants(next)).toEqual([]);
  });
});

describe('Phase 3 Step 2 — marker search', () => {
  it('findMarkersByColor returns only exact color matches', () => {
    const state = makeBaseState();
    let next = applyOperation(state, {
      type: 'ADD_MARKER',
      marker: { type: 'point', id: toMarkerId('m1'), frame: toFrame(10), label: 'A', color: '#ff0000', scope: 'global', linkedClipId: null },
    });
    next = applyOperation(next, {
      type: 'ADD_MARKER',
      marker: { type: 'point', id: toMarkerId('m2'), frame: toFrame(20), label: 'B', color: '#00ff00', scope: 'global', linkedClipId: null },
    });
    next = applyOperation(next, {
      type: 'ADD_MARKER',
      marker: { type: 'point', id: toMarkerId('m3'), frame: toFrame(30), label: 'C', color: '#ff0000', scope: 'global', linkedClipId: null },
    });
    const red = findMarkersByColor(next, '#ff0000');
    expect(red).toHaveLength(2);
    expect(red.every((m) => m.color === '#ff0000')).toBe(true);
    expect(findMarkersByColor(next, '#00ff00')).toHaveLength(1);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('findMarkersByLabel is case-insensitive substring match', () => {
    const state = makeBaseState();
    let next = applyOperation(state, {
      type: 'ADD_MARKER',
      marker: { type: 'point', id: toMarkerId('m1'), frame: toFrame(10), label: 'Foo Bar', color: '#f00', scope: 'global', linkedClipId: null },
    });
    expect(findMarkersByLabel(next, 'foo')).toHaveLength(1);
    expect(findMarkersByLabel(next, 'FOO')).toHaveLength(1);
    expect(findMarkersByLabel(next, 'bar')).toHaveLength(1);
    expect(findMarkersByLabel(next, 'o b')).toHaveLength(1);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('findMarkersByLabel returns [] when no match', () => {
    const state = makeBaseState();
    const result = findMarkersByLabel(state, 'nonexistent');
    expect(result).toEqual([]);
  });
});
