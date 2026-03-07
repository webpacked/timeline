# Changelog

All notable changes to `@webpacked-timeline/ui` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0-beta.1] - 2026-03-07

### Added
- DaVinci Resolve-style preset with 6 components:
  - `DaVinciEditor` — full-layout editor (toolbar + ruler + tracks + clips + playhead)
  - `DaVinciToolbar` — tool buttons, zoom controls, undo/redo, play/pause
  - `DaVinciRuler` — timecode ruler with major/minor tick marks
  - `DaVinciTrack` — track label row with name, type badge, lock/visibility, solo/mute (audio), clip count
  - `DaVinciClip` — clip block with waveform visualization, label, trim handles, accent strip
  - `DaVinciPlayhead` — red playhead line
- `TimelineProvider` context and `useTimelineContext` / `useEngine` for custom layouts
- Shared utilities: `frameToPx`, `pxToFrame`, `frameToTimecode`, `rulerTickInterval`, `clamp`, `cn`
- CSS variable theming system with ~50 tokens in `tokens.css`
- DaVinci dark theme override in `davinci.css`
- Style entry points: `@webpacked-timeline/ui/styles/davinci` and `@webpacked-timeline/ui/styles/tokens`
- Full keyboard shortcut support (V/C/T/R/S/Y/H for tools, Space for play, arrow keys for scrubbing, Cmd+Z for undo)
- Track resize (drag handle between tracks)
- Clip selection, multi-select (Cmd+A), and deletion (Delete/Backspace)
- Virtual windowing for clips outside viewport
- Snap indicator lines during drag operations
- Add/delete tracks from the label column
- Add clips to tracks
- Zoom slider with logarithmic scale
- Playhead auto-scroll during playback
- Hand tool for panning
- Tabler-based SVG icon set
