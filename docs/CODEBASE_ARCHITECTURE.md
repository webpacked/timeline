# Timeline Editor — Complete Codebase Architecture

> A professional, frame-accurate video/audio timeline editing system built as a TypeScript monorepo.

---

## Table of Contents

1. [Overview](#overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Package Dependency Graph](#package-dependency-graph)
4. [Core Package (`@timeline/core`)](#core-package)
5. [React Adapter (`@timeline/react`)](#react-adapter)
6. [UI Package (`@timeline/ui`)](#ui-package)
7. [Demo Application (`@timeline/demo-app`)](#demo-application)
8. [Data Flow: Top to Bottom](#data-flow-top-to-bottom)
9. [Type System](#type-system)
10. [Tool System](#tool-system)
11. [History & Undo/Redo](#history--undoredo)
12. [Snap System](#snap-system)
13. [Playback System](#playback-system)
14. [Serialization & Import/Export](#serialization--importexport)
15. [Invariant System](#invariant-system)
16. [Feature Matrix](#feature-matrix)

---

## Overview

This is a **framework-agnostic, deterministic, frame-based timeline editing kernel** with a React integration layer and UI component library. It follows a strict three-layer architecture:

| Layer | Package | Responsibility |
|-------|---------|---------------|
| **Data Layer** | `@timeline/core` | Pure state, dispatch, tools, history, validation, serialization |
| **Adapter Layer** | `@timeline/react` | React integration: engine orchestrator, hooks, tool routing, context |
| **Presentation Layer** | `@timeline/ui` | Visual components: tracks, clips, ruler, toolbar, playhead |
| **Application Layer** | `@timeline/demo-app` | Demo app composing all layers into a working timeline editor |

### Key Architectural Principles

| Principle | Rule |
|-----------|------|
| **Three-layer law** | Core imports only stdlib + TypeScript. No React/DOM/UI. |
| **Single mutation entry** | Only `dispatch(state, transaction)` produces a new `TimelineState`. |
| **Strict immutability** | All state updates return new objects; no in-place mutation. |
| **Time type law** | All frame positions are `TimelineFrame` (branded integer); never raw `number`. |
| **Selector isolation** | Each React hook only re-renders when its specific slice of state changes. |

---

## Monorepo Structure

```
timeline/
├── packages/
│   ├── core/          → @timeline/core      (pure TypeScript engine)
│   ├── react/         → @timeline/react     (React adapter layer)
│   ├── ui/            → @timeline/ui        (UI components)
│   └── demo/          → @timeline/demo-app  (working demo application)
├── apps/
│   └── demo/          → Integration test demo (deprecated)
├── turbo.json         → Turborepo build config
├── pnpm-workspace.yaml
└── package.json
```

---

## Package Dependency Graph

```
┌─────────────────────────────────────────────┐
│                 Application                  │
│              @timeline/demo-app              │
│    (composes all layers into working app)    │
└────────────┬───────────────┬────────────────┘
             │               │
             ▼               ▼
┌────────────────┐  ┌────────────────────────┐
│  @timeline/ui  │  │   (custom components)  │
│  (components)  │  │   built per-app        │
└───────┬────────┘  └──────────┬─────────────┘
        │                      │
        ▼                      ▼
┌─────────────────────────────────────────────┐
│             @timeline/react                  │
│  TimelineEngine · Hooks · ToolRouter ·       │
│  TimelineProvider · useSyncExternalStore      │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│             @timeline/core                   │
│  dispatch · TimelineState · Tools · History  │
│  Snap · Playback · Serialization · Invariants│
└─────────────────────────────────────────────┘
```

---

## Core Package

### Directory Map

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `engine/` | Mutation pipeline, history, playback, serialization, import/export | `dispatcher.ts`, `apply.ts`, `history.ts`, `playback-engine.ts` |
| `operations/` | High-level operation builders | `clip-operations.ts`, `track-operations.ts`, `ripple.ts` |
| `systems/` | Query helpers, asset registry, validation | `queries.ts`, `asset-registry.ts`, `validation.ts` |
| `tools/` | Framework-agnostic editing tools (12 built-in) | `selection.ts`, `razor.ts`, `slip.ts`, `ripple-trim.ts`, etc. |
| `types/` | All TypeScript types and factories (28 files) | `state.ts`, `clip.ts`, `track.ts`, `operations.ts`, `frame.ts` |
| `utils/` | Frame math, ID generation | `frame.ts`, `id.ts` |
| `validation/` | Pre-dispatch and post-dispatch checks | `invariants.ts`, `validators.ts` |

### The Dispatch Pipeline

This is the **only** way state changes:

```
Transaction { id, label, timestamp, operations[] }
                    │
                    ▼
         dispatch(state, transaction)
                    │
    ┌───────────────┼───────────────┐
    │   For each operation:         │
    │   1. validateOperation(s, op) │
    │   2. s = applyOperation(s, op)│
    └───────────────┼───────────────┘
                    │
         checkInvariants(proposedState)
                    │
            ┌───────┴───────┐
            │               │
       violations?     no violations
            │               │
     { accepted: false } { accepted: true, nextState }
```

Rules:
- **All-or-nothing**: If any operation fails validation, zero operations are applied
- **Rolling state**: Each op validates against state after previous ops (needed for DELETE → INSERT×2)
- **Version bump**: `timeline.version` increments by 1 on each successful commit

### Operation Primitives (58+ types)

| Category | Operations |
|----------|-----------|
| **Clip** | `MOVE_CLIP`, `RESIZE_CLIP`, `SLICE_CLIP`, `DELETE_CLIP`, `INSERT_CLIP`, `SET_MEDIA_BOUNDS`, `SET_CLIP_ENABLED`, `SET_CLIP_REVERSED`, `SET_CLIP_SPEED`, `SET_CLIP_COLOR`, `SET_CLIP_NAME`, `SET_CLIP_TRANSFORM`, `SET_AUDIO_PROPERTIES` |
| **Track** | `ADD_TRACK`, `DELETE_TRACK`, `REORDER_TRACK`, `SET_TRACK_HEIGHT`, `SET_TRACK_NAME`, `SET_TRACK_BLEND_MODE`, `SET_TRACK_OPACITY` |
| **Transition** | `ADD_TRANSITION`, `DELETE_TRANSITION`, `SET_TRANSITION_DURATION`, `SET_TRANSITION_ALIGNMENT` |
| **Effect** | `ADD_EFFECT`, `REMOVE_EFFECT`, `REORDER_EFFECT`, `SET_EFFECT_ENABLED`, `SET_EFFECT_PARAM` |
| **Keyframe** | `ADD_KEYFRAME`, `MOVE_KEYFRAME`, `DELETE_KEYFRAME`, `SET_KEYFRAME_EASING` |
| **Asset** | `REGISTER_ASSET`, `UNREGISTER_ASSET`, `SET_ASSET_STATUS` |
| **Timeline** | `RENAME_TIMELINE`, `SET_TIMELINE_DURATION`, `SET_TIMELINE_START_TC`, `SET_SEQUENCE_SETTINGS` |
| **Marker** | `ADD_MARKER`, `MOVE_MARKER`, `DELETE_MARKER` |
| **In/Out** | `SET_IN_POINT`, `SET_OUT_POINT` |
| **Generator** | `INSERT_GENERATOR`, `ADD_CAPTION`, `EDIT_CAPTION`, `DELETE_CAPTION` |
| **Grouping** | `LINK_CLIPS`, `UNLINK_CLIPS`, `ADD_TRACK_GROUP`, `DELETE_TRACK_GROUP` |
| **Beat Grid** | `ADD_BEAT_GRID`, `REMOVE_BEAT_GRID` |

---

## React Adapter

### Architecture

The React adapter wraps core into a `useSyncExternalStore`-compatible pattern:

```
┌──────────────────────────────────────────────┐
│              TimelineEngine                    │
│                                                │
│  ┌─────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ History  │ │ToolReg.  │ │ ProvisionalMgr│  │
│  │ Stack    │ │(12 tools)│ │ (ghost state) │  │
│  └────┬─────┘ └────┬─────┘ └──────┬────────┘  │
│       │            │               │            │
│  ┌────┴────┐ ┌─────┴─────┐ ┌──────┴──────┐   │
│  │Snap Idx │ │ Track Idx │ │  Playback   │   │
│  │Manager  │ │           │ │  Engine     │   │
│  └─────────┘ └───────────┘ └─────────────┘   │
│                                                │
│  subscribe() / getSnapshot() → EngineSnapshot  │
└──────────────────────────────────────────────┘
```

### EngineSnapshot Shape

```typescript
{
  state: TimelineState,        // Current immutable state
  provisional: ProvisionalState | null,  // Ghost clips during drag
  activeToolId: string,        // Current tool ID
  canUndo: boolean,
  canRedo: boolean,
  history: { canUndo, canRedo },
  trackIds: readonly string[], // Stable reference if unchanged
  cursor: string,              // CSS cursor for active tool
  playhead: PlayheadState,     // Frame position, playing, rate
  change: StateChange,         // Diff from previous state
}
```

### Hooks (Selector-Isolated)

| Hook | Returns | Re-renders when |
|------|---------|-----------------|
| `useEngine()` | `TimelineEngine` | Never (stable ref) |
| `useTimeline()` | `Timeline` | Timeline object changes |
| `useTrackIds()` | `readonly string[]` | Tracks added/removed |
| `useTrack(id)` | `Track \| null` | That specific track changes |
| `useClip(id)` | `Clip \| null` | That specific clip changes (provisional-aware) |
| `useClips(engine, trackId)` | `readonly Clip[]` | Clips on that track change |
| `useActiveTool()` | `{ id, cursor }` | Tool switch or cursor changes |
| `useCanUndo()` / `useCanRedo()` | `boolean` | Undo/redo availability changes |
| `useProvisional()` | `ProvisionalState \| null` | During drag |
| `usePlayheadFrame(engine)` | `TimelineFrame` | Playhead position changes |
| `useIsPlaying(engine)` | `boolean` | Play state toggles |
| `useMarkers(engine)` | `readonly Marker[]` | Markers change |
| `useHistory(engine)` | `{ canUndo, canRedo }` | History state changes |
| `useToolRouter(engine, opts)` | `ToolRouterHandlers` | Stable (memoized) |
| `useVirtualWindow(engine, ...)` | `VirtualWindow` | Viewport changes |
| `useVisibleClips(engine, window)` | `VirtualClipEntry[]` | Visible clips change |

### Tool Router Event Flow

```
DOM Event (pointer/keyboard)
        │
        ▼
useToolRouter handlers (React synthetic events)
        │
        ▼
Coordinate conversion: clientX/Y → frame + trackId + clipId
        │
        ▼
engine.handlePointerDown/Move/Up(converted, modifiers)
        │
        ▼
Active tool's onPointerDown/Move/Up(event, toolContext)
        │
        ├── onPointerMove → ProvisionalState (ghost; never dispatches)
        │
        └── onPointerUp → Transaction | null
                              │
                              ▼
                         dispatch(state, transaction)
                              │
                              ▼
                    queueMicrotask → rebuildSnapIndex
```

---

## UI Package

### Component Hierarchy

```
TimelineRoot (engine, provides context, wires ToolRouter)
├── Toolbar (8 tools: Select, Razor, Trim, Roll, Slip, Slide, Hand, Zoom)
├── Ruler (timecode ticks, click-to-seek)
│   ├── MarkerPin* (point markers on ruler)
│   └── InOutHandles (in/out point drag handles)
├── Track* (per track — label area + clip container)
│   ├── Clip* (absolutely positioned, provisional-aware)
│   │   ├── ThumbnailStrip (video thumbnails)
│   │   ├── ClipLabel (name + duration)
│   │   ├── EffectLane (colored effect bands)
│   │   │   └── KeyframeDiamond* (draggable keyframe markers)
│   │   └── TransitionHandle (dissolve/wipe resize)
│   └── MarkerRange* (range marker overlays)
├── Playhead (frame line + scrub handle)
└── ZoomBar (+/- zoom controls)
```

### Hit-Testing via Data Attributes

| Attribute | Component | Purpose |
|-----------|-----------|---------|
| `data-clip-id={id}` | Clip | Tool router identifies clicked clip |
| `data-track-id={id}` | Track/Clip | Tool router identifies target track |

### Theming

90+ CSS custom properties (`--tl-*` tokens) for full visual customization:
- **Dark Pro** (default): `registry/themes/dark-pro.css`
- **Light**: `registry/themes/light.css`
- Custom: Override any `--tl-*` variable in `:root`

---

## Demo Application

### How It Works

```
app.tsx
├── engine.ts        → new TimelineEngine({ initialState: buildMockState() })
├── mock-data.ts     → 4 tracks, 9 clips, 9 assets @ 30fps
└── components/
    ├── TimelineRoot → Wires useToolRouter to DOM container
    ├── Toolbar      → 8 tool buttons calling engine.activateTool()
    ├── Ruler        → Timecode ticks, click-to-seek
    ├── Track        → Track rows with label + clip area
    ├── Clip         → Positioned blocks, provisional state overlay
    ├── ClipLabel    → Name + duration display
    ├── Playhead     → Red line + draggable handle
    └── ZoomBar      → Logarithmic zoom slider
```

---

## Data Flow: Top to Bottom

### Complete Mutation Flow

```
1. User clicks/drags in UI
         │
2. DOM event captured by TimelineRoot (onPointerDown/Move/Up)
         │
3. useToolRouter converts to TimelinePointerEvent
   (frame, trackId, clipId via data-* attributes)
         │
4. engine.handlePointerDown/Move/Up(event, modifiers)
         │
5. Active tool processes event:
   ├── onPointerMove → returns ProvisionalState (ghost)
   │                   → engine stores it, hooks react
   │
   └── onPointerUp → returns Transaction (or null)
                       │
6. engine.dispatch(transaction)
         │
7. For each op in transaction:
   a. validateOperation(rollingState, op)
   b. applyOperation(rollingState, op)
         │
8. checkInvariants(proposedState)
         │
9. If accepted:
   a. History push (with compression)
   b. TrackIndex rebuild
   c. SnapIndex schedule rebuild
   d. PlaybackEngine update
   e. Rebuild EngineSnapshot
   f. Notify all subscribers
         │
10. useSyncExternalStore detects change
    → selector picks relevant slice
    → React re-renders only affected components
```

### Read Path

```
Component
    │
    ▼
useClip(clipId) / useTrack(trackId) / useTimeline() / etc.
    │
    ▼
useSyncExternalStore(engine.subscribe, () => selector(engine.getSnapshot()))
    │
    ▼
Selector extracts slice from EngineSnapshot
    │
    ▼
React compares with previous value (reference equality)
    │
    ├── Same reference → no re-render
    └── Different reference → re-render component
```

---

## Type System

### Core State Shape

```typescript
TimelineState {
  timeline: Timeline {
    id: string
    name: string
    fps: FrameRate
    duration: TimelineFrame
    tracks: Track[] {
      id: TrackId
      name: string
      type: 'video' | 'audio' | 'subtitle' | 'title'
      clips: Clip[] {
        id: ClipId
        assetId: AssetId
        trackId: TrackId
        timelineStart: TimelineFrame
        timelineEnd: TimelineFrame
        mediaIn: TimelineFrame
        mediaOut: TimelineFrame
        name?: string
        speed?: number
        effects?: Effect[]
        transitions?: Transition[]
        transform?: ClipTransform
        audioProperties?: AudioProperties
      }
      height?: number
      muted?: boolean
      locked?: boolean
      solo?: boolean
    }
    markers: Marker[]
    inPoint?: TimelineFrame
    outPoint?: TimelineFrame
    beatGrid?: BeatGrid
    version: number
  }
  assetRegistry: Map<AssetId, Asset>
  schemaVersion: number
}
```

### Branded ID Types

All IDs are branded strings for type safety:
`ClipId`, `TrackId`, `AssetId`, `EffectId`, `KeyframeId`, `TransitionId`, `ToolId`, `TrackGroupId`, `LinkGroupId`, `ProjectId`, `BinId`, `MarkerId`, `CaptionId`

---

## Tool System

### Built-in Tools (12)

| Tool | ID | What It Does | Operations Generated |
|------|----|-------------|---------------------|
| **Selection** | `selection` | Click-select, drag-move, rubber-band | `MOVE_CLIP` |
| **Razor** | `razor` | Slice clip at frame | `DELETE_CLIP` + `INSERT_CLIP`×2 |
| **Ripple Trim** | `ripple-trim` | Trim edge + shift subsequent clips | `RESIZE_CLIP` + `MOVE_CLIP`×N |
| **Roll Trim** | `roll-trim` | Adjust adjacent edges together | `RESIZE_CLIP`×2 |
| **Slip** | `slip` | Move media within clip bounds | `SET_MEDIA_BOUNDS` |
| **Slide** | `slide` | Slide clip, adjust neighbors | `MOVE_CLIP` + `RESIZE_CLIP`×2 |
| **Ripple Delete** | `ripple-delete` | Delete + shift subsequent | `DELETE_CLIP` + `MOVE_CLIP`×N |
| **Ripple Insert** | `ripple-insert` | Insert + push subsequent | `MOVE_CLIP`×N + `INSERT_CLIP` |
| **Hand** | `hand` | Pan/scroll | (no transaction) |
| **Transition** | `transition` | Add/manage transitions | `ADD_TRANSITION` |
| **Keyframe** | `keyframe` | Add/move/delete keyframes | `ADD_KEYFRAME`, `MOVE_KEYFRAME`, `DELETE_KEYFRAME` |
| **Zoom** | `zoom` | Zoom in/out | (calls onZoomChange callback) |

### Tool Interface

```typescript
interface ITool {
  id: ToolId;
  onPointerDown(event: TimelinePointerEvent, ctx: ToolContext): void;
  onPointerMove(event: TimelinePointerEvent, ctx: ToolContext): ProvisionalState | null;
  onPointerUp(event: TimelinePointerEvent, ctx: ToolContext): Transaction | null;
  onKeyDown(event: TimelineKeyEvent, ctx: ToolContext): Transaction | null;
  onKeyUp(event: TimelineKeyEvent, ctx: ToolContext): void;
  onCancel(): void;
  getCursor(ctx: ToolContext): string;
}
```

---

## History & Undo/Redo

### Dual API

1. **Pure functions**: `createHistory`, `pushHistory`, `undo`, `redo`, `canUndo`, `canRedo`
2. **HistoryStack class**: Adds compression policies, checkpoints, persistence

### Compression

The `TransactionCompressor` merges consecutive similar operations (e.g., rapid MOVE_CLIPs during drag become one history entry).

```typescript
CompressionPolicy {
  maxAge: number;           // Max age in ms for merge eligibility
  mergeable: string[];      // Operation types that can be merged
  maxConsecutiveMerges: number;
}
```

---

## Snap System

### How It Works

```
buildSnapIndex(state, playheadFrame)
    → Sorted array of snap points from clip boundaries, playhead, beat grid

nearest(index, frame, radius, exclude?, allowedTypes?)
    → Best snap point within radius (tiebreak: priority → sort order)

toggleSnap(index, enabled)
    → Pure toggle
```

### Priority Table

| Source | Priority |
|--------|----------|
| Marker | 100 |
| In/Out Point | 90 |
| Clip Start/End | 80 |
| Playhead | 70 |
| Beat Grid | 50 |

---

## Playback System

```
PlaybackEngine
├── PlayheadController (position, play/pause, seek, jog/shuttle)
├── Clock (browserClock / nodeClock / testClock)
├── Pipeline (VideoDecoder, AudioDecoder, Compositor)
└── State → { currentFrame, isPlaying, rate, loopRegion }
```

### Keyboard Shortcuts (via KeyboardHandler)

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| J | Shuttle reverse |
| K | Stop |
| L | Shuttle forward |
| ← / → | Step frame |
| Home / End | Go to start/end |

---

## Serialization & Import/Export

| Format | Import | Export |
|--------|--------|--------|
| JSON (native) | `deserializeTimeline` | `serializeTimeline` |
| OTIO | `importFromOTIO` | `exportToOTIO` |
| EDL | — | `exportToEDL` |
| AAF | — | `exportToAAF` |
| FCP XML | — | `exportToFCPXML` |
| SRT subtitles | `parseSRT` | — |
| VTT subtitles | `parseVTT` | — |

---

## Invariant System

Post-mutation checks that **reject** invalid state:

| # | Check | Violation Type |
|---|-------|---------------|
| 1 | Schema version matches | `SCHEMA_VERSION_MISMATCH` |
| 2 | Clips sorted by `timelineStart` | `TRACK_NOT_SORTED` |
| 3 | No overlapping clips on same track | `OVERLAP` |
| 4 | Every clip's `assetId` exists | `ASSET_MISSING` |
| 5 | Asset `mediaType` matches track `type` | `TRACK_TYPE_MISMATCH` |
| 6 | `mediaIn >= 0`, `mediaOut <= intrinsicDuration` | `MEDIA_BOUNDS_INVALID` |
| 7 | Duration matches `(mediaOut - mediaIn) / speed` | `DURATION_MISMATCH` |
| 8 | `timelineEnd <= timeline.duration` | `CLIP_BEYOND_TIMELINE` |
| 9 | `speed > 0` | `SPEED_INVALID` |

---

## Feature Matrix

### Core → React → UI Coverage

| Feature | Core | React Adapter | UI Components | Demo App |
|---------|:----:|:-------------:|:-------------:|:--------:|
| Timeline state management | ✅ | ✅ | — | ✅ |
| Clip CRUD | ✅ | ✅ (dispatch) | — | ✅ |
| Track CRUD | ✅ | ✅ (dispatch) | — | ✅ |
| Selection tool | ✅ | ✅ | ✅ | ✅ |
| Razor tool | ✅ | ✅ | ✅ | ✅ |
| Ripple trim | ✅ | ✅ | ✅ | ✅ |
| Roll trim | ✅ | ✅ | ✅ | ✅ |
| Slip tool | ✅ | ✅ | ✅ | ✅ |
| Slide tool | ✅ | ✅ | ✅ | ✅ |
| Hand tool | ✅ | ✅ | ✅ | ✅ |
| Zoom tool | ✅ | ✅ | ✅ | ✅ |
| Undo/Redo | ✅ | ✅ | — | ✅ |
| History compression | ✅ | ✅ | — | ✅ |
| Snap-to-edge | ✅ | ✅ | — | ✅ |
| Provisional/ghost state | ✅ | ✅ | ✅ | ✅ |
| Playhead display | ✅ | ✅ | ✅ | ✅ |
| Playhead seeking | ✅ | ✅ | ✅ | ✅ |
| Tool cursor feedback | ✅ | ✅ | ✅ | ✅ |
| Markers | ✅ | ✅ (read) | ✅ | — |
| Time ruler | — | — | ✅ | ✅ |
| Zoom controls | ✅ | — | ✅ | ✅ |
| Keyboard shortcuts | ✅ | ✅ | — | ✅ |
| Effects | ✅ | — | ✅ (display) | — |
| Keyframes | ✅ | — | ✅ (display) | — |
| Transitions | ✅ | — | ✅ (display) | — |
| Serialization | ✅ | — | — | — |
| OTIO/EDL/AAF export | ✅ | — | — | — |
| Subtitle import | ✅ | — | — | — |
| Project model | ✅ | — | — | — |
| Track groups | ✅ | — | — | — |
| Link groups | ✅ | — | — | — |
| Audio properties | ✅ | — | — | — |
| Clip transforms | ✅ | — | — | — |
| Waveform display | — | — | ✅ | — |
| Thumbnail strip | — | — | ✅ | — |
| Virtual scrolling | ✅ | ✅ | — | — |

---

## How To Add a New Feature (End-to-End)

1. **Core**: Add new `OperationPrimitive` type → implement in `applyOperation` → add validation in `validators.ts` → add invariant check if needed
2. **React**: The operation is already available via `engine.dispatch()`. Optionally add a dedicated hook for reading the new state
3. **UI**: Add component that reads via hook and renders. User interactions create transactions via tool router or direct dispatch
4. **Demo**: Wire the new component into the app layout
