/**
 * TimelineEngine — Phase R Step 1 (full orchestrator)
 *
 * Wires @timeline/core: HistoryStack, PlaybackEngine, SnapIndexManager,
 * TrackIndex, KeyboardHandler, dispatch, diffStates. Exposes EngineSnapshot
 * for useSyncExternalStore.
 *
 * No DOM dependencies — clock and getPixelsPerFrame are injected.
 */

import {
  dispatch as coreDispatch,
  HistoryStack,
  DEFAULT_COMPRESSION_POLICY,
  diffStates,
  EMPTY_STATE_CHANGE,
  createProvisionalManager,
  setProvisional,
  clearProvisional,
  createRegistry,
  activateTool as registryActivateTool,
  getActiveTool,
  buildSnapIndex,
  nearest,
  SnapIndexManager,
  TrackIndex,
  PlaybackEngine,
  browserClock,
  KeyboardHandler,
  SelectionTool,
  RazorTool,
  RippleTrimTool,
  RollTrimTool,
  SlipTool,
  SlideTool,
  RippleDeleteTool,
  RippleInsertTool,
  HandTool,
  TransitionTool,
  KeyframeTool,
  createZoomTool,
  toFrame,
  toToolId,
} from '@timeline/core';

import type {
  TimelineState,
  Transaction,
  DispatchResult,
  TimelineFrame,
  TrackId,
  ITool,
  ToolId,
  ToolContext,
  Modifiers,
  TimelinePointerEvent,
  TimelineKeyEvent,
  ToolRegistry,
  ProvisionalManager,
  StateChange,
  SnapPointType,
  SnapIndex,
} from '@timeline/core';

import type { EngineSnapshot, TimelineEngineOptions } from './types/engine-snapshot';
import { DEFAULT_PLAYHEAD_STATE } from './types/engine-snapshot';

export type { EngineSnapshot, TimelineEngineOptions } from './types/engine-snapshot';
export { DEFAULT_PLAYHEAD_STATE } from './types/engine-snapshot';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SNAP_RADIUS_PX = 8;
const DEFAULT_TRACK_H = 48;
const DEFAULT_PPF = 10;

/** No-op transaction for initial history entry */
const NOOP_TRANSACTION: Transaction = {
  id: 'initial',
  label: 'initial',
  timestamp: 0,
  operations: [],
};

/** Idle modifiers for cursor computation */
const IDLE_MODIFIERS: Modifiers = { shift: false, alt: false, ctrl: false, meta: false };

// ---------------------------------------------------------------------------
// TimelineEngine
// ---------------------------------------------------------------------------

export class TimelineEngine {
  private currentState: TimelineState;
  private history: HistoryStack;
  private provisional: ProvisionalManager;
  private toolRegistry: ToolRegistry;
  private keyboardHandler: KeyboardHandler;
  private playback: PlaybackEngine | null;
  private snapManager: SnapIndexManager;
  private trackIndex: TrackIndex;
  private subscribers: Set<() => void>;
  private snapshot: EngineSnapshot;
  private prevState: TimelineState;
  private stableTrackIds: readonly string[];
  private options: TimelineEngineOptions;
  /** Cached for stable snapshot.history ref — only updated when canUndo/canRedo change. */
  private historyFlags: { canUndo: boolean; canRedo: boolean };
  private playbackUnsubscribe: (() => void) | null = null;
  /** Lightweight playhead frame when no PlaybackEngine is present. */
  private _playheadFrame: TimelineFrame = toFrame(0);
  /** Selection state (set of clip IDs). */
  private _selectedClipIds: ReadonlySet<string> = new Set();

