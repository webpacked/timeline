# @timeline

A professional open-source NLE (Non-Linear Editor)
timeline engine for the web.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@timeline/core` | Headless TypeScript engine | `npm i @timeline/core` |
| `@timeline/react` | React adapter + hooks | `npm i @timeline/react` |
| `@timeline/ui` | shadcn-style components | `npx timeline-ui add timeline` |

## Architecture
Your App
└── @timeline/ui       (components you own)
└── @timeline/react  (hooks + engine)
└── @timeline/core   (pure TS engine)

@timeline/core is framework-agnostic. It runs in
the browser, Node.js, Web Workers, and Electron.
React is never imported by core.

## Quick Start
```bash
# Install engine + adapter
npm install @timeline/core @timeline/react

# Copy UI components into your project
npx timeline-ui add timeline
# Components land in ./components/timeline/
# You own the code — edit freely.
```

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Foundation — types, dispatch, history | ✅ |
| 1 | Tool scaffolding + React adapter scaffold | ✅ |
| 2 | Core tools — Select, Razor, Trim, Slip, Delete, Insert | ✅ |
| 3 | Markers, BeatGrid, Generators, Captions, SRT/VTT | ✅ |
| 4 | Effects, Keyframes, Transitions, Track Groups | ✅ |
| 5 | Serialization — JSON, OTIO, EDL, AAF, FCPXML | ✅ |
| 6 | Playback engine — PlayheadController, pipeline contracts | ✅ |
| 7 | Performance — interval tree, compression, benchmarks | ✅ |
| R | @timeline/react — full adapter buildout | 🔄 Next |
| U | @timeline/ui — shadcn-style components | ⬜ |

**@timeline/core — Feature Complete**
942 tests · 0 TypeScript errors

## Contributing

See CONTRIBUTING.md (coming soon).

## License

MIT
