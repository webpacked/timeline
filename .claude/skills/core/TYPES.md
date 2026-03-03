> **Load this file when:** Touching `packages/core/src/types/` or any file that defines or references core data shapes.
> **Do NOT load this file when:** Writing UI components, hooks, or tool implementations (load `DISPATCHER.md`, `HOOKS.md`, or `ITOOL_CONTRACT.md` instead).

---

# TYPES — Canonical Type Definitions (Source of Truth)

**If a type here conflicts with the codebase, the codebase is wrong.**

---

## Time & Frame Types

```typescript
// Branded integer — ALL frame positions in the engine
type TimelineFrame = number & { readonly __brand: "TimelineFrame" };

// Exact literal union — NO floating-point approximations allowed
type FrameRate = 23.976 | 24 | 25 | 29.97 | 30 | 50 | 59.94 | 60;

// Ingest/export boundary only — never use in edit operation arithmetic
type RationalTime = { readonly value: number; readonly rate: FrameRate };

// Display only — never use in arithmetic
type Timecode = string & { readonly __brand: "Timecode" };

// Audio boundary type
type AudioSampleIndex = number & { readonly __brand: "AudioSampleIndex" };

// Helpers
const FrameRates = {
  NTSC: 29.97,
  PAL: 25,
  NTSC_DF: 23.976,
  CINEMA: 24,
  P30: 30,
} as const;
function toFrame(n: number): TimelineFrame;
function toTimecode(s: string): Timecode;
function isDropFrame(fps: FrameRate): boolean;
```

---

## Branded ID Types

```typescript
type AssetId = string & { readonly __brand: "AssetId" };
type ClipId = string & { readonly __brand: "ClipId" };
type TrackId = string & { readonly __brand: "TrackId" };
type MarkerId = string & { readonly __brand: "MarkerId" };
type ToolId = string & { readonly __brand: "ToolId" };

function toAssetId(s: string): AssetId;
function toClipId(s: string): ClipId;
function toTrackId(s: string): TrackId;
```

---

## Enums & Unions

```typescript
type AssetStatus = "online" | "offline" | "proxy-only" | "missing";
type TrackType = "video" | "audio" | "subtitle" | "title";
type RetimingMode = "ripple" | "slip" | "none";
```

---

## Data Models

```typescript
type Asset = {
  readonly id: AssetId;
  readonly name: string;
  readonly mediaType: TrackType;
  readonly filePath: string;
  readonly intrinsicDuration: TimelineFrame;
  readonly nativeFps: FrameRate;
  readonly sourceTimecodeOffset: TimelineFrame;
  readonly status: AssetStatus; // default: 'online'
};

type Clip = {
  readonly id: ClipId;
  readonly assetId: AssetId;
  readonly trackId: TrackId;
  readonly timelineStart: TimelineFrame;
  readonly timelineEnd: TimelineFrame;
  readonly mediaIn: TimelineFrame;
  readonly mediaOut: TimelineFrame;
  readonly speed: number; // default: 1.0, must be > 0
  readonly enabled: boolean; // default: true
  readonly reversed: boolean; // default: false
  readonly name: string | null;
  readonly color: string | null;
  readonly metadata: Record<string, string>;
};

type Track = {
  readonly id: TrackId;
  readonly name: string;
  readonly type: TrackType;
  readonly clips: readonly Clip[]; // always sorted by timelineStart
  readonly locked: boolean;
  readonly muted: boolean;
  readonly solo: boolean;
  readonly height: number;
};

type SequenceSettings = {
  readonly frameSize: { readonly width: number; readonly height: number };
  readonly sampleRate: number;
  readonly pixelAspect: number;
};

type Timeline = {
  readonly id: string;
  readonly name: string;
  readonly fps: FrameRate;
  readonly duration: TimelineFrame;
  readonly startTimecode: Timecode;
  readonly tracks: readonly Track[];
  readonly sequenceSettings: SequenceSettings | null;
  readonly version: number; // bumped +1 per committed Transaction
};

// ─── State ───────────────────────────────────────────────────────────────────

type AssetRegistry = ReadonlyMap<AssetId, Asset>;

type TimelineState = {
  readonly timeline: Timeline;
  readonly assetRegistry: AssetRegistry;
};
```

---

## Operations, Transaction & DispatchResult

