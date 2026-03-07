/**
 * ASSET MODEL — Phase 0 + Phase 3
 *
 * Asset is FileAsset | GeneratorAsset. Multiple Clips can reference the same Asset.
 * Assets never change their intrinsicDuration after registration.
 */

import type { TimelineFrame, FrameRate } from './frame';
import type { TrackType } from './track';
import type { Generator } from './generator';

// ---------------------------------------------------------------------------
// Branded IDs
// ---------------------------------------------------------------------------

export type AssetId = string & { readonly __brand: 'AssetId' };

export const toAssetId = (s: string): AssetId => s as AssetId;

// ---------------------------------------------------------------------------
// Asset status
// ---------------------------------------------------------------------------

export type AssetStatus = 'online' | 'offline' | 'proxy-only' | 'missing';

// ---------------------------------------------------------------------------
// FileAsset — media file on disk
// ---------------------------------------------------------------------------

export type FileAsset = {
  readonly kind: 'file';
  readonly id: AssetId;
  readonly name: string;
  readonly mediaType: TrackType;
  readonly filePath: string;
  readonly intrinsicDuration: TimelineFrame;
  readonly nativeFps: FrameRate;
  readonly sourceTimecodeOffset: TimelineFrame;
  readonly status: AssetStatus;
};

// ---------------------------------------------------------------------------
// GeneratorAsset — synthetic asset (no filePath)
// ---------------------------------------------------------------------------

export type GeneratorAsset = {
  readonly kind: 'generator';
  readonly id: AssetId;
  readonly name: string;
  readonly mediaType: TrackType;
  readonly intrinsicDuration: TimelineFrame;
  readonly nativeFps: FrameRate;
  readonly sourceTimecodeOffset: TimelineFrame;
  readonly status: AssetStatus;
  readonly generatorDef: Generator;
};

// ---------------------------------------------------------------------------
// Asset — discriminated union
// ---------------------------------------------------------------------------

export type Asset = FileAsset | GeneratorAsset;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createAsset(params: {
  id: string;
  name: string;
  mediaType: TrackType;
  filePath: string;
  intrinsicDuration: TimelineFrame;
  nativeFps: FrameRate;
  sourceTimecodeOffset: TimelineFrame;
  status?: AssetStatus;
}): FileAsset {
  return {
    kind: 'file',
    id: params.id as AssetId,
    name: params.name,
    mediaType: params.mediaType,
    filePath: params.filePath,
    intrinsicDuration: params.intrinsicDuration,
    nativeFps: params.nativeFps,
    sourceTimecodeOffset: params.sourceTimecodeOffset,
    status: params.status ?? 'online',
  };
}

export function createGeneratorAsset(params: {
  id: string;
  name: string;
  mediaType: TrackType;
  generatorDef: Generator;
  nativeFps: FrameRate;
  status?: AssetStatus;
}): GeneratorAsset {
  return {
    kind: 'generator',
    id: params.id as AssetId,
    name: params.name,
    mediaType: params.mediaType,
    intrinsicDuration: params.generatorDef.duration,
    nativeFps: params.nativeFps,
    sourceTimecodeOffset: 0 as TimelineFrame,
    status: params.status ?? 'online',
    generatorDef: params.generatorDef,
  };
}
