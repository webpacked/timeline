/**
 * Project operations — Phase 5 Step 5
 *
 * Pure functions that transform Project immutably.
 * Projects are not managed by the Dispatcher.
 */

import type { Project, Bin, BinId, BinItem } from '../types/project';

function withUpdatedAt(project: Project, updatedAt: number = Date.now()): Project {
  return { ...project, updatedAt };
}

function itemsEqual(a: BinItem, b: BinItem): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'asset':
      return a.assetId === (b as typeof a).assetId;
    case 'sequence':
      return a.timelineId === (b as typeof a).timelineId;
    case 'bin':
      return a.binId === (b as typeof a).binId;
  }
}

export function addTimeline(project: Project, state: import('../types/state').TimelineState): Project {
  return withUpdatedAt({
    ...project,
    timelines: [...project.timelines, state],
  });
}

export function removeTimeline(project: Project, timelineId: string): Project {
  const nextTimelines = project.timelines.filter((t) => t.timeline.id !== timelineId);
  if (nextTimelines.length === project.timelines.length) return project;
  return withUpdatedAt({ ...project, timelines: nextTimelines });
}

export function addBin(project: Project, bin: Bin): Project {
  const nextBins = [...project.bins, bin];
  const nextRoot =
    bin.parentId === null ? [...project.rootBinIds, bin.id] : project.rootBinIds;
  return withUpdatedAt({ ...project, bins: nextBins, rootBinIds: nextRoot });
}

export function removeBin(project: Project, binId: BinId): Project {
  // Collect all descendant bin IDs (including the root binId)
  const toRemove = new Set<BinId>();
  const byParent = new Map<BinId | null, Bin[]>();
  for (const b of project.bins) {
    const key = b.parentId;
    const arr = byParent.get(key) ?? [];
    arr.push(b);
    byParent.set(key, arr);
  }

  const stack: BinId[] = [binId];
  while (stack.length) {
    const id = stack.pop()!;
    if (toRemove.has(id)) continue;
    toRemove.add(id);
    const children = byParent.get(id) ?? [];
    for (const child of children) stack.push(child.id);
  }

  if (toRemove.size === 1 && !project.bins.some((b) => b.id === binId)) {
    return project;
  }

  const nextBins = project.bins.filter((b) => !toRemove.has(b.id));
  const nextRoot = project.rootBinIds.filter((id) => !toRemove.has(id));
  return withUpdatedAt({ ...project, bins: nextBins, rootBinIds: nextRoot });
}

export function addItemToBin(project: Project, binId: BinId, item: BinItem): Project {
  const idx = project.bins.findIndex((b) => b.id === binId);
  if (idx < 0) throw new Error(`Bin not found: ${binId}`);

  const target = project.bins[idx]!;
  const updated: Bin = { ...target, items: [...target.items, item] };
  const nextBins = [...project.bins];
  nextBins[idx] = updated;
  return withUpdatedAt({ ...project, bins: nextBins });
}

export function removeItemFromBin(project: Project, binId: BinId, item: BinItem): Project {
  const idx = project.bins.findIndex((b) => b.id === binId);
  if (idx < 0) throw new Error(`Bin not found: ${binId}`);

  const target = project.bins[idx]!;
  const nextItems = target.items.filter((i) => !itemsEqual(i, item));
  if (nextItems.length === target.items.length) return project;

  const updated: Bin = { ...target, items: nextItems };
  const nextBins = [...project.bins];
  nextBins[idx] = updated;
  return withUpdatedAt({ ...project, bins: nextBins });
}

export function moveItemBetweenBins(
  project: Project,
  fromBinId: BinId,
  toBinId: BinId,
  item: BinItem,
): Project {
  const fromIdx = project.bins.findIndex((b) => b.id === fromBinId);
  const toIdx = project.bins.findIndex((b) => b.id === toBinId);
  if (fromIdx < 0) throw new Error(`Bin not found: ${fromBinId}`);
  if (toIdx < 0) throw new Error(`Bin not found: ${toBinId}`);

  const fromBin = project.bins[fromIdx]!;
  const toBin = project.bins[toIdx]!;

  const nextFromItems = fromBin.items.filter((i) => !itemsEqual(i, item));
  const nextToItems = [...toBin.items, item];

  const nextBins = [...project.bins];
  nextBins[fromIdx] = { ...fromBin, items: nextFromItems };
  nextBins[toIdx] = { ...toBin, items: nextToItems };

  return withUpdatedAt({ ...project, bins: nextBins });
}

