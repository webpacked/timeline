/**
 * Project serialization — Phase 5 Step 5
 *
 * Pure functions. No IO. Uses timeline migrate() + checkInvariants().
 */

import type { Project, Bin, BinId, BinItem } from '../types/project';
import type { TimelineState } from '../types/state';
import { CURRENT_SCHEMA_VERSION } from '../types/state';
import { migrate } from './migrator';
import { checkInvariants } from '../validation/invariants';
import { SerializationError } from './serialization-error';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function validateBinItem(item: unknown): asserts item is BinItem {
  if (!isObject(item)) throw new SerializationError('Invalid bin item');
  const kind = item.kind;
  if (kind === 'asset') {
    if (typeof item.assetId !== 'string') throw new SerializationError('Invalid bin item');
    return;
  }
  if (kind === 'sequence') {
    if (typeof item.timelineId !== 'string') throw new SerializationError('Invalid bin item');
    return;
  }
  if (kind === 'bin') {
    if (typeof item.binId !== 'string') throw new SerializationError('Invalid bin item');
    return;
  }
  throw new SerializationError('Invalid bin item');
}

function validateBin(bin: unknown): asserts bin is Bin {
  if (!isObject(bin)) throw new SerializationError('Invalid bin');
  if (typeof bin.id !== 'string') throw new SerializationError('Invalid bin');
  if (typeof bin.label !== 'string') throw new SerializationError('Invalid bin');
  if (!(typeof bin.parentId === 'string' || bin.parentId === null)) throw new SerializationError('Invalid bin');
  if (!Array.isArray(bin.items)) throw new SerializationError('Invalid bin');
  for (const item of bin.items) validateBinItem(item);
  if (bin.color !== undefined && typeof bin.color !== 'string') throw new SerializationError('Invalid bin');
}

function toPlainTimeline(state: TimelineState): unknown {
  return {
    schemaVersion: state.schemaVersion,
    timeline: state.timeline,
    assetRegistry: Object.fromEntries(state.assetRegistry),
  };
}

export function serializeProject(project: Project): string {
  // Emit stable key order for deterministic JSON output
  const plain = {
    id: project.id,
    name: project.name,
    timelines: project.timelines.map(toPlainTimeline),
    bins: project.bins,
    rootBinIds: project.rootBinIds,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    schemaVersion: project.schemaVersion,
  };
  return JSON.stringify(plain, null, 2);
}

export function deserializeProject(raw: string): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON';
    throw new SerializationError(msg);
  }

  if (!isObject(parsed)) throw new SerializationError('Invalid JSON structure');
  const obj = parsed as Record<string, unknown>;

  const schemaVersion = obj.schemaVersion;
  if (typeof schemaVersion !== 'number') throw new SerializationError('Missing schemaVersion');
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new SerializationError(`Unknown project schema version: ${schemaVersion}`);
  }

  if (!Array.isArray(obj.timelines)) throw new SerializationError('Missing timelines');

  const timelines: TimelineState[] = [];
  for (const t of obj.timelines) {
    const state = migrate(t);
    const violations = checkInvariants(state);
    if (violations.length > 0) {
      throw new SerializationError('Timeline failed invariant checks', violations);
    }
    timelines.push(state);
  }

  const binsRaw = obj.bins;
  if (binsRaw !== undefined && !Array.isArray(binsRaw)) throw new SerializationError('Invalid bins');
  const bins: Bin[] = (binsRaw ?? []) as Bin[];
  for (const b of bins) validateBin(b);

  const rootBinIdsRaw = obj.rootBinIds;
  if (rootBinIdsRaw !== undefined && !Array.isArray(rootBinIdsRaw)) {
    throw new SerializationError('Invalid rootBinIds');
  }
  const rootBinIds = (rootBinIdsRaw ?? []) as BinId[];
  for (const id of rootBinIds) {
    if (typeof id !== 'string') throw new SerializationError('Invalid rootBinIds');
  }

  // Minimal required fields; others are pass-through
  if (typeof obj.id !== 'string') throw new SerializationError('Invalid project id');
  if (typeof obj.name !== 'string') throw new SerializationError('Invalid project name');
  if (typeof obj.createdAt !== 'number') throw new SerializationError('Invalid createdAt');
  if (typeof obj.updatedAt !== 'number') throw new SerializationError('Invalid updatedAt');

  return {
    id: obj.id as Project['id'],
    name: obj.name,
    schemaVersion,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    timelines,
    bins,
    rootBinIds,
  };
}

