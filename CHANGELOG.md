# Changelog

All notable changes to the timeline monorepo are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

_No unreleased changes._

---

## [0.0.1] — Phase 0 Complete

### @timeline/core

#### Added
- FrameRate discriminated union
- TimelineFrame branded type
- Full OperationPrimitive union (25+ ops)
- Transaction + DispatchResult types
- InvariantChecker (9 rules)
- Per-primitive validators
- applyOperation() pure function
- dispatch() atomic with rolling-state validation
- HistoryStack (push, undo, redo, limit eviction)

---

## [0.1.0] — Phase 1 Complete

### @timeline/core

#### Added
- Tool scaffolding: ITool interface, ToolContext, ToolRegistry
- ProvisionalManager (ghost clip preview)
- TimelineEngine class (EngineSnapshot, subscribe/getSnapshot)
- 8 React hooks (useSyncExternalStore, selector isolation)
- ToolRouter (rAF throttle, onPointerLeave Option Y)

---

## [0.2.0] — Phase 2 Complete

### @timeline/core

#### Added
- SelectionTool (click, drag, multi-drag, rubber-band)
- RazorTool (slice with Shift+click all-tracks mode)
- RippleTrimTool (start/end edges, downstream shift)
- RollTrimTool (2-op transaction, precomputed clamp)
- SlipTool (media-space drag, SET_MEDIA_BOUNDS)
- RippleDeleteTool
- RippleInsertTool
- HandTool

#### Changed
- Dispatcher: rolling-state validation (validate-then-apply
  per op, not validate-all then apply-all)
- MOVE_CLIP ordering rule: +delta sorts R→L, -delta sorts L→R

---

## [0.3.0] — Phase 3 Complete — February 27, 2025

### @timeline/core

#### Added

**Marker System**
- `Marker` discriminated union: point and range variants
- Optional `clipId` field for clip-linked markers
- Clip-linked markers auto-shift on `MOVE_CLIP` (same delta)
- `MarkerId` branded type and `toMarkerId()` factory
- `MarkerScope` union: 'timeline' | 'clip'
- Primitives: `ADD_MARKER`, `MOVE_MARKER`, `DELETE_MARKER`
- Validators for all marker primitives
- Invariants: `checkMarkerBounds` (bounds + range endFrame > startFrame)

**In/Out Points**
- `inPoint` and `outPoint` optional fields on `TimelineState`
- Primitives: `SET_IN_POINT`, `SET_OUT_POINT`
- Invariant: `checkInOutPoints` (in < out, both within duration)

**Beat Grid**
- `BeatGrid` entity on `TimelineState` (bpm, timeSignature, offset)
- Primitive: `ADD_BEAT_GRID`, `REMOVE_BEAT_GRID`
- Beat grid frames injected into `buildSnapIndex()` automatically
- Invariant: `checkBeatGrid` (single beat grid, bpm > 0)

**Generator Entity**
- `GeneratorType` union: 'solid' | 'bars' | 'countdown' | 'text'
- `Generator` entity type
- `GeneratorAsset` type + `createGeneratorAsset()` factory
- `Asset` union: `FileAsset | GeneratorAsset`
- Primitive: `INSERT_GENERATOR`

**Caption System**
- `Caption` entity: text, startFrame, endFrame, language,
  style, burnIn
- `CaptionStyle` type with font, color, alignment fields
- `defaultCaptionStyle` exported constant
- `captions` array on `Track` (sorted by startFrame)
- Primitives: `ADD_CAPTION`, `EDIT_CAPTION`, `DELETE_CAPTION`
- `EDIT_CAPTION` supports partial updates (merge pattern)
- Validators: overlap detection on ADD_CAPTION
- Invariants: `checkCaptionBounds`, caption overlap check

**Marker Search API**
- `findMarkersByColor(state, color)` — exact match
- `findMarkersByLabel(state, label)` — case-insensitive substring

**SRT/VTT Import**
- `parseSRT(raw, fps, options?)` — full SRT parser
- `parseVTT(raw, fps, options?)` — full WebVTT parser
- Both strip formatting tags, handle multi-line text
- `subtitleImportToOps(captions, trackId)` — pure op builder
- `SRTParseOptions` / `VTTParseOptions` types exported

