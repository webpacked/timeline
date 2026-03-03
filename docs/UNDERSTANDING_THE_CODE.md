# Understanding the code

A short guide to how this repo is structured and how to read it.

---

## 1. Repo at a glance

- **Monorepo** (pnpm workspaces + Turbo). Three main packages:
  - **`packages/core`** — Timeline kernel: state, dispatch, operations, tools, snap. No React/DOM.
  - **`packages/react`** — Adapter: `TimelineProvider`, hooks (`useTimeline`, `useClip`, …), tool router. Imports `@timeline/core` + React.
  - **`packages/ui`** — Components: `<Timeline>`, `<Clip>`, etc. Imports `@timeline/react` and `@timeline/core`.

- **Rule:** Lower layers never import from higher layers. Core is the foundation.

- **Commands:** From repo root: `pnpm install`, `pnpm build`, `pnpm test`. Per-package: `pnpm --filter @timeline/core test`, etc.

---

## 2. Where to start reading

### If you want to see “how does one edit get applied?”

1. **Entry point for mutation:**  
   `packages/core/src/engine/dispatcher.ts`  
   - Single function: `dispatch(state, transaction)`.  
   - Read the file top to bottom; it’s short. It: validates each op against *rolling* state, applies each op, runs `checkInvariants`, then returns `nextState` with version bumped.

2. **What gets applied:**  
   `packages/core/src/engine/apply.ts`  
   - `applyOperation(state, op)` — one big `switch (op.type)` that returns a new state. No validation here; that’s in validators.

3. **What is a “transaction”:**  
   `packages/core/src/types/operations.ts`  
   - `Transaction`: `{ id, label, timestamp, operations: OperationPrimitive[] }`.  
   - `OperationPrimitive`: discriminated union (`MOVE_CLIP`, `RESIZE_CLIP`, `INSERT_CLIP`, …).  
   - So: “one edit” = one `Transaction` (often one op; tools like Ripple emit multiple ops in one transaction).

4. **Who produces transactions:**  
   Tools. Example: `packages/core/src/tools/slip.ts` — `onPointerUp` returns a `Transaction` with a single `SET_MEDIA_BOUNDS` op.  
   Another: `packages/core/src/tools/ripple-delete.ts` — builds `DELETE_CLIP` + several `MOVE_CLIP` ops.

**Trace path:** Tool `onPointerUp` → returns `Transaction` → adapter calls `dispatch(state, transaction)` → `dispatcher.ts` → `validateOperation` (validators.ts) + `applyOperation` (apply.ts) + `checkInvariants` (invariants.ts) → `nextState`.

---

### If you want to see “what is the state?”

1. **State shape:**  
   `packages/core/src/types/state.ts`  
   - `TimelineState`: `{ schemaVersion, timeline, assetRegistry }`.

2. **Timeline and tracks:**  
   `packages/core/src/types/timeline.ts` — `Timeline` (fps, duration, tracks, version).  
   `packages/core/src/types/track.ts` — `Track` (id, name, type, clips[], locked, …).  
   `packages/core/src/types/clip.ts` — `Clip` (timelineStart/End, mediaIn/Out, assetId, trackId, …).

3. **Assets:**  
   `packages/core/src/types/asset.ts` — `Asset`; registry is `ReadonlyMap<AssetId, Asset>`.

4. **Frames:**  
   `packages/core/src/types/frame.ts` — `TimelineFrame` (branded number), `FrameRate`, `toFrame()`. All positions in the engine use `TimelineFrame`, never raw `number`.

So: “the code” for “what is the state” lives in `packages/core/src/types/`.

---

### If you want to see “how do tools work?”

1. **Contract:**  
   `packages/core/src/tools/types.ts`  
   - `ITool`: `onPointerDown`, `onPointerMove` (returns `ProvisionalState | null` — ghost), `onPointerUp` (returns `Transaction | null`).  
   - `ToolContext`: state, snapIndex, pixelsPerFrame, frameAtX, trackAtY, snap().  
   - Rule: `onPointerMove` never calls dispatch; only `onPointerUp` returns a transaction.

2. **Registry and default:**  
   `packages/core/src/tools/registry.ts`  
   - `createRegistry(tools, defaultId)`, `activateTool(registry, id)` (calls outgoing tool’s `onCancel()`), `NoOpTool`.

3. **One simple tool:**  
   `packages/core/src/tools/slip.ts` — Slip = change media in/out without moving timeline range; only `SET_MEDIA_BOUNDS`.  
   Then try: `packages/core/src/tools/selection.ts` (selection + move), or `packages/core/src/tools/razor.ts` (slice = DELETE + two INSERTs).

4. **How the adapter wires tools:**  
   `packages/react/src/tool-router.ts` — turns DOM events into `TimelinePointerEvent` / `TimelineKeyEvent`, calls active tool, applies provisional state or commits transaction via engine.

