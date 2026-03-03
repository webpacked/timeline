/**
 * SlipTool — Phase 2 Step 5
 *
 * Drag a clip to shift its media window. The clip's timeline position is
 * unchanged — only mediaIn and mediaOut move together by the same delta.
 *
 * OPERATION: Single SET_MEDIA_BOUNDS. No MOVE_CLIP. No RESIZE_CLIP. Nothing else.
 *
 * DELTA: rawDelta = event.frame - dragStartFrame (no snapping — slip is in media space)
 *
 * CLAMP:
 *   minDelta = -clip.mediaIn                           → mediaIn + delta >= 0
 *   maxDelta = asset.intrinsicDuration - clip.mediaOut → mediaOut + delta <= intrinsicDuration
 *   clampedDelta = clamp(rawDelta, minDelta, maxDelta)
 *
 * SNAP: none. getSnapCandidateTypes returns [].
 *
 * RULES:
 *   - Zero imports from React, DOM, @timeline/react, @timeline/ui
 *   - onPointerMove never dispatches
 *   - onPointerUp never mutates instance state
 *   - Every instance variable appears in onCancel()
 *   - Capture-before-reset: compute delta BEFORE _resetDragState()
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
import type { ClipId, Clip } from '../types/clip';
import type { TimelineFrame }  from '../types/frame';
import type { Transaction }    from '../types/operations';
import type { TimelineState }  from '../types/state';

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
function txId(): string { return `slip-tx-${++_txSeq}`; }

// ---------------------------------------------------------------------------
// SlipTool
// ---------------------------------------------------------------------------

export class SlipTool implements ITool {
  readonly id:          ToolId = toToolId('slip');
  readonly shortcutKey: string = 'y';   // Premiere convention for slip

  // ── 2 drag-tracking vars ──────────────────────────────────────────────────
  /** Clip being slipped. Null when idle. */
  private dragClipId:     ClipId        | null = null;
  /** Frame at which pointer went down. Delta = currentFrame - dragStartFrame. */
  private dragStartFrame: TimelineFrame | null = null;

  // ── 1 cursor-staging var ──────────────────────────────────────────────────
  /** Staged by onPointerMove — getCursor() has no event parameter. */
  private isHoveringClip: boolean = false;

  // ── ITool: getCursor ──────────────────────────────────────────────────────

  getCursor(_ctx: ToolContext): string {
    if (this.dragClipId !== null) return 'ew-resize'; // mid-drag: resize cursor
    if (this.isHoveringClip)      return 'grab';      // hovering: grab cursor
    return 'default';
  }

  // ── ITool: getSnapCandidateTypes ─────────────────────────────────────────

  getSnapCandidateTypes(): readonly SnapPointType[] {
    return [];  // slip is in media space — no timeline snapping
  }

  // ── ITool: onPointerDown ──────────────────────────────────────────────────

  onPointerDown(event: TimelinePointerEvent, _ctx: ToolContext): void {
    if (event.clipId === null) return;  // clicked empty space
    this.dragClipId     = event.clipId;
    this.dragStartFrame = event.frame;
  }

  // ── ITool: onPointerMove ──────────────────────────────────────────────────

  onPointerMove(event: TimelinePointerEvent, ctx: ToolContext): ProvisionalState | null {
    // Stage hover for getCursor()
    this.isHoveringClip = event.clipId !== null;

    // Not mid-drag
    if (this.dragClipId === null || this.dragStartFrame === null) return null;

    const liveClip = findClip(ctx.state, this.dragClipId);
    if (!liveClip) return null;

    const asset = ctx.state.assetRegistry.get(liveClip.assetId);
    if (!asset) return null;

    const rawDelta     = (event.frame - this.dragStartFrame) as number;
    const minDelta     = -liveClip.mediaIn as number;
    const maxDelta     = (asset.intrinsicDuration - liveClip.mediaOut) as number;
    const clampedDelta = Math.max(minDelta, Math.min(maxDelta, rawDelta));

    // Ghost: same timeline bounds, shifted media window
    const ghostClip: Clip = {
      ...liveClip,
      // timelineStart and timelineEnd intentionally NOT overridden — clip stays put
      mediaIn:  (liveClip.mediaIn  + clampedDelta) as TimelineFrame,
      mediaOut: (liveClip.mediaOut + clampedDelta) as TimelineFrame,
    };

    return { clips: [ghostClip], isProvisional: true };
  }

  // ── ITool: onPointerUp ────────────────────────────────────────────────────

  onPointerUp(event: TimelinePointerEvent, ctx: ToolContext): Transaction | null {
    // Capture-before-reset: compute rawDelta BEFORE calling _resetDragState(),
    // because rawDelta uses this.dragStartFrame which reset clears.
    if (this.dragClipId === null || this.dragStartFrame === null) {
      this._resetDragState();
      return null;
    }

    const rawDelta = (event.frame - this.dragStartFrame) as number;

    // Capture, then reset
    const clipId = this.dragClipId;
    this._resetDragState();

    const liveClip = findClip(ctx.state, clipId);
    if (!liveClip) return null;

    const asset = ctx.state.assetRegistry.get(liveClip.assetId);
    if (!asset) return null;

    const minDelta     = -liveClip.mediaIn as number;
    const maxDelta     = (asset.intrinsicDuration - liveClip.mediaOut) as number;
    const clampedDelta = Math.max(minDelta, Math.min(maxDelta, rawDelta));

    // No-op: media window didn't shift
    if (clampedDelta === 0) return null;

    return {
      id:        txId(),
      label:     'Slip',
      timestamp: Date.now(),
      operations: [
        {
          type:     'SET_MEDIA_BOUNDS',
          clipId,
          mediaIn:  (liveClip.mediaIn  + clampedDelta) as TimelineFrame,
          mediaOut: (liveClip.mediaOut + clampedDelta) as TimelineFrame,
        },
      ],
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
    this.dragClipId     = null;
    this.dragStartFrame = null;
    this.isHoveringClip = false;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _resetDragState(): void {
    this.dragClipId     = null;
    this.dragStartFrame = null;
    // isHoveringClip intentionally NOT reset here — it is a cursor-staging var
  }
}