#### Changed
- `TimelineState` extended: `markers`, `beatGrid`,
  `inPoint`, `outPoint` (all optional, backward compatible)
- `Track` extended: `captions` array (default empty)
- `createTimeline()` accepts new optional fields
- `createTrack()` accepts optional `captions`
- `buildSnapIndex()` now includes beat grid snap points

#### Fixed
- `checkMarkerBounds`: point marker frame and range
  frameStart now validated against `[0, durationFrames)`
- `checkInOutPoints`: both points validated within
  timeline duration bounds

#### Tests
- Phase 3 adds 33+ tests across all new subsystems
- All new state-producing tests call `checkInvariants()`
- Subtitle import tests are pure (no state, no dispatch)

---

## [0.8.0] — Phase U Complete — February 27, 2025

### Added (@timeline/ui)

**CLI**
- `npx @timeline/ui add <component>` — copies
  components into your project
- `npx @timeline/ui add --preset=<name>` —
  install curated bundles
- `npx @timeline/ui list` — show all components
  with install status
- `npx @timeline/ui diff <component>` —
  show changes vs registry
- `npx @timeline/ui update <component>` —
  update with diff preview + confirmation
- Theme install: `add theme --theme=dark-pro`
- Manifest tracking: `.timeline-ui.json`
- Registry dependency resolution (topological)

**Theme system**
- `dark-pro` theme (DaVinci-inspired default)
- `light` theme (Final Cut Pro-inspired)
- 45+ CSS custom property tokens
- Token naming: `--tl-{component}-{property}-{state}`

**Shared utilities** (copied into _shared/)
- `time.ts` — frameToPx, pxToFrame,
  frameToTimecode, rulerTickInterval
- `geometry.ts` — Rect, clamp, normalizeRect,
  rectsOverlap
- `use-drag.ts` — useDrag() hook with threshold
- `use-snap.ts` — useSnap() hook via engine

**Components**

Tier 1 — Core:
  timeline-root, track, clip, playhead, ruler

Tier 2 — Editing:
  toolbar, zoom-bar

Tier 3 — Media:
  waveform (canvas), thumbnail-strip, clip-label

Tier 4 — Advanced:
  effect-lane, keyframe-diamond,
  transition-handle

Tier 5 — Markers:
  marker-pin, marker-range, in-out-handles

**Rendering contract**
- All components read engine via TimelineProvider
- Zero hardcoded colors (CSS vars only)
- Render prop escape hatches on all content
  components
- No local useState for canonical engine values
- All mutations via engine.dispatch() only

### Tests
- 113 UI tests (CLI + components)
- 1152+ total tests across monorepo
- Registry integrity: all registered files
  verified to exist

---

## [0.7.0] — Phase R Complete — February 27, 2025

### Added (@timeline/react)

**TimelineEngine**
- Full orchestrator wiring Dispatcher,
  PlaybackEngine, ToolRouter, SnapIndexManager,
  TrackIndex, HistoryStack, KeyboardHandler
- `TimelineEngineOptions`: pipeline, clock,
  historyLimit, compression, tools, callbacks
- `EngineSnapshot`: state, provisional, playhead,
  history, trackIds, cursor, change
- `DEFAULT_PLAYHEAD_STATE` for edit-only mode
- Playback events wired to snapshot rebuild
  (usePlayheadFrame updates every rAF tick)
- `handlePointerLeave` with Option Y pattern
- `undo()` / `redo()` with full state sync

**Hooks (13 total)**
- `useTimeline(engine)` — timeline metadata
- `useTrackIds(engine)` — stable track list
- `useTrack(engine, id)` — single track
- `useClip(engine, id)` — single clip,
  provisional-first lookup
- `useClips(engine, trackId)` — track clips
- `useMarkers(engine)` — timeline markers
- `useHistory(engine)` — canUndo/canRedo,
  stable object reference
