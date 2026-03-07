> **Load this file when:** Writing ANY ITool implementation, adding a new tool, or writing tool tests.
> **Do NOT load this file when:** Writing core operations, React hooks, or UI components (tools and hooks are separate concerns).

---

# ITOOL_CONTRACT — Interface & Test Pattern

## Critical Rule

`onPointerMove` **NEVER** calls `dispatch()`. `onPointerUp` **NEVER** mutates instance state.

---

## ITool Interface

```typescript
interface ITool {
  readonly id: ToolId;
  readonly cursor: CSSProperties["cursor"];

  onPointerDown(event: TimelinePointerEvent, ctx: ToolContext): void;

  // Returns ProvisionalState for ghost rendering — never dispatches
  onPointerMove(
    event: TimelinePointerEvent,
    ctx: ToolContext,
  ): ProvisionalState | null;

  // Returns Transaction to commit — never mutates state
  onPointerUp(
    event: TimelinePointerEvent,
    ctx: ToolContext,
  ): Transaction | null;

  onKeyDown?(event: TimelineKeyEvent, ctx: ToolContext): Transaction | null;
  onKeyUp?(event: TimelineKeyEvent, ctx: ToolContext): void;

  // Called when another tool is activated while this one has a gesture in progress
  onCancel?(): void;
}
```

---

## ToolContext Type

```typescript
type ToolContext = {
  readonly state: TimelineState; // committed state (never provisional)
  readonly snapIndex: SnapIndex; // index from last commit, never mid-drag
  readonly pixelsPerFrame: number;
  readonly snapEnabled: boolean;
  readonly frameAtX: (x: number) => TimelineFrame; // pixel → frame conversion
  readonly trackAtY: (y: number) => Track | null; // pixel → track conversion
};
```

---

## ProvisionalState Type

```typescript
type ProvisionalState = {
  readonly clips: readonly Clip[]; // full replacement clips (not partial/delta)
};
// UI reads: provisional?.clips.find(c => c.id === id) ?? committedClip
```

---

## Event Types

```typescript
type TimelinePointerEvent = {
  readonly frame: TimelineFrame;
  readonly trackId: TrackId | null;
  readonly clientX: number;
  readonly clientY: number;
  readonly buttons: number;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
};

type TimelineKeyEvent = {
  readonly key: string;
  readonly code: string;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
};
```

---

## Tool Internal State Rule

A tool may hold **drag-tracking variables only** on its instance. No timeline state. No copies of clips. Read from `ctx.state` on every event.

```typescript
class SelectionTool implements ITool {
  // ✅ OK — drag tracking only
  private dragStartFrame: TimelineFrame | null = null;
  private dragClipId: ClipId | null = null;

  // ❌ NOT OK — never cache TimelineState or Clip data
  // private cachedClip: Clip | null = null;
}
```

---

## Capture-before-reset pattern (required in every `onPointerUp`)

In `onPointerUp`, **ALWAYS** capture instance variables into locals before calling any reset function. `_resetDragState()` / `onCancel()` set instance vars to `null` — any code that runs after the reset and reads `this.dragClipId` (etc.) will get `null`.

```typescript
// ✅ Correct — capture first, then reset
onPointerUp(event, ctx): Transaction | null {
  const clipId = this.dragClipId;   // captured
  const edge   = this.dragEdge;     // captured
  this._resetDragState();           // clears this.dragClipId, this.dragEdge, etc.
  if (!clipId || !edge) return null;
  return buildTransaction(clipId, edge);  // safe — uses locals, not this.*
}

// ❌ Wrong — reset before capture
onPointerUp(event, ctx): Transaction | null {
  this._resetDragState();
  return buildTransaction(this.dragClipId);  // 🐛 always null
}
```

**Variant:** Any helper method called from `onPointerUp` that reads `this.*` (e.g. `this._clampFrame()`) must be called **before** `_resetDragState()`, not after. This means: compute all derived values first, then capture, then reset.

```typescript
// ✅ Correct order in onPointerUp
const newFrame = this._clampFrame(snapped); // reads this.dragEdge etc. — call FIRST
const clipId = this.dragClipId; // then capture
this._resetDragState(); // then reset
```

This bug has appeared in SelectionTool, RippleTrimTool, and will appear in every tool that has a reset helper. The pattern is now mandatory.

---

## NoOpTool — Test Double

