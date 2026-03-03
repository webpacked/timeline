/**
 * ZoomTool Tests — Phase 7 Step 5
 *
 * 11. onPointerDown captures dragStartX and dragStartZoom
 * 12. onPointerMove right calls onZoomChange with increased zoom
 * 13. onPointerMove left calls onZoomChange with decreased zoom
 * 14. onZoomChange value is clamped to max
 * 15. onZoomChange value is clamped to min
 * 16. onPointerUp resets drag state
 * 17. '+' key calls onZoomChange with 1.25x current
 * 18. '-' key calls onZoomChange with 0.8x current
 * 19. '0' key resets to initialPixelsPerFrame
 * 20. onCancel resets drag state
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ZoomTool, createZoomTool } from '../../tools/zoom-tool';
import type { ToolContext, TimelinePointerEvent, TimelineKeyEvent } from '../../tools/types';

function makeCtx(pixelsPerFrame: number): ToolContext {
  return {
    state: {} as ToolContext['state'],
    snapIndex: {} as ToolContext['snapIndex'],
    pixelsPerFrame,
    modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    frameAtX: () => ({} as ToolContext['frameAtX'] extends (x: number) => infer R ? R : never),
    trackAtY: () => null,
    snap: (f) => f,
  };
}

function makePointerEv(x: number): TimelinePointerEvent {
  return {
    frame: {} as TimelinePointerEvent['frame'],
    trackId: null,
    clipId: null,
    x,
    y: 0,
    buttons: 1,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  };
}

function makeKeyEv(key: string): TimelineKeyEvent {
  return {
    key,
    code: key === '=' ? 'Equal' : key === '0' ? 'Digit0' : key,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
  };
}

describe('ZoomTool — onPointerDown captures dragStartX and dragStartZoom', () => {
  it('after pointerDown, pointerMove right increases zoom from start value', () => {
    const onZoomChange = vi.fn();
    const tool = new ZoomTool({ onZoomChange, initialPixelsPerFrame: 10 });
    const ctx = makeCtx(10);
    tool.onPointerDown(makePointerEv(100), ctx);
    tool.onPointerMove(makePointerEv(150), ctx);
    expect(onZoomChange).toHaveBeenCalled();
    const lastCall = onZoomChange.mock.calls[onZoomChange.mock.calls.length - 1]![0];
    expect(lastCall).toBeGreaterThan(10);
  });
});

describe('ZoomTool — onPointerMove right calls onZoomChange with increased zoom', () => {
  it('drag right yields zoom > dragStartZoom', () => {
    const onZoomChange = vi.fn();
    const tool = new ZoomTool({ onZoomChange });
    const ctx = makeCtx(10);
    tool.onPointerDown(makePointerEv(0), ctx);
    tool.onPointerMove(makePointerEv(50), ctx);
    expect(onZoomChange).toHaveBeenCalledWith(expect.any(Number));
    expect(onZoomChange.mock.calls[0]![0]).toBeGreaterThan(10);
  });
});

describe('ZoomTool — onPointerMove left calls onZoomChange with decreased zoom', () => {
  it('drag left yields zoom < dragStartZoom', () => {
    const onZoomChange = vi.fn();
    const tool = new ZoomTool({ onZoomChange });
    const ctx = makeCtx(10);
    tool.onPointerDown(makePointerEv(100), ctx);
    tool.onPointerMove(makePointerEv(50), ctx);
    expect(onZoomChange).toHaveBeenCalledWith(expect.any(Number));
    expect(onZoomChange.mock.calls[0]![0]).toBeLessThan(10);
  });
});

describe('ZoomTool — onZoomChange value is clamped to max', () => {
  it('drag far right does not exceed maxPixelsPerFrame', () => {
    const onZoomChange = vi.fn();
    const tool = new ZoomTool({
      onZoomChange,
      maxPixelsPerFrame: 20,
      initialPixelsPerFrame: 10,
    });
    const ctx = makeCtx(10);
    tool.onPointerDown(makePointerEv(0), ctx);
    tool.onPointerMove(makePointerEv(500), ctx);
    const calls = onZoomChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach(([value]) => expect(value).toBeLessThanOrEqual(20));
  });
});

describe('ZoomTool — onZoomChange value is clamped to min', () => {
  it('drag far left does not go below minPixelsPerFrame', () => {
    const onZoomChange = vi.fn();
    const tool = new ZoomTool({
      onZoomChange,
      minPixelsPerFrame: 2,
      initialPixelsPerFrame: 10,
    });
    const ctx = makeCtx(10);
    tool.onPointerDown(makePointerEv(0), ctx);
    tool.onPointerMove(makePointerEv(-500), ctx);
    const calls = onZoomChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach(([value]) => expect(value).toBeGreaterThanOrEqual(2));
  });
});

describe('ZoomTool — onPointerUp resets drag state', () => {
  it('after pointerUp, pointerMove uses new ctx.pixelsPerFrame (no accumulated delta)', () => {
    const onZoomChange = vi.fn();
    const tool = new ZoomTool({ onZoomChange });
    const ctx10 = makeCtx(10);
    const ctx20 = makeCtx(20);
    tool.onPointerDown(makePointerEv(0), ctx10);
    tool.onPointerUp(makePointerEv(100), ctx10);
    tool.onPointerDown(makePointerEv(0), ctx20);
    tool.onPointerMove(makePointerEv(10), ctx20);
    const lastCall = onZoomChange.mock.calls[onZoomChange.mock.calls.length - 1]![0];
    expect(lastCall).toBeGreaterThan(20);
  });
});

describe('ZoomTool — "+" key calls onZoomChange with 1.25x current', () => {
  it('key "+" zooms in by 1.25x', () => {
    const onZoomChange = vi.fn();
    const tool = new ZoomTool({ onZoomChange });
    const ctx = makeCtx(10);
    tool.onKeyDown(makeKeyEv('+'), ctx);
    expect(onZoomChange).toHaveBeenCalledWith(12.5);
  });
});

describe('ZoomTool — "-" key calls onZoomChange with 0.8x current', () => {
  it('key "-" zooms out by 0.8x', () => {
    const onZoomChange = vi.fn();
    const tool = new ZoomTool({ onZoomChange });
    const ctx = makeCtx(10);
    tool.onKeyDown(makeKeyEv('-'), ctx);
    expect(onZoomChange).toHaveBeenCalledWith(8);
  });
});

describe('ZoomTool — "0" key resets to initialPixelsPerFrame', () => {
  it('key "0" calls onZoomChange with initialPixelsPerFrame', () => {
    const onZoomChange = vi.fn();
    const tool = new ZoomTool({
      onZoomChange,
      initialPixelsPerFrame: 15,
    });
    const ctx = makeCtx(10);
    tool.onKeyDown(makeKeyEv('0'), ctx);
    expect(onZoomChange).toHaveBeenCalledWith(15);
  });
});

describe('ZoomTool — onCancel resets drag state', () => {
  it('after onCancel, next pointerDown starts fresh', () => {
    const onZoomChange = vi.fn();
    const tool = new ZoomTool({ onZoomChange });
    const ctx = makeCtx(10);
    tool.onPointerDown(makePointerEv(0), ctx);
    tool.onCancel();
    tool.onPointerDown(makePointerEv(0), ctx);
    tool.onPointerMove(makePointerEv(10), ctx);
    expect(onZoomChange).toHaveBeenCalled();
  });
});

describe('ZoomTool — createZoomTool returns ITool', () => {
  it('createZoomTool(options) returns object with id and shortcutKey', () => {
    const onZoomChange = vi.fn();
    const tool = createZoomTool({ onZoomChange });
    expect(tool.id).toBe('zoom');
    expect(tool.shortcutKey).toBe('Z');
    expect(typeof tool.onPointerDown).toBe('function');
    expect(typeof tool.onPointerMove).toBe('function');
    expect(typeof tool.onPointerUp).toBe('function');
    expect(typeof tool.onKeyDown).toBe('function');
    expect(typeof tool.onKeyUp).toBe('function');
    expect(typeof tool.onCancel).toBe('function');
  });
});