- `useActiveToolId(engine)` — active tool
- `useCursor(engine)` — CSS cursor string
- `useProvisional(engine)` — ghost clip state
- `usePlayheadFrame(engine)` — current frame,
  updates every rAF tick during playback
- `useIsPlaying(engine)` — playback state
- `useChange(engine)` — StateChange diff
- `usePlayhead(engine)` — full playhead state
- `usePlayheadEvent(engine, type, handler)`
- `useVirtualWindow(engine, w, s, ppf)`
- `useVisibleClips(engine, window)`
- `useToolRouter(engine, options)`

**ToolRouter**
- `createToolRouter()` — React pointer/key
  event → TimelinePointerEvent/KeyEvent
- rAF throttle on onPointerMove only
- Option Y: pointerLeave → handlePointerUp
  + handlePointerLeave + clearProvisional
- `useToolRouter()` hook with stable ref

**Selector isolation**
- Proven: updating clip A does not re-render
  component watching clip B (toBe test)
- `historyFlags` cache prevents spurious
  re-renders on unchanged undo/redo state
- `stableTrackIds` only recreates on actual
  track list change

### Tests
- Phase R adds 97 react tests
- 1039 total tests across core + react
- Integration suite: 27 tests covering
  full dispatch→hook→re-render round-trips

---

## [0.6.0] — Phase 7 Complete — February 27, 2025

### Added

**Clip Interval Tree**
- `IntervalTree<T>` — centered interval tree,
  O(log n + k) point queries
- `TrackIndex` — per-state clip index,
  build() + query() + invalidate()
- `ClipEntry` type
- `getClipsAtFrame()` and `resolveFrame()` accept
  optional `TrackIndex` for fast lookup
- `PlaybackEngine` uses `TrackIndex` automatically

**Virtual Rendering**
- `VirtualWindow` type (startFrame, endFrame,
  pixelsPerFrame)
- `VirtualClipEntry` type (clip, isVisible, left, width)
- `getVisibleClips()` — all clips with visibility flag
- `getVisibleFrameRange()` — viewport → frame range

**SnapIndex Microtask Debounce**
- `SnapIndexManager` — debounces snap index rebuilds
  via queueMicrotask; N synchronous calls → 1 rebuild
- `rebuildSync()` for tests and initial build
- `PlaybackEngine` uses `SnapIndexManager`

**State Diff**
- `StateChange` type — trackIds, clipIds, markers,
  timeline, playhead flags
- `diffStates(prev, next)` — reference equality diff
- `EMPTY_STATE_CHANGE` constant

**Transaction Compression**
- `CompressionPolicy` union: none | last-write-wins
- `CompressibleOpType` — 10 rapid-fire op types
- `DEFAULT_COMPRESSION_POLICY` (300ms window)
- `NO_COMPRESSION` constant
- `TransactionCompressor` — clock-injectable
- `HistoryStack.pushWithCompression()` — replaces
  last entry within compression window
- `HistoryStack.resetCompression()`

**Named Checkpoints**
- `HistoryStack.saveCheckpoint(name)`
- `HistoryStack.restoreCheckpoint(name)`
- `HistoryStack.listCheckpoints()`
- `HistoryStack.clearCheckpoint(name)`

**History Persistence**
- `HistoryStack.serialize()` — JSON with versioning
- `HistoryStack.deserialize()` — static, rebuilds
  from JSON, runs migrate() + checkInvariants()
- `HistoryStack.softLimitWarning()` — true at 80%

**Worker Contracts**
- `WaveformRequest`, `WaveformPeak`, `WaveformResult`
- `WaveformWorkerMessage`, `WaveformWorkerResponse`
- `ThumbnailPriority`, `ThumbnailQueueEntry`
- `ThumbnailWorkerMessage`, `ThumbnailWorkerResponse`
- `ThumbnailCache` — LRU cache, configurable size
- `ThumbnailQueue` — priority queue, FIFO tiebreak

**Tools**
- `SlideTool` (shortcut Y) — slide clip on timeline,
  neighbors trim to compensate, no gap created
- `ZoomTool` (shortcut Z) — drag or +/-/0 keys,
  exponential feel, zero dispatch
