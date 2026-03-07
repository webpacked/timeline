/**
 * KeyframeTool (Pen tool) — Phase 4 Step 4
 *
 * Click on a clip's effect lane to add a keyframe.
 * Click an existing keyframe to delete (via Delete key). Drag keyframe to move.
 *
 * RULES:
 *   - onPointerMove never dispatches; returns ProvisionalState for preview
 *   - onPointerUp never mutates instance state (capture-before-reset)
 *   - Every instance variable reset in onCancel()
 */

import type {
  ITool,
  ToolContext,
  TimelinePointerEvent,
  TimelineKeyEvent,
  ProvisionalState,
} from './types';
import { toToolId, type ToolId, type SnapPointType } from './types';
import type { ClipId, Clip } from '../types/clip';
import type { EffectId } from '../types/effect';
import type { KeyframeId, Keyframe } from '../types/keyframe';
import type { TimelineState } from '../types/state';
import type { Transaction } from '../types/operations';
import type { TimelineFrame } from '../types/frame';
import { toFrame } from '../types/frame';
import { toKeyframeId } from '../types/keyframe';
import { LINEAR_EASING } from '../types/easing';
import { applyOperation } from '../engine/apply';
import { nearest } from '../snap-index';

const KEYFRAME_HIT_RADIUS_PX = 6;
const SNAP_RADIUS_FRAMES = 5;

function findClip(state: TimelineState, clipId: ClipId): Clip | undefined {
  for (const track of state.timeline.tracks) {
    const c = track.clips.find((c) => c.id === clipId);
    if (c) return c;
  }
  return undefined;
}

function findKeyframeAt(
  clip: Clip,
  x: number,
  pixelsPerFrame: number,
): { effectId: EffectId; keyframe: Keyframe } | null {
  const effects = clip.effects ?? [];
  for (const effect of effects) {
    for (const kf of effect.keyframes) {
      const kfPx = kf.frame * pixelsPerFrame;
      if (Math.abs(x - kfPx) <= KEYFRAME_HIT_RADIUS_PX) {
        return { effectId: effect.id, keyframe: kf };
      }
    }
  }
  return null;
}

let _txSeq = 0;
function txId(): string {
  return `keyframe-tx-${++_txSeq}`;
}

export class KeyframeTool implements ITool {
  readonly id: ToolId = toToolId('keyframe');
  readonly shortcutKey: string = 'P';

  private draggingKeyframe: {
    clipId: ClipId;
    effectId: EffectId;
    keyframeId: KeyframeId;
    startX: number;
    startFrame: TimelineFrame;
  } | null = null;
  private activeClipId: ClipId | null = null;
  private activeEffectId: EffectId | null = null;
  private pendingAddKeyframe: {
    clipId: ClipId;
    effectId: EffectId;
    targetFrame: TimelineFrame;
  } | null = null;

  getCursor(_ctx: ToolContext): string {
    return 'crosshair';
  }

  getSnapCandidateTypes(): readonly SnapPointType[] {
    return ['ClipStart', 'ClipEnd', 'Marker', 'BeatGrid'];
  }

  onPointerDown(event: TimelinePointerEvent, ctx: ToolContext): void {
    if (event.clipId === null) return;

    const clip = findClip(ctx.state, event.clipId);
    if (!clip) return;

    const effects = clip.effects ?? [];
    if (effects.length === 0) return;

    const hitKf = findKeyframeAt(clip, event.x, ctx.pixelsPerFrame);
    if (hitKf) {
      this.draggingKeyframe = {
        clipId: clip.id,
        effectId: hitKf.effectId,
        keyframeId: hitKf.keyframe.id,
        startX: event.x,
        startFrame: hitKf.keyframe.frame,
      };
      return;
    }

    const firstEffect = effects[0]!;
    let targetFrame = ctx.frameAtX(event.x) as TimelineFrame;
    if (ctx.snapIndex.enabled) {
      const snapPoint = nearest(
        ctx.snapIndex,
        targetFrame,
        SNAP_RADIUS_FRAMES,
        undefined,
        ['ClipStart', 'ClipEnd', 'Marker', 'BeatGrid'],
      );
      if (snapPoint) targetFrame = snapPoint.frame as TimelineFrame;
    }
    this.activeClipId = clip.id;
    this.activeEffectId = firstEffect.id;
    this.pendingAddKeyframe = {
      clipId: clip.id,
      effectId: firstEffect.id,
      targetFrame,
    };
  }

