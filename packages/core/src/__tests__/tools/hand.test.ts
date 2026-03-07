/**
 * HandTool Tests — Phase 2 Step 8
 *
 * Covers all items from the approved test plan:
 *   □ Drag sequence: down → move → move → up → callback called twice with correct deltas
 *   □ Incremental delta: each delta is event-to-event, not from startX
 *   □ No callback registered: drag completes silently, no error
 *   □ onPointerUp returns null always
 *   □ onKeyDown returns null always
 *   □ onPointerMove returns null always (never ProvisionalState)
 *   □ getCursor returns 'grabbing' mid-drag, 'grab' otherwise
 *   □ onCancel resets isDragging — subsequent move after cancel fires no callback
 *   □ setScrollCallback(null) unregisters — subsequent drag fires no callback
 *
 * HandTool has no TimelineState effects — no dispatch, no checkInvariants needed.
 * Zero React imports.
 */

import { describe, it, expect, vi } from 'vitest';

import { HandTool }     from '../../tools/hand';
import { toTrackId }    from '../../types/track';
import { toFrame }      from '../../types/frame';
import type { ToolContext, TimelinePointerEvent, TimelineKeyEvent } from '../../tools/types';
import type { TimelineFrame } from '../../types/frame';
import type { TrackId }       from '../../types/track';

// ── Minimal stubs ─────────────────────────────────────────────────────────────
// HandTool never reads from ToolContext — a cast stub is sufficient.
const STUB_CTX = {} as ToolContext;

function makeEv(x: number = 0, frame: TimelineFrame = toFrame(0)): TimelinePointerEvent {
  return {
    frame, x, y: 24,
    trackId:  toTrackId('track-1'),
    clipId:   null,
    buttons:  1,
    shiftKey: false, altKey: false, metaKey: false,
  };
}

function makeKeyEv(): TimelineKeyEvent {
  return { key: 'h', code: 'KeyH', shiftKey: false, altKey: false, metaKey: false, ctrlKey: false };
}

// ── Suite 1: Full drag sequence ────────────────────────────────────────────────

describe('HandTool — drag sequence: callback called with correct deltas', () => {
  it('down(x=100) → move(x=130) → move(x=160) → callback called twice with Δ=30, 30', () => {
    const tool     = new HandTool();
    const deltas: number[] = [];
    tool.setScrollCallback(dx => deltas.push(dx));

    tool.onPointerDown(makeEv(100), STUB_CTX);
    tool.onPointerMove(makeEv(130), STUB_CTX);
    tool.onPointerMove(makeEv(160), STUB_CTX);
    tool.onPointerUp(makeEv(160),   STUB_CTX);

    expect(deltas).toHaveLength(2);
    expect(deltas[0]).toBe(30);   // 130 - 100
    expect(deltas[1]).toBe(30);   // 160 - 130  ← incremental, not 60
  });

  it('incremental: second delta is event-to-event, not from startX', () => {
    const tool     = new HandTool();
    const deltas: number[] = [];
    tool.setScrollCallback(dx => deltas.push(dx));

    tool.onPointerDown(makeEv(0),   STUB_CTX);
    tool.onPointerMove(makeEv(50),  STUB_CTX);   // Δ = 50 - 0 = 50
    tool.onPointerMove(makeEv(70),  STUB_CTX);   // Δ = 70 - 50 = 20  (not 70 - 0 = 70)
    tool.onPointerMove(makeEv(100), STUB_CTX);   // Δ = 100 - 70 = 30

    expect(deltas).toEqual([50, 20, 30]);
  });
});

// ── Suite 2: No callback registered ──────────────────────────────────────────

describe('HandTool — no callback registered: silent, no error', () => {
  it('full drag completes without throwing', () => {
    const tool = new HandTool();  // no setScrollCallback()
    expect(() => {
      tool.onPointerDown(makeEv(100), STUB_CTX);
      tool.onPointerMove(makeEv(150), STUB_CTX);
      tool.onPointerUp(makeEv(150),   STUB_CTX);
    }).not.toThrow();
  });
});

