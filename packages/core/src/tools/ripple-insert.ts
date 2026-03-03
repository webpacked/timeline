/**
 * RippleInsertTool — Phase 2 Step 7
 *
 * Drag a clip from an asset and drop it onto a track.
 * Clips at or after the drop point shift RIGHT by insertDuration.
 * The inserted clip lands exactly at the drop point.
 *
 * TRANSACTION ORDER — critical:
 *   MOVE_CLIPs first (RIGHT-TO-LEFT — +delta rule)
 *   INSERT_CLIP last (gap is now open after all MOVE_CLIPs)
 *
 * INSTANCE VARIABLE GROUPS:
 *   Group A (pending-insert): set by setPendingInsert(), preserved across drops,
 *     cleared only by onCancel(). Cannot be changed mid-drag (guard in setPendingInsert).
 *   Group B (drag-tracking): set by onPointerDown(), cleared by onPointerUp() and onCancel().
 *
 * PROVISIONAL STATE:
 *   Ghost inserted clip (sentinel id 'provisional-insert') + all shifted right-clips.
 *   Ghost id is NEVER written to committed state — real clip gets new id at onPointerUp.
 *
 * RULES:
 *   - Zero imports from React, DOM, @timeline/react, @timeline/ui
 *   - onPointerMove never dispatches
 *   - onPointerUp never mutates instance state (capture-before-reset)
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
import type { ClipId, Clip }                from '../types/clip';
import type { TrackId }                      from '../types/track';
import type { TimelineFrame }                from '../types/frame';
import type { OperationPrimitive, Transaction } from '../types/operations';
import type { TimelineState }                from '../types/state';
import type { Asset }                        from '../types/asset';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Sentinel ClipId used for the ghost inserted clip during drag.
 * This id is NEVER written to committed state.
 * The real clip gets a new id from _generateId() at onPointerUp time.
 */
const PROVISIONAL_INSERT_ID = 'provisional-insert' as ClipId;

// ---------------------------------------------------------------------------
// ID generator — replaceable in tests via _setIdGenerator()
// ---------------------------------------------------------------------------

/** Production default: crypto.randomUUID() */
let generateId: () => string = () => crypto.randomUUID();

/**
 * Replace the ID generator for deterministic IDs in tests.
 * @example
 *   let counter = 0;
 *   beforeEach(() => { counter = 0; _setIdGenerator(() => `insert-${++counter}`); });
 *   afterEach(()  => { _setIdGenerator(() => crypto.randomUUID()); });
 */
