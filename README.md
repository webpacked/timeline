# Timeline Editor

[![CI](https://github.com/maanaaasss/timeline/actions/workflows/ci.yml/badge.svg)](https://github.com/maanaaasss/timeline/actions/workflows/ci.yml)

A production-ready, headless timeline editor engine with React bindings and UI components.

## Features

- **Headless Architecture** - Pure TypeScript engine with no UI dependencies
- **Undo/Redo** - Complete history management with validation pipeline
- **Track Management** - Solo, mute, lock, height adjustment
- **Clip Operations** - Move, trim, ripple delete, copy/paste, split
- **Markers** - Timeline markers, clip markers, and region markers
- **Work Area** - Define and manage work areas for focused editing
- **Playhead Control** - Draggable playhead with keyboard shortcuts
- **Snapping** - Smart snapping to clips, markers, and playhead
- **Type-Safe** - Full TypeScript support with zero errors

## Packages

This monorepo contains:

- **[@timeline/core](./packages/core)** - Core timeline engine (41 public methods)
- **[@timeline/react](./packages/react)** - React hooks and provider
- **[@timeline/ui](./packages/ui)** - Presentational React components
- **[demo](./apps/demo)** - Interactive demo application

## Quick Start

```bash
# Install dependencies
pnpm install

# Run demo application
pnpm dev

# Run all tests
pnpm test

# Build all packages
pnpm build
```

The demo will be available at http://localhost:3004

## Architecture

The timeline editor follows a strict architectural pattern:

1. **Core Operations** - Pure functions for all business logic
2. **Dispatcher** - Handles validation, history recording, and state updates
3. **Engine** - Thin orchestration layer exposing public API
4. **React Bindings** - Hooks that subscribe to state changes
5. **UI Components** - Presentational components using the hooks

See [API_STABILITY_AUDIT.md](./API_STABILITY_AUDIT.md) for detailed API documentation.

## Development

```bash
# Install dependencies
pnpm install

# Run demo in development mode
pnpm dev

# Run tests with watch mode
pnpm test --watch

# Build all packages
pnpm build

# Type check
pnpm typecheck
```

## Testing

All packages include comprehensive tests:

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @timeline/core test
```

- 40 passing tests across 3 test suites
- Edge case testing
- Stress testing
- Phase 2 feature testing

## CI/CD

The project uses GitHub Actions for continuous integration:

- ✅ Install dependencies
- ✅ Build all packages
- ✅ Run all tests (40 tests)
- ✅ Verify build outputs

See [CI_CONFIGURATION.md](./CI_CONFIGURATION.md) for details.

## Public API

The engine exposes 41 public methods organized into categories:

- **Playback** - `setPlayhead()`, `play()`, `pause()`, etc.
- **Selection** - `setSelection()`, `clearSelection()`, `selectAll()`
- **History** - `undo()`, `redo()`, `canUndo()`, `canRedo()`
- **Clips** - `moveClip()`, `trimClip()`, `splitClip()`, `deleteClips()`
- **Tracks** - `addTrack()`, `removeTrack()`, `toggleTrackSolo()`, `setTrackHeight()`
- **Markers** - `addTimelineMarker()`, `addClipMarker()`, `addRegionMarker()`
- **Work Area** - `setWorkArea()`, `clearWorkArea()`
- **Ripple** - `rippleDelete()`, `rippleTrim()`, `insertEdit()`

See the [Core Package README](./packages/core/README.md) for full API documentation.

## License

MIT
