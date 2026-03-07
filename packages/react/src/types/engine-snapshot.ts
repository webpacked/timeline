/**
 * EngineSnapshot — Phase R Step 1
 *
 * The single object useSyncExternalStore reads.
 * Includes edit state, playback state (merged), and change for hook optimization.
 */

import type {
  TimelineState,
  ProvisionalState,
  StateChange,
  PlayheadState,
  PipelineConfig,
  Clock,
  CompressionPolicy,
  ITool,
  TimelineFrame,
} from '@webpacked-timeline/core';
import { toFrame } from '@webpacked-timeline/core';

export type TimelineEngineOptions = {
  initialState: TimelineState;
  pipeline?: PipelineConfig;
  dimensions?: { width: number; height: number };
  clock?: Clock;
  historyLimit?: number;
  compression?: CompressionPolicy;
  /** Merged with defaults; duplicate ids override. */
  tools?: ITool[];
  /** Default active tool id (default: 'selection'). */
  defaultToolId?: string;
  onMarkIn?: (frame: TimelineFrame) => void;
  onMarkOut?: (frame: TimelineFrame) => void;
  onZoomChange?: (pixelsPerFrame: number) => void;
  getPixelsPerFrame?: () => number;
};

export type EngineSnapshot = {
  readonly state: TimelineState;
  readonly provisional: ProvisionalState | null;
  readonly activeToolId: string;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Stable ref for useHistory — only changes when canUndo/canRedo change. */
  readonly history: { readonly canUndo: boolean; readonly canRedo: boolean };
  readonly trackIds: readonly string[];
  readonly cursor: string;
  readonly playhead: PlayheadState;
  readonly change: StateChange;
  /** Currently selected clip IDs. */
  readonly selectedClipIds: ReadonlySet<string>;
};

export const DEFAULT_PLAYHEAD_STATE: PlayheadState = {
  currentFrame: toFrame(0),
  isPlaying: false,
  playbackRate: 1.0,
  quality: 'full',
  durationFrames: 0,
  fps: 30,
  loopRegion: null,
  prerollFrames: 0,
  postrollFrames: 0,
};
