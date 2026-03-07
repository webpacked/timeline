/**
 * @timeline/ui — Public API
 *
 * DaVinci Resolve–style timeline editor components.
 *
 * Quick start:
 *   import { DaVinciEditor } from '@timeline/ui';
 *   import '@timeline/ui/styles/davinci';
 *
 *   <DaVinciEditor engine={engine} style={{ height: '100vh' }} />
 */

// ── DaVinci Preset (the main thing most users want) ────────────────────────
export {
  DaVinciEditor,
  DaVinciToolbar,
  DaVinciRuler,
  DaVinciTrack,
  DaVinciClip,
  DaVinciPlayhead,
} from './presets/davinci';
export type {
  DaVinciEditorProps,
  DaVinciRulerProps,
  DaVinciTrackProps,
  DaVinciClipProps,
  DaVinciPlayheadProps,
} from './presets/davinci';

// ── Context (for custom layouts) ───────────────────────────────────────────
export {
  TimelineProvider,
  useTimelineContext,
  useEngine,
} from './context/timeline-context';
export type {
  TimelineContextValue,
  TimelineProviderProps,
} from './context/timeline-context';

// ── Shared utilities ───────────────────────────────────────────────────────
export {
  frameToPx,
  pxToFrame,
  frameToTimecode,
  rulerTickInterval,
} from './shared/time';

export { useTimelineRefs } from './shared/use-refs';
export { clamp } from './shared/geometry';
export { cn } from './shared/cn';
