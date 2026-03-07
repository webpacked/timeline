/**
 * tool-router.ts — Phase 1
 *
 * Converts raw DOM PointerEvents / KeyboardEvents into TimelinePointerEvents
 * and routes them to the appropriate engine handler methods.
 *
 * RULES:
 *   - requestAnimationFrame appears ONLY here — do not move it to engine.ts
 *   - No React imports
 *   - No dispatch() calls — engine handles all mutations
 *   - No provisional state management — engine owns that entirely
 *   - getLayout() is called fresh on every event — never cached
 *
 * POINTER LEAVE CONTRACT:
 *   If the cursor leaves the timeline mid-drag, onPointerLeave resets the rAF
 *   AND calls engine.handlePointerUp() with a synthetic event. This clears
 *   provisional state (ghost disappears) and cancels the drag cleanly.
 */

import type { TimelineEngine } from './engine';
import type {
  TimelinePointerEvent,
  TimelineKeyEvent,
  Modifiers,
  TrackId,
  ClipId,
  TimelineFrame,
  TimelineState,
} from '@webpacked-timeline/core';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Describes one track's pixel position in the rendered timeline.
 * Provided by the UI layer on each event — the router never computes this.
 */
export type TrackLayout = {
  readonly trackId: TrackId;
  readonly top:     number;   // clientY of the track's top edge (px)
  readonly height:  number;   // track height (px)
};

/**
 * The layout state the router needs to convert coordinates.
 * Returned fresh by getLayout() on every event — always reflects current zoom/scroll.
 */
export type RouterLayout = {
  readonly timelineOriginX: number;               // clientX where frame 0 starts
  readonly pixelsPerFrame:  number;               // px per frame at current zoom
  readonly trackLayouts:    readonly TrackLayout[];
};

/**
 * Stable DOM event handler references returned by createToolRouter().
 * Attach these to the timeline container element once — they never need
 * re-attaching on zoom, scroll, or tool switches.
 */
export type ToolRouterHandlers = {
  readonly onPointerDown:  (e: PointerEvent)  => void;
  readonly onPointerMove:  (e: PointerEvent)  => void;
  readonly onPointerUp:    (e: PointerEvent)  => void;
  /** Resets rAF and calls handlePointerUp to clear provisional on cursor leave. */
  readonly onPointerLeave: (e: PointerEvent)  => void;
  readonly onKeyDown:      (e: KeyboardEvent) => void;
  readonly onKeyUp:        (e: KeyboardEvent) => void;
};

// ---------------------------------------------------------------------------
// Coordinate conversion utilities (module-level, not exported)
// ---------------------------------------------------------------------------

/**
 * Convert clientX to a TimelineFrame.
 * Uses Math.floor — frames are integers, left edge of each frame cell.
 */
export function frameAtX(
  clientX:         number,
  timelineOriginX: number,
  ppf:             number,
): TimelineFrame {
  return Math.floor((clientX - timelineOriginX) / ppf) as TimelineFrame;
}

/**
 * Convert clientY to the TrackId of the track under the cursor, or null.
 * Iterates track layouts linearly — timeline track counts are small (< 100).
 */
export function trackAtY(
  clientY:      number,
  trackLayouts: readonly TrackLayout[],
): TrackId | null {
  for (const layout of trackLayouts) {
    if (clientY >= layout.top && clientY < layout.top + layout.height) {
      return layout.trackId;
    }
  }
  return null;
}

/**
 * Hit-test: find the ClipId under the cursor at the given frame on a track.
 * Returns null if no clip covers that frame, or if trackId is null.
 *
 * Clips are sorted by timelineStart (invariant) — linear scan is fine for
 * typical clip counts per track (< 200).
 */
export function clipAtFrame(
  frame:   TimelineFrame,
  trackId: TrackId | null,
  state:   TimelineState,
): ClipId | null {
  if (trackId === null) return null;
  const track = state.timeline.tracks.find(t => t.id === trackId);
  if (!track) return null;
  const clip = track.clips.find(
    c => frame >= c.timelineStart && frame < c.timelineEnd,
  );
  return clip ? clip.id : null;
}

/** Extract Modifiers from any PointerEvent or KeyboardEvent. */
export function extractModifiers(e: PointerEvent | KeyboardEvent): Modifiers {
  return {
    shift: e.shiftKey,
    alt:   e.altKey,
    ctrl:  e.ctrlKey,
    meta:  e.metaKey,
  };
}

/**
 * Convert a raw PointerEvent into a TimelinePointerEvent.
 * Populates clipId via hit-test against the current committed state.
 */
function convertPointerEvent(
  e:      PointerEvent,
  layout: RouterLayout,
  state:  TimelineState,
): TimelinePointerEvent {
  const frame   = frameAtX(e.clientX, layout.timelineOriginX, layout.pixelsPerFrame);
  const trackId = trackAtY(e.clientY, layout.trackLayouts);
  const clipId  = clipAtFrame(frame, trackId, state);

  return {
    frame,
    trackId,
    clipId,
    x:        e.clientX,
    y:        e.clientY,
    buttons:  e.buttons,
    shiftKey: e.shiftKey,
    altKey:   e.altKey,
    metaKey:  e.metaKey,
  };
}

