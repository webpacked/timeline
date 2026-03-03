/**
 * Worker contracts — Phase 7 Step 4
 *
 * Core defines message/response types only.
 * No Worker instantiation — host responsibility.
 */

import type { AssetId } from './asset';
import type { ClipId } from './clip';
import type { TimelineFrame } from './frame';
import type { ThumbnailRequest, ThumbnailResult } from './pipeline';

// ---------------------------------------------------------------------------
// Waveform worker contract
// ---------------------------------------------------------------------------

export type WaveformRequest = {
  readonly requestId: string;
  readonly assetId: AssetId;
  readonly channel: number;
  readonly startFrame: TimelineFrame;
  readonly endFrame: TimelineFrame;
  readonly buckets: number;
  readonly sampleRate: number;
};

export type WaveformPeak = {
  readonly min: number;
  readonly max: number;
  readonly rms: number;
};

export type WaveformResult = {
  readonly requestId: string;
  readonly assetId: AssetId;
  readonly peaks: readonly WaveformPeak[];
  readonly error?: string;
};

export type WaveformWorkerMessage =
  | { type: 'request'; payload: WaveformRequest }
  | { type: 'cancel'; requestId: string };

export type WaveformWorkerResponse =
  | { type: 'result'; payload: WaveformResult }
  | { type: 'progress'; requestId: string; progress: number }
  | { type: 'error'; requestId: string; message: string };

// ---------------------------------------------------------------------------
// Thumbnail queue contract
// ---------------------------------------------------------------------------

export type ThumbnailPriority = 'high' | 'normal' | 'low';

export type ThumbnailQueueEntry = {
  readonly request: ThumbnailRequest;
  readonly priority: ThumbnailPriority;
  readonly addedAt: number;
};

export type ThumbnailWorkerMessage =
  | { type: 'request'; payload: ThumbnailQueueEntry }
  | { type: 'cancel'; requestId: string }
  | { type: 'set-priority'; requestId: string; priority: ThumbnailPriority };

export type ThumbnailWorkerResponse =
  | { type: 'result'; payload: ThumbnailResult }
  | { type: 'error'; requestId: string; message: string };