So: “how tools work” = `core/tools/types.ts` (contract) → any `core/tools/*.ts` (implementation) → `react/tool-router.ts` (wiring).

---

### If you want to see “how does undo/redo work?”

- **History lives outside dispatch.**  
  `packages/core/src/engine/history.ts`  
  - `HistoryState`: `{ past, present, future, limit }`.  
  - `pushHistory(history, newState)` — present goes to past, newState becomes present, future cleared.  
  - `undo` / `redo` move between past/present/future.  
  - The *caller* (e.g. TimelineEngine or React adapter) does: if `dispatch` accepted, then `pushHistory(history, result.nextState)`.

- **Engine usage:**  
  `packages/core/src/engine/timeline-engine.ts` — holds `HistoryState`, subscribes listeners, and (in the legacy path) pushes state after each operation. So “where is history used” is in that class and in whatever calls `dispatch` and then pushes.

---

### If you want to see “how does snapping work?”

- **Snap index:**  
  `packages/core/src/snap-index.ts`  
  - `buildSnapIndex(state, playheadFrame)` — collects clip start/end and playhead into a sorted list of `SnapPoint`.  
  - `nearest(index, frame, radiusFrames, exclude?, allowedTypes?)` — returns best snap within radius.  
  - Rule: index is built *after* an accepted dispatch (e.g. `queueMicrotask`), never during a drag.  
- **Tools use it via `ToolContext.snap(frame, exclude?, allowedTypes?)`** — the adapter builds the index and passes a `snap` function so tools don’t deal with radius or enabled flag.

---

## 3. Layer summary

| Layer   | Purpose                         | Key files / concepts                          |
|--------|----------------------------------|-----------------------------------------------|
| **core** | State, dispatch, operations, tools, snap | `dispatcher`, `apply`, `types/*`, `tools/*`, `snap-index` |
| **react** | State subscription, hooks, tool router   | `TimelineProvider`, `useTimeline` / `useClip` / `useEngine`, `tool-router` |
| **ui**    | Rendering timeline and clips     | `Timeline`, `Clip`, layout and hit-test       |

So: “understanding the code” by layer = core (data + rules), react (glue + events), ui (pixels).

---

## 4. Deep dives (docs in repo)

- **Architecture and rules:**  
  `.claude/skills/ARCHITECTURE.md` — three-layer law, single mutation, immutability, time types.

- **Full HLD/LLD and mind maps:**  
  `packages/core/docs/ARCHITECTURE_HLD_LLD.md` — high/low-level design, module list, text + Mermaid mind map.  
  `packages/core/docs/MINDMAP.md` — Mermaid-only mind maps and flow diagrams.

- **Dispatcher and validation:**  
  `.claude/skills/core/DISPATCHER.md` — exact dispatch algorithm, MOVE_CLIP ordering.  
  `.claude/skills/core/OPERATIONS.md` — each primitive, validators, compound patterns.  
  `.claude/skills/core/INVARIANTS.md` — the nine invariant checks.

- **Tools:**  
  `.claude/skills/tools/ITOOL_CONTRACT.md` — ITool contract, capture-before-reset, testing.

- **Types:**  
  `.claude/skills/core/TYPES.md` — canonical type definitions.

---

## 5. Quick reference: one edit end-to-end

1. User drags a clip (e.g. Slip tool).  
2. **UI** sends pointer events to **React** `ToolRouter`.  
3. **ToolRouter** converts to `TimelinePointerEvent`, calls **active tool** (`SlipTool`).  
4. On move: tool returns **ProvisionalState** (ghost); UI shows it.  
5. On up: tool returns **Transaction** (e.g. one `SET_MEDIA_BOUNDS`).  
6. Adapter calls **`dispatch(engine.getState(), transaction)`** in core.  
7. **Dispatcher** validates, applies, checks invariants; returns **`{ accepted, nextState }`**.  
8. Adapter pushes **nextState** into **history** and updates engine state.  
9. **Snap index** is rebuilt (e.g. next microtask).  
10. **Subscribers** (e.g. React) re-render from new state.

So: “understand the code” along one edit = follow from UI → tool → transaction → dispatch → state → history → UI.

---

## 6. Tests as a guide

- **Core:**  
  `packages/core/src/__tests__/` — e.g. `dispatcher.test.ts`, `invariants.test.ts`, `history.test.ts`; `tools/` for each tool. Tests show how to build state, build transactions, and assert on `dispatch` and `checkInvariants`.

- **React:**  
  `packages/react/src/__tests__/` — provider, hooks, tool-router. Good for seeing how the adapter uses core.

Reading the tests for “dispatch” and “one tool” (e.g. Slip or Selection) gives a concrete picture of how the code is used and what it guarantees.
