/**
 * SelectionTool — Phase 2
 *
 * The most complex tool. Handles four interaction modes:
 *   MODE 1: Single click  → select/deselect clip (no drag)
 *   MODE 2: Single drag   → move one clip, produce MOVE_CLIP Transaction
 *   MODE 3: Multi drag    → move all selected clips by uniform delta, N× MOVE_CLIP
 *   MODE 4: Rubber-band   → marquee select clips, no Transaction
 *
 * SELECTION CONTRACT:
 *   Selection lives on this instance as Set<ClipId>.
 *   It is NOT in TimelineState. It is NOT undoable.
 *   onCancel() resets all instance state, including selection.
 *
 * GHOST CLIP CONTRACT (corrected in design review):
 *   Ghost clips are ALWAYS built by reading the live clip from ctx.state
 *   then overriding position fields. Never spread a stored clip snapshot.
 *   originalPositions is ONLY used in onPointerUp for MOVE_CLIP delta math.
 *
 * RULES:
 *   - Zero imports from React, DOM, @timeline/react, @timeline/ui
 *   - onPointerMove must never call dispatch
 *   - onPointerUp must never mutate instance state
 *   - Every instance variable appears in onCancel() — no exceptions
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
import type { TrackId }      from '../types/track';
import type { TimelineFrame } from '../types/frame';
import type { Transaction }   from '../types/operations';
import type { TimelineState } from '../types/state';
import { findClipById }       from '../systems/queries';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum pixel distance before a pointerdown becomes a drag (click tolerance). */
const DRAG_THRESHOLD_PX = 4;

/** Pixel width on each side of a clip edge that triggers 'ew-resize' cursor. */
const EDGE_HIT_ZONE_PX = 8;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type DragMode = 'idle' | 'drag-clip' | 'rubber-band';

