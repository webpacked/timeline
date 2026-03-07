> **Load this file when:** Every coding session. Always.
> **Do NOT load this file when:** Never skip this file.

---

# ARCHITECTURE — Hard Rules (Always Active)

## Rule 1 — The Three-Layer Law (NO EXCEPTIONS)

```
packages/core   →  imports nothing outside core stdlib + TypeScript
packages/react  →  imports @webpacked-timeline/core + React only
packages/ui     →  imports @webpacked-timeline/react + @webpacked-timeline/core + React only
```

Lower layers NEVER import from higher layers. A `packages/core` file that imports
`React`, `ReactDOM`, `requestAnimationFrame`, `document`, or anything from
`@webpacked-timeline/react` or `@webpacked-timeline/ui` is **categorically wrong** — reject it.

## Rule 2 — One Entry Point for Mutation

`dispatch(state, transaction)` is the **only** function that produces a new `TimelineState`.

```typescript
// ✅ ONLY legal pattern for state change
const result = dispatch(currentState, transaction);

// ❌ ILLEGAL — state mutation outside dispatch
state.timeline.tracks.push(newTrack);
state.timeline.name = "New Name";
```

No function outside `engine/dispatcher.ts` may produce a `TimelineState`. No exceptions.

## Rule 3 — Strict Immutability

All functions that touch state return a **new object**. Never mutate in place.

```typescript
// ✅
return { ...state, timeline: { ...state.timeline, name: op.name } };

// ❌
state.timeline.name = op.name;
return state;
```

Banned mutating array methods inside engine code: `.push()`, `.pop()`, `.splice()`,
`.sort()` (on existing arrays), direct index assignment. Use `.map()`, `.filter()`,
`.concat()`, spread instead.

## Rule 4 — The Time Type Law

All frame-position values are `TimelineFrame` (branded integer). Never raw `number`.

```typescript
type TimelineFrame = number & { readonly __brand: "TimelineFrame" };
type FrameRate = 23.976 | 24 | 25 | 29.97 | 30 | 50 | 59.94 | 60;

// ✅
const start: TimelineFrame = toFrame(100);

// ❌
const start: number = 100; // raw number for frame position
const fps: number = 29.97; // raw float for frame rate
```

`Timecode` is display only — never use it in arithmetic.
`RationalTime` is ingest/export boundary only — never in edit operations.

---

## This file does NOT cover

- Which operations exist (→ `core/OPERATIONS.md`)
- How dispatch works internally (→ `core/DISPATCHER.md`)
- Type definitions (→ `core/TYPES.md`)
- Hook patterns (→ `adapter/HOOKS.md`)

---

## Common mistakes to avoid

- Adding `import React from 'react'` anywhere in `packages/core`
- Returning the mutated `state` object instead of a new spread
- Passing a raw `number` where `TimelineFrame` is required and casting with `as any`