  constructor(options: TimelineEngineOptions) {
    this.options = options;
    this.currentState = options.initialState;

    this.history = new HistoryStack(
      options.historyLimit ?? 100,
      options.compression ?? DEFAULT_COMPRESSION_POLICY,
    );
    this.history.push({
      state: options.initialState,
      transaction: NOOP_TRANSACTION,
    });

    this.provisional = createProvisionalManager();

    const ppf = options.getPixelsPerFrame?.() ?? DEFAULT_PPF;
    const defaultTools: ITool[] = [
      new SelectionTool(),
      new RazorTool(),
      new RippleTrimTool(),
      new RollTrimTool(),
      new SlipTool(),
      new SlideTool(),
      new RippleDeleteTool(),
      new RippleInsertTool(),
      new HandTool(),
      new TransitionTool(),
      new KeyframeTool(),
      createZoomTool({
        onZoomChange: options.onZoomChange ?? (() => {}),
        initialPixelsPerFrame: ppf,
      }),
    ];
    const toolMap = new Map<ToolId, ITool>(defaultTools.map((t) => [t.id, t]));
    for (const t of options.tools ?? []) {
      toolMap.set(t.id, t);
    }
    const allTools = [...toolMap.values()];
    const defaultToolId = options.defaultToolId ?? 'selection';
    this.toolRegistry = createRegistry(allTools, toToolId(defaultToolId));

    this.snapManager = new SnapIndexManager();
    this.snapManager.rebuildSync(options.initialState);

    this.trackIndex = new TrackIndex();
    this.trackIndex.build(options.initialState);

    if (options.pipeline) {
      this.playback = new PlaybackEngine(
        options.initialState,
        options.pipeline,
        options.dimensions ?? { width: 1920, height: 1080 },
        options.clock ?? browserClock,
      );
      this.playbackUnsubscribe = this.playback.on(() => {
        this.rebuildSnapshot(EMPTY_STATE_CHANGE);
        this.notify();
      });
    } else {
      this.playback = null;
    }

    this.keyboardHandler = new KeyboardHandler(this.playback ?? ({} as PlaybackEngine), {
      onMarkIn: options.onMarkIn,
      onMarkOut: options.onMarkOut,
      getTimelineState: () => this.currentState,
    });

    this.subscribers = new Set();
    this.stableTrackIds = options.initialState.timeline.tracks.map((t) => t.id);
    this.prevState = options.initialState;
    const u0 = this.history.canUndo();
    const r0 = this.history.canRedo();
    this.historyFlags = { canUndo: u0, canRedo: r0 };
    this.snapshot = this.buildSnapshot(EMPTY_STATE_CHANGE);

    this.subscribe = this.subscribe.bind(this);
    this.getSnapshot = this.getSnapshot.bind(this);
    this.dispatch = this.dispatch.bind(this);
  }

  dispatch(transaction: Transaction): DispatchResult {
    const result = coreDispatch(this.currentState, transaction);
    if (!result.accepted) {
      return result;
    }

    const change = diffStates(this.currentState, result.nextState);
    this.currentState = result.nextState;
    this.history.pushWithCompression(
      { state: result.nextState, transaction },
      transaction,
    );

    this.trackIndex.build(result.nextState);
    this.snapManager.scheduleRebuild(result.nextState);
    this.playback?.updateState(result.nextState);

    const nextIds = result.nextState.timeline.tracks.map((t) => t.id);
    const idsChanged =
      this.stableTrackIds.length !== nextIds.length ||
      this.stableTrackIds.some((id, i) => id !== nextIds[i]);
    if (idsChanged) {
      this.stableTrackIds = nextIds;
    }

    this.rebuildSnapshot(change);
    this.notify();
    return result;
  }

  undo(): boolean {
    const state = this.history.undo();
    if (state === null) return false;
    this.currentState = state;
    this.applyStateChange(state);
    return true;
  }

  redo(): boolean {
    const state = this.history.redo();
    if (state === null) return false;
    this.currentState = state;
    this.applyStateChange(state);
    return true;
  }

  private applyStateChange(state: TimelineState): void {
    const change = diffStates(this.prevState, state);
    this.prevState = state;
    this.trackIndex.build(state);
    this.snapManager.scheduleRebuild(state);
    this.playback?.updateState(state);
    const nextIds = state.timeline.tracks.map((t) => t.id);
    const idsChanged =
      this.stableTrackIds.length !== nextIds.length ||
      this.stableTrackIds.some((id, i) => id !== nextIds[i]);
    if (idsChanged) {
      this.stableTrackIds = nextIds;
    }
    this.rebuildSnapshot(change);
    this.notify();
  }

  activateTool(toolId: string): void {
    const id = toToolId(toolId);
    this.toolRegistry = registryActivateTool(this.toolRegistry, id);
    this._syncSelectionFromTool();
    this.rebuildSnapshot(EMPTY_STATE_CHANGE);
    this.notify();
  }

  getActiveToolId(): string {
    return this.toolRegistry.activeToolId as string;
  }

