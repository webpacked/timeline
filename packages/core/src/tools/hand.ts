/**
 * HandTool — Phase 2 Step 8
 *
 * Scroll/pan the timeline viewport by dragging.
 * This tool has ZERO effect on TimelineState.
 *
 * - Never produces a Transaction (onPointerUp returns null always)
 * - Never calls dispatch
 * - Never returns ProvisionalState (onPointerMove returns null always)
 * - Never creates ClipIds (_setIdGenerator not needed)
 *
 * THE SCROLL CALLBACK:
 *   The UI registers a callback via setScrollCallback().
 *   On every onPointerMove during drag, HandTool fires:
 *     scrollCallback(event.x - lastX)   ← pixel delta, not frame delta
 *   The UI handles scrollLeft adjustment. HandTool has no DOM access.
 *
 *   The callback is optional — drag tracking activates regardless.
 *   If no callback is registered, delta is computed but discarded.
 *   This allows testing drag tracking without a live callback.
 *
 * RULES:
 *   - Zero imports from React, DOM, @webpacked-timeline/react, @webpacked-timeline/ui
 *   - Every instance variable appears in onCancel()
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
import type { Transaction } from '../types/operations';

// ---------------------------------------------------------------------------
// HandTool
// ---------------------------------------------------------------------------

export class HandTool implements ITool {
  readonly id:          ToolId = toToolId('hand');
  readonly shortcutKey: string = 'h';   // standard NLE convention

  // ── Scroll callback ────────────────────────────────────────────────────────
  /**
   * Registered by the UI layer once at mount. Persists across drags and
   * cancels — not per-drag state. Pass null to unregister.
   */
  private scrollCallback: ((deltaX: number) => void) | null = null;

  // ── Drag-tracking ──────────────────────────────────────────────────────────
  /** Gates delta computation and cursor. */
  private isDragging: boolean = false;

  /**
   * X position (pixels) at the last pointer event.
   * Delta is event-to-event (not from start): deltaX = event.x - lastX.
   * Incremental delta is what UI scroll handlers expect (scrollLeft += deltaX).
   */
  private lastX: number = 0;

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Register the UI's scroll handler. Called once at mount, not per-drag.
   * @param cb  Receives pixel deltaX per move event. Pass null to unregister.
   */
  setScrollCallback(cb: ((deltaX: number) => void) | null): void {
    this.scrollCallback = cb;
  }

  // ── ITool: getCursor ──────────────────────────────────────────────────────

  getCursor(_ctx: ToolContext): string {
    return this.isDragging ? 'grabbing' : 'grab';
    // No 'default' — HandTool always shows grab intent
  }

  // ── ITool: getSnapCandidateTypes ─────────────────────────────────────────

  getSnapCandidateTypes(): readonly SnapPointType[] {
    return [];  // pure scroll, no snapping
  }

  // ── ITool: onPointerDown ──────────────────────────────────────────────────

  onPointerDown(event: TimelinePointerEvent, _ctx: ToolContext): void {
    this.isDragging = true;
    this.lastX      = event.x;
    // scrollCallback may be null — drag tracking still activates.
    // Delta will be computed but discarded if no callback is registered.
  }

  // ── ITool: onPointerMove ──────────────────────────────────────────────────

  onPointerMove(event: TimelinePointerEvent, _ctx: ToolContext): ProvisionalState | null {
    if (!this.isDragging) return null;

    const deltaX    = event.x - this.lastX;
    this.scrollCallback?.(deltaX);   // no-op if null
    this.lastX = event.x;

    return null;  // scroll is not a ProvisionalState concern
  }

  // ── ITool: onPointerUp ────────────────────────────────────────────────────

  onPointerUp(_event: TimelinePointerEvent, _ctx: ToolContext): Transaction | null {
    this.isDragging = false;
    this.lastX      = 0;
    return null;  // always — HandTool never produces a Transaction
  }

  // ── ITool: onKeyDown / onKeyUp ────────────────────────────────────────────

  onKeyDown(_event: TimelineKeyEvent, _ctx: ToolContext): Transaction | null {
    return null;  // always — no keyboard interactions
  }

  onKeyUp(_event: TimelineKeyEvent, _ctx: ToolContext): void {}

  // ── ITool: onCancel ───────────────────────────────────────────────────────
  /**
   * Resets per-drag state only.
   * scrollCallback is NOT cleared — it persists across cancels.
   * Re-registering on every cancelled drag would be unnecessary UI burden.
   */
  onCancel(): void {
    this.isDragging = false;
    this.lastX      = 0;
  }
}
