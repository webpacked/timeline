/**
 * LINK GROUP — Phase 4
 *
 * Locks A/V clips in sync; when one moves, all move together.
 */

import type { ClipId } from './clip';

export type LinkGroupId = string & { readonly __brand: 'LinkGroupId' };
export function toLinkGroupId(s: string): LinkGroupId {
  return s as LinkGroupId;
}

export type LinkGroup = {
  readonly id: LinkGroupId;
  /** Min 2 clips. */
  readonly clipIds: readonly ClipId[];
};

export function createLinkGroup(
  id: LinkGroupId,
  clipIds: readonly ClipId[],
): LinkGroup {
  return { id, clipIds };
}