  /**
   * Read selection from the active tool (if it exposes getSelection) and
   * sync to this._selectedClipIds. Called after every pointer event so that
   * SelectionTool's internal Set is always mirrored in the engine snapshot.
   */
  private _syncSelectionFromTool(): void {
    const tool = getActiveTool(this.toolRegistry) as unknown as {
      getSelection?: () => ReadonlySet<string>;
    };
    if (typeof tool.getSelection === 'function') {
      this._selectedClipIds = tool.getSelection();
    }
  }

  handlePointerDown(event: TimelinePointerEvent, modifiers: Modifiers): void {
    const ctx = this.buildToolContext(modifiers);
    getActiveTool(this.toolRegistry).onPointerDown(event, ctx);
    this._syncSelectionFromTool();
    this.rebuildSnapshot(EMPTY_STATE_CHANGE);
    this.notify();
  }

  handlePointerMove(event: TimelinePointerEvent, modifiers: Modifiers): void {
    const ctx = this.buildToolContext(modifiers);
    const provisional = getActiveTool(this.toolRegistry).onPointerMove(event, ctx);
    this.provisional =
      provisional !== null
        ? setProvisional(this.provisional, provisional)
        : clearProvisional(this.provisional);
    // NOTE: Don't sync selection on move — selection only changes on up/down.
    // Rebuild snapshot with current state (doesn't re-allocate state object).
    this.rebuildSnapshot(EMPTY_STATE_CHANGE);
    this.notifyProvisional();
  }

  handlePointerUp(event: TimelinePointerEvent, modifiers: Modifiers): void {
    this.provisional = clearProvisional(this.provisional);
    const ctx = this.buildToolContext(modifiers);
    const tx = getActiveTool(this.toolRegistry).onPointerUp(event, ctx);
    this._syncSelectionFromTool();
    if (tx !== null) {
      this.dispatch(tx);
    } else {
      this.rebuildSnapshot(EMPTY_STATE_CHANGE);
      this.notify();
    }
  }

  /** Option Y: cursor left timeline mid-drag — cancel tool gesture and clear provisional. */
  handlePointerLeave(_event: TimelinePointerEvent): void {
    getActiveTool(this.toolRegistry).onCancel();
    this._syncSelectionFromTool();
    this.provisional = clearProvisional(this.provisional);
    this.rebuildSnapshot(EMPTY_STATE_CHANGE);
    this.notify();
  }

  handleKeyDown(event: TimelineKeyEvent, modifiers: Modifiers): boolean {
    if (this.keyboardHandler.handleKeyDown(event)) {
      return true;
    }
    const ctx = this.buildToolContext(modifiers);
    const tx = getActiveTool(this.toolRegistry).onKeyDown(event, ctx);
    if (tx !== null) {
      this.dispatch(tx);
      return true;
    }
    return false;
  }

  handleKeyUp(event: TimelineKeyEvent, modifiers: Modifiers): void {
    const ctx = this.buildToolContext(modifiers);
    getActiveTool(this.toolRegistry).onKeyUp(event, ctx);
  }

  private buildToolContext(modifiers: Modifiers): ToolContext {
    const state = this.currentState;
    const ppf = this.options.getPixelsPerFrame?.() ?? DEFAULT_PPF;
    let idx = this.snapManager.getIndex();
    if (idx === null) {
      this.snapManager.rebuildSync(state);
      idx = this.snapManager.getIndex();
    }
    const snapIndex = idx ?? buildSnapIndex(state, toFrame(0));

    return {
      state,
      snapIndex,
      pixelsPerFrame: ppf,
      modifiers,
      frameAtX: (x: number): TimelineFrame => Math.round(x / ppf) as TimelineFrame,
      trackAtY: (y: number): TrackId | null => {
        const i = Math.floor(y / DEFAULT_TRACK_H);
        const t = state.timeline.tracks[i];
        return t ? t.id : null;
      },
      snap: (
        frame: TimelineFrame,
        exclude?: readonly string[],
        allowedTypes?: readonly SnapPointType[],
      ): TimelineFrame => {
        const radius = SNAP_RADIUS_PX / ppf;
        const hit = nearest(snapIndex, frame, radius, exclude, allowedTypes);
        return hit ? hit.frame : frame;
      },
    };
  }