```typescript
type OperationPrimitive =
  // Clip ops
  | {
      type: "MOVE_CLIP";
      clipId: ClipId;
      newTimelineStart: TimelineFrame;
      targetTrackId?: TrackId;
    }
  | {
      type: "RESIZE_CLIP";
      clipId: ClipId;
      edge: "start" | "end";
      newFrame: TimelineFrame;
    }
  | { type: "SLICE_CLIP"; clipId: ClipId; atFrame: TimelineFrame }
  | { type: "DELETE_CLIP"; clipId: ClipId }
  | { type: "INSERT_CLIP"; clip: Clip; trackId: TrackId }
  | {
      type: "SET_MEDIA_BOUNDS";
      clipId: ClipId;
      mediaIn: TimelineFrame;
      mediaOut: TimelineFrame;
    }
  | { type: "SET_CLIP_ENABLED"; clipId: ClipId; enabled: boolean }
  | { type: "SET_CLIP_REVERSED"; clipId: ClipId; reversed: boolean }
  | { type: "SET_CLIP_SPEED"; clipId: ClipId; speed: number }
  | { type: "SET_CLIP_COLOR"; clipId: ClipId; color: string | null }
  | { type: "SET_CLIP_NAME"; clipId: ClipId; name: string | null }
  // Track ops
  | { type: "ADD_TRACK"; track: Track }
  | { type: "DELETE_TRACK"; trackId: TrackId }
  | { type: "REORDER_TRACK"; trackId: TrackId; newIndex: number }
  | { type: "SET_TRACK_HEIGHT"; trackId: TrackId; height: number }
  | { type: "SET_TRACK_NAME"; trackId: TrackId; name: string }
  // Asset ops
  | { type: "REGISTER_ASSET"; asset: Asset }
  | { type: "UNREGISTER_ASSET"; assetId: AssetId }
  | { type: "SET_ASSET_STATUS"; assetId: AssetId; status: AssetStatus }
  // Timeline ops
  | { type: "RENAME_TIMELINE"; name: string }
  | { type: "SET_TIMELINE_DURATION"; duration: TimelineFrame }
  | { type: "SET_TIMELINE_START_TC"; startTimecode: Timecode }
  | { type: "SET_SEQUENCE_SETTINGS"; settings: Partial<SequenceSettings> };

type Transaction = {
  readonly id: string;
  readonly label: string;
  readonly timestamp: number;
  readonly operations: readonly OperationPrimitive[];
};

type RejectionReason =
  | "OVERLAP"
  | "LOCKED_TRACK"
  | "ASSET_MISSING"
  | "TYPE_MISMATCH"
  | "OUT_OF_BOUNDS"
  | "MEDIA_BOUNDS_INVALID"
  | "ASSET_IN_USE"
  | "TRACK_NOT_EMPTY"
  | "SPEED_INVALID"
  | "INVARIANT_VIOLATED";

type DispatchResult =
  | { accepted: true; nextState: TimelineState }
  | { accepted: false; reason: RejectionReason; message: string };
```

---

## InvariantViolation & HistoryStack

```typescript
type ViolationType =
  | "OVERLAP"
  | "MEDIA_BOUNDS_INVALID"
  | "ASSET_MISSING"
  | "TRACK_TYPE_MISMATCH"
  | "CLIP_BEYOND_TIMELINE"
  | "TRACK_NOT_SORTED"
  | "DURATION_MISMATCH"
  | "SPEED_INVALID";

type InvariantViolation = {
  readonly type: ViolationType;
  readonly entityId: string;
  readonly message: string;
};

type HistoryStack = {
  readonly past: readonly TimelineState[];
  readonly present: TimelineState;
  readonly future: readonly TimelineState[];
  readonly limit: number;
};
```

---

## This file does NOT cover

- How dispatch uses these types (→ `core/DISPATCHER.md`)
- Validation rules per operation (→ `core/OPERATIONS.md`)
- How React hooks consume these types (→ `adapter/HOOKS.md`)

---

## Common mistakes to avoid

- Using `number` for a frame position instead of `TimelineFrame`
- Adding fields to `TimelineState` that belong in Phase 2 (`markers`, `workArea`, `linkGroups`, `groups`)
- Using `asset.type` or `asset.duration` — the correct fields are `asset.mediaType` and `asset.intrinsicDuration`
