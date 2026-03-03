/**
 * TimelineEngine — Phase 1
 *
 * The ONLY class in the Phase 1 system. Lives in packages/react.
 * Wires @timeline/core pure functions together and exposes what React needs.
 *
 * IMMUTABILITY CONTRACT:
 *   All core state changes go through coreDispatch().
 *   Engine private fields are assigned (not mutated) on every change.
 *
 * notify() FIRES IN EXACTLY THREE SITUATIONS:
 *   1. After a Transaction is accepted by dispatch()
 *   2. After provisional state changes (set or clear)
 *      — includes handlePointerDown (cursor), handlePointerMove, handlePointerUp
 *   3. After activateTool() — cursor needs to update
 *
 * notify() NEVER FIRES:
 *   - During buildToolContext()
 *   - During snap index rebuild (queueMicrotask)
 *   - More than once per handlePointerMove call
 *   - In setPixelsPerFrame() — ppf is not in EngineSnapshot
 *   - In handleKeyDown when tx is null
 */

// Core pure functions — sourced from @timeline/core public API
import {
  dispatch as coreDispatch,
  createHistory,
  pushHistory,
  undo as historyUndo,
  redo as historyRedo,
  canUndo as historyCanUndo,
  canRedo as historyCanRedo,
  buildSnapIndex,
  nearest,
  createRegistry,
  activateTool as registryActivate,
  getActiveTool,
  NoOpTool,
  createProvisionalManager,
  setProvisional,
  clearProvisional,
  toToolId,
} from '@timeline/core';

import type {
  TimelineState,
  Transaction,
  DispatchResult,
  TimelineFrame,
  TrackId,
  SnapIndex,
  ITool,
  ToolId,
  ToolContext,
  Modifiers,
  TimelinePointerEvent,
  TimelineKeyEvent,
  ProvisionalState,
  ToolRegistry,
  ProvisionalManager,
  HistoryState,
} from '@timeline/core';

// ---------------------------------------------------------------------------
// EngineSnapshot — the single object useSyncExternalStore reads
// ---------------------------------------------------------------------------

/**
 * One object. One subscribe(). One getSnapshot().
 * Hooks destructure what they need — no dual-store coordination required.
 *
 * pixelsPerFrame is NOT here — zoom is UI state passed as a prop.
 * snapIndex is NOT here — internal to engine, accessed only via buildToolContext().
 */
