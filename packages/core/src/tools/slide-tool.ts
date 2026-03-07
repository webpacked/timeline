/**
 * SlideTool — Phase 7 Step 5
 *
 * Moves a clip left/right on the timeline. Neighbors trim to fill:
 * left neighbor's end resizes to abut; right neighbor moves and resizes.
 * No ripple — total duration unchanged.
 *
 * Uses: MOVE_CLIP, RESIZE_CLIP (edge 'start' | 'end').
 * Capture-before-reset in onPointerUp.
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
import type { Track } from '../types/track';
import type { TimelineFrame } from '../types/frame';
import type { TimelineState } from '../types/state';
import type { Transaction, OperationPrimitive } from '../types/operations';
import { toFrame } from '../types/frame';
import { findClipById } from '../engine/frame-resolver';

function findClipAndTrack(
  state: TimelineState,
  clipId: ClipId,
): { clip: Clip; track: Track } | null {
  const found = findClipById(state, clipId);
  return found ? { clip: found.clip, track: found.track } : null;
}

function findLeftNeighbor(track: Track, clip: Clip): Clip | null {
  const clipStart = clip.timelineStart as number;
  let best: Clip | null = null;
  let bestStart = -1;
  for (const c of track.clips) {
    const s = c.timelineStart as number;
    if (s < clipStart && s > bestStart) {
      bestStart = s;
      best = c;
    }
  }
  return best;
}

function findRightNeighbor(track: Track, clip: Clip): Clip | null {
  const clipStart = clip.timelineStart as number;
  let best: Clip | null = null;
  let bestStart = Infinity;
  for (const c of track.clips) {
    const s = c.timelineStart as number;
    if (s > clipStart && s < bestStart) {
      bestStart = s;
      best = c;
    }
  }
  return best;
}

let _txSeq = 0;
function txId(): string {
  return `slide-tx-${++_txSeq}`;
}

export class SlideTool implements ITool {
  readonly id: ToolId = toToolId('slide');
  readonly shortcutKey = 'Y';

  private draggingClipId: ClipId | null = null;
  private dragStartX = 0;
  private originalStart: TimelineFrame = toFrame(0);

  getCursor(_ctx: ToolContext): string {
    if (this.draggingClipId !== null) return 'ew-resize';
    return 'grab';
  }

  getSnapCandidateTypes(): readonly SnapPointType[] {
    return ['ClipStart', 'ClipEnd'];
  }

  onPointerDown(event: TimelinePointerEvent, _ctx: ToolContext): void {
    if (event.clipId === null) return;
    const found = findClipAndTrack(_ctx.state, event.clipId);
    if (!found) return;
    this.draggingClipId = event.clipId;
    this.dragStartX = event.x;
    this.originalStart = found.clip.timelineStart;
  }

  onPointerMove(event: TimelinePointerEvent, ctx: ToolContext): ProvisionalState | null {
    if (this.draggingClipId === null) return null;
    const found = findClipAndTrack(ctx.state, this.draggingClipId);
    if (!found) return null;
    const { clip, track } = found;
    const left = findLeftNeighbor(track, clip);
    const right = findRightNeighbor(track, clip);
    const durationFrames = (clip.timelineEnd as number) - (clip.timelineStart as number);
    const deltaFrames = Math.round((event.x - this.dragStartX) / ctx.pixelsPerFrame);
    let newStartN = (this.originalStart as number) + deltaFrames;
    const minStart = left
      ? (left.timelineEnd as number)
      : 0;
    const maxStart = right
      ? (right.timelineStart as number) - durationFrames
      : (ctx.state.timeline.duration as number) - durationFrames;
    newStartN = Math.max(minStart, Math.min(maxStart, newStartN));
    const newStart = toFrame(newStartN);
    const ghostClip: Clip = {
      ...clip,
      timelineStart: newStart,
      timelineEnd: toFrame(newStartN + durationFrames),
    };
    return { clips: [ghostClip], isProvisional: true };
  }

  onPointerUp(event: TimelinePointerEvent, ctx: ToolContext): Transaction | null {
    const clipId = this.draggingClipId;
    const startX = this.dragStartX;
    const origStart = this.originalStart;
    this.draggingClipId = null;
    this.dragStartX = 0;
    this.originalStart = toFrame(0);

    if (clipId === null) return null;

    const found = findClipAndTrack(ctx.state, clipId);
    if (!found) return null;
    const { clip, track } = found;
    const left = findLeftNeighbor(track, clip);
    const right = findRightNeighbor(track, clip);
    const durationFrames = (clip.timelineEnd as number) - (clip.timelineStart as number);
    const deltaFrames = Math.round((event.x - startX) / ctx.pixelsPerFrame);
    let newStartN = (origStart as number) + deltaFrames;
    const minStart = left ? (left.timelineEnd as number) : 0;
    const maxStart = right
      ? (right.timelineStart as number) - durationFrames
      : (ctx.state.timeline.duration as number) - durationFrames;
    newStartN = Math.max(minStart, Math.min(maxStart, newStartN));
    const newStart = toFrame(newStartN);
    if (newStartN === (origStart as number)) return null;

    const operations: OperationPrimitive[] = [];
    if (left) {
      operations.push({
        type: 'RESIZE_CLIP',
        clipId: left.id,
        edge: 'end',
        newFrame: newStart,
      });
    }
    operations.push({
      type: 'MOVE_CLIP',
      clipId,
      newTimelineStart: newStart,
    });
    if (right) {
      const newRightStart = newStartN + durationFrames;
      operations.push({
        type: 'MOVE_CLIP',
        clipId: right.id,
        newTimelineStart: toFrame(newRightStart),
      });
      operations.push({
        type: 'RESIZE_CLIP',
        clipId: right.id,
        edge: 'end',
        newFrame: toFrame((right.timelineEnd as number)),
      });
    }

    return {
      id: txId(),
      label: 'Slide',
      timestamp: Date.now(),
      operations,
    };
  }

  onKeyDown(_event: TimelineKeyEvent, _ctx: ToolContext): Transaction | null {
    return null;
  }

  onKeyUp(_event: TimelineKeyEvent, _ctx: ToolContext): void {}

  onCancel(): void {
    this.draggingClipId = null;
    this.dragStartX = 0;
    this.originalStart = toFrame(0);
  }
}
