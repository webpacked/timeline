/**
 * MARKER SEARCH API — Phase 3 Step 2
 *
 * Pure functions. Search state.timeline.markers only.
 */

import type { TimelineState } from '../types/state';
import type { Marker } from '../types/marker';

/**
 * Returns markers whose color exactly matches the given string.
 */
export function findMarkersByColor(
  state: TimelineState,
  color: string,
): Marker[] {
  return state.timeline.markers.filter((m) => m.color === color);
}

/**
 * Returns markers whose label contains the given string (case-insensitive).
 */
export function findMarkersByLabel(
  state: TimelineState,
  label: string,
): Marker[] {
  const lower = label.toLowerCase();
  return state.timeline.markers.filter((m) =>
    m.label.toLowerCase().includes(lower),
  );
}