// ── Suite 3: Return values ────────────────────────────────────────────────────

describe('HandTool — return values: always null', () => {
  it('onPointerUp returns null always', () => {
    const tool = new HandTool();
    tool.onPointerDown(makeEv(0), STUB_CTX);
    expect(tool.onPointerUp(makeEv(100), STUB_CTX)).toBeNull();
  });

  it('onKeyDown returns null always', () => {
    const tool = new HandTool();
    expect(tool.onKeyDown(makeKeyEv(), STUB_CTX)).toBeNull();
  });

  it('onPointerMove returns null always (never ProvisionalState)', () => {
    const tool = new HandTool();
    tool.onPointerDown(makeEv(0), STUB_CTX);
    expect(tool.onPointerMove(makeEv(50), STUB_CTX)).toBeNull();
  });
});

// ── Suite 4: getCursor ─────────────────────────────────────────────────────────

describe('HandTool — getCursor: grab/grabbing only', () => {
  it('returns grab when idle (not mid-drag)', () => {
    const tool = new HandTool();
    expect(tool.getCursor(STUB_CTX)).toBe('grab');
  });

  it('returns grabbing mid-drag', () => {
    const tool = new HandTool();
    tool.onPointerDown(makeEv(0), STUB_CTX);
    expect(tool.getCursor(STUB_CTX)).toBe('grabbing');
  });

  it('returns grab again after pointerUp', () => {
    const tool = new HandTool();
    tool.onPointerDown(makeEv(0),   STUB_CTX);
    tool.onPointerUp(makeEv(100),   STUB_CTX);
    expect(tool.getCursor(STUB_CTX)).toBe('grab');
  });
});

// ── Suite 5: onCancel resets drag ─────────────────────────────────────────────

describe('HandTool — onCancel: resets isDragging', () => {
  it('move after cancel fires no callback', () => {
    const tool     = new HandTool();
    const deltas: number[] = [];
    tool.setScrollCallback(dx => deltas.push(dx));

    tool.onPointerDown(makeEv(0),   STUB_CTX);
    tool.onPointerMove(makeEv(50),  STUB_CTX);   // fires callback once
    tool.onCancel();
    tool.onPointerMove(makeEv(100), STUB_CTX);   // should NOT fire — not dragging

    expect(deltas).toHaveLength(1);   // only the pre-cancel move
    expect(deltas[0]).toBe(50);
  });

  it('getCursor returns grab after onCancel', () => {
    const tool = new HandTool();
    tool.onPointerDown(makeEv(0), STUB_CTX);
    tool.onCancel();
    expect(tool.getCursor(STUB_CTX)).toBe('grab');
  });
});

// ── Suite 6: setScrollCallback(null) unregisters ──────────────────────────────

describe('HandTool — setScrollCallback(null): unregisters callback', () => {
  it('subsequent drag fires no callback after setScrollCallback(null)', () => {
    const tool     = new HandTool();
    const deltas: number[] = [];
    tool.setScrollCallback(dx => deltas.push(dx));

    // First drag — callback active
    tool.onPointerDown(makeEv(0),   STUB_CTX);
    tool.onPointerMove(makeEv(50),  STUB_CTX);
    tool.onPointerUp(makeEv(50),    STUB_CTX);

    // Unregister
    tool.setScrollCallback(null);

    // Second drag — no callback
    tool.onPointerDown(makeEv(50),  STUB_CTX);
    tool.onPointerMove(makeEv(100), STUB_CTX);
    tool.onPointerUp(makeEv(100),   STUB_CTX);

    expect(deltas).toHaveLength(1);   // only the first drag's move
    expect(deltas[0]).toBe(50);
  });
});

// ── Suite 7: structural ───────────────────────────────────────────────────────

describe('HandTool — structural', () => {
  it('getSnapCandidateTypes returns empty array', () => {
    expect(new HandTool().getSnapCandidateTypes()).toHaveLength(0);
  });

  it('has correct id and shortcutKey', () => {
    const tool = new HandTool();
    expect(tool.id).toBe('hand');
    expect(tool.shortcutKey).toBe('h');
  });
});