- `createZoomTool(options)` factory
- `ZoomToolOptions` type

### Performance (verified by benchmarks)
- 40 tracks / 200 clips: buildLargeState < 500ms
- checkInvariants() on 200 clips < 50ms
- getClipsAtFrame() with TrackIndex ×1000 < 100ms
- serializeTimeline() on large state < 100ms
- deserializeTimeline() on large state < 200ms

### Tests
- Phase 7 adds 116 tests across core
- 10 benchmark tests (performance gate)
- 15 invariant audit tests (correctness gate)
- 1 API surface test (38 export checks)
- 942 total tests, 0 tsc errors

---

## [0.5.0] — Phase 6 Complete — February 27, 2025

### Added

**PlayheadController**
- `PlayheadController` class — rAF loop, clock injection
- `Clock` abstraction: `browserClock`, `nodeClock`,
  `createTestClock()`
- `PlayheadState`: currentFrame, isPlaying, playbackRate,
  quality, durationFrames, fps, loopRegion,
  prerollFrames, postrollFrames
- `PlayheadEventType` union: play | pause | seek | loop |
  frame-dropped | ended | loop-point | state
- `PlaybackQuality` union: full | half | quarter | proxy
- Frame drop detection (wholeFrames > 2 → cap + emit)
- `destroy()` for cleanup

**Pipeline Contracts**
- `VideoDecoder`, `AudioDecoder` — host-implemented
- `VideoFrameRequest`, `AudioChunkRequest`
- `VideoFrameResult`, `AudioChunkResult`
- `Compositor`, `CompositeRequest`, `CompositeResult`
- `CompositeLayer`, `ResolvedCompositeRequest`
- `ThumbnailProvider`, `ThumbnailRequest`,
  `ThumbnailResult`
- `PipelineConfig` — registry for host implementations

**Frame Resolver**
- `resolveFrame()` — builds CompositeRequest from state
- `getClipsAtFrame()` — clips visible at a frame
- `mediaFrameForClip()` — timeline→media frame conversion
- `findNextClipBoundary()` / `findPrevClipBoundary()`
- `findNextMarker()` / `findPrevMarker()`
- `findClipById()`

**PlaybackEngine**
- Orchestrates PlayheadController + pipeline
- `play()`, `pause()`, `seekTo()`, `setPlaybackRate()`,
  `setQuality()`, `setLoopRegion()`, `setPreroll()`,
  `setPostroll()`
- `seekToStart()`, `seekToEnd()`
- `seekToNextClipBoundary()`, `seekToPrevClipBoundary()`
- `seekToNextMarker()`, `seekToPrevMarker()`
- `renderFrame()` — decode + composite pipeline
- `updateState()` — sync with edit engine
- `getCurrentTimelineState()`

**Keyboard Contract**
- `KeyboardHandler` — DOM-free, accepts
  `TimelineKeyEvent`
- `DEFAULT_KEY_BINDINGS` — Space, J/K/L, arrows,
  Home/End, I/O, Q
- J/K/L jog-shuttle with speed levels (1x/2x/4x,
  reverse)
- `KeyboardHandlerOptions`: custom bindings,
  onMarkIn, onMarkOut, getTimelineState
- `toggle-loop` action wired to in/out points

**Loop Region**
- `LoopRegion` type: startFrame, endFrame (exclusive)
- `setLoopRegion()`, `setPreroll()`, `setPostroll()`
- Loop wraps at endFrame + postrollFrames
- play() seeks to startFrame - prerollFrames on entry
- 'loop-point' event on wrap

**React Hooks (@timeline/react)**
- `usePlayhead(engine)` — useSyncExternalStore,
  stable action callbacks
- `usePlayheadEvent(engine, type, handler)` —
  event subscription without re-renders
- `UsePlayheadResult` type exported

### Tests
- Phase 6 adds 121 tests across core + react
- All clock-dependent tests use createTestClock()
- Zero DOM dependencies in any core file

---

## [0.4.0] — Phase 4 Complete — February 27, 2025

### @timeline/core

#### Added

**Effect System**
- `Effect` entity: effectType, enabled, renderStage,
  params, keyframes
