# @timeline/core — Architecture Mind Map

Standalone mind map and flow diagrams. View in any Mermaid-compatible viewer (GitHub, VS Code Mermaid extension, etc.).

---

## 1. Core Mind Map (Hierarchy)

```mermaid
mindmap
  root((@timeline/core))
    RULES
      Three-layer
        core imports only stdlib + TS
        no React / DOM / UI
      Single mutation
        dispatch only
        no direct state mutation
      Immutability
        new objects only
        no push/splice/sort in place
      Time types
        TimelineFrame branded
        no raw number for frames
    STATE
      TimelineState
        schemaVersion
        timeline
        assetRegistry
      Timeline
        fps duration version
        tracks
      Track
        clips sorted by start
        locked muted solo
      Clip
        timelineStart End
        mediaIn Out
        assetId trackId
      Asset
        intrinsicDuration
        mediaType
    MUTATION
      Transaction
        operations array
        all-or-nothing
      OperationPrimitive
        Clip ops
        Track ops
        Asset ops
        Timeline ops
      dispatch
        validate per op
        apply per op
        invariants
        version bump
    ENGINE
      dispatcher
      apply
      history
      TimelineEngine
    VALIDATION
      validators
        per-op checks
      invariants
        9 checks
        no short-circuit
    TOOLS
      ITool
        Pointer Down/Move/Up
        Key Down/Up
        onCancel
      Registry
        activateTool
        NoOpTool
      Selection
      Razor Slip
      Ripple*
      RollTrim Hand
    SNAP
      SnapIndex
      buildSnapIndex
      nearest
      after dispatch only
    SYSTEMS
      queries
      asset-registry
      validation helpers
```

---

## 2. Data Flow: User → State

```mermaid
flowchart LR
  U[User / Adapter] --> T[Transaction]
  T --> D[dispatch]
  D --> V[validate]
  D --> A[apply]
  D --> I[checkInvariants]
  I --> NS[nextState]
  NS --> H[pushHistory]
  H --> S[(TimelineState)]
```

---

## 3. Tool Event → Transaction

```mermaid
flowchart TB
  E[DOM Events] --> R[ToolRouter]
  R --> C[ToolContext]
  C --> TD[onPointerDown]
  C --> TM[onPointerMove]
  C --> TU[onPointerUp]
  TM --> PS[ProvisionalState]
  TU --> TX[Transaction]
  TX --> D[dispatch]
  D --> NS[nextState]
  NS --> Q[queueMicrotask]
  Q --> SI[buildSnapIndex]
```

---

## 4. Dispatch Algorithm (Steps)

```mermaid
flowchart TD
  S[state + transaction] --> L[proposedState = state]
  L --> LOOP[for each op]
  LOOP --> V[validateOperation proposedState, op]
  V --> REJ{rejection?}
  REJ -->|yes| OUT1[return accepted: false]
  REJ -->|no| AP[proposedState = applyOperation proposedState, op]
  AP --> LOOP
  LOOP --> INV[checkInvariants proposedState]
  INV --> VIOL{violations?}
  VIOL -->|yes| OUT2[return accepted: false]
  VIOL -->|no| VER[bump timeline.version]
  VER --> OUT3[return accepted: true, nextState]
```

---

## 5. Module Ownership (Conceptual)

```mermaid
flowchart TB
  subgraph TYPES
    state[state.ts]
    ops[operations.ts]
    frame[frame.ts]
    clip[clip.ts]
    track[track.ts]
    asset[asset.ts]
    timeline[timeline.ts]
  end

  subgraph ENGINE
    dispatcher[dispatcher.ts]
    apply[apply.ts]
    history[history.ts]
    engine[timeline-engine.ts]
  end

  subgraph VALIDATION
    validators[validators.ts]
    invariants[invariants.ts]
  end

  subgraph TOOLS
    tooltypes[tools/types.ts]
    registry[tools/registry.ts]
    selection[tools/selection.ts]
    razor[tools/razor.ts]
    slip[tools/slip.ts]
    ripple[tools/ripple-*.ts]
    rolltrim[tools/roll-trim.ts]
    hand[tools/hand.ts]
  end

  dispatcher --> apply
  dispatcher --> validators
  dispatcher --> invariants
  apply --> state
  apply --> clip
  apply --> track
  validators --> state
  validators --> ops
  invariants --> state
  invariants --> clip
  tooltypes --> state
  tooltypes --> ops
  registry --> tooltypes
  snap[snap-index.ts] --> state
  snap --> frame
```

---

## 6. Operation Primitive Categories

```mermaid
mindmap
  root((OperationPrimitive))
    CLIP
      MOVE_CLIP
      RESIZE_CLIP
      SLICE_CLIP
      DELETE_CLIP
      INSERT_CLIP
      SET_MEDIA_BOUNDS
      SET_CLIP_*
    TRACK
      ADD_TRACK
      DELETE_TRACK
      REORDER_TRACK
      SET_TRACK_*
    ASSET
      REGISTER_ASSET
      UNREGISTER_ASSET
      SET_ASSET_STATUS
    TIMELINE
      RENAME_TIMELINE
      SET_TIMELINE_DURATION
      SET_TIMELINE_START_TC
      SET_SEQUENCE_SETTINGS
```

---

## 7. Invariant Checks (Order)

```mermaid
flowchart LR
  A[1. SCHEMA_VERSION] --> B[2. TRACK_NOT_SORTED]
  B --> C[3. OVERLAP]
  C --> D[4. ASSET_MISSING]
  D --> E[5. TRACK_TYPE_MISMATCH]
  E --> F[6. MEDIA_BOUNDS]
  F --> G[7. DURATION_MISMATCH]
  G --> H[8. CLIP_BEYOND_TIMELINE]
  H --> I[9. SPEED_INVALID]
```
