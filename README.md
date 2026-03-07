# @timeline

Professional open-source NLE (Non-Linear Editor) timeline engine for the web.

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`@webpacked-timeline/core`](packages/core) | Headless TypeScript engine | 1.0.0-beta.1 |
| [`@webpacked-timeline/react`](packages/react) | React adapter + hooks | 1.0.0-beta.1 |
| [`@webpacked-timeline/ui`](packages/ui) | DaVinci-style UI preset | 1.0.0-beta.1 |

## Quick Start

```bash
npm install @webpacked-timeline/ui @webpacked-timeline/react @webpacked-timeline/core
```

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

## Architecture

```
Your App
└── @webpacked-timeline/ui       → DaVinci-style components (React)
    └── @webpacked-timeline/react  → Hooks, context, TimelineEngine
        └── @webpacked-timeline/core   → Pure TypeScript engine (zero deps)
```

- **@webpacked-timeline/core** is framework-agnostic. Runs in browser, Node.js, Web Workers, Electron.
- **@webpacked-timeline/react** provides `TimelineEngine` (wires core's dispatcher, history, tools, playback) and 20+ hooks.
- **@webpacked-timeline/ui** provides drop-in `DaVinciEditor` with toolbar, ruler, tracks, clips, playhead, and full keyboard shortcuts.

## Features

- 40+ atomic editing operations
- 12 professional tools (Selection, Razor, Trim, Slip, Slide, etc.)
- Undo/redo with transaction compression
- Playback engine with J/K/L shuttle
- Export to OTIO, EDL, AAF, FCP XML
- SRT/VTT subtitle import
- Snap system, virtual windowing, interval tree
- Full CSS variable theming
- 850+ tests, zero TypeScript errors

## Development

```bash
pnpm install
pnpm --filter @timeline/core test    # Run core tests
pnpm --filter @timeline/react test   # Run react tests
pnpm --filter @timeline/ui build     # Build UI package
cd apps/demo && pnpm dev             # Run demo app
```

## Status

Feature-complete. All phases delivered:

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Foundation — types, dispatch, history | ✅ |
| 1 | Tool scaffolding + React adapter | ✅ |
| 2 | Core tools — Select, Razor, Trim, Slip, Delete, Insert | ✅ |
| 3 | Markers, BeatGrid, Generators, Captions, SRT/VTT | ✅ |
| 4 | Effects, Keyframes, Transitions, Track Groups | ✅ |
| 5 | Serialization — JSON, OTIO, EDL, AAF, FCP XML | ✅ |
| 6 | Playback engine — PlayheadController, pipeline contracts | ✅ |
| 7 | Performance — interval tree, compression, benchmarks | ✅ |
| R | @timeline/react — full adapter buildout | ✅ |
| U | @timeline/ui — DaVinci preset | ✅ |

## Contributing

See CONTRIBUTING.md (coming soon).

## License

MIT
