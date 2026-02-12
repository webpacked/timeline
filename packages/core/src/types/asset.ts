/**
 * ASSET MODEL
 * 
 * An Asset represents immutable metadata about a media file.
 * 
 * WHAT IS AN ASSET?
 * - A reference to source media (video, audio, image)
 * - Contains metadata like duration and type
 * - Immutable once registered (duration never changes)
 * 
 * WHY SEPARATE ASSETS FROM CLIPS?
 * - Multiple clips can reference the same asset
 * - Asset duration is the source of truth
 * - Clips can trim/slice the asset without modifying it
 * 
 * EXAMPLE:
 * ```typescript
 * const asset: Asset = {
 *   id: 'asset_1',
 *   type: 'video',
 *   duration: frame(3600),  // 2 minutes at 30fps
 *   sourceUrl: 'https://example.com/video.mp4',
 * };
 * ```
 * 
 * INVARIANTS:
 * - Asset ID must be unique
 * - Duration must be positive
 * - Duration is immutable after registration
 */

import type { Frame } from './frame';

/**
 * AssetType - The kind of media this asset represents
 */
export type AssetType = 'video' | 'audio' | 'image';

/**
 * Asset - Immutable metadata about a media file
 */
export interface Asset {
  /** Unique identifier */
  id: string;
  
  /** Type of media */
  type: AssetType;
  
  /** Total duration of the asset in frames */
  duration: Frame;
  
  /** Source URL or file path */
  sourceUrl: string;
  
  /** Optional metadata for custom use cases */
  metadata?: Record<string, unknown>;
}

/**
 * Create a new asset
 * 
 * @param params - Asset parameters
 * @returns A new Asset object
 */
export function createAsset(params: {
  id: string;
  type: AssetType;
  duration: Frame;
  sourceUrl: string;
  metadata?: Record<string, unknown>;
}): Asset {
  const asset: Asset = {
    id: params.id,
    type: params.type,
    duration: params.duration,
    sourceUrl: params.sourceUrl,
  };
  
  if (params.metadata !== undefined) {
    asset.metadata = params.metadata;
  }
  
  return asset;
}