export function _setIdGenerator(fn: () => string): void {
  generateId = fn;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findTrack(state: TimelineState, trackId: TrackId) {
  return state.timeline.tracks.find(t => t.id === trackId) ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

let _txSeq = 0;
function txId(): string { return `ripple-insert-tx-${++_txSeq}`; }

// ---------------------------------------------------------------------------
// computeRippleInsertOps — pure function, module scope, not exported
// ---------------------------------------------------------------------------

/**
 * Returns the operation array for a ripple-insert:
 *   [MOVE_CLIP×N (right-to-left), INSERT_CLIP]
 *
 * MOVE_CLIP sort: RIGHT-TO-LEFT (descending timelineStart).
 * Reason: delta is positive (+insertDuration). Per OPERATIONS.md:
 *   +delta → sort right-to-left so rightmost clip moves into empty space first.
 *
 * INSERT_CLIP LAST — after all MOVE_CLIPs, [dropFrame, dropFrame+insertDuration) is vacant.
 */
function computeRippleInsertOps(
  dropFrame:     TimelineFrame,
  insertClip:    Clip,
  targetTrackId: TrackId,
  state:         TimelineState,
): OperationPrimitive[] {
  const insertDuration = (insertClip.timelineEnd - insertClip.timelineStart) as number;

  const track = findTrack(state, targetTrackId);

  // Clips whose timelineStart >= dropFrame are pushed right
  const rightClips = (track?.clips ?? [])
    .filter(c => c.timelineStart >= dropFrame)
    .sort((a, b) => b.timelineStart - a.timelineStart);  // RIGHT-TO-LEFT — +delta rule

  return [
    // MOVE_CLIPs first — rightmost moves into empty space first
    ...rightClips.map(c => ({
      type:             'MOVE_CLIP' as const,
      clipId:            c.id,
      newTimelineStart: (c.timelineStart + insertDuration) as TimelineFrame,
    })),
    // INSERT_CLIP last — [dropFrame, dropFrame+insertDuration) is now vacant
    { type: 'INSERT_CLIP' as const, clip: insertClip, trackId: targetTrackId },
  ];
}

// ---------------------------------------------------------------------------
// RippleInsertTool
// ---------------------------------------------------------------------------

export class RippleInsertTool implements ITool {
  readonly id:          ToolId = toToolId('ripple-insert');
  readonly shortcutKey: string = '';   // activated programmatically

  // ── GROUP A: Pending-insert state ─────────────────────────────────────────
  // Set by setPendingInsert(). Preserved across drops. Cleared by onCancel().
  // Cannot be changed mid-drag (guard in setPendingInsert).
  private pendingAsset:    Asset         | null = null;
  private pendingMediaIn:  TimelineFrame | null = null;
  private pendingMediaOut: TimelineFrame | null = null;

  // ── GROUP B: Drag-tracking state ──────────────────────────────────────────
  // Set by onPointerDown(). Reset by onPointerUp() (Group B only) and onCancel() (all).
  private isDragging: boolean = false;

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Configure what clip will be inserted on the next drag.
   * Preserves across drops — can be called once per asset, then drag many times.
   *
   * Guard: ignored if a drag is in progress — prevents ghost/Transaction mismatch
   * from async React state updates firing setPendingInsert mid-drag.
   */
  setPendingInsert(
    asset:    Asset,
    mediaIn:  TimelineFrame,
    mediaOut: TimelineFrame,
  ): void {
    if (this.isDragging) return;   // mid-drag guard: silent ignore
    this.pendingAsset    = asset;
    this.pendingMediaIn  = mediaIn;
    this.pendingMediaOut = mediaOut;
  }

  // ── ITool: getCursor ──────────────────────────────────────────────────────

  getCursor(_ctx: ToolContext): string {
    if (this.pendingAsset !== null) return 'copy';  // pending insert configured
    return 'default';
  }

  // ── ITool: getSnapCandidateTypes ─────────────────────────────────────────

  getSnapCandidateTypes(): readonly SnapPointType[] {
    return ['ClipStart', 'ClipEnd', 'Playhead', 'Marker'];
  }

  // ── ITool: onPointerDown ──────────────────────────────────────────────────

  onPointerDown(event: TimelinePointerEvent, _ctx: ToolContext): void {
    if (this.pendingAsset === null) return;        // no clip configured
    if (event.trackId === null)     return;        // not over a track
    this.isDragging = true;
  }

  // ── ITool: onPointerMove ──────────────────────────────────────────────────

  onPointerMove(event: TimelinePointerEvent, ctx: ToolContext): ProvisionalState | null {
    if (!this.isDragging || this.pendingAsset === null) return null;
    if (event.trackId === null) return null;

    const insertDuration = (this.pendingMediaOut! - this.pendingMediaIn!) as number;
    const timelineDuration = ctx.state.timeline.duration as number;

    const snapped    = ctx.snap(event.frame) as TimelineFrame;
    const dropFrame  = clamp(snapped, 0, timelineDuration - insertDuration) as TimelineFrame;

    const track      = findTrack(ctx.state, event.trackId);
    const rightClips = (track?.clips ?? [])
      .filter(c => c.timelineStart >= dropFrame);

    // Ghost inserted clip — sentinel id, NEVER committed
    const ghostInserted: Clip = {
      id:            PROVISIONAL_INSERT_ID,
      assetId:       this.pendingAsset.id,
      trackId:       event.trackId,
      timelineStart: dropFrame,
      timelineEnd:   (dropFrame + insertDuration) as TimelineFrame,
      mediaIn:       this.pendingMediaIn!,
      mediaOut:      this.pendingMediaOut!,
      speed:         1.0,
      enabled:       true,
      reversed:      false,
      name:          null,
      color:         null,
      metadata:      {},
    };

    // Ghost shifted clips — all right-side clips moved right
    const ghostsShifted: Clip[] = rightClips.map(c => ({
      ...c,
      timelineStart: (c.timelineStart + insertDuration) as TimelineFrame,
      timelineEnd:   (c.timelineEnd   + insertDuration) as TimelineFrame,
    }));

    return {
      clips:         [ghostInserted, ...ghostsShifted],
      isProvisional: true,
    };
  }

  // ── ITool: onPointerUp ────────────────────────────────────────────────────

  onPointerUp(event: TimelinePointerEvent, ctx: ToolContext): Transaction | null {
    // Capture-before-reset pattern:
    // All capture must happen before _resetDragState() clears isDragging.
    const wasDragging  = this.isDragging;
    const asset        = this.pendingAsset;
    const mediaIn      = this.pendingMediaIn;
    const mediaOut     = this.pendingMediaOut;
    const trackId      = event.trackId;

    // Reset Group B only — Group A (pendingAsset etc.) preserved for re-use
    this._resetDragState();

    if (!wasDragging || !asset || mediaIn === null || mediaOut === null) return null;
    if (trackId === null) return null;

    const insertDuration   = (mediaOut - mediaIn) as number;
    const timelineDuration = ctx.state.timeline.duration as number;

    const snapped   = ctx.snap(event.frame) as TimelineFrame;
    const dropFrame = clamp(snapped, 0, timelineDuration - insertDuration) as TimelineFrame;

    // Build the real inserted clip — new id from _generateId(), NOT the sentinel
    const newClip: Clip = {
      id:            generateId() as ClipId,
      assetId:       asset.id,
      trackId,
      timelineStart: dropFrame,
      timelineEnd:   (dropFrame + insertDuration) as TimelineFrame,
      mediaIn,
      mediaOut,
      speed:         1.0,
      enabled:       true,
      reversed:      false,
      name:          null,
      color:         null,
      metadata:      {},
    };

    const operations = computeRippleInsertOps(dropFrame, newClip, trackId, ctx.state);

    return {
      id:        txId(),
      label:     'Ripple Insert',
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
    this.pendingAsset    = null;
    this.pendingMediaIn  = null;
    this.pendingMediaOut = null;
    this.isDragging      = false;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /** Reset Group B only. Group A (pending-insert) is preserved for re-use. */
  private _resetDragState(): void {
    this.isDragging = false;
  }
}
