> **Load this file when:** Touching any component in `packages/ui` — `Timeline`, `Track`, `Clip`, `TimeRuler`, or `Toolbar`.
> **Do NOT load this file when:** Writing core engine logic, hooks, or tool implementations.

---

# COMPONENTS — @timeline/ui Rules

## Critical Rule

**No component imports from `@timeline/core` directly.** No component calls `dispatch()` directly. State flows in through hooks only.

```typescript
// ❌ WRONG
import { dispatch, findClipById } from "@timeline/core";

// ✅ CORRECT
import { useClip, useTimeline } from "@timeline/react";
```

---

## Component Inventory

| Component     | Hook it uses                      | What it renders                  |
| ------------- | --------------------------------- | -------------------------------- |
| `<Timeline>`  | `useTimeline()`                   | Container, TimeRuler, Track list |
| `<Track>`     | `useTrack(id)`                    | Clip list for one track          |
| `<Clip>`      | `useClip(id)`, `useProvisional()` | Single clip block                |
| `<TimeRuler>` | `useTimeline()`, `usePlayhead()`  | Frame tick labels                |
| `<Toolbar>`   | `useActiveTool()`                 | Tool selection buttons           |

---

## Pixel Math (canonical formulas)

```typescript
// Clip position — use these exact formulas everywhere
const left = clip.timelineStart * pixelsPerFrame;
const width = (clip.timelineEnd - clip.timelineStart) * pixelsPerFrame;

// TimeRuler tick
const tickLeft = frame * pixelsPerFrame;
```

`pixelsPerFrame` comes from the scroll/zoom context — never hardcoded.

---

## Ghost / Provisional Rendering

During a drag, the `<Clip>` component overlays the provisional position at reduced opacity:

```typescript
function ClipBlock({ id }: { id: ClipId }) {
  const committed   = useClip(id);
  const provisional = useProvisional();

  // resolveClip: provisional overrides committed during drag
  const clip = provisional?.clips.find(c => c.id === id) ?? committed;
  if (!clip) return null;

  const left   = clip.timelineStart * pixelsPerFrame;
  const width  = (clip.timelineEnd - clip.timelineStart) * pixelsPerFrame;
  const isGhost = !!provisional?.clips.find(c => c.id === id);

  return (
    <div
      style={{
        position: 'absolute',
        left,
        width,
        opacity: isGhost ? 0.6 : 1,
      }}
    />
  );
}
```

Ghost clips render at **0.6 opacity**, not 0.5 or 0.7.

---

## Pointer Events — Flow to ToolRouter

Components call `ToolRouter` methods on pointer events, never handle drag logic themselves:

```typescript
function TrackRow({ id }: { id: TrackId }) {
  const { toolRouter } = useTimelineContext();

  return (
    <div
      onPointerDown={e => toolRouter.handlePointerDown(e.nativeEvent, id)}
      onPointerMove={e => toolRouter.handlePointerMove(e.nativeEvent, id)}
      onPointerUp={e => toolRouter.handlePointerUp(e.nativeEvent, id)}
    />
  );
}
```

---

## What Components Do NOT Do

- ❌ Import from `@timeline/core` directly
- ❌ Call `dispatch()` directly
- ❌ Implement drag logic (that belongs in `packages/react/tools/`)
- ❌ Keep a `useState` copy of clip data
- ❌ Call any engine method except through hooks and `toolRouter`

---

## This file does NOT cover

- How hooks compute clip data (→ `adapter/HOOKS.md`)
- How ToolRouter processes events (→ `adapter/TOOL_ROUTER.md`)
- Pixel-to-frame conversions inside tools (→ `tools/ITOOL_CONTRACT.md`)

---

## Common mistakes to avoid

- Using `clip.timelineStart / fps` to compute pixel position — the formula is always `timelineStart * pixelsPerFrame`, never divide by fps
- Rendering ghost clips at opacity 0.5 — the spec is **0.6**
- Attaching `onPointerMove` at document level inside a component — attach on the track row and let ToolRouter throttle
