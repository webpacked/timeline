> **Load this file when:** Writing or modifying any hook in `packages/react`, implementing `useClip`, `useTimeline`, `useProvisional`, or modifying `TimelineEngine`.
> **Do NOT load this file when:** Writing core operations, tools, or UI component rendering logic (→ `ui/COMPONENTS.md`).

---

# HOOKS — useSyncExternalStore Patterns

## Critical Rule

**Never use `useState` to mirror engine state.**

```typescript
// ❌ WRONG — causes stale closure, double render, and subscription leak
function useClip(id: ClipId) {
  const [clip, setClip] = useState<Clip>();
  useEffect(() => engine.subscribe(() => setClip(engine.getClip(id))), [id]);
  return clip;
}

// ✅ CORRECT
function useClip(id: ClipId) {
  return useSyncExternalStore(
    engine.subscribe,
    () => engine.getState().assetRegistry, // outer scope
  );
}
```

---

## Selector Scope Rule — Never Over-Subscribe

Each hook selects the **minimum slice** needed. A hook that selects the entire state causes every clip to re-render on every change.

```typescript
// ❌ WRONG — re-renders when ANY part of state changes
function useClip(id: ClipId) {
  const state = useSyncExternalStore(engine.subscribe, engine.getState);
  return findClip(state, id);
}

// ✅ CORRECT — re-renders only when THIS clip's data changes
function useClip(id: ClipId) {
  return useSyncExternalStore(engine.subscribe, () => {
    const state = engine.getState();
    for (const track of state.timeline.tracks) {
      const clip = track.clips.find((c) => c.id === id);
      if (clip) return clip;
    }
    return null;
  });
}
```

---

## Hooks Never Import from @timeline/core Directly

All calls go through the `TimelineEngine` adapter class. Hooks never call `dispatch()` directly.

```typescript
// ❌
import { dispatch } from "@timeline/core";

// ✅
const { engine } = useTimelineContext();
engine.dispatch(transaction);
```

---

## Hook Reference

### `useTimeline()`

- **Subscribes to:** `timeline.id`, `timeline.name`, `timeline.fps`, `timeline.duration`, `timeline.tracks` structure (id list only, not clip contents)
- **Re-renders when:** Top-level timeline metadata or track list structure changes
- **Returns:** `Pick<Timeline, 'id' | 'name' | 'fps' | 'duration'> & { trackIds: TrackId[] }`

### `useTrack(id: TrackId)`

- **Subscribes to:** That track's fields + its `clips` id list (not clip data)
- **Re-renders when:** That specific track's metadata or clip id list changes
- **Returns:** `Track` (with clips as full objects — selectors further scope if needed)

### `useClip(id: ClipId)`

- **Subscribes to:** All fields of that specific clip
- **Re-renders when:** That clip's data changes
- **Returns:** `Clip | null`

```typescript
// Canonical useClip implementation:
export function useClip(id: ClipId): Clip | null {
  const { engine } = useTimelineContext();
  return useSyncExternalStore(engine.subscribe, () => {
    const state = engine.getState();
    for (const track of state.timeline.tracks) {
      const clip = track.clips.find((c) => c.id === id);
      if (clip) return clip;
    }
    return null;
  });
}
```

### `usePlayhead()`

- **Subscribes to:** `PlayheadController` — a **separate** subscription channel from the edit engine
- **Re-renders when:** `currentFrame` changes (every rAF tick during playback)
- **Returns:** `{ frame: TimelineFrame; isPlaying: boolean }`

### `useActiveTool()`

- **Returns:** `{ toolId: ToolId; cursor: string }`
- **Re-renders when:** Active tool changes

### `useProvisional()`

- **Returns:** `ProvisionalState | null`
- **Re-renders when:** `ProvisionalStateManager.set()` or `.clear()` is called
- **Note:** This is a **separate** subscription from the main engine — provisional updates never hit `engine.notify()`

### `useSnapEnabled()`

- **Returns:** `boolean`
- **Re-renders when:** User toggles snap

---

## resolveClip() Pattern — Provisional Overlay

UI components read provisional state first, committed state as fallback:

```typescript
function resolveClip(
  id: ClipId,
  committed: Clip | null,
  provisional: ProvisionalState | null,
): Clip | null {
  if (provisional) {
    const ghost = provisional.clips.find((c) => c.id === id);
    if (ghost) return ghost;
  }
  return committed;
}

// In component:
function ClipShell({ id }: { id: ClipId }) {
  const committed = useClip(id);
  const provisional = useProvisional();
  const clip = resolveClip(id, committed, provisional);
  if (!clip) return null;
  // render with clip data
}
```

---

## This file does NOT cover

- How ToolRouter converts raw DOM events (→ `adapter/TOOL_ROUTER.md`)
- Pixel math and ghost rendering styles (→ `ui/COMPONENTS.md`)
- What subscriptions the engine supports (→ TimelineEngine class docs)

---

## Common mistakes to avoid

- Importing `dispatch` from `@timeline/core` inside a hook — always call `engine.dispatch()`
- Using `useEffect` + `useState` to mirror engine state — use `useSyncExternalStore` always
- Subscribing to `engine.getState` (entire state snapshot) — always write a scoped selector
