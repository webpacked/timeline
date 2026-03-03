/**
 * ASSET REGISTRY SYSTEM — Phase 0 compliant
 *
 * Pure functions for managing assets in the timeline state.
 * Uses state.assetRegistry (ReadonlyMap<AssetId, Asset>).
 */

import { TimelineState } from '../types/state';
import { Asset, AssetId, toAssetId } from '../types/asset';

export function registerAsset(state: TimelineState, asset: Asset): TimelineState {
  const next = new Map(state.assetRegistry);
  next.set(asset.id, asset);
  return { ...state, assetRegistry: next };
}

export function getAsset(state: TimelineState, assetId: string): Asset | undefined {
  return state.assetRegistry.get(toAssetId(assetId));
}

export function hasAsset(state: TimelineState, assetId: string): boolean {
  return state.assetRegistry.has(toAssetId(assetId));
}

export function getAllAssets(state: TimelineState): Asset[] {
  return Array.from(state.assetRegistry.values());
}

export function unregisterAsset(state: TimelineState, assetId: string): TimelineState {
  const next = new Map(state.assetRegistry);
  next.delete(toAssetId(assetId));
  return { ...state, assetRegistry: next };
}
