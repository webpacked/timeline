# Changelog

All notable changes to `@timeline/core` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0-beta.1] - 2026-03-07

### Added
- Core state model: `Timeline`, `Track`, `Clip`, `Asset` with branded IDs (`ClipId`, `TrackId`, `AssetId`, `TimelineFrame`, `FrameRate`)
- Factory functions: `createTimeline`, `createTrack`, `createClip`, `createAsset`, `createTimelineState`
- Frame utilities: `toFrame`, `frameRate`, `framesToTimecode`, `framesToSeconds`, `secondsToFrames`, `FrameRates`, drop-frame support
- Atomic dispatcher with rolling-state validation (`dispatch`)
- 40+ operation primitives: `MOVE_CLIP`, `RESIZE_CLIP`, `SLICE_CLIP`, `DELETE_CLIP`, `INSERT_CLIP`, `SET_MEDIA_BOUNDS`, `SET_CLIP_ENABLED`, `SET_CLIP_SPEED`, `ADD_TRACK`, `DELETE_TRACK`, `REORDER_TRACK`, `REGISTER_ASSET`, `ADD_MARKER`, `MOVE_MARKER`, `DELETE_MARKER`, `SET_IN_POINT`, `SET_OUT_POINT`, `ADD_BEAT_GRID`, `INSERT_GENERATOR`, `ADD_CAPTION`, `EDIT_CAPTION`, `DELETE_CAPTION`, `ADD_EFFECT`, `REMOVE_EFFECT`, `ADD_KEYFRAME`, `MOVE_KEYFRAME`, `DELETE_KEYFRAME`, `SET_CLIP_TRANSFORM`, `SET_AUDIO_PROPERTIES`, `ADD_TRANSITION`, `DELETE_TRANSITION`, `LINK_CLIPS`, `UNLINK_CLIPS`, and more
- Invariant checker with 9 validation rules (`checkInvariants`)
- `HistoryStack` with undo/redo and configurable limit
- `TransactionCompressor` for merging rapid sequential edits
- Tool system: `ITool` interface, `ToolRegistry`, `ProvisionalManager` for drag previews
- 12 built-in tools: `SelectionTool`, `RazorTool`, `RippleTrimTool`, `RollTrimTool`, `SlipTool`, `SlideTool`, `RippleDeleteTool`, `RippleInsertTool`, `HandTool`, `TransitionTool`, `KeyframeTool`, `ZoomTool`
- Snap system: `SnapIndexManager`, `buildSnapIndex`, `nearest`
- `PlayheadController` with play/pause/seek and J/K/L shuttle
- `PlaybackEngine` with pipeline contracts (`VideoDecoder`, `AudioDecoder`, `Compositor`)
- `KeyboardHandler` with configurable key bindings
- Versioned JSON serialization: `serializeTimeline`, `deserializeTimeline` with automatic migration
- Export: `exportToOTIO`, `importFromOTIO`, `exportToEDL`, `exportToAAF`, `exportToFCPXML`
- SRT/VTT subtitle import: `parseSRT`, `parseVTT`, `subtitleImportToOps`
- Project model: `Project`, `Bin` with `addTimeline`, `addBin`, `serializeProject`, `deserializeProject`
- `IntervalTree` for O(log n) clip lookup
- `TrackIndex` for fast track-level queries
- `ThumbnailCache` (LRU) and `ThumbnailQueue` (priority)
- Virtual windowing: `getVisibleClips`, `getVisibleFrameRange`
- `diffStates` for efficient state change detection
- Effects, keyframes, easing curves, clip transforms, audio properties
- Transitions with alignment and duration controls
- Track groups and link groups
- Clock abstraction: `browserClock`, `nodeClock`, `createTestClock`
- 852 tests passing