- `EffectId` branded type and `toEffectId()` factory
- `RenderStage` union: preComposite | postComposite | output
- `EffectParam` type (key, value)
- `createEffect()` factory (defaults: enabled true,
  renderStage preComposite)
- Primitives: `ADD_EFFECT`, `REMOVE_EFFECT`,
  `REORDER_EFFECT`, `SET_EFFECT_ENABLED`, `SET_EFFECT_PARAM`
- Invariant: `checkEffects` (renderStage validity,
  keyframe order, no duplicate keyframe frames)

**Keyframe System**
- `Keyframe` entity: frame, value, easing
- `KeyframeId` branded type and `toKeyframeId()` factory
- `EasingCurve` discriminated union:
  Linear | Hold | EaseIn | EaseOut | EaseBoth | BezierCurve
- `LINEAR_EASING` and `HOLD_EASING` constants
- `AnimatableProperty` type (value + keyframes[])
- `createAnimatableProperty()` factory
- Primitives: `ADD_KEYFRAME`, `MOVE_KEYFRAME`,
  `DELETE_KEYFRAME`, `SET_KEYFRAME_EASING`
- Keyframes auto-sorted by frame on ADD and MOVE

**Clip Transform**
- `ClipTransform` type: positionX/Y, scaleX/Y, rotation,
  opacity, anchorX/Y (all AnimatableProperty)
- `DEFAULT_CLIP_TRANSFORM` constant
- Primitive: `SET_CLIP_TRANSFORM` (Partial merge)

**Audio Properties**
- `AudioProperties` type: gain, pan (AnimatableProperty),
  mute, channelRouting, normalizationGain
- `ChannelRouting` union: stereo | mono | left | right
- `DEFAULT_AUDIO_PROPERTIES` constant
- Primitive: `SET_AUDIO_PROPERTIES` (Partial merge)
- Validator: pan.value in [-1,1],
  normalizationGain >= 0

**Transition System**
- `Transition` entity: type, durationFrames, alignment,
  easing, params
- `TransitionId` branded type and `toTransitionId()`
- `TransitionAlignment` union:
  centerOnCut | endAtCut | startAtCut
- `createTransition()` factory
- Primitives: `ADD_TRANSITION`, `DELETE_TRANSITION`,
  `SET_TRANSITION_DURATION`, `SET_TRANSITION_ALIGNMENT`
- Invariant: `checkTransitions` (duration > 0,
  valid alignment)

**Track Groups**
- `TrackGroup` entity: label, trackIds, collapsed
- `TrackGroupId` branded type and `toTrackGroupId()`
- `createTrackGroup()` factory
- Primitives: `ADD_TRACK_GROUP`, `DELETE_TRACK_GROUP`
- ADD clears groupId on tracks when group deleted
- Invariant: `checkTrackGroups` (no orphaned groupId refs)

**Link Groups**
- `LinkGroup` entity: clipIds (min 2)
- `LinkGroupId` branded type and `toLinkGroupId()`
- `createLinkGroup()` factory
- Primitives: `LINK_CLIPS`, `UNLINK_CLIPS`
- Invariant: `checkLinkGroups` (min 2 clips,
  all exist, no clip in two groups)

**Track Properties**
- `blendMode` and `opacity` optional fields on Track
- Primitives: `SET_TRACK_BLEND_MODE`, `SET_TRACK_OPACITY`
- Validator: opacity in [0,1]

**Tools**
- `TransitionTool` (shortcut T): drag clip right edge
  to create/resize transition, click transition zone
  to delete
- `KeyframeTool` / Pen tool (shortcut P): click effect
  lane to add keyframe, drag to move, Delete to remove

#### Changed
- `Clip` extended: optional effects, transform, audio,
  transition fields (all backward compatible)
- `Track` extended: optional blendMode, opacity, groupId
- `Timeline` extended: optional trackGroups, linkGroups

#### Tests
- Phase 4 adds 68 tests across effects, keyframes,
  transforms, audio, transitions, groups, and tools
- All state-producing tests call checkInvariants()

---