  private buildSnapshot(change: StateChange): EngineSnapshot {
    const activeTool = getActiveTool(this.toolRegistry);
    const cursor = activeTool?.getCursor(this.buildToolContext(IDLE_MODIFIERS)) ?? 'default';
    const u = this.history.canUndo();
    const r = this.history.canRedo();
    if (u !== this.historyFlags.canUndo || r !== this.historyFlags.canRedo) {
      this.historyFlags = { canUndo: u, canRedo: r };
    }
    const playheadState = this.playback?.getState() ?? {
      ...DEFAULT_PLAYHEAD_STATE,
      currentFrame: this._playheadFrame,
      durationFrames: (this.currentState.timeline.duration as number) ?? 0,
      fps: (this.currentState.timeline.fps as number) || 30,
    };
    return {
      state: this.currentState,
      provisional: this.provisional.current,
      activeToolId: this.toolRegistry.activeToolId as string,
      canUndo: u,
      canRedo: r,
      history: this.historyFlags,
      trackIds: this.stableTrackIds,
      cursor,
      playhead: playheadState,
      change,
      selectedClipIds: this._selectedClipIds,
    };
  }

  private rebuildSnapshot(change: StateChange): void {
    this.snapshot = this.buildSnapshot(change);
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  getSnapshot(): EngineSnapshot {
    return this.snapshot;
  }

  getSnapIndex(): SnapIndex | null {
    return this.snapManager.getIndex();
  }

  private notify(): void {
    this.subscribers.forEach((cb) => cb());
  }

  /**
   * Notify only on provisional changes (during drag / pointer move).
   * Currently calls notify() — future optimization: use a separate lightweight
   * provisional subscriber channel so that state-only hooks (useTrackIds,
   * useHistory, useMarkers) skip their selector checks during drag.
   */
  private notifyProvisional(): void {
    this.subscribers.forEach((cb) => cb());
  }

  get playbackEngine(): PlaybackEngine | null {
    return this.playback;
  }

  getState(): TimelineState {
    return this.currentState;
  }

  /**
   * Seek the playhead to a specific frame.
   * Works with or without a PlaybackEngine.
   */
  seekTo(frame: TimelineFrame): void {
    if (this.playback) {
      this.playback.seekTo(frame);
    } else {
      const maxFrame = (this.currentState.timeline.duration as number) - 1;
      this._playheadFrame = Math.max(0, Math.min(frame as number, maxFrame)) as TimelineFrame;
      this.rebuildSnapshot(EMPTY_STATE_CHANGE);
      this.notify();
    }
  }

  /** Get the current playhead frame. */
  getPlayheadFrame(): TimelineFrame {
    if (this.playback) {
      return this.playback.getState().currentFrame;
    }
    return this._playheadFrame;
  }

  /**
   * Write a selection set back to the active tool (if SelectionTool).
   * Keeps the tool's internal Set in sync with external API calls.
   */
  private _writeSelectionToTool(ids: ReadonlySet<string>): void {
    const tool = getActiveTool(this.toolRegistry) as unknown as {
      clearSelection?: () => void;
      getSelection?: () => ReadonlySet<string>;
    };
    if (typeof tool.clearSelection === 'function') {
      tool.clearSelection();
      // SelectionTool.clearSelection() clears the set; we can't add back via public API
      // so we just clear — the engine's _selectedClipIds drives rendering.
    }
    this._selectedClipIds = ids;
  }

  /** Get the current selection (clip IDs). */
  getSelectedClipIds(): ReadonlySet<string> {
    return this._selectedClipIds;
  }

  /** Set the selection (clip IDs). */
  setSelectedClipIds(ids: ReadonlySet<string>): void {
    this._writeSelectionToTool(ids);
    this.rebuildSnapshot(EMPTY_STATE_CHANGE);
    this.notify();
  }

  /** Toggle a clip in/out of the selection. */
  toggleClipSelection(clipId: string, multi: boolean): void {
    const next = new Set(this._selectedClipIds);
    if (multi) {
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
    } else {
      next.clear();
      next.add(clipId);
    }
    this._writeSelectionToTool(next);
    this.rebuildSnapshot(EMPTY_STATE_CHANGE);
    this.notify();
  }

  /** Clear selection. */
  clearSelection(): void {
    if (this._selectedClipIds.size === 0) return;
    this._writeSelectionToTool(new Set());
    this.rebuildSnapshot(EMPTY_STATE_CHANGE);
    this.notify();
  }

  destroy(): void {
    this.playbackUnsubscribe?.();
    this.playbackUnsubscribe = null;
    this.playback?.destroy();
    this.subscribers.clear();
  }
}
