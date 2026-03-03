/**
 * TOOL CONTRACT TYPES — Phase 1
 *
 * Zero implementation. Zero imports from React or DOM.
 * Every ITool must satisfy this interface exactly.
 *
 * RULES (from ITOOL_CONTRACT.md):
 *   - onPointerMove NEVER calls dispatch
 *   - onPointerUp NEVER mutates instance state
 *   - onKeyDown, onKeyUp, onCancel are REQUIRED — implement as no-ops if unused
 */

import type { TimelineFrame }            from '../types/frame';
import type { TrackId }                  from '../types/track';
import type { ClipId, Clip }             from '../types/clip';
import type { TimelineState }            from '../types/state';
import type { Transaction }              from '../types/operations';
import type { SnapIndex } from '../snap-index';
import type { SnapPointType } from '../snap-index';
export type { SnapPointType } from '../snap-index';

// ---------------------------------------------------------------------------
// Branded ID
// ---------------------------------------------------------------------------

export type ToolId = string & { readonly __brand: 'ToolId' };

export function toToolId(s: string): ToolId {
  return s as ToolId;
}

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

/** Keyboard modifier state — available on ToolContext so getCursor() can
 *  react to held keys even when no pointer event is firing. */
export type Modifiers = {
  readonly shift: boolean;
  readonly alt:   boolean;
  readonly ctrl:  boolean;
  readonly meta:  boolean;
};

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/** Normalised pointer event in frame-space.
 *  ToolRouter populates clipId via hit-test — tools never recompute it. */
export type TimelinePointerEvent = {
  readonly frame:    TimelineFrame;
  readonly trackId:  TrackId | null;
  readonly clipId:   ClipId  | null;  // clip under cursor at event time, if any
  readonly x:        number;          // client pixels (for snap radius math)
  readonly y:        number;
  readonly buttons:  number;          // same as PointerEvent.buttons
  readonly shiftKey: boolean;
  readonly altKey:   boolean;
  readonly metaKey:  boolean;
};

export type TimelineKeyEvent = {
  readonly key:      string;
  readonly code:     string;
  readonly shiftKey: boolean;
  readonly altKey:   boolean;
  readonly metaKey:  boolean;
  readonly ctrlKey:  boolean;
  /** True when key is held and OS is firing repeated keydowns. */
  readonly repeat?:  boolean;
};

// ---------------------------------------------------------------------------
// ProvisionalState
// ---------------------------------------------------------------------------

/** Pixel + frame region swept by a rubber-band (marquee) selection drag.
 *  Populated by SelectionTool during rubber-band drags. */
export type RubberBandRegion = {
  readonly startFrame: TimelineFrame;
  readonly endFrame:   TimelineFrame;
  readonly startY:     number;   // clientY of drag origin
  readonly endY:       number;   // clientY of current cursor position
};

/** Ghost state produced by onPointerMove.
 *  isProvisional: true is a compile-time discriminant so resolveClip()
 *  can distinguish provisional from committed Clip[] arrays. */
export type ProvisionalState = {
  readonly clips:        readonly Clip[];
  readonly rubberBand?:  RubberBandRegion;  // populated during rubber-band select drag
  readonly isProvisional: true;
};

// ---------------------------------------------------------------------------
// ToolContext
// ---------------------------------------------------------------------------

/** Injected by TimelineEngine on every event call.
 *  Tools never import TimelineEngine. They never call dispatch() directly. */
export type ToolContext = {
  readonly state:          TimelineState;
  readonly snapIndex:      SnapIndex;
  readonly pixelsPerFrame: number;
  /** Current modifier key state — updates on every pointer/key event. */
  readonly modifiers:      Modifiers;
  /** Convert a client-pixel x-position to a TimelineFrame. */
  readonly frameAtX:       (x: number) => TimelineFrame;
  /** Return the TrackId whose row contains client-pixel y, or null. */
  readonly trackAtY:       (y: number) => TrackId | null;
  /** Query snap and return the snapped frame (or original if no hit).
   *  Handles enabled/disabled, radius, exclusion, and type filter internally.
   *  Tools never see radiusFrames or the enabled flag. */
  readonly snap: (
    frame:         TimelineFrame,
    exclude?:      readonly string[],
    allowedTypes?: readonly SnapPointType[],
  ) => TimelineFrame;
};

// ---------------------------------------------------------------------------
// ITool interface
// ---------------------------------------------------------------------------

export interface ITool {
  readonly id:          ToolId;
  /** Single-character keyboard shortcut, e.g. 'v', 'b', 'r'. Empty string = no shortcut. */
  readonly shortcutKey: string;

  /** Return the CSS cursor string for the current tool + modifier state.
   *  Called on every pointermove — must be cheap. */
  getCursor(ctx: ToolContext): string;

  /** Return the SnapPointType categories this tool snaps to.
   *  Used by ctx.snap() to filter the snap index automatically. */
  getSnapCandidateTypes(): readonly SnapPointType[];

  onPointerDown(event: TimelinePointerEvent, ctx: ToolContext): void;

  /** Return ProvisionalState for ghost rendering.
   *  MUST NOT call dispatch. MUST NOT call engine methods. */
  onPointerMove(event: TimelinePointerEvent, ctx: ToolContext): ProvisionalState | null;

  /** Return a Transaction to commit, or null if this gesture produces no edit.
   *  MUST NOT mutate any instance state. */
  onPointerUp(event: TimelinePointerEvent, ctx: ToolContext): Transaction | null;

  /** Handle a keydown — return a Transaction or null.
   *  Required — implement as `return null` if unused. */
  onKeyDown(event: TimelineKeyEvent, ctx: ToolContext): Transaction | null;

  /** Handle a keyup — no return value.
   *  Required — implement as no-op if unused. */
  onKeyUp(event: TimelineKeyEvent, ctx: ToolContext): void;

  /** Called when a gesture is interrupted (Escape, tool switch mid-drag).
   *  Required — implement as no-op if unused. */
  onCancel(): void;
}
