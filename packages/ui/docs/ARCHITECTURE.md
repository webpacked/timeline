We are starting Phase U.
Before any component code, create this file:

packages/ui/ARCHITECTURE.md

Content:

════════════════════════════════════════════════════════
@webpacked-timeline/ui — Architecture & Contract
════════════════════════════════════════════════════════

## Philosophy

@webpacked-timeline/ui is not a component library.
It is a component distribution system.

When you run `npx @webpacked-timeline/ui add clip`, a clip.tsx
lands in YOUR project. You own it. Edit every pixel,
every animation, every class. There are no version
conflicts, no !important fights, no "the library
doesn't support that prop."

The only things you import from @timeline packages
are @webpacked-timeline/core (types + engine) and
@webpacked-timeline/react (hooks). Never the UI.

## What gets copied into your project

components/timeline/
  _shared/              ← copied first, once
    time.ts             ← timeToPx, pxToTime, frameToTimecode
    geometry.ts         ← rect math, hit testing
    interaction.ts      ← drag state, pointer capture
    use-drag.ts         ← useDrag() hook
    use-snap.ts         ← useSnap() hook
  timeline.css          ← CSS variable tokens
  timeline-root.tsx     ← Tier 1
  track.tsx
  clip.tsx
  playhead.tsx
  ruler.tsx
  toolbar.tsx           ← Tier 2
  zoom-bar.tsx
  thumbnail-strip.tsx   ← Tier 3
  waveform.tsx
  clip-label.tsx
  effect-lane.tsx       ← Tier 4
  keyframe-diamond.tsx
  transition-handle.tsx
  marker-pin.tsx        ← Tier 5
  marker-range.tsx
  in-out-handles.tsx

## Provider pattern

timeline-root.tsx is the ONLY component that
takes engine as a prop. It wraps children in
TimelineProvider:

  <TimelineProvider engine={engine}>
    {children}
  </TimelineProvider>

All other components read engine from context:

  const engine = useTimelineEngine()

This is not global magic. Engine is explicit at
the root. One place. Clear ownership.

Override: any component can accept an optional
engine prop to bypass context:

  <Clip engine={overrideEngine} clipId={id} />

## Rendering contract

Components MAY:
  - Read engine state via hooks
  - Call engine commands (dispatch, activateTool,
    play, pause, seekTo, undo, redo)
  - Render provisional state from useProvisional()
  - Subscribe to playhead via usePlayheadFrame()

Components MUST NOT:
  - Modify engine state directly (no engine.state.x = y)
  - Store canonical engine values in local useState
    (no const [frame, setFrame] = useState(0) when
     frame comes from the engine)
  - Embed tool logic (tools live in core)
  - Import from other copied components
    (import only from _shared/ and @webpacked-timeline/*)

## Tool system

Tool state is managed entirely by @webpacked-timeline/core.
Components respect tool mode — they do not define it.

engine.activateTool('razor')   // switch tool
engine.getActiveToolId()       // read active tool
useActiveToolId(engine)        // React hook

The timeline-root component attaches the ToolRouter
(from @webpacked-timeline/react) to its DOM container.
All pointer events flow: DOM → ToolRouter → ITool.
Components never handle pointer events directly
for tool purposes.

## CSS variable tokens

All visual values are CSS variables defined in
timeline.css. No hardcoded colors anywhere.

Token naming: --tl-{component}-{property}-{state}

Examples:
  --tl-clip-bg
  --tl-clip-bg-selected
  --tl-clip-bg-provisional
  --tl-track-height
  --tl-playhead-color
  --tl-ruler-height
  --tl-waveform-color
  --tl-keyframe-color

Override any token:
  :root { --tl-clip-bg: hsl(142 71% 45%); }

## Themes

Themes are CSS files that override token values.
Install: npx @webpacked-timeline/ui add theme --theme=dark-pro

Available themes:
  dark-pro    (default, DaVinci-inspired)
  light       (Final Cut Pro-inspired)
  high-contrast

## Presets

Presets are convenience installers. Not locked
bundles. Fully editable after install.

  npx @webpacked-timeline/ui add --preset=minimal
    Installs: timeline-root, track, clip,
              playhead, ruler

  npx @webpacked-timeline/ui add --preset=video-editor
    Installs: all Tier 1–4 components

  npx @webpacked-timeline/ui add --preset=audio-editor
    Installs: timeline-root, track, clip,
              waveform, playhead, ruler, toolbar

## Versioning and updates

Copied files belong to you. The CLI never
silently overwrites them.

  npx @webpacked-timeline/ui diff clip
    Shows what changed between your version
    and the latest registry version.

  npx @webpacked-timeline/ui update clip
    Shows diff first, then asks for confirmation.
    Use --force to skip confirmation.

  npx @webpacked-timeline/ui update clip --force
    Overwrites without confirmation.

## Performance policy

Components mount only visible clips.
useVisibleClips(engine, window) from @webpacked-timeline/react
returns VirtualClipEntry[] with isVisible flags.

Timeline renders ALL tracks but only mounts clip
components where isVisible === true.

Future (Phase P): full windowed virtualization
using @webpacked-timeline/core TrackIndex for O(log n) lookup.

## Accessibility policy

Minimum viable accessibility shipped with v0.1:
  - Keyboard scrubbing (arrow keys via KeyboardHandler)
  - Focus ring tokens (--tl-focus-ring)
  - ARIA role="region" on timeline root
  - ARIA role="listitem" on tracks
  - aria-label on playhead

Full accessibility (WCAG 2.1 AA) is a roadmap item.

## Non-goals for v0.x

These are explicitly out of scope:
  - Built-in video rendering pipeline
  - Cloud export or storage
  - Asset management backend
  - Real-time collaboration layer
  - Mobile touch support (pointer events only)
  - Accessibility beyond minimum viable
  - Server-side rendering support

## Component anatomy

Every component follows this structure:

  1. Imports (@webpacked-timeline/react, _shared/, react)
  2. Props interface (documented with JSDoc)
  3. Component function
  4. Internal sub-components (if needed, in same file)
  5. Export

Props interface minimum:
  className?:  string
  style?:      React.CSSProperties

Render prop escape hatches where content varies:
  renderLabel?:     (clip: Clip) => React.ReactNode
  renderThumbnail?: (clip: Clip) => React.ReactNode
  renderOverlay?:   (clip: Clip) => React.ReactNode

## Testing policy

CLI: unit tests for registry, file copier,
     dependency resolver, diff engine

Registry: integrity test — every registered
          component's files exist and compile

Components: render tests using
            @testing-library/react

Integration: example project in
             packages/ui/examples/
             that installs components and renders

════════════════════════════════════════════════════════
ACCEPTANCE
════════════════════════════════════════════════════════
- Create packages/ui/ARCHITECTURE.md
- No code changes
- No test changes
- pnpm exec tsc --noEmit → 0 errors