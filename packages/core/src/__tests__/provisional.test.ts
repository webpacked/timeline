/**
 * PROVISIONAL MANAGER TESTS — Phase 1
 *
 * Gate conditions:
 * ✓ createProvisionalManager: current is null
 * ✓ setProvisional: sets current, returns new object (no mutation)
 * ✓ clearProvisional: resets current to null, returns new object (no mutation)
 * ✓ resolveClip: provisional version wins over committed when both exist
 * ✓ resolveClip: returns committed when no provisional override
 * ✓ resolveClip: returns undefined when absent from both (deleted-during-drag)
 * ✓ resolveClip: returns provisional clip even when absent from committed state
 * ✓ resolveClip: correct clip returned when multiple clips in provisional
 */

import { describe, it, expect } from 'vitest';
import {
  createProvisionalManager,
  setProvisional,
  clearProvisional,
  resolveClip,
} from '../tools/provisional';
import type { ProvisionalState } from '../tools/types';
import { createTimelineState } from '../types/state';
import { createTimeline } from '../types/timeline';
import { createTrack, toTrackId } from '../types/track';
import { createClip, toClipId } from '../types/clip';
import { createAsset, toAssetId } from '../types/asset';
import { toFrame, toTimecode } from '../types/frame';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeEmptyState() {
  const timeline = createTimeline({
    id: 'tl', name: 'T', fps: 30, duration: toFrame(9000),
    startTimecode: toTimecode('00:00:00:00'), tracks: [],
  });
  return createTimelineState({ timeline });
}

function makeClip(id: string, start: number, end: number) {
  return createClip({
    id,
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(start),
    timelineEnd:   toFrame(end),
    mediaIn:       toFrame(0),
    mediaOut:      toFrame(end - start),
  });
}

function makeStateWithClip(clip: ReturnType<typeof makeClip>) {
  const asset = createAsset({
    id: 'asset-1', name: 'A', mediaType: 'video',
    filePath: '/a.mp4', intrinsicDuration: toFrame(10000),
    nativeFps: 30, sourceTimecodeOffset: toFrame(0),
  });
  const track = createTrack({
    id: 'track-1', name: 'V1', type: 'video',
    clips: [clip],
  });
  const timeline = createTimeline({
    id: 'tl', name: 'T', fps: 30, duration: toFrame(9000),
    startTimecode: toTimecode('00:00:00:00'), tracks: [track],
  });
  return createTimelineState({
    timeline,
    assetRegistry: new Map([[toAssetId('asset-1'), asset]]),
  });
}

function makeProvisional(clips: ReturnType<typeof makeClip>[]): ProvisionalState {
  return { clips, isProvisional: true };
}

// ── createProvisionalManager ──────────────────────────────────────────────────

describe('createProvisionalManager', () => {
  it('creates a manager with current = null', () => {
    const manager = createProvisionalManager();
    expect(manager.current).toBeNull();
  });
});

// ── setProvisional ─────────────────────────────────────────────────────────────

describe('setProvisional', () => {
  it('sets current to the provided provisional state', () => {
    const clip = makeClip('c1', 0, 100);
    const provisional = makeProvisional([clip]);
    const manager = setProvisional(createProvisionalManager(), provisional);
    expect(manager.current).toBe(provisional);
  });

  it('returns a NEW object — does not mutate the original manager', () => {
    const original = createProvisionalManager();
    const clip = makeClip('c1', 0, 100);
    const next = setProvisional(original, makeProvisional([clip]));
    expect(original.current).toBeNull();    // original unchanged
    expect(next).not.toBe(original);        // different reference
  });

  it('can overwrite an existing provisional with a new one', () => {
    const clip1 = makeClip('c1', 0,  100);
    const clip2 = makeClip('c2', 0, 200);
    const m1 = setProvisional(createProvisionalManager(), makeProvisional([clip1]));
    const m2 = setProvisional(m1, makeProvisional([clip2]));
    expect(m2.current!.clips[0]!.id).toBe('c2');
    expect(m1.current!.clips[0]!.id).toBe('c1'); // m1 unchanged
  });
});

// ── clearProvisional ──────────────────────────────────────────────────────────

