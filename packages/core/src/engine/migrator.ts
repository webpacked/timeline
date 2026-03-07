/**
 * Schema migrator — Phase 5 Step 1 / Addendum
 *
 * Pure functions. Brings parsed JSON to current schema version.
 * checkInvariants() is run by deserializeTimeline after migrate.
 */

import { CURRENT_SCHEMA_VERSION } from '../types/state';
import type { TimelineState } from '../types/state';
import type { AssetId, Asset } from '../types/asset';
import { SerializationError } from './serialization-error';

export { CURRENT_SCHEMA_VERSION };

/** V1 → V2: no structural change; bump schemaVersion only. */
function migrateV1toV2(raw: unknown): unknown {
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 2,
  };
}

/**
 * Migrate parsed JSON to current schema version.
 * Runs migration chain (v1→v2, future v2→v3, …). Converts assetRegistry
 * from plain object to Map when needed.
 * Throws SerializationError on invalid structure or unknown version.
 */
export function migrate(raw: unknown): TimelineState {
  if (typeof raw !== 'object' || raw === null) {
    throw new SerializationError('Invalid JSON structure');
  }

  const obj = raw as Record<string, unknown>;
  const version = obj.schemaVersion;
  if (typeof version !== 'number') {
    throw new SerializationError('Missing schemaVersion');
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new SerializationError(`Unknown schema version: ${version}`);
  }

  let current: unknown = raw;
  if (version < 2) current = migrateV1toV2(current);
  // future: if (version < 3) current = migrateV2toV3(current)
  // future: if (version < 4) current = migrateV3toV4(current)

  const curr = current as Record<string, unknown>;
  const registry = curr.assetRegistry;
  const assetRegistry =
    registry instanceof Map
      ? registry
      : new Map<AssetId, Asset>(
          Object.entries(registry as Record<string, Asset>).map(([k, v]) => [k as AssetId, v]),
        );
  return {
    schemaVersion: curr.schemaVersion as number,
    timeline: curr.timeline as TimelineState['timeline'],
    assetRegistry,
  } as TimelineState;
}
