# Timeline API Stability Audit

**Date:** 2026-02-14  
**Purpose:** Verify that public API boundaries are properly locked and internal changes won't break consumers

---

## Executive Summary

✅ **API is properly locked down and stable**

All three packages have clear public API boundaries:
- `@timeline/core` - Public API intentionally defined, internals separated
- `@timeline/react` - Only adapter layer exported
- `@timeline/ui` - Only presentational components exported

**Key Finding:** Internal changes will NOT break consumers. The architecture supports the claim: "If you remove something internal → users should not break."

---

## Package-by-Package Analysis

### 1. @timeline/core

#### Public API Surface (`src/index.ts` → `src/public-api.ts`)

**Exported:**
```typescript
// Engine
- TimelineEngine (41 public methods)

// Factory Functions
- createTimeline, createTrack, createClip, createAsset, createTimelineState

// Frame Utilities
- frame, frameRate, framesToTimecode, framesToSeconds, secondsToFrames

// Types
- Frame, FrameRate, Timeline, Track, TrackType, Clip, Asset, AssetType
- TimelineState, ValidationResult, ValidationError
- TimelineMarker, ClipMarker, RegionMarker, WorkArea, Marker
- LinkGroup, Group
```

**NOT Exported (Internal):**
```typescript
// Internal operations (addClip, moveClip, removeClip, etc.)
// Internal systems (validation, queries, snapping, linking, grouping)
// Internal utilities (ID generation, low-level helpers)
// Transaction primitives (dispatcher, operations)
```

**Internal API (`src/internal.ts`):**
- Re-exports public API
- Adds access to operations, systems, utilities
- Clearly documented as "NOT stable" and "may change without notice"
- Used by: tests, UI package (for snapping), advanced integrations

**Stability Assessment:**
- ✅ Public API is minimal and intentional
- ✅ All editing goes through `TimelineEngine` (high-level API)
- ✅ Internal refactoring possible without breaking changes
- ✅ Clear separation maintained in documentation

**Consumer Protection:**
```typescript
// Consumer code uses ONLY public API:
import { TimelineEngine, createTimeline, frame } from '@timeline/core';

const engine = new TimelineEngine(state);
engine.addClip(trackId, clip);      // High-level method
engine.moveClip(clipId, frame(100)); // High-level method
```

If we refactor internal `addClip` operation → consumers don't break  
If we change dispatcher logic → consumers don't break  
If we modify validation system → consumers don't break  

**Only breaking changes:**
- Changing `TimelineEngine` method signatures
- Changing factory function parameters
- Changing exported type shapes

---

### 2. @timeline/react

#### Public API Surface (`src/index.ts`)

**Exported:**
```typescript
// Context Provider
- TimelineProvider, TimelineContext, TimelineProviderProps

// Hooks
- useEngine(): TimelineEngine
- useTimeline(): { state: TimelineState, engine: TimelineEngine }
- useTrack(trackId: string): Track | null
- useClip(clipId: string): Clip | null
```

**NOT Exported:**
- Internal hook implementations
- Context implementation details

**Stability Assessment:**
- ✅ Minimal adapter layer - only 4 hooks + 1 provider
- ✅ All hooks return public types from `@timeline/core`
- ✅ No internal state management exposed
- ✅ Pure delegation to core engine

**Consumer Protection:**
```typescript
// Consumer code:
import { TimelineProvider, useTimeline, useTrack } from '@timeline/react';

function App() {
  return (
    <TimelineProvider engine={engine}>
      <Timeline />
    </TimelineProvider>
  );
}

function Timeline() {
  const { state, engine } = useTimeline();
  return <div>{state.timeline.name}</div>;
}
```

If we change hook implementation → consumers don't break  
If we optimize re-render logic → consumers don't break  
If we add internal state → consumers don't break  

**Only breaking changes:**
- Changing hook return types
- Changing provider prop requirements

---

### 3. @timeline/ui

#### Public API Surface (`src/index.ts`)

**Exported:**
```typescript
// Components
- Timeline (main container)
- Track (track row component)
- Clip (clip component)
- TimeRuler (time ruler component)

// Context (internal to UI package)
- TimelineUIContext (exported but documented as internal)
```

