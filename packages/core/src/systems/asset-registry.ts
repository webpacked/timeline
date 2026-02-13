/**
 * ASSET REGISTRY SYSTEM
 * 
 * Pure functions for managing assets in the timeline state.
 * 
 * WHAT IS THE ASSET REGISTRY?
 * - A Map of asset ID -> Asset
 * - Stores immutable metadata about media files
 * - Provides lookup functions for assets
 * 
 * WHY A REGISTRY?
 * - Centralized asset management
 * - Multiple clips can reference the same asset
 * - Asset duration is the source of truth for validation
 * 
 * USAGE:
 * ```typescript
 * let state = createTimelineState({ timeline, assets: new Map() });
 * state = registerAsset(state, asset);
 * const asset = getAsset(state, 'asset_1');
 * ```
 * 
 * ALL FUNCTIONS ARE PURE:
 * - Take state as input
 * - Return new state as output
 * - Never mutate the input state
 */

import { TimelineState } from '../types/state';
import { Asset } from '../types/asset';

/**
 * Register a new asset in the state
 * 
 * Creates a new state with the asset added to the registry.
 * If an asset with the same ID already exists, it will be replaced.
 * 
 * @param state - Current timeline state
 * @param asset - Asset to register
 * @returns New timeline state with the asset registered
 */
export function registerAsset(state: TimelineState, asset: Asset): TimelineState {
  const newAssets = new Map(state.assets);
  newAssets.set(asset.id, asset);
  
  return {
    ...state,
    assets: newAssets,
  };
}

/**
 * Get an asset by ID
 * 
 * @param state - Current timeline state
 * @param assetId - ID of the asset to get
 * @returns The asset, or undefined if not found
 */
export function getAsset(state: TimelineState, assetId: string): Asset | undefined {
  return state.assets.get(assetId);
}

/**
 * Check if an asset exists in the registry
 * 
 * @param state - Current timeline state
 * @param assetId - ID of the asset to check
 * @returns true if the asset exists
 */
export function hasAsset(state: TimelineState, assetId: string): boolean {
  return state.assets.has(assetId);
}

/**
 * Get all assets in the registry
 * 
 * @param state - Current timeline state
 * @returns Array of all assets
 */
export function getAllAssets(state: TimelineState): Asset[] {
  return Array.from(state.assets.values());
}

/**
 * Remove an asset from the registry
 * 
 * WARNING: This does not check if any clips reference this asset.
 * You should validate that no clips reference this asset before removing it.
 * 
 * @param state - Current timeline state
 * @param assetId - ID of the asset to remove
 * @returns New timeline state with the asset removed
 */
export function unregisterAsset(state: TimelineState, assetId: string): TimelineState {
  const newAssets = new Map(state.assets);
  newAssets.delete(assetId);
  
  return {
    ...state,
    assets: newAssets,
  };
}
