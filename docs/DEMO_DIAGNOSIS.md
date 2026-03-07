# Demo app operations diagnosis

Reference for manual checks. Hit-testing is now implemented in the adapter (see below).

## Hit-testing fix (implemented)

- **packages/react/src/adapter/tool-router.ts**: `convertPointerEvent` walks up the DOM from `e.target` and reads `data-clip-id` / `data-track-id` from elements. It sets `clipId`, `trackId`, and optional `edge` ('left' | 'right' | 'none') for clip edge hit zone. Tools now receive correct clipId/trackId when clicking clips or track empty space.
- **packages/demo**: Track clip area has `data-track-id`; Clip already had `data-clip-id` and `data-track-id` on the outer div. Diagnostic code (window.__tl_engine, dispatch logger, handlers log) has been removed.

## How to run

1. Start the demo: `pnpm --filter @webpacked-timeline/demo-app dev`
2. Open the app in the browser and open DevTools → Console.
3. Run through the actions below and note results.
4. Run the Part 2 console commands.
5. Inspect a clip element for `data-clip-id` / `data-track-id` (Part 4).
6. After clicking/dragging a clip, check whether any `dispatch:` log appeared (Part 5).

---

## PART 1 — Console diagnosis

| # | Action | What happened | Console errors/warnings |
|---|--------|----------------|-------------------------|
| 1 | Click a clip | _e.g. no highlight_ | _none_ |
| 2 | Toolbar "Razor" → click a clip | _e.g. no split_ | |
| 3 | Toolbar "Select" → drag a clip | _e.g. no move_ | |
| 4 | Click the ruler | _e.g. playhead moves / no change_ | |
| 5 | Drag zoom slider | _e.g. clips resize_ | |
| 6 | Press Space | _e.g. play/pause or nothing_ | |
| 7 | Press ArrowRight | _e.g. step forward or nothing_ | |

---

## PART 2 — Engine in console

```js
console.log(window.__tl_engine)   // expect: engine object
window.__tl_engine.getActiveToolId()  // expect: 'selection'
window.__tl_engine.getSnapshot().activeToolId  // expect: matches above
```

Result: _e.g. engine present, getActiveToolId() returns 'selection'_

---

## PART 3 — ToolRouter handlers

From the one-time log on load:

**handlers keys:** _e.g. `['onPointerDown','onPointerMove','onPointerUp','onPointerLeave','onKeyDown']`_

The TimelineRoot div has `{...handlers}` (onPointerDown/Move/Up/Leave, onKeyDown). No other element should sit on top and block pointer events (check z-index / pointer-events in DevTools if clicks don’t reach the root).

---

## PART 4 — Clip data attributes

Right‑click a clip → Inspect. Check for:

- `data-clip-id="..."`
- `data-track-id="..."`

Result: _e.g. both present on the clip div_

---

## PART 5 — Dispatch on interaction

When you click or drag a clip, does the console show a `dispatch: ...` line?

Result: _e.g. No — dispatch is not called on clip click/drag_

---

## Root cause (why clip actions don’t work)

The demo uses `useToolRouter` from `@webpacked-timeline/react`, which is backed by the **adapter** tool router (`packages/react/src/adapter/tool-router.ts`). That adapter:

- Converts pointer events to `TimelinePointerEvent` with **frame** (from x and zoom).
- Always sets **trackId: null** and **clipId: null** (it has no layout or hit-test).

Core tools (selection, razor, slip, etc.) all depend on `event.clipId` and/or `event.trackId`. When those are null they no-op (e.g. “if (event.clipId === null) return”), so:

- Clicking a clip does not select it.
- Razor does not split.
- Select + drag does not move.

The **full** tool router in `packages/react/src/tool-router.ts` does hit-testing: it takes a `getLayout()` that returns `timelineOriginX`, `pixelsPerFrame`, and **trackLayouts** (each track’s top/height in client coords), and it populates `frame`, `trackId`, and `clipId` via `frameAtX`, `trackAtY`, and `clipAtFrame`. That implementation is **not** currently exported from `@webpacked-timeline/react` (only the adapter is). So to fix the demo:

1. **Option A**: Export the full `createToolRouter` from `@webpacked-timeline/react` (and a `useToolRouter` that uses it) and pass a `getLayout()` from the demo that computes track layouts from the DOM or from track positions (e.g. track index × track height + ruler height).
2. **Option B**: In the demo, use a local/copy of the full tool router and call it with `getLayout()` so that pointer events get correct `clipId`/`trackId` before being sent to the engine.

After wiring layout and hit-testing, clip selection, razor, and drag should work; then you can re-check Parts 1 and 5 (dispatch should be called when committing a tool action).

---

## SelectionTool and selection visual

**SelectionTool** (`packages/core/src/tools/selection.ts`) keeps selection in a private instance Set; it does not dispatch SET_SELECTION and the engine has no selection in snapshot. The demo cannot show selection highlight until the engine exposes selection (e.g. useSelection hook). Clip click and drag work; the UI just will not show which clips are selected.

## After diagnosis

- Remove or guard the `console.log('handlers:', ...)` in `timeline-root.tsx` if you don’t want it in dev.
- Remove the `window.__tl_engine` assignment and the `dispatch` wrapper in `engine.ts` when you’re done debugging.
