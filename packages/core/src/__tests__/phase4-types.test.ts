/**
 * Phase 4 Step 1 — Type and factory tests (no dispatch, no state).
 * Pure shape and default checks.
 */

import { describe, it, expect } from 'vitest';
import { LINEAR_EASING, HOLD_EASING } from '../types/easing';
import {
  toKeyframeId,
  type Keyframe,
} from '../types/keyframe';
import { createEffect, toEffectId } from '../types/effect';
import { DEFAULT_CLIP_TRANSFORM } from '../types/clip-transform';
import { DEFAULT_AUDIO_PROPERTIES } from '../types/audio-properties';
import { createTransition, toTransitionId } from '../types/transition';
import { LINEAR_EASING as LINEAR } from '../types/easing';
import { createTrackGroup, toTrackGroupId } from '../types/track-group';
import { createLinkGroup, toLinkGroupId } from '../types/link-group';
import { createClip, toClipId } from '../types/clip';
import { createTrack } from '../types/track';
import { createTimeline } from '../types/timeline';
import { toFrame } from '../types/frame';

describe('Phase 4 — Easing', () => {
  it('LINEAR_EASING.kind === "Linear"', () => {
    expect(LINEAR_EASING.kind).toBe('Linear');
  });

  it('HOLD_EASING.kind === "Hold"', () => {
    expect(HOLD_EASING.kind).toBe('Hold');
  });

  it('BezierCurve easing has p1x, p1y, p2x, p2y', () => {
    const bezier = {
      kind: 'BezierCurve' as const,
      p1x: 0.25,
      p1y: 0.1,
      p2x: 0.75,
      p2y: 0.9,
    };
    expect(bezier.p1x).toBe(0.25);
    expect(bezier.p1y).toBe(0.1);
    expect(bezier.p2x).toBe(0.75);
    expect(bezier.p2y).toBe(0.9);
  });
});

describe('Phase 4 — Keyframe', () => {
  it('toKeyframeId returns branded string', () => {
    const id = toKeyframeId('kf-1');
    expect(id).toBe('kf-1');
    expect(typeof id).toBe('string');
  });

  it('Keyframe has frame, value, easing fields', () => {
    const kf: Keyframe = {
      id: toKeyframeId('kf-1'),
      frame: toFrame(100),
      value: 0.5,
      easing: LINEAR_EASING,
    };
    expect(kf.frame).toBe(100);
    expect(kf.value).toBe(0.5);
    expect(kf.easing).toEqual(LINEAR_EASING);
  });
});

describe('Phase 4 — Effect', () => {
  it('createEffect defaults: enabled true, renderStage preComposite, keyframes []', () => {
    const e = createEffect(toEffectId('eff-1'), 'blur');
    expect(e.enabled).toBe(true);
    expect(e.renderStage).toBe('preComposite');
    expect(e.keyframes).toEqual([]);
  });
});

describe('Phase 4 — ClipTransform', () => {
  it('DEFAULT_CLIP_TRANSFORM.opacity.value === 1', () => {
    expect(DEFAULT_CLIP_TRANSFORM.opacity.value).toBe(1);
  });

  it('DEFAULT_CLIP_TRANSFORM.scaleX.value === 1', () => {
    expect(DEFAULT_CLIP_TRANSFORM.scaleX.value).toBe(1);
  });

  it('DEFAULT_CLIP_TRANSFORM.positionX.keyframes is empty', () => {
    expect(DEFAULT_CLIP_TRANSFORM.positionX.keyframes).toEqual([]);
  });
});

describe('Phase 4 — AudioProperties', () => {
  it('DEFAULT_AUDIO_PROPERTIES.mute === false', () => {
    expect(DEFAULT_AUDIO_PROPERTIES.mute).toBe(false);
  });

  it('DEFAULT_AUDIO_PROPERTIES.channelRouting === "stereo"', () => {
    expect(DEFAULT_AUDIO_PROPERTIES.channelRouting).toBe('stereo');
  });

  it('DEFAULT_AUDIO_PROPERTIES.gain.value === 0', () => {
    expect(DEFAULT_AUDIO_PROPERTIES.gain.value).toBe(0);
  });
});

describe('Phase 4 — Transition', () => {
  it('createTransition defaults: alignment centerOnCut, easing LINEAR_EASING', () => {
    const t = createTransition(toTransitionId('tr-1'), 'dissolve', 15);
    expect(t.alignment).toBe('centerOnCut');
    expect(t.easing).toEqual(LINEAR);
  });
});

describe('Phase 4 — TrackGroup', () => {
  it('createTrackGroup defaults: collapsed false, trackIds []', () => {
    const g = createTrackGroup(toTrackGroupId('grp-1'), 'Group');
    expect(g.collapsed).toBe(false);
    expect(g.trackIds).toEqual([]);
  });
});

describe('Phase 4 — LinkGroup', () => {
  it('createLinkGroup stores clipIds', () => {
    const g = createLinkGroup(toLinkGroupId('link-1'), [
      toClipId('c1'),
      toClipId('c2'),
    ]);
    expect(g.clipIds).toHaveLength(2);
    expect(g.clipIds[0]).toBe('c1');
    expect(g.clipIds[1]).toBe('c2');
  });
});

describe('Phase 4 — Backward compat (createClip, createTrack, createTimeline)', () => {
  it('createClip still works with no new fields', () => {
    const clip = createClip({
      id: 'c1',
      assetId: 'a1',
      trackId: 't1',
      timelineStart: toFrame(0),
      timelineEnd: toFrame(100),
      mediaIn: toFrame(0),
      mediaOut: toFrame(100),
    });
    expect(clip.id).toBe('c1');
    expect(clip.timelineStart).toBe(0);
    expect(clip.effects).toBeUndefined();
    expect(clip.transform).toBeUndefined();
    expect(clip.audio).toBeUndefined();
    expect(clip.transition).toBeUndefined();
  });

  it('createTrack still works with no new fields', () => {
    const track = createTrack({ id: 't1', name: 'V1', type: 'video' });
    expect(track.id).toBe('t1');
    expect(track.name).toBe('V1');
    expect(track.blendMode).toBeUndefined();
    expect(track.opacity).toBeUndefined();
    expect(track.groupId).toBeUndefined();
  });

  it('createTimeline still works with no new fields', () => {
    const tl = createTimeline({
      id: 'tl1',
      name: 'Seq',
      fps: 30,
      duration: toFrame(1000),
    });
    expect(tl.id).toBe('tl1');
    expect(tl.trackGroups).toBeUndefined();
    expect(tl.linkGroups).toBeUndefined();
  });
});