export type EngineSnapshot = {
  readonly state:        TimelineState;
  readonly provisional:  ProvisionalState | null;  // null when not dragging
  readonly activeToolId: ToolId;
  readonly cursor:       string;                   // getCursor() at idle modifiers
  readonly canUndo:      boolean;
  readonly canRedo:      boolean;
  readonly trackIds:     readonly TrackId[];        // stable ref until tracks change
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SNAP_RADIUS_PX   = 8;
const DEFAULT_PPF      = 10;       // 10px per frame — overridden by setPixelsPerFrame
const DEFAULT_TRACK_H  = 48;       // 48px per track — Phase 2 replaces with measured values

/** Modifiers state when no keys are held — used for idle cursor computation */
const IDLE_MODIFIERS: Modifiers = { shift: false, alt: false, ctrl: false, meta: false };

// ---------------------------------------------------------------------------
// TimelineEngine
// ---------------------------------------------------------------------------

export class TimelineEngine {
  // ── Private state ─────────────────────────────────────────────────────────
  private _state:       TimelineState;
  private _history:     HistoryState;
  private _snapIndex:   SnapIndex;
  private _registry:    ToolRegistry;
  private _provisional: ProvisionalManager;
  private _snapshot:    EngineSnapshot;
  private _listeners:   Set<() => void>;
  private _ppf:         number;          // pixelsPerFrame — internal only, NOT in snapshot
  private _playhead:    TimelineFrame;

  // ── Constructor ──────────────────────────────────────────────────────────

  constructor(
    initial:       TimelineState,
    tools:         readonly ITool[] = [NoOpTool],
    defaultToolId: ToolId          = toToolId('noop'),
  ) {
    this._state       = initial;
    this._history     = createHistory(initial);
    this._snapIndex   = buildSnapIndex(initial, 0 as TimelineFrame);
    this._registry    = createRegistry(tools, defaultToolId);
    this._provisional = createProvisionalManager();
    this._listeners   = new Set();
    this._ppf         = DEFAULT_PPF;
    this._playhead    = 0 as TimelineFrame;
    this._snapshot    = this.buildSnapshot();

    // Bind so callers can destructure: const { subscribe, getSnapshot } = engine
    this.subscribe   = this.subscribe.bind(this);
    this.getSnapshot = this.getSnapshot.bind(this);
  }

  // ── useSyncExternalStore interface ────────────────────────────────────────

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  /** Returns same object reference until the next notify(). */
  getSnapshot(): EngineSnapshot {
    return this._snapshot;
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────

  dispatch(tx: Transaction): DispatchResult {
    const result = coreDispatch(this._state, tx);

    if (result.accepted) {
      this._state    = result.nextState;
      this._history  = pushHistory(this._history, result.nextState);
      this._snapshot = this.buildSnapshot();
      this.notify();
      // Snap index rebuild never blocks the render — always async
      queueMicrotask(() => this.rebuildSnapIndex());
    }

    return result;
  }

  // ── Pointer routing ───────────────────────────────────────────────────────

  /**
   * Forward to activeTool.onPointerDown.
   * Rebuilds snapshot and notifies once — cursor may change on mousedown
   * (e.g. Selection tool switches to grab cursor when clicking a clip).
   */
  handlePointerDown(event: TimelinePointerEvent, modifiers: Modifiers): void {
    const ctx = this.buildToolContext(modifiers);
    getActiveTool(this._registry).onPointerDown(event, ctx);
    this._snapshot = this.buildSnapshot();
    this.notify();
  }

  /**
   * Forward to activeTool.onPointerMove.
   * Sets or clears provisional, rebuilds snapshot, calls notify() ONCE.
   * rAF throttle lives in tool-router.ts — not here.
   */
  handlePointerMove(event: TimelinePointerEvent, modifiers: Modifiers): void {
    const ctx         = this.buildToolContext(modifiers);
    const provisional = getActiveTool(this._registry).onPointerMove(event, ctx);

    this._provisional = provisional !== null
      ? setProvisional(this._provisional, provisional)
      : clearProvisional(this._provisional);

    this._snapshot = this.buildSnapshot();
    this.notify();
  }

  /**
   * Order matters:
   *   1. Clear provisional first — snapshot no longer shows ghost
   *   2. Get tx from tool.onPointerUp
   *   3. If tx → dispatch() — dispatch calls notify() internally
   *   4. Else → notify() once — push cleared ghost to subscribers
   */
  handlePointerUp(event: TimelinePointerEvent, modifiers: Modifiers): void {
    // Step 1 — always clear provisional before reading the tx
    this._provisional = clearProvisional(this._provisional);
    const ctx = this.buildToolContext(modifiers);

    // Step 2 — get optional commit transaction
    const tx = getActiveTool(this._registry).onPointerUp(event, ctx);

    if (tx !== null) {
      // Step 3 — dispatch handles snapshot rebuild + notify internally
      this.dispatch(tx);
    } else {
      // Step 4 — no tx: push the cleared-ghost state to subscribers
      this._snapshot = this.buildSnapshot();
      this.notify();
    }
  }

  /**
   * Forward to activeTool.onKeyDown.
   * If tx non-null: dispatch (dispatch calls notify internally).
   * If null: NO notify — key events that produce no tx don't trigger re-renders.
   * (Different from handlePointerUp where ghost always must be cleared.)
   */
  handleKeyDown(event: TimelineKeyEvent, modifiers: Modifiers): void {
    const ctx = this.buildToolContext(modifiers);
    const tx  = getActiveTool(this._registry).onKeyDown(event, ctx);
    if (tx !== null) {
      this.dispatch(tx);
    }
  }

  /** keyup never changes visible state — no notify. */
  handleKeyUp(event: TimelineKeyEvent, modifiers: Modifiers): void {
    const ctx = this.buildToolContext(modifiers);
    getActiveTool(this._registry).onKeyUp(event, ctx);
  }

  // ── Tool management ───────────────────────────────────────────────────────

  /**
   * Switch active tool.
   * registryActivate calls outgoing.onCancel() before switching.
   * Rebuilds snapshot (cursor changes), notifies.
   */
  activateTool(id: ToolId): void {
    this._registry = registryActivate(this._registry, id);
    this._snapshot = this.buildSnapshot();
    this.notify();
  }

  // ── Playhead ──────────────────────────────────────────────────────────────

  /**
   * Update playhead position.
   * Notifies (playhead is rendered + is a snap point).
   * Queues snap index rebuild.
   */
  setPlayheadFrame(frame: TimelineFrame): void {
    this._playhead = frame;
    this._snapshot = this.buildSnapshot();
    this.notify();
    queueMicrotask(() => this.rebuildSnapIndex());
  }

  // ── Zoom sync ─────────────────────────────────────────────────────────────

  /**
   * Sync internal _ppf from UI zoom state.
   * Does NOT call notify() — ppf is not in EngineSnapshot.
   * buildToolContext() always reads the current _ppf at event time.
   */
  setPixelsPerFrame(ppf: number): void {
    this._ppf = ppf;
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  undo(): void {
    if (!historyCanUndo(this._history)) return;
    this._history  = historyUndo(this._history);
    this._state    = this._history.present;
    this._snapshot = this.buildSnapshot();
    this.notify();
    queueMicrotask(() => this.rebuildSnapIndex());
  }

  redo(): void {
    if (!historyCanRedo(this._history)) return;
    this._history  = historyRedo(this._history);
    this._state    = this._history.present;
    this._snapshot = this.buildSnapshot();
    this.notify();
    queueMicrotask(() => this.rebuildSnapIndex());
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildSnapshot(): EngineSnapshot {
    return {
      state:        this._state,
      provisional:  this._provisional.current,
      activeToolId: this._registry.activeToolId,
      cursor:       getActiveTool(this._registry).getCursor(this.buildToolContext(IDLE_MODIFIERS)),
      canUndo:      historyCanUndo(this._history),
      canRedo:      historyCanRedo(this._history),
      trackIds:     this._state.timeline.tracks.map(t => t.id),
    };
  }

  private buildToolContext(modifiers: Modifiers): ToolContext {
    const ppf   = this._ppf;
    const idx   = this._snapIndex;
    const state = this._state;

    return {
      state,
      snapIndex:      idx,
      pixelsPerFrame: ppf,
      modifiers,
      frameAtX: (x: number): TimelineFrame =>
        Math.round(x / ppf) as TimelineFrame,
      trackAtY: (y: number): TrackId | null => {
        // Linear track layout — 48px per track (Phase 2 uses measured heights)
        const trackIndex = Math.floor(y / DEFAULT_TRACK_H);
        const track = state.timeline.tracks[trackIndex];
        return track ? track.id : null;
      },
      snap: (
        frame: TimelineFrame,
        exclude?: readonly string[],
        allowedTypes?: Parameters<typeof nearest>[4],
      ): TimelineFrame => {
        const radiusFrames = SNAP_RADIUS_PX / ppf;
        const hit = nearest(idx, frame, radiusFrames, exclude, allowedTypes);
        return hit ? hit.frame : frame;
      },
    };
  }

  private notify(): void {
    for (const listener of this._listeners) {
      listener();
    }
  }

  private rebuildSnapIndex(): void {
    this._snapIndex = buildSnapIndex(this._state, this._playhead);
  }
}
