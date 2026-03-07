/**
 * PROJECT MODEL — Phase 5 Step 5
 *
 * A Project is a multi-timeline container with a shared bin hierarchy.
 * Pure types + factories only. No IO.
 */

import type { AssetId } from './asset';
import type { TimelineState } from './state';
import { CURRENT_SCHEMA_VERSION } from './state';

// ---------------------------------------------------------------------------
// Branded IDs
// ---------------------------------------------------------------------------

export type ProjectId = string & { readonly __brand: 'ProjectId' };
export function toProjectId(s: string): ProjectId {
  return s as ProjectId;
}

export type BinId = string & { readonly __brand: 'BinId' };
export function toBinId(s: string): BinId {
  return s as BinId;
}

// ---------------------------------------------------------------------------
// Bin model
// ---------------------------------------------------------------------------

export type BinItem =
  | { readonly kind: 'asset'; readonly assetId: AssetId }
  | { readonly kind: 'sequence'; readonly timelineId: string }
  | { readonly kind: 'bin'; readonly binId: BinId };

export type Bin = {
  readonly id: BinId;
  readonly label: string;
  readonly parentId: BinId | null; // null = root
  readonly items: readonly BinItem[];
  readonly color?: string;
};

export function createBin(
  id: BinId,
  label: string,
  parentId: BinId | null = null,
): Bin {
  return { id, label, parentId, items: [] };
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export type Project = {
  readonly id: ProjectId;
  readonly name: string;
  readonly timelines: readonly TimelineState[];
  readonly bins: readonly Bin[];
  readonly rootBinIds: readonly BinId[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly schemaVersion: number; // = CURRENT_SCHEMA_VERSION
};

export function createProject(
  id: ProjectId,
  name: string,
  timelines: readonly TimelineState[] = [],
): Project {
  const now = Date.now();
  return {
    id,
    name,
    timelines,
    bins: [],
    rootBinIds: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}
