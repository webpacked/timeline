# Changelog

All notable changes to `@webpacked-timeline/react` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0-beta.1] - 2026-03-07

### Added
- `TimelineEngine` orchestrator class — wires core's dispatcher, `HistoryStack`, `PlaybackEngine`, `SnapIndexManager`, `TrackIndex`, `KeyboardHandler`, and all 12 built-in tools
- `TimelineProvider` context + `TimelineContext` for React tree
- 20+ hooks with `useSyncExternalStore` for granular re-renders:
  - `useEngine`, `useTimeline`, `useTrackIds`, `useTrack`, `useClip`, `useClips`
  - `useMarkers`, `useHistory`, `useCanUndo`, `useCanRedo`
  - `usePlayheadFrame`, `useIsPlaying`, `usePlaybackEngine`, `usePlayhead`, `usePlayheadEvent`
  - `useActiveToolId`, `useActiveTool`, `useCursor`
  - `useProvisional`, `useSelectedClipIds`, `useChange`
- Engine-first hook variants: `useTimelineWithEngine`, `useTrackIdsWithEngine`, `useTrackWithEngine`, `useClipWithEngine`, `useProvisionalWithEngine`
- `useVirtualWindow` and `useVisibleClips` for viewport-aware rendering
- `createToolRouter` adapter and `useToolRouter` hook for pointer/keyboard event wiring
- `EngineSnapshot` type for stable external store contract
- `DEFAULT_PLAYHEAD_STATE` constant
- 187 tests passing