type OriginalPosition = {
  readonly timelineStart: TimelineFrame;
  readonly timelineEnd:   TimelineFrame;
  readonly trackId:       TrackId;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a clip by id and assert it exists. Returns undefined if missing. */
function liveClip(state: TimelineState, id: ClipId): Clip | undefined {
  return findClipById(state, id);
}

/** Clip edge check — returns 'start', 'end', or null. */
function hitEdge(
  clip: Clip,
  clientX: number,
  ppf: number,
  originX: number,
): 'start' | 'end' | null {
  const startPx = clip.timelineStart * ppf + originX;
  const endPx   = clip.timelineEnd   * ppf + originX;
  if (Math.abs(clientX - startPx) <= EDGE_HIT_ZONE_PX) return 'start';
  if (Math.abs(clientX - endPx)   <= EDGE_HIT_ZONE_PX) return 'end';
  return null;
}

/** Collect clips from state that belong to the given Set of ids. */
function collectClips(state: TimelineState, ids: ReadonlySet<ClipId>): Clip[] {
  const result: Clip[] = [];
  for (const id of ids) {
    const c = liveClip(state, id);
    if (c) result.push(c);
  }
  return result;
}

/** Make a unique transaction id. */
let _txSeq = 0;
function txId(): string { return `selection-tx-${++_txSeq}`; }

// ---------------------------------------------------------------------------
// SelectionTool
// ---------------------------------------------------------------------------

export class SelectionTool implements ITool {
  readonly id:          ToolId = toToolId('selection');
  readonly shortcutKey: string = 'v';

  // ── Selection state (persists across gestures) ───────────────────────────
  private readonly selected: Set<ClipId> = new Set();

  // ── Per-gesture tracking ──────────────────────────────────────────────────
  private mode:             DragMode      = 'idle';

  // drag-clip mode
  private dragStartFrame:   TimelineFrame | null     = null;
  private dragStartX:       number        | null     = null;
  private dragStartY:       number        | null     = null;
  private dragClipId:       ClipId        | null     = null;
  private isMultiDrag:      boolean                  = false;
  /** Frame values only — no Clip objects. Used only in onPointerUp for delta math. */
  private originalPositions: Map<ClipId, OriginalPosition> = new Map();

  // rubber-band mode
  private rubberBandStartFrame: TimelineFrame | null = null;
  private rubberBandStartY:     number        | null = null;

  // getCursor() state (updated on move/down, read in getCursor)
  private lastClientX:  number        | null = null;
  private lastHitEdge:  'start'|'end' | null = null;

  // ── Public read access ────────────────────────────────────────────────────

  getSelection(): ReadonlySet<ClipId> {
    return this.selected;
  }

  clearSelection(): void {
    this.selected.clear();
  }

  // ── ITool: getCursor ──────────────────────────────────────────────────────

  getCursor(_ctx: ToolContext): string {
    if (this.mode === 'drag-clip')    return 'grabbing';
    if (this.mode === 'rubber-band')  return 'crosshair';
    if (this.lastHitEdge !== null)    return 'ew-resize';
    // lastClientX non-null → we've had at least one move event with a clip under cursor.
    // The actual clip-hover check happens in onPointerMove where we update lastHitEdge.
    // If lastHitEdge is null but we're hovering a clip, use 'grab'.
    // The presence of lastClientX alone doesn't mean hovering clip — we'd need the
    // last event's clipId. Store it:
    if (this._lastHoveredClipId !== null) return 'grab';
    return 'default';
  }

  private _lastHoveredClipId: ClipId | null = null;

  // ── ITool: getSnapCandidateTypes ─────────────────────────────────────────

  getSnapCandidateTypes(): readonly SnapPointType[] {
    return ['ClipStart', 'ClipEnd', 'Playhead'];
  }

  // ── ITool: onPointerDown ──────────────────────────────────────────────────

  onPointerDown(event: TimelinePointerEvent, ctx: ToolContext): void {
    this.lastClientX       = event.x;
    this._lastHoveredClipId = event.clipId;

    if (event.clipId !== null) {
      // Hitting a clip — start potential drag
      const clip = liveClip(ctx.state, event.clipId);
      if (!clip) return;

      this.mode          = 'drag-clip';
      this.dragStartX    = event.x;
      this.dragStartY    = event.y;
      this.dragStartFrame = event.frame;
      this.dragClipId    = event.clipId;

      // Determine if this is a multi-clip drag
      this.isMultiDrag = this.selected.size > 1 && this.selected.has(event.clipId);

      // Snapshot original positions for all clips that will move
      this.originalPositions.clear();
      const clipsToRecord = this.isMultiDrag
        ? [...this.selected]
        : [event.clipId];

      for (const id of clipsToRecord) {
        const c = liveClip(ctx.state, id);
        if (c) {
          this.originalPositions.set(id, {
            timelineStart: c.timelineStart,
            timelineEnd:   c.timelineEnd,
            trackId:       c.trackId,
          });
        }
      }
    } else {
      // Hitting empty space — start rubber-band
      this.mode                  = 'rubber-band';
      this.dragStartX            = event.x;   // needed for click-threshold check in onPointerUp
      this.rubberBandStartFrame  = event.frame;
      this.rubberBandStartY      = event.y;
    }
  }

  // ── ITool: onPointerMove ──────────────────────────────────────────────────

  onPointerMove(event: TimelinePointerEvent, ctx: ToolContext): ProvisionalState | null {
    this.lastClientX        = event.x;
    this._lastHoveredClipId = event.clipId;

    // Update edge-hover state for getCursor()
    if (event.clipId !== null) {
      const c = liveClip(ctx.state, event.clipId);
      this.lastHitEdge = c
        ? hitEdge(c, event.x, ctx.pixelsPerFrame, 0)
        : null;
    } else {
      this.lastHitEdge        = null;
      this._lastHoveredClipId = null;
    }

    // ── MODE 4: rubber-band ───────────────────────────────────────────────
    if (this.mode === 'rubber-band') {
      if (this.rubberBandStartFrame === null || this.rubberBandStartY === null) return null;
      return {
        clips:      [],
        rubberBand: {
          startFrame: this.rubberBandStartFrame,
          endFrame:   event.frame,
          startY:     this.rubberBandStartY,
          endY:       event.y,
        },
        isProvisional: true,
      };
    }

    // ── MODE 1: click (below drag threshold) ──────────────────────────────
    if (this.mode === 'drag-clip' && this.dragStartX !== null) {
      const dxPx = Math.abs(event.x - this.dragStartX);
      if (dxPx < DRAG_THRESHOLD_PX) return null;
    }

    // ── MODE 2: single clip drag ──────────────────────────────────────────
    if (this.mode === 'drag-clip' && !this.isMultiDrag && this.dragClipId !== null) {
      const clip = liveClip(ctx.state, this.dragClipId);
      if (!clip || this.dragStartFrame === null) return null;

      const frameDelta    = event.frame - this.dragStartFrame;
      const orig          = this.originalPositions.get(this.dragClipId);
      if (!orig) return null;

      const rawTarget     = (orig.timelineStart + frameDelta) as TimelineFrame;
      const snappedStart  = ctx.snap(rawTarget, [this.dragClipId]);
      const duration      = (clip.timelineEnd - clip.timelineStart) as TimelineFrame;

      return {
        clips: [{
          ...clip,                                             // read fresh from state
          timelineStart: snappedStart,
          timelineEnd:   (snappedStart + duration) as TimelineFrame,
        }],
        isProvisional: true,
      };
    }

    // ── MODE 3: multi-clip drag ────────────────────────────────────────────
    if (this.mode === 'drag-clip' && this.isMultiDrag && this.dragClipId !== null) {
      if (this.dragStartFrame === null) return null;

      const frameDelta   = event.frame - this.dragStartFrame;
      const anchorOrig   = this.originalPositions.get(this.dragClipId);
      if (!anchorOrig) return null;

      // Snap the anchor clip's new start, then derive uniform delta
      const rawAnchor    = (anchorOrig.timelineStart + frameDelta) as TimelineFrame;
      const snappedAnchor = ctx.snap(rawAnchor, [...this.selected]);
      const snappedDelta  = (snappedAnchor - anchorOrig.timelineStart) as TimelineFrame;

      const ghosts: Clip[] = [];
      for (const id of this.selected) {
        const c = liveClip(ctx.state, id);
        if (!c) continue;
        const orig = this.originalPositions.get(id);
        if (!orig) continue;

        ghosts.push({
          ...c,                                                // fresh from state
          timelineStart: (orig.timelineStart + snappedDelta) as TimelineFrame,
          timelineEnd:   (orig.timelineEnd   + snappedDelta) as TimelineFrame,
        });
      }

      return { clips: ghosts, isProvisional: true };
    }

    return null;
  }

  // ── ITool: onPointerUp ────────────────────────────────────────────────────

  onPointerUp(event: TimelinePointerEvent, ctx: ToolContext): Transaction | null {
    // ── Capture all instance state before resetting ────────────────────────
    // _resetDragState() clears dragStartFrame, dragClipId, etc.
    // Everything we need MUST be saved to locals first.
    const previousMode        = this.mode;
    const savedDragClipId     = this.dragClipId;
    const savedDragStartFrame = this.dragStartFrame;
    const savedDragStartX     = this.dragStartX;
    const savedIsMultiDrag    = this.isMultiDrag;
    const savedOrigPositions  = new Map(this.originalPositions);
    const savedRbStartFrame   = this.rubberBandStartFrame;
    const savedSelected       = new Set(this.selected);  // snapshot for rubber-band calc

    // Reset drag state (preserves this.selected for click path)
    this._resetDragState();

    // ── MODE 4: rubber-band complete ──────────────────────────────────────
    if (previousMode === 'rubber-band') {
      // Check if this was just a click on empty space (< 4px delta)
      const dxPx = savedDragStartX !== null ? Math.abs(event.x - savedDragStartX) : 0;
      if (dxPx < DRAG_THRESHOLD_PX) {
        // Click on empty space — clear selection
        this.selected.clear();
        return null;
      }

      if (savedRbStartFrame === null) return null;
      const minFrame = Math.min(savedRbStartFrame, event.frame) as TimelineFrame;
      const maxFrame = Math.max(savedRbStartFrame, event.frame) as TimelineFrame;

      for (const track of ctx.state.timeline.tracks) {
        for (const clip of track.clips) {
          if (clip.timelineStart < maxFrame && clip.timelineEnd > minFrame) {
            this.selected.add(clip.id);
          }
        }
      }
      return null;   // rubber-band produces no Transaction
    }

    if (previousMode !== 'drag-clip') return null;

    // ── MODE 1: click (no drag — delta below threshold) ────────────────────
    const dxPx = savedDragStartX !== null ? Math.abs(event.x - savedDragStartX) : 0;
    if (dxPx < DRAG_THRESHOLD_PX) {
      if (event.clipId !== null) {
        if (event.shiftKey) {
          if (this.selected.has(event.clipId)) this.selected.delete(event.clipId);
          else                                  this.selected.add(event.clipId);
        } else {
          this.selected.clear();
          this.selected.add(event.clipId);
        }
      } else {
        this.selected.clear();
      }
      return null;
    }

    if (savedDragClipId === null) return null;

    // ── MODE 2: single clip drag ──────────────────────────────────────────
    if (!savedIsMultiDrag) {
      const orig = savedOrigPositions.get(savedDragClipId);
      if (!orig) return null;

      const frameDelta = (event.frame - (savedDragStartFrame ?? event.frame)) as TimelineFrame;
      const rawTarget  = (orig.timelineStart + frameDelta) as TimelineFrame;
      const snapped    = ctx.snap(rawTarget, [savedDragClipId]);

      if (snapped === orig.timelineStart) return null;   // no-op

      return {
        id:         txId(),
        label:      'Move Clip',
        timestamp:  Date.now(),
        operations: [{
          type:             'MOVE_CLIP',
          clipId:           savedDragClipId,
          newTimelineStart: snapped,
        }],
      };
    }

    // ── MODE 3: multi-clip drag ────────────────────────────────────────────
    const anchorOrig = savedOrigPositions.get(savedDragClipId);
    if (!anchorOrig) return null;

    const frameDelta    = (event.frame - (savedDragStartFrame ?? event.frame)) as TimelineFrame;
    const rawAnchor     = (anchorOrig.timelineStart + frameDelta) as TimelineFrame;
    const snappedAnchor = ctx.snap(rawAnchor, [...savedSelected]);
    const snappedDelta  = (snappedAnchor - anchorOrig.timelineStart) as TimelineFrame;

    if (snappedDelta === 0) return null;

    const operations = [...savedSelected].flatMap(id => {
      const orig = savedOrigPositions.get(id);
      if (!orig) return [];
      return [{
        type:             'MOVE_CLIP' as const,
        clipId:           id,
        newTimelineStart: (orig.timelineStart + snappedDelta) as TimelineFrame,
      }];
    });

    if (operations.length === 0) return null;

    return {
      id:        txId(),
      label:     `Move ${operations.length} Clips`,
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
  /**
   * Reset ALL instance state.
   * Every instance variable must appear here.
   * If a new variable is added to the class, it MUST be added here too.
   */
  onCancel(): void {
    this.selected.clear();
    this.mode                  = 'idle';
    this.dragStartFrame        = null;
    this.dragStartX            = null;
    this.dragStartY            = null;
    this.dragClipId            = null;
    this.isMultiDrag           = false;
    this.originalPositions.clear();
    this.rubberBandStartFrame  = null;
    this.rubberBandStartY      = null;
    this.lastClientX           = null;
    this.lastHitEdge           = null;
    this._lastHoveredClipId    = null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Reset per-gesture drag state WITHOUT clearing selection. */
  private _resetDragState(): void {
    // Preserve mode/ids for the caller (onPointerUp reads them first, then calls this)
    // So only clear after reading:
    this.mode                  = 'idle';
    this.dragStartFrame        = null;
    this.dragStartX            = null;
    this.dragStartY            = null;
    this.isMultiDrag           = false;
    this.originalPositions.clear();
    this.rubberBandStartFrame  = null;
    this.rubberBandStartY      = null;
  }
}
