> **Load this file when:** Touching `ToolRouter`, adding pointer event handling, or implementing the provisional drag flow in `packages/react`.
> **Do NOT load this file when:** Writing ITool implementations (→ `tools/ITOOL_CONTRACT.md`), hooks (→ `adapter/HOOKS.md`), or UI components.

---

# TOOL_ROUTER — DOM Event → Tool Contract

## Critical Rule

`handlePointerMove` is throttled to **one execution per `requestAnimationFrame`**. The handler inside `rAF` always uses the most-recent event, not a queued list.

---

## ToolRouter's Responsibility

Convert raw DOM `PointerEvent` → `TimelinePointerEvent`, extract modifier keys, call the active tool, and manage provisional state.

```typescript
class ToolRouter {
  private rafPending = false;
  private lastMoveEvent: PointerEvent | null = null;
  private lastMoveTrack: TrackId | null = null;
}
```

---

## The Three Handlers

### handlePointerDown

```typescript
handlePointerDown(domEvent: PointerEvent, trackId: TrackId | null): void {
  const tool = this.engine.getActiveTool();
  const ctx  = this.engine.buildToolContext();
  const evt  = this.convertEvent(domEvent, trackId, ctx);
  tool.onPointerDown(evt, ctx);
}
```

### handlePointerMove (rAF-throttled)

```typescript
handlePointerMove(domEvent: PointerEvent, trackId: TrackId | null): void {
  this.lastMoveEvent = domEvent;
  this.lastMoveTrack = trackId;

  if (this.rafPending) return;  // drop intermediate events
  this.rafPending = true;

  requestAnimationFrame(() => {
    this.rafPending = false;
    if (!this.lastMoveEvent) return;

    const tool = this.engine.getActiveTool();
    const ctx  = this.engine.buildToolContext();
    const evt  = this.convertEvent(this.lastMoveEvent, this.lastMoveTrack, ctx);

    const provisional = tool.onPointerMove(evt, ctx);
    // Set ghost — does NOT dispatch, does NOT touch history
    this.engine.provisionalManager.set(provisional);
  });
}
```

### handlePointerUp

```typescript
handlePointerUp(domEvent: PointerEvent, trackId: TrackId | null): void {
  const tool = this.engine.getActiveTool();
  const ctx  = this.engine.buildToolContext();
  const evt  = this.convertEvent(domEvent, trackId, ctx);

  const tx = tool.onPointerUp(evt, ctx);

  // Always clear ghost on pointer up — even if tool returns null
  this.engine.provisionalManager.clear();

  // Commit only if tool returned a Transaction
  if (tx) this.engine.dispatch(tx);
}
```

---

## convertEvent() — TimelinePointerEvent Construction

```typescript
private convertEvent(
  dom: PointerEvent,
  trackId: TrackId | null,
  ctx: ToolContext,
): TimelinePointerEvent {
  return {
    frame:    ctx.frameAtX(dom.clientX),
    trackId,
    clientX:  dom.clientX,
    clientY:  dom.clientY,
    buttons:  dom.buttons,
    shiftKey: dom.shiftKey,
    altKey:   dom.altKey,
    metaKey:  dom.metaKey,
  };
}
```

---

## Provisional Flow Summary

```
onPointerMove → tool.onPointerMove() → ProvisionalState | null
                                      ↓
                          provisionalManager.set()   ← no dispatch
                                      ↓
                         UI re-renders with ghost overlay   ← separate sub

onPointerUp  → tool.onPointerUp() → Transaction | null
                                      ↓
                          provisionalManager.clear()  ← always
                                      ↓
                          engine.dispatch(tx)         ← only if tx !== null
                                      ↓
                         history push + engine.notify()
```

---

## What ToolRouter Does NOT Do

- ❌ Does not know what any specific tool does
- ❌ Does not validate Transactions (that's the Dispatcher's job)
- ❌ Does not call `dispatch()` inside `handlePointerMove`
- ❌ Does not capture keyboard events (keyboard goes through a separate `KeyRouter`)

---

## This file does NOT cover

- ITool method contracts (→ `tools/ITOOL_CONTRACT.md`)
- How provisional state is rendered as ghost clips (→ `ui/COMPONENTS.md`)
- The `engine.dispatch()` algorithm (→ `core/DISPATCHER.md`)

---

## Common mistakes to avoid

- Dispatching inside `handlePointerMove` — it must only call `provisionalManager.set()`
- Forgetting to call `provisionalManager.clear()` on pointer up — ghost clips persist if not cleared
- Starting a new `rAF` for every move event — use the `rafPending` guard to drop intermediate events