**NOT Exported:**
- Component internal state
- Component utility functions
- Drag/resize handlers
- Layout calculations

**Special Case - Internal Import:**
```typescript
// packages/ui/src/timeline/Clip.tsx uses:
import { 
  findSnapTargets, 
  calculateSnapExcluding,
  type SnapResult 
} from '@timeline/core/internal';
```

**Justification:**
- Snapping calculations needed during interactive drag
- Cannot go through `TimelineEngine` (too heavy for real-time)
- Documented in Session notes as "intentional internal imports for interactive features"
- UI package is part of the timeline monorepo (trusted consumer)

**Stability Assessment:**
- ✅ Only presentational components exported
- ✅ Components take props, render UI, call engine methods
- ✅ No business logic exposed
- ✅ Internal UI state not exposed

**Consumer Protection:**
```typescript
// Consumer code:
import { Timeline } from '@timeline/ui';
import { TimelineProvider } from '@timeline/react';

function App() {
  return (
    <TimelineProvider engine={engine}>
      <Timeline />
    </TimelineProvider>
  );
}
```

If we change Timeline internal layout → consumers don't break  
If we refactor Clip drag logic → consumers don't break  
If we change styling approach → consumers don't break  

**Only breaking changes:**
- Changing component prop interfaces
- Removing exported components

---

## Boundary Enforcement

### Package Dependencies

```
@timeline/ui
  ↓ depends on
@timeline/react
  ↓ depends on
@timeline/core
```

**Dependency Rules:**
- ✅ UI imports from `@timeline/react` (public API only)
- ✅ UI imports from `@timeline/core` (public API only)
- ⚠️ UI imports from `@timeline/core/internal` (snapping - documented exception)
- ✅ React imports from `@timeline/core` (public API only)
- ✅ Core has no dependencies

### TypeScript Configuration

Each package has `tsconfig.json` with proper compilation settings:
- `declaration: true` - Generates `.d.ts` type files
- `declarationMap: true` - Source map for types
- Type exports properly defined in `package.json`

**Build Output:**
```
packages/core/dist/
  ├── index.js       (public API)
  ├── index.d.ts     (public types)
  ├── internal.js    (internal API)
  └── internal.d.ts  (internal types)
```

Consumers importing from `@timeline/core` get `index.d.ts` (public types only).

---

## Testing the Boundary

### Hypothetical Internal Changes

#### Scenario 1: Refactor Validation System
```typescript
// BEFORE (internal)
export function validateClip(state, clip) { ... }

// AFTER (internal) - completely rewrite
export function validateClipV2(state, clip) { ... }
```

**Impact:**
- ❌ Internal code breaks (expected, internal tests will catch)
- ✅ Public API unchanged (`TimelineEngine.addClip()` still works)
- ✅ Consumers don't break

---

#### Scenario 2: Change Dispatcher Architecture
```typescript
// BEFORE (internal)
export function dispatch(history, operation) { ... }

// AFTER (internal) - new architecture
export function dispatchV2(context, command) { ... }
```

**Impact:**
- ❌ `TimelineEngine` implementation needs update
- ✅ Public API unchanged (engine methods still return `DispatchResult`)
- ✅ Consumers don't break

---

#### Scenario 3: Optimize Snapping Algorithm
```typescript
// BEFORE (internal)
export function calculateSnap(frame, targets, threshold) { ... }

// AFTER (internal) - better algorithm
export function calculateSnap(frame, targets, threshold, options?) { ... }
```

