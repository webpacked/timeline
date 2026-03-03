/**
 * TransitionTool — Phase 4 Step 4
 *
 * Drag from a clip's right edge to create or resize a transition.
 * Click on an existing transition area to delete it.
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
import type { TimelineState } from '../types/state';
import type { Transaction } from '../types/operations';
import type { TimelineFrame } from '../types/frame';
import { createTransition, toTransitionId } from '../types/transition';
import { LINEAR_EASING } from '../types/easing';
import { applyOperation } from '../engine/apply';

const TRANSITION_EDGE_THRESHOLD_PX = 8;

function findClip(state: TimelineState, clipId: ClipId): Clip | undefined {
  for (const track of state.timeline.tracks) {
    const c = track.clips.find((c) => c.id === clipId);
    if (c) return c;
  }
  return undefined;
}

function findClipAtRightEdge(
  state: TimelineState,
  x: number,
  pixelsPerFrame: number,
): { clip: Clip; trackIndex: number } | null {
  for (let ti = 0; ti < state.timeline.tracks.length; ti++) {
    const track = state.timeline.tracks[ti]!;
    for (const clip of track.clips) {
      const rightEdgePx = clip.timelineEnd * pixelsPerFrame;
      if (Math.abs(x - rightEdgePx) <= TRANSITION_EDGE_THRESHOLD_PX) {
        return { clip, trackIndex: ti };
      }
    }
  }
  return null;
}

function findClipInTransitionZone(
  state: TimelineState,
  x: number,
  pixelsPerFrame: number,
): Clip | null {
  for (const track of state.timeline.tracks) {
    for (const clip of track.clips) {
      if (!clip.transition) continue;
      const rightEdgePx = clip.timelineEnd * pixelsPerFrame;
      const leftOfTransitionPx = rightEdgePx - clip.transition.durationFrames * pixelsPerFrame;
      if (x >= leftOfTransitionPx && x <= rightEdgePx) return clip;
    }
  }
  return null;
}

let _txSeq = 0;
function txId(): string {
  return `transition-tx-${++_txSeq}`;
}

export class TransitionTool implements ITool {
  readonly id: ToolId = toToolId('transition');
  readonly shortcutKey: string = 'T';

  private pendingClipId: ClipId | null = null;
  private dragStartX: number = 0;
  private pendingDeleteTransitionClipId: ClipId | null = null;

  getCursor(_ctx: ToolContext): string {
    return 'ew-resize';
  }

  getSnapCandidateTypes(): readonly SnapPointType[] {
    return ['ClipStart', 'ClipEnd', 'Marker', 'BeatGrid'];
  }

  onPointerDown(event: TimelinePointerEvent, ctx: ToolContext): void {
    const { state, pixelsPerFrame } = ctx;
    const x = event.x;

    // Prefer starting a drag from the right edge over deleting the transition
    const atEdge = findClipAtRightEdge(state, x, pixelsPerFrame);
    if (atEdge) {
      this.pendingClipId = atEdge.clip.id;
      this.dragStartX = x;
      return;
    }

    const inTransition = findClipInTransitionZone(state, x, pixelsPerFrame);
    if (inTransition) {
      this.pendingDeleteTransitionClipId = inTransition.id;
    }
  }

  onPointerMove(event: TimelinePointerEvent, ctx: ToolContext): ProvisionalState | null {
    if (this.pendingClipId === null) return null;

    const clip = findClip(ctx.state, this.pendingClipId);
    if (!clip) return null;

    const dragDeltaX = event.x - this.dragStartX;
    const deltaFrames = Math.round(dragDeltaX / ctx.pixelsPerFrame);
    const durationFrames = Math.max(1, deltaFrames);

    const transition = createTransition(
      toTransitionId(`tr-${clip.id}-preview`),
      'dissolve',
      durationFrames,
      'centerOnCut',
      LINEAR_EASING,
    );

    let nextState: TimelineState;
    if (clip.transition) {
      nextState = applyOperation(ctx.state, {
        type: 'SET_TRANSITION_DURATION',
        clipId: clip.id,
        durationFrames,
      });
    } else {
      nextState = applyOperation(ctx.state, {
        type: 'ADD_TRANSITION',
        clipId: clip.id,
        transition,
      });
    }

    const updatedClip = nextState.timeline.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === this.pendingClipId);
    if (!updatedClip) return null;

    return {
      clips: [updatedClip],
      isProvisional: true,
    };
  }

  onPointerUp(event: TimelinePointerEvent, ctx: ToolContext): Transaction | null {
    const pendingClipId = this.pendingClipId;
    const dragStartX = this.dragStartX;
    const pendingDelete = this.pendingDeleteTransitionClipId;

    this.pendingClipId = null;
    this.dragStartX = 0;
    this.pendingDeleteTransitionClipId = null;

    if (pendingDelete !== null) {
      return {
        id: txId(),
        label: 'Delete transition',
        timestamp: Date.now(),
        operations: [{ type: 'DELETE_TRANSITION', clipId: pendingDelete }],
      };
    }

    if (pendingClipId === null) return null;

    const clip = findClip(ctx.state, pendingClipId);
    if (!clip) return null;

    const dragDeltaX = event.x - dragStartX;
    const deltaFrames = Math.round(dragDeltaX / ctx.pixelsPerFrame);
    const durationFrames = Math.max(1, deltaFrames);
    if (deltaFrames < 1) return null;

    if (clip.transition) {
      return {
        id: txId(),
        label: 'Set transition duration',
        timestamp: Date.now(),
        operations: [
          {
            type: 'SET_TRANSITION_DURATION',
            clipId: pendingClipId,
            durationFrames,
          },
        ],
      };
    }

    const transition = createTransition(
      toTransitionId(`tr-${clip.id}-${Date.now()}`),
      'dissolve',
      durationFrames,
      'centerOnCut',
      LINEAR_EASING,
    );
    return {
      id: txId(),
      label: 'Add transition',
      timestamp: Date.now(),
      operations: [
        {
          type: 'ADD_TRANSITION',
          clipId: pendingClipId,
          transition,
        },
      ],
    };
  }

  onKeyDown(_event: TimelineKeyEvent, _ctx: ToolContext): Transaction | null {
    return null;
  }

  onKeyUp(_event: TimelineKeyEvent, _ctx: ToolContext): void {}

  onCancel(): void {
    this.pendingClipId = null;
    this.dragStartX = 0;
    this.pendingDeleteTransitionClipId = null;
  }
}