/** Convert a raw KeyboardEvent into a TimelineKeyEvent. */
function convertKeyEvent(e: KeyboardEvent): TimelineKeyEvent {
  return {
    key:      e.key,
    code:     e.code,
    shiftKey: e.shiftKey,
    altKey:   e.altKey,
    metaKey:  e.metaKey,
    ctrlKey:  e.ctrlKey,
    repeat:   e.repeat,
  };
}

// ---------------------------------------------------------------------------
// createToolRouter — public factory
// ---------------------------------------------------------------------------

/**
 * Creates stable DOM event handlers that wire raw browser events to the engine.
 *
 * @param engine    - The Phase 1 TimelineEngine instance.
 * @param getLayout - Called on every event to get current zoom/scroll state.
 *                   Never cached — always reflects the latest UI layout.
 *
 * @returns Stable handler references. Safe to attach as DOM event listeners
 *          without re-attaching on zoom, scroll, or tool changes.
 *
 * @example
 * ```tsx
 * const router = createToolRouter(engine, () => ({
 *   timelineOriginX: containerRef.current.getBoundingClientRect().left,
 *   pixelsPerFrame:  ppf,
 *   trackLayouts:    computeTrackLayouts(tracks),
 * }));
 *
 * <div
 *   onPointerDown={router.onPointerDown}
 *   onPointerMove={router.onPointerMove}
 *   onPointerUp={router.onPointerUp}
 *   onPointerLeave={router.onPointerLeave}
 * />
 * ```
 */
export function createToolRouter(
  engine:    TimelineEngine,
  getLayout: () => RouterLayout,
): ToolRouterHandlers {

  // ── Closure state ─────────────────────────────────────────────────────────
  // Mutable — deliberately not frozen. These are an implementation detail
  // of the rAF throttle and leave-cancel logic.

  /** True while a requestAnimationFrame callback is outstanding. */
  let rafPending:        boolean          = false;

  /** The most-recent pointermove event — overwritten on every move call. */
  let lastMoveEvent:     PointerEvent     | null = null;

  /** Modifiers captured at the same time as lastMoveEvent. */
  let lastMoveModifiers: Modifiers        | null = null;

  // ── rAF throttle ──────────────────────────────────────────────────────────

  /**
   * Called on every raw pointermove. Always captures the most-recent event,
   * but schedules at most ONE requestAnimationFrame per vsync frame.
   * Intermediate events are dropped — the rAF callback always processes
   * the latest position, not a queued history.
   *
   * This is the ONLY place requestAnimationFrame appears in the codebase.
   */
  function throttledPointerMove(e: PointerEvent): void {
    // Always capture most-recent — even if rAF is already pending
    lastMoveEvent     = e;
    lastMoveModifiers = extractModifiers(e);

    if (rafPending) return;   // rAF already scheduled — drop this schedule request
    rafPending = true;

    requestAnimationFrame(() => {
      rafPending = false;

      // onPointerLeave may have nulled these after the rAF was queued
      if (!lastMoveEvent || !lastMoveModifiers) return;

      const layout    = getLayout();
      const state     = engine.getSnapshot().state;
      const converted = convertPointerEvent(lastMoveEvent, layout, state);
      engine.handlePointerMove(converted, lastMoveModifiers);
    });
  }

  // ── Handler object ─────────────────────────────────────────────────────────

  return {
    onPointerDown(e: PointerEvent): void {
      const layout    = getLayout();
      const state     = engine.getSnapshot().state;
      const converted = convertPointerEvent(e, layout, state);
      engine.handlePointerDown(converted, extractModifiers(e));
    },

    onPointerMove(e: PointerEvent): void {
      throttledPointerMove(e);
    },

    onPointerUp(e: PointerEvent): void {
      const layout    = getLayout();
      const state     = engine.getSnapshot().state;
      const converted = convertPointerEvent(e, layout, state);
      engine.handlePointerUp(converted, extractModifiers(e));
    },

    /**
     * Cursor left the timeline mid-drag.
     *
     * Reset the rAF (kill queued callback via null-guard) then call
     * handlePointerUp to clear provisional state. Without this, the ghost
     * clip would render indefinitely — pointerup fires on a different element.
     */
    onPointerLeave(e: PointerEvent): void {
      // Kill outstanding rAF — its null-guard prevents a stale engine call
      rafPending        = false;
      lastMoveEvent     = null;
      lastMoveModifiers = null;

      // Synthetic pointerup — clears provisional, tool.onPointerUp returns null
      const layout    = getLayout();
      const state     = engine.getSnapshot().state;
      const converted = convertPointerEvent(e, layout, state);
      engine.handlePointerUp(converted, extractModifiers(e));
    },

    onKeyDown(e: KeyboardEvent): void {
      engine.handleKeyDown(convertKeyEvent(e), extractModifiers(e));
    },

    onKeyUp(e: KeyboardEvent): void {
      engine.handleKeyUp(convertKeyEvent(e), extractModifiers(e));
    },
  };
}
