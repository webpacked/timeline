# @webpacked-timeline/ui

DaVinci-style React timeline editor. One import. Full professional timeline.

## Install

```bash
npm install @webpacked-timeline/ui @webpacked-timeline/react @webpacked-timeline/core
```

## Quick Start (30 seconds)

```tsx
import { DaVinciEditor } from '@webpacked-timeline/ui';
import '@webpacked-timeline/ui/styles/davinci';
import { TimelineEngine } from '@webpacked-timeline/react';
import { createTimelineState, createTimeline, toFrame, frameRate } from '@webpacked-timeline/core';

const engine = new TimelineEngine({
  initialState: createTimelineState({
    timeline: createTimeline({
      id: 'tl-1',
      name: 'My Timeline',
      fps: frameRate(30),
      duration: toFrame(9000),
    }),
  }),
});

export default function App() {
  return <DaVinciEditor engine={engine} style={{ height: '100vh' }} />;
}
```

That's it — a full DaVinci Resolve-style timeline editor with toolbar, ruler, tracks, clips, playhead, undo/redo, and keyboard shortcuts.

## Components

All components are exported from the package root:

| Component | Description |
|-----------|-------------|
| `DaVinciEditor` | Full-layout editor (toolbar + ruler + tracks + playhead) |
| `DaVinciToolbar` | Tool buttons, zoom controls, transport (undo/redo/play) |
| `DaVinciRuler` | Timecode ruler with major/minor ticks |
| `DaVinciTrack` | Track label row (name, type badge, lock, solo/mute) |
| `DaVinciClip` | Clip block with waveform, label, trim handles |
| `DaVinciPlayhead` | Red playhead line |

### DaVinciEditor Props

```typescript
interface DaVinciEditorProps {
  engine: TimelineEngine;      // from @webpacked-timeline/react
  initialPpf?: number;         // initial pixels per frame (default: 4)
  onPpfChange?: (ppf: number) => void;
  registerZoomHandler?: (handler: (ppf: number) => void) => void;
  className?: string;
  style?: React.CSSProperties;
}
```

### Context & Utilities

For custom layouts, use the context directly:

```tsx
import { TimelineProvider, useTimelineContext, useEngine } from '@webpacked-timeline/ui';
import { frameToPx, pxToFrame, frameToTimecode } from '@webpacked-timeline/ui';
```

## Theming

All visual properties are controlled by CSS custom properties. Import the DaVinci theme:

```css
@import '@webpacked-timeline/ui/styles/davinci';
```

Override any token in your CSS:

```css
:root {
  --tl-clip-video-bg: hsl(270 70% 50%);
  --tl-track-height: 60px;
  --tl-playhead-color: hsl(120 60% 50%);
}
```

### Key Tokens

| Token | Default | Description |
|-------|---------|-------------|
| `--tl-app-bg` | `hsl(220 13% 9%)` | App background |
| `--tl-panel-bg` | `hsl(220 13% 11%)` | Panel background |
| `--tl-toolbar-bg` | `hsl(220 13% 11%)` | Toolbar background |
| `--tl-toolbar-height` | `40px` | Toolbar height |
| `--tl-ruler-height` | `32px` | Ruler height |
| `--tl-track-height` | `80px` | Track row height |
| `--tl-track-bg-video` | `#28282E` | Video track background |
| `--tl-track-bg-audio` | `#28282E` | Audio track background |
| `--tl-clip-video-bg` | `#2E77A5` | Video clip fill |
| `--tl-clip-audio-bg` | `#179160` | Audio clip fill |
| `--tl-clip-radius` | `2px` | Clip border radius |
| `--tl-clip-text` | `hsl(0 0% 92%)` | Clip label color |
| `--tl-playhead-color` | `#ff3b30` | Playhead line color |
| `--tl-timecode-color` | `hsl(0 0% 88%)` | Timecode text color |
| `--tl-label-width` | `200px` | Track label column width |
| `--tl-snap-color` | `hsl(45 90% 60%)` | Snap indicator color |

See [tokens.css](src/tokens.css) for the full list of ~50 tokens. All colors controlled by CSS variables — no hardcoded colors in components.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Selection tool |
| `C` | Razor tool |
| `T` | Ripple Trim |
| `R` | Roll Trim |
| `S` | Slip |
| `Y` | Slide |
| `H` | Hand (pan) |
| `Space` | Play/Pause |
| `←` / `→` | Step 1 frame |
| `Shift+←/→` | Step 10 frames |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Delete` | Delete selected clips |
| `Cmd+A` | Select all |
| `Escape` | Clear selection |

## Presets

The DaVinci preset ships with `@webpacked-timeline/ui`. More presets are planned.

## License

MIT
