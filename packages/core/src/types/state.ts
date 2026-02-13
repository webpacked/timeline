/**
 * TIMELINE STATE
 * 
 * This is the complete state shape for the timeline engine.
 * 
 * WHAT IS TIMELINE STATE?
 * - The root state object that contains everything
 * - Timeline (tracks and clips)
 * - Assets (media metadata)
 * 
 * WHY SEPARATE STATE?
 * - Clear separation between timeline structure and asset registry
 * - Assets can be shared across multiple clips
 * - State is the single source of truth
 * 
 * EXAMPLE:
 * ```typescript
 * const state: TimelineState = {
 *   timeline: {
 *     id: 'timeline_1',
 *     name: 'My Project',
 *     fps: frameRate(30),
 *     duration: frame(9000),
 *     tracks: [],
 *   },
 *   assets: new Map([
 *     ['asset_1', { id: 'asset_1', type: 'video', duration: frame(3600), sourceUrl: '...' }],
 *   ]),
 * };
 * ```
 * 
 * IMMUTABILITY:
 * All operations on TimelineState must return a NEW state object.
 * Never mutate the existing state.
 */

import { Timeline } from './timeline';
import { Asset } from './asset';
import { LinkGroup } from './linking';
import { Group } from './grouping';
import { TimelineMarker, ClipMarker, RegionMarker, WorkArea } from './marker';

/**
 * TimelineState - The complete state for the timeline engine
 * 
 * Phase 2 additions:
 * - linkGroups: Synchronized editing groups
 * - groups: Visual organization groups
 * - markers: Timeline/clip/region markers
 * - workArea: Active editing region
 */
export interface TimelineState {
  /** The timeline (tracks and clips) */
  timeline: Timeline;
  
  /** Asset registry (media metadata) */
  assets: Map<string, Asset>;
  
  // === PHASE 2: EDITING INTELLIGENCE ===
  
  /** Link groups for synchronized editing */
  linkGroups: Map<string, LinkGroup>;
  
  /** Groups for visual organization */
  groups: Map<string, Group>;
  
  /** Markers for navigation and annotation */
  markers: {
    timeline: TimelineMarker[];
    clips: ClipMarker[];
    regions: RegionMarker[];
  };
  
  /** Optional work area definition */
  workArea?: WorkArea;
}

/**
 * Create a new timeline state
 * 
 * @param params - State parameters
 * @returns A new TimelineState object
 */
export function createTimelineState(params: {
  timeline: Timeline;
  assets?: Map<string, Asset>;
  linkGroups?: Map<string, LinkGroup>;
  groups?: Map<string, Group>;
  markers?: {
    timeline: TimelineMarker[];
    clips: ClipMarker[];
    regions: RegionMarker[];
  };
  workArea?: WorkArea;
}): TimelineState {
  const state: TimelineState = {
    timeline: params.timeline,
    assets: params.assets ?? new Map(),
    linkGroups: params.linkGroups ?? new Map(),
    groups: params.groups ?? new Map(),
    markers: params.markers ?? {
      timeline: [],
      clips: [],
      regions: [],
    },
  };
  
  // Only add workArea if explicitly provided
  if (params.workArea !== undefined) {
    state.workArea = params.workArea;
  }
  
  return state;
}