```typescript
// Zero React imports — tools are pure TS
import type {
  ITool,
  ToolContext,
  TimelinePointerEvent,
  TimelineKeyEvent,
  ProvisionalState,
} from "@webpacked-timeline/core";

class NoOpTool implements ITool {
  readonly id = "no-op" as ToolId;
  readonly cursor = "default" as const;

  onPointerDown(_evt: TimelinePointerEvent, _ctx: ToolContext): void {}

  onPointerMove(
    _evt: TimelinePointerEvent,
    _ctx: ToolContext,
  ): ProvisionalState | null {
    return null; // No ghost
  }

  onPointerUp(
    _evt: TimelinePointerEvent,
    _ctx: ToolContext,
  ): Transaction | null {
    return null; // No commit
  }
}
```

Use `NoOpTool` as a base for unit tests that need an `ITool` but don't care about specific tool logic.

---

## Tool Test Pattern (no React)

```typescript
import { describe, it, expect } from "vitest";
import { dispatch } from "@webpacked-timeline/core";

it("MoveTool produces correct MOVE_CLIP transaction", () => {
  const tool = new MoveTool();
  const ctx = buildTestToolContext(makeState());

  tool.onPointerDown({ ...evt, frame: toFrame(0) }, ctx);
  tool.onPointerMove({ ...evt, frame: toFrame(50) }, ctx);
  const tx = tool.onPointerUp({ ...evt, frame: toFrame(100) }, ctx);

  expect(tx).not.toBeNull();
  const result = dispatch(ctx.state, tx!);
  expect(result.accepted).toBe(true);
  // Check invariants always:
  if (result.accepted) {
    expect(checkInvariants(result.nextState)).toEqual([]);
  }
});
```

---

## This file does NOT cover

- How ToolRouter converts DOM events → `TimelinePointerEvent` (→ `adapter/TOOL_ROUTER.md`)
- How `ProvisionalState` is rendered (→ `ui/COMPONENTS.md`)
- How snap queries work (→ `core/SNAP_INDEX.md`)

---

## Common mistakes to avoid

- Calling `dispatch()` inside `onPointerMove` — only `onPointerUp` may return a `Transaction` to dispatch
- Storing `Clip` objects on the tool instance — always read from `ctx.state` on each event
- Returning a `Transaction` from `onPointerMove` — it must return `ProvisionalState | null`

---

## NoOpTool — Concrete Reference Implementation

The canonical no-op tool. Lives in `packages/core/src/tools/registry.ts`.
Every required ITool method is explicitly implemented — no shortcuts.
Use this as a copy-paste base when scaffolding new tools.
Use this as a test double when you need a tool that does nothing.

```typescript
export const NoOpTool: ITool = {
  id: "noop" as ToolId,
  shortcutKey: "",

  getCursor: (_ctx) => "default",
  getSnapCandidateTypes: () => [],

  onPointerDown: (_evt, _ctx) => {},
  onPointerMove: (_evt, _ctx) => null,
  onPointerUp: (_evt, _ctx) => null,
  onKeyDown: (_evt, _ctx) => null,
  onKeyUp: (_evt, _ctx) => {},
  onCancel: () => {},
};
```

Rules for using NoOpTool in tests:

- Spread it to override only the methods you need to test
- Never mutate the exported constant — always spread to a new object
- Use it as the defaultTool when constructing TimelineEngine in tests

```typescript
// ✅ Correct — spread to override
const spyTool: ITool = {
  ...NoOpTool,
  id: toToolId("spy"),
  onPointerUp: (_evt, _ctx) => buildTestTransaction(),
};

// ❌ Wrong — mutates the shared constant
NoOpTool.onPointerUp = () => buildTestTransaction();
```

---

## Tool Testing Pattern

### Unit tests — test the tool in isolation, zero React

Every tool can be tested with a mock ToolContext.
No React. No engine. No router. Just the tool and a context.

