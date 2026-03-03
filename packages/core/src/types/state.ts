/**
 * TIMELINE STATE — Phase 0 compliant
 *
 * TimelineState is the single source of truth for the engine.
 * Phase 0 only: timeline + assetRegistry. No Phase 2 fields.
 *
 * RULE: Every function that changes state returns a NEW TimelineState.
 * Never mutate the existing state.
 */

import type { Timeline } from './timeline';
import type { Asset, AssetId } from './asset';

// ---------------------------------------------------------------------------
// AssetRegistry — ReadonlyMap is the invariant boundary
// ---------------------------------------------------------------------------

export type AssetRegistry = ReadonlyMap<AssetId, Asset>;

// ---------------------------------------------------------------------------
// Schema versioning
// ---------------------------------------------------------------------------

/**
 * Increment this whenever TimelineState gains a new required field or
 * a field's semantics change in a breaking way.
 *
 * The schemaVersion invariant check rejects loading a future schema
 * into an older engine (prevents silent data corruption on downgrade).
 */
export const CURRENT_SCHEMA_VERSION = 2 as const;

// ---------------------------------------------------------------------------
// TimelineState
// ---------------------------------------------------------------------------

export type TimelineState = {
  readonly schemaVersion: number;        // must equal CURRENT_SCHEMA_VERSION
  readonly timeline:      Timeline;
  readonly assetRegistry: AssetRegistry;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTimelineState(params: {
  timeline:       Timeline;
  assetRegistry?: AssetRegistry;
  /** @deprecated use assetRegistry. Kept for test backward-compat only. */
  assets?:        Map<string, Asset>;
}): TimelineState {
  // Support legacy 'assets' param during test migration
  const registry: AssetRegistry =
    params.assetRegistry ??
    (params.assets
      ? (params.assets as unknown as AssetRegistry)
      : new Map<AssetId, Asset>());

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    timeline:      params.timeline,
    assetRegistry: registry,
  };
}