**Impact:**
- ⚠️ UI package needs update (uses internal snapping)
- ✅ Public API unchanged (consumers don't use snapping directly)
- ✅ External consumers don't break
- ⚠️ Monorepo internal (UI) needs coordination

**Mitigation:**
- UI is part of monorepo → updated atomically with core
- External consumers never affected

---

#### Scenario 4: Remove Internal Utility
```typescript
// REMOVE this internal utility:
export function generateClipId() { ... }
```

**Impact:**
- ❌ Internal tests break (expected)
- ✅ Public API unchanged (consumers use `createClip()` factory)
- ✅ Consumers don't break

---

## Stability Guarantees

### What WON'T Break Consumers

✅ Refactoring internal operations  
✅ Changing validation logic  
✅ Optimizing query systems  
✅ Restructuring internal code  
✅ Renaming internal functions  
✅ Removing internal utilities  
✅ Changing dispatcher implementation  
✅ Modifying transaction system  

### What WILL Break Consumers (True Breaking Changes)

❌ Changing `TimelineEngine` method signatures  
❌ Removing `TimelineEngine` methods  
❌ Changing factory function parameters  
❌ Changing exported type shapes  
❌ Removing exported utilities (e.g., `frame`, `frameRate`)  

### What Needs Coordination (Monorepo Internal)

⚠️ Changes to `/internal` exports used by `@timeline/ui`  
⚠️ Snapping algorithm changes (used by Clip component)  

**Mitigation:** Monorepo allows atomic updates across packages.

---

## Semantic Versioning Alignment

### Major Version (Breaking Changes)

**Require major version bump:**
- Changing `TimelineEngine` public method signatures
- Removing exported functions/types
- Changing exported type shapes incompatibly

**Do NOT require major version bump:**
- Internal refactoring
- Performance improvements
- Bug fixes to internal systems
- New internal utilities (not exported)

### Minor Version (New Features)

**Examples:**
- Adding new `TimelineEngine` methods
- Adding new factory functions
- Adding optional parameters to existing methods (with defaults)
- Exporting new types

### Patch Version (Bug Fixes)

**Examples:**
- Fixing validation bugs
- Optimizing internal algorithms
- Fixing memory leaks
- Improving error messages

---

## API Stability Scorecard

| Criteria | @timeline/core | @timeline/react | @timeline/ui | Status |
|----------|---------------|-----------------|--------------|--------|
| Public API explicitly defined | ✅ | ✅ | ✅ | **PASS** |
| Internal code not exported | ✅ | ✅ | ✅ | **PASS** |
| Internal exports clearly marked | ✅ | N/A | N/A | **PASS** |
| TypeScript types properly exposed | ✅ | ✅ | ✅ | **PASS** |
| Minimal API surface | ✅ | ✅ | ✅ | **PASS** |
| High-level abstractions only | ✅ | ✅ | ✅ | **PASS** |
| Internal changes won't break users | ✅ | ✅ | ✅ | **PASS** |
| Clear documentation | ✅ | ✅ | ⚠️ | **MOSTLY** |

**Overall Score: 7.5/8 (93.75%)**

---

## Recommendations

### Immediate Actions: None Required

The API is already properly locked down and stable.

### Future Improvements

1. **Documentation Enhancement**
   - Add JSDoc comments to all `TimelineEngine` public methods
   - Document breaking change policy in CONTRIBUTING.md
   - Add "API Stability" section to main README

2. **Automated Boundary Enforcement**
   - Consider using `@microsoft/api-extractor` to generate API reports
   - Add CI check to detect accidental public API changes
   - Use `publint` or similar tool to verify package exports

3. **UI Package Clarity**
   - Add comment in `Clip.tsx` explaining why `/internal` import is needed
   - Consider moving snapping to a separate internal UI utility layer

4. **Versioning Policy**
   - Document semantic versioning policy for internal vs public changes
   - Add CHANGELOG to track API changes

---

## Conclusion

**The timeline packages have a properly locked public API.**

✅ **Core claim verified:** "If you remove something internal → users should not break"

**Evidence:**
1. Public API explicitly defined in `public-api.ts`
2. Internal code segregated in `internal.ts` with warnings
3. High-level `TimelineEngine` is the primary consumer interface
4. React adapter only exposes hooks and provider
5. UI package only exports presentational components
6. TypeScript ensures type safety at boundaries

**Stability level:** Production-ready

**Breaking change risk:** Low (only changes to public API methods/types)

**Refactoring freedom:** High (all internal code can change freely)

**Architecture quality:** Excellent separation of concerns

---

**Next Steps:**
1. Add API documentation (JSDoc)
2. Consider automated API boundary testing
3. Document versioning policy
4. Ready for external consumers

