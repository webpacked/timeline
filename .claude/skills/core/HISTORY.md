> **Load this file when:** Touching `engine/history.ts`, implementing undo/redo in the adapter.
> **Do NOT load this file when:** Writing core operations, validators, or UI components.

---

# HISTORY — HistoryStack & Pure Functions

## Critical Rule

History lives **outside** the Dispatcher. The Dispatcher returns `nextState`. The caller (TimelineEngine adapter) decides whether to push it into history. The Dispatcher never touches `HistoryStack`.

---

## HistoryStack Type

```typescript
type HistoryStack = {
  readonly past: readonly TimelineState[]; // oldest at index 0
  readonly present: TimelineState;
  readonly future: readonly TimelineState[]; // most-recent-undone at index 0
  readonly limit: number; // max entries in past[]
};
```

---

## The Five Pure Functions

```typescript
// Create initial history — no past, no future
function createHistory(
  initialState: TimelineState,
  limit?: number,
): HistoryStack;

// Push a new state — moves present→past, clears future[]
function pushHistory(
  history: HistoryStack,
  newState: TimelineState,
): HistoryStack;

// Undo — moves present→future[0], past[last]→present
// Returns same reference if past is empty (no-op)
function undo(history: HistoryStack): HistoryStack;

// Redo — moves present→past[last], future[0]→present
// Returns same reference if future is empty (no-op)
function redo(history: HistoryStack): HistoryStack;

// Clear — empties past[] and future[], keeps present
function clearHistory(history: HistoryStack): HistoryStack;

// Helper — read present state
function getCurrentState(history: HistoryStack): TimelineState;
```

---

## Limit Eviction Rule

When `pushHistory` would cause `past.length > limit`, the **oldest** entry (index 0) is dropped:

```typescript
const pastWithPresent = [...history.past, history.present];
const trimmed =
  pastWithPresent.length > limit
    ? pastWithPresent.slice(pastWithPresent.length - limit)
    : pastWithPresent;
// trimmed becomes the new history.past
```

---

## Branch Rule (Undo then New Transaction)

Calling `pushHistory` after an `undo` **clears the future array**. This creates a new branch — the undone operations are discarded. No tree branching in Phase 0.

```typescript
// History: A → B → C, user undos to B
// future = [C]
// User makes new edit → D
pushHistory(history, D);
// Result: past=[A,B], present=D, future=[] ← C is gone
```

---

## Caller Pattern (TimelineEngine adapter)

```typescript
// In TimelineEngine.dispatch():
const result = coreDispatch(this.history.present, transaction);
if (result.accepted) {
  this.history = pushHistory(this.history, result.nextState);
  this.notify();
}
return result;
```

---

## What History Does NOT Do

- ❌ No per-operation granularity — history entries are `TimelineState` snapshots, not operation lists
- ❌ No compression (Phase 7)
- ❌ No persistence / serialization (Phase 7)
- ❌ No transaction squashing (Phase 7)

---

## This file does NOT cover

- How `dispatch()` produces `nextState` (→ `core/DISPATCHER.md`)
- How `useSyncExternalStore` reacts to history changes (→ `adapter/HOOKS.md`)

---

## Common mistakes to avoid

- Pushing into history before calling `dispatch()` — always push the ACCEPTED `nextState`, not state before dispatch
- Not clearing `future[]` on `pushHistory` — forgetting this breaks the branch rule and leaks stale futures
- Checking `canUndo` by testing `history.past.length > 0` but forgetting that `undo` on empty past returns the **same reference** — always use the `canUndo()` helper