describe('clearProvisional', () => {
  it('resets current to null', () => {
    const clip = makeClip('c1', 0, 100);
    const withProvisional = setProvisional(createProvisionalManager(), makeProvisional([clip]));
    const cleared = clearProvisional(withProvisional);
    expect(cleared.current).toBeNull();
  });

  it('returns a NEW object — does not mutate the original manager', () => {
    const clip = makeClip('c1', 0, 100);
    const original = setProvisional(createProvisionalManager(), makeProvisional([clip]));
    const cleared = clearProvisional(original);
    expect(original.current).not.toBeNull(); // original unchanged
    expect(cleared).not.toBe(original);
  });

  it('clearing an already-null manager returns a new manager with null', () => {
    const original = createProvisionalManager();
    const cleared = clearProvisional(original);
    expect(cleared.current).toBeNull();
  });
});

// ── resolveClip ───────────────────────────────────────────────────────────────

describe('resolveClip — no provisional', () => {
  it('returns the committed clip when provisional is null', () => {
    const clip = makeClip('c1', 0, 100);
    const state = makeStateWithClip(clip);
    const manager = createProvisionalManager(); // current = null
    const result = resolveClip(toClipId('c1'), state, manager);
    expect(result).toBeDefined();
    expect(result!.timelineStart).toBe(toFrame(0));
  });

  it('returns undefined when clip absent from committed state and no provisional', () => {
    const state = makeEmptyState();
    const manager = createProvisionalManager();
    const result = resolveClip(toClipId('ghost'), state, manager);
    expect(result).toBeUndefined();
  });
});

describe('resolveClip — provisional overrides committed', () => {
  it('returns provisional version when committed and provisional differ (ghost rendering)', () => {
    const committed = makeClip('c1', 0,  100);  // at frame 0
    const ghost     = { ...committed, timelineStart: toFrame(50) }; // dragged to 50
    const state   = makeStateWithClip(committed);
    const manager = setProvisional(createProvisionalManager(), makeProvisional([ghost]));

    const result = resolveClip(toClipId('c1'), state, manager);
    expect(result?.timelineStart).toBe(toFrame(50)); // ghost wins
  });

  it('returns committed clip when provisional has different clip id', () => {
    const committed = makeClip('c1', 0, 100);
    const otherGhost = makeClip('c2', 50, 150); // different id
    const state   = makeStateWithClip(committed);
    const manager = setProvisional(createProvisionalManager(), makeProvisional([otherGhost]));

    const result = resolveClip(toClipId('c1'), state, manager);
    expect(result?.timelineStart).toBe(toFrame(0)); // committed, not ghost
  });

  it('returns correct clip when multiple clips are in provisional', () => {
    const committed1 = makeClip('c1', 0,   100);
    const committed2 = makeClip('c2', 200, 300);
    const ghost1 = { ...committed1, timelineStart: toFrame(50) };
    const ghost2 = { ...committed2, timelineStart: toFrame(250) };

    const state = makeStateWithClip(committed1); // only c1 in committed
    const manager = setProvisional(createProvisionalManager(), makeProvisional([ghost1, ghost2]));

    expect(resolveClip(toClipId('c1'), state, manager)?.timelineStart).toBe(toFrame(50));
    expect(resolveClip(toClipId('c2'), state, manager)?.timelineStart).toBe(toFrame(250));
  });
});

describe('resolveClip — deleted-during-drag case', () => {
  it('returns undefined when clip absent from both provisional and committed state', () => {
    // This is the deleted-during-drag case:
    // provisional was cleared, and the clip was also removed from committed state
    const state   = makeEmptyState();
    const manager = clearProvisional(createProvisionalManager());
    const result  = resolveClip(toClipId('ghost'), state, manager);
    expect(result).toBeUndefined();
  });

  it('returns provisional clip even when absent from committed state (added ghost)', () => {
    // A ghost of a newly "previewed" clip that doesn't exist in committed state yet
    const ghost   = makeClip('preview-clip', 0, 100);
    const state   = makeEmptyState(); // clip not in committed
    const manager = setProvisional(createProvisionalManager(), makeProvisional([ghost]));

    const result = resolveClip(toClipId('preview-clip'), state, manager);
    expect(result).toBeDefined();
    expect(result!.id).toBe('preview-clip');
  });
});