  onPointerMove(event: TimelinePointerEvent, ctx: ToolContext): ProvisionalState | null {
    if (this.draggingKeyframe === null) return null;

    const clip = findClip(ctx.state, this.draggingKeyframe.clipId);
    if (!clip) return null;

    const dragDeltaX = event.x - this.draggingKeyframe.startX;
    const deltaFrames = Math.round(dragDeltaX / ctx.pixelsPerFrame);
    let newFrame = Math.max(0, this.draggingKeyframe.startFrame + deltaFrames) as TimelineFrame;
    if (ctx.snapIndex.enabled) {
      const snapPoint = nearest(
        ctx.snapIndex,
        newFrame,
        SNAP_RADIUS_FRAMES,
        undefined,
        ['ClipStart', 'ClipEnd', 'Marker', 'BeatGrid'],
      );
      if (snapPoint) newFrame = snapPoint.frame as TimelineFrame;
    }

    const nextState = applyOperation(ctx.state, {
      type: 'MOVE_KEYFRAME',
      clipId: this.draggingKeyframe.clipId,
      effectId: this.draggingKeyframe.effectId,
      keyframeId: this.draggingKeyframe.keyframeId,
      newFrame,
    });

    const updatedClip = nextState.timeline.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === this.draggingKeyframe!.clipId);
    if (!updatedClip) return null;

    return {
      clips: [updatedClip],
      isProvisional: true,
    };
  }

  onPointerUp(event: TimelinePointerEvent, ctx: ToolContext): Transaction | null {
    const dragging = this.draggingKeyframe;
    const pendingAdd = this.pendingAddKeyframe;

    this.draggingKeyframe = null;
    this.activeClipId = null;
    this.activeEffectId = null;
    this.pendingAddKeyframe = null;

    if (pendingAdd !== null) {
      return {
        id: txId(),
        label: 'Add keyframe',
        timestamp: Date.now(),
        operations: [
          {
            type: 'ADD_KEYFRAME',
            clipId: pendingAdd.clipId,
            effectId: pendingAdd.effectId,
            keyframe: {
              id: toKeyframeId(`kf-${Date.now()}`),
              frame: pendingAdd.targetFrame,
              value: 1.0,
              easing: LINEAR_EASING,
            },
          },
        ],
      };
    }

    if (dragging === null) return null;

    const dragDeltaX = event.x - dragging.startX;
    const deltaFrames = Math.round(dragDeltaX / ctx.pixelsPerFrame);
    let newFrame = Math.max(0, dragging.startFrame + deltaFrames) as TimelineFrame;
    if (ctx.snapIndex.enabled) {
      const snapPoint = nearest(
        ctx.snapIndex,
        newFrame,
        SNAP_RADIUS_FRAMES,
        undefined,
        ['ClipStart', 'ClipEnd', 'Marker', 'BeatGrid'],
      );
      if (snapPoint) newFrame = snapPoint.frame as TimelineFrame;
    }

    if (newFrame === dragging.startFrame) return null;

    return {
      id: txId(),
      label: 'Move keyframe',
      timestamp: Date.now(),
      operations: [
        {
          type: 'MOVE_KEYFRAME',
          clipId: dragging.clipId,
          effectId: dragging.effectId,
          keyframeId: dragging.keyframeId,
          newFrame,
        },
      ],
    };
  }

  onKeyDown(event: TimelineKeyEvent, ctx: ToolContext): Transaction | null {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return null;

    const dragging = this.draggingKeyframe;
    this.draggingKeyframe = null;
    this.activeClipId = null;
    this.activeEffectId = null;
    this.pendingAddKeyframe = null;

    if (dragging === null) return null;

    return {
      id: txId(),
      label: 'Delete keyframe',
      timestamp: Date.now(),
      operations: [
        {
          type: 'DELETE_KEYFRAME',
          clipId: dragging.clipId,
          effectId: dragging.effectId,
          keyframeId: dragging.keyframeId,
        },
      ],
    };
  }

  onKeyUp(_event: TimelineKeyEvent, _ctx: ToolContext): void {}

  onCancel(): void {
    this.draggingKeyframe = null;
    this.activeClipId = null;
    this.activeEffectId = null;
    this.pendingAddKeyframe = null;
  }
}
