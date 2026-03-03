/**
 * RippleDeleteTool — Phase 2 Step 6
 *
 * Click a clip to delete it. All clips to the right on the same track
 * shift left by the deleted clip's duration. No drag. No provisional state.
 *
 * TRANSACTION:
 *   DELETE_CLIP { clipId }
 *   MOVE_CLIP×N — one per downstream clip, sorted LEFT-TO-RIGHT
 *
 * MOVE_CLIP ordering rule (OPERATIONS.md: delta is negative → left-to-right):
 *   Leftmost clip moves first into space vacated by DELETE_CLIP.
 *   Each subsequent clip moves into space vacated by the one before it.
 *   Wrong order → OVERLAP rejection from rolling-state validator.
 *
 * ACTIVATION: RippleDeleteTool is activated programmatically (e.g. when Delete
 * is pressed while a clip is selected in SelectionTool). shortcutKey is empty
 * because 'delete' is not a single-char tool-activation key.
 *
 * RULES:
 *   - Zero imports from React, DOM, @timeline/react, @timeline/ui
 *   - onPointerMove never dispatches (returns null always)
 *   - onPointerUp never mutates instance state
 *   - Every instance variable appears in onCancel()
 *   - Capture-before-reset pattern applied in onPointerUp
 */

import type {
  ITool,
  ToolContext,
  TimelinePointerEvent,
  TimelineKeyEvent,
  ProvisionalState,
} from './types';
import {
  toToolId,
  type ToolId,
  type SnapPointType,
} from './types';
import type { ClipId, Clip }       from '../types/clip';
import type { TimelineFrame }       from '../types/frame';
import type { OperationPrimitive, Transaction } from '../types/operations';
import type { TimelineState }       from '../types/state';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findClip(state: TimelineState, clipId: ClipId): Clip | undefined {
  for (const track of state.timeline.tracks) {
    const c = track.clips.find(c => c.id === clipId);
    if (c) return c;
  }
  return undefined;
}

let _txSeq = 0;
function txId(): string { return `ripple-delete-tx-${++_txSeq}`; }

// ---------------------------------------------------------------------------
// computeRippleDeleteOps — pure function, module scope, not exported
// ---------------------------------------------------------------------------

/**
 * Returns the operations array for a ripple-delete of `clip`:
 *   [DELETE_CLIP, ...MOVE_CLIP×N (left-to-right)]
 *
 * MOVE_CLIP sort: LEFT-TO-RIGHT (ascending timelineStart).
 * Reason: delta is negative (clips shift left). Per OPERATIONS.md:
 *   -delta → sort left-to-right so each clip moves into already-vacated space.
 */
function computeRippleDeleteOps(
  clip:  Clip,
  state: TimelineState,
): OperationPrimitive[] {
  const deletedDuration = (clip.timelineEnd - clip.timelineStart) as number;

  const track = state.timeline.tracks.find(t => t.id === clip.trackId);

  // Clips strictly to the right: those whose start >= clip's end
  const rightClips = (track?.clips ?? [])
    .filter(c => c.timelineStart >= clip.timelineEnd)
    .sort((a, b) => a.timelineStart - b.timelineStart);  // LEFT-TO-RIGHT — -delta rule

  return [
    { type: 'DELETE_CLIP', clipId: clip.id },
    ...rightClips.map(c => ({
      type:             'MOVE_CLIP' as const,
      clipId:            c.id,
      newTimelineStart: (c.timelineStart - deletedDuration) as TimelineFrame,
    })),
  ];
}

// ---------------------------------------------------------------------------
// RippleDeleteTool
// ---------------------------------------------------------------------------

export class RippleDeleteTool implements ITool {
  readonly id:          ToolId = toToolId('ripple-delete');
  readonly shortcutKey: string = '';   // not a single-char activation key — activated programmatically

  // ── 1 click-recording var ─────────────────────────────────────────────────
  /**
   * Clip targeted at onPointerDown. Read and cleared at onPointerUp.
   * No drag, no delta, no edge — this tool is click-only.
   */
  private pendingClipId: ClipId | null = null;

  // ── 1 cursor-staging var ──────────────────────────────────────────────────
  /** Staged by onPointerMove — getCursor() has no event parameter. */
  private isHoveringClip: boolean = false;

  // ── ITool: getCursor ──────────────────────────────────────────────────────

  getCursor(_ctx: ToolContext): string {
    if (this.isHoveringClip) return 'pointer';  // "click to delete this"
    return 'default';
  }

  // ── ITool: getSnapCandidateTypes ─────────────────────────────────────────

  getSnapCandidateTypes(): readonly SnapPointType[] {
    return [];  // no drag, no snap
  }

  // ── ITool: onPointerDown ──────────────────────────────────────────────────

  onPointerDown(event: TimelinePointerEvent, _ctx: ToolContext): void {
    if (event.clipId === null) return;  // clicked empty space
    this.pendingClipId = event.clipId;
  }

  // ── ITool: onPointerMove ──────────────────────────────────────────────────

  onPointerMove(event: TimelinePointerEvent, _ctx: ToolContext): ProvisionalState | null {
    this.isHoveringClip = event.clipId !== null;
    return null;  // no ghost — delete is instantaneous, no preview needed
  }

  // ── ITool: onPointerUp ────────────────────────────────────────────────────

  onPointerUp(_event: TimelinePointerEvent, ctx: ToolContext): Transaction | null {
    // Capture-before-reset pattern
    const clipId = this.pendingClipId;
    this._resetState();

    if (!clipId) return null;  // empty-space click

    // Read clip from ctx.state (committed, current)
    const liveClip = findClip(ctx.state, clipId);
    if (!liveClip) return null;  // defensive: clip may have already been removed

    const operations = computeRippleDeleteOps(liveClip, ctx.state);

    return {
      id:        txId(),
      label:     'Ripple Delete',
      timestamp: Date.now(),
      operations,
    };
  }

  // ── ITool: onKeyDown / onKeyUp ────────────────────────────────────────────

  onKeyDown(_event: TimelineKeyEvent, _ctx: ToolContext): Transaction | null {
    return null;
  }

  onKeyUp(_event: TimelineKeyEvent, _ctx: ToolContext): void {}

  // ── ITool: onCancel ───────────────────────────────────────────────────────
  /** Reset ALL instance state. Every variable must appear here. */
  onCancel(): void {
    this.pendingClipId  = null;
    this.isHoveringClip = false;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _resetState(): void {
    this.pendingClipId = null;
    // isHoveringClip intentionally NOT reset — it is a cursor-staging var, not click state
  }
}