```typescript
import { describe, it, expect, vi } from "vitest";
import { toFrame } from "../types/frame";
import { toToolId } from "../tools/types";
import { NoOpTool } from "../tools/registry";
import { checkInvariants } from "../validation/invariants";
import { applyTransaction } from "../engine/apply";

// Minimal mock context — override only what the tool under test uses
function createMockContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    state: createTestState(),
    snapIndex: buildSnapIndex(createTestState(), toFrame(0)),
    pixelsPerFrame: 5,
    modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    frameAtX: (x) => toFrame(Math.floor(x / 5)),
    trackAtY: (_y) => null,
    snap: (frame) => frame, // no-op snap for unit tests
    ...overrides,
  };
}

// Pattern: down → move → up → verify Transaction
it("tool produces valid transaction on pointer up", () => {
  const tool = new MyTool();
  const ctx = createMockContext();

  tool.onPointerDown(makePointerEvent({ x: 100 }), ctx);
  tool.onPointerMove(makePointerEvent({ x: 120 }), ctx);
  const tx = tool.onPointerUp(makePointerEvent({ x: 120 }), ctx);

  // 1. Transaction must exist
  expect(tx).not.toBeNull();

  // 2. Applying it must produce zero invariant violations — always
  const nextState = applyTransaction(ctx.state, tx!);
  expect(checkInvariants(nextState)).toHaveLength(0);
});
```

### CRITICAL RULE

Every tool test that produces a Transaction MUST run:

```typescript
expect(checkInvariants(applyTransaction(state, tx!))).toHaveLength(0);
```

This is not optional. A Transaction that passes the Dispatcher in
isolation can still produce invalid state when applied to edge-case
fixtures. The InvariantChecker is the proof of correctness.

### Integration tests — test through the router with flushRaf()

When testing drag behavior that goes through ToolRouter, the rAF
throttle must be flushed synchronously. Use this helper pattern:

```typescript
// In your test setup file or at the top of integration test files

let rafCallbacks: FrameRequestCallback[] = [];

function setupFakeRaf() {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length; // fake handle
  });
}

function flushRaf() {
  const toRun = [...rafCallbacks];
  rafCallbacks = [];
  toRun.forEach((cb) => cb(performance.now()));
}

function clearRaf() {
  rafCallbacks = [];
}
```

Usage in integration tests:

```typescript
beforeEach(() => {
  setupFakeRaf();
});

afterEach(() => {
  clearRaf();
  vi.unstubAllGlobals();
});

it("drag move is throttled to one engine call per frame", () => {
  const router = createToolRouter(engine, () => testLayout);

  // Fire 10 moves without flushing — all queued, none executed
  for (let i = 0; i < 10; i++) {
    router.onPointerMove(makePointerEvent({ x: i * 10 }));
  }
  expect(engineSpy.handlePointerMove).not.toHaveBeenCalled();

  // Flush one frame — exactly one call with the most recent event
  flushRaf();
  expect(engineSpy.handlePointerMove).toHaveBeenCalledOnce();
  expect(engineSpy.handlePointerMove).toHaveBeenCalledWith(
    expect.objectContaining({ x: 90 }), // most recent event
    expect.any(Object),
  );
});
```

### Tool test file location convention

```
packages/core/src/tests/tools/
  selection.test.ts    ← unit tests, zero React
  razor.test.ts
  ripple-trim.test.ts
  ...
packages/react/src/tests/
  tool-router.test.ts  ← integration tests using flushRaf()
```

Unit tests live in core. Integration tests live in react.
A tool test that imports anything from `@webpacked-timeline/react` is wrong.

---

## Tool-specific public API methods

Tools may expose additional public methods beyond the `ITool` interface for UI configuration.
Examples: `setPendingInsert()` on `RippleInsertTool`, `setScrollCallback()` on `HandTool`.

Rules:

- **Mid-drag guard required:** Methods that mutate pending-insert/callback state must guard
  against mid-drag calls: `if (this.isDragging) return`. Without the guard, async React state
  updates can fire these methods mid-drag—causing ghost and Transaction to be built from
  different configurations (silent corruption).
- **Configuration, not drag state:** These vars should NOT be reset in `onCancel()`.
  They are registered once (e.g., at component mount) and persist across drags.
  Only the drag-tracking vars (`isDragging`, `lastX`, etc.) belong in `onCancel()`.
- **Document as "call before drag begins":** Add a JSDoc comment to each such method.

```typescript
// ✅ Correct — guards mid-drag, preserves across cancels
setPendingInsert(asset: Asset, mediaIn: TimelineFrame, mediaOut: TimelineFrame): void {
  if (this.isDragging) return;   // mid-drag guard
  this.pendingAsset   = asset;
  this.pendingMediaIn  = mediaIn;
  this.pendingMediaOut = mediaOut;
}

onCancel(): void {
  // Reset drag vars only — pendingAsset intentionally NOT cleared here
  this.isDragging = false;
  this.lastX      = 0;
}
```
