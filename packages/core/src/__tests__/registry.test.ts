/**
 * TOOL REGISTRY TESTS — Phase 1
 *
 * Gate conditions:
 * ✓ createRegistry: builds registry with correct active tool
 * ✓ createRegistry: throws on unknown defaultId
 * ✓ activateTool: switches activeToolId
 * ✓ activateTool: calls onCancel() on the OUTGOING tool
 * ✓ activateTool: throws on unknown id
 * ✓ getActiveTool: returns correct tool
 * ✓ registerTool: adds new tool, does not change activeToolId
 * ✓ registerTool: replaces existing tool with same id
 * ✓ All functions are pure (original registry never mutated)
 * ✓ NoOpTool satisfies ITool interface
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createRegistry,
  activateTool,
  getActiveTool,
  registerTool,
  NoOpTool,
  type ToolRegistry,
} from '../tools/registry';
import type { ITool, ToolContext, TimelinePointerEvent, TimelineKeyEvent } from '../tools/types';
import { toToolId } from '../tools/types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Clone NoOpTool with a different id for testing */
function makeTool(id: string): ITool {
  return { ...NoOpTool, id: toToolId(id) };
}

const toolA = makeTool('tool-a');
const toolB = makeTool('tool-b');
const toolC = makeTool('tool-c');

// ── createRegistry ────────────────────────────────────────────────────────────

describe('createRegistry', () => {
  it('creates a registry with the correct active tool', () => {
    const reg = createRegistry([toolA, toolB], toToolId('tool-a'));
    expect(reg.activeToolId).toBe('tool-a');
    expect(reg.tools.size).toBe(2);
  });

  it('indexes tools by id', () => {
    const reg = createRegistry([toolA, toolB], toToolId('tool-a'));
    expect(reg.tools.has(toToolId('tool-a'))).toBe(true);
    expect(reg.tools.has(toToolId('tool-b'))).toBe(true);
  });

  it('throws if defaultId is not in the tools array', () => {
    expect(() =>
      createRegistry([toolA], toToolId('tool-b'))
    ).toThrow('tool-b');
  });

  it('throws on empty tools array with any defaultId', () => {
    expect(() =>
      createRegistry([], toToolId('x'))
    ).toThrow();
  });
});

// ── activateTool ──────────────────────────────────────────────────────────────

describe('activateTool', () => {
  it('returns a new registry with activeToolId updated', () => {
    const reg = createRegistry([toolA, toolB], toToolId('tool-a'));
    const next = activateTool(reg, toToolId('tool-b'));
    expect(next.activeToolId).toBe('tool-b');
  });

  it('does NOT mutate the original registry', () => {
    const reg = createRegistry([toolA, toolB], toToolId('tool-a'));
    activateTool(reg, toToolId('tool-b'));
    expect(reg.activeToolId).toBe('tool-a'); // unchanged
  });

  it('tools map reference is preserved (same tools, same map entries)', () => {
    const reg = createRegistry([toolA, toolB], toToolId('tool-a'));
    const next = activateTool(reg, toToolId('tool-b'));
    expect(next.tools).toBe(reg.tools); // same map reference — no copy needed
  });

  it('calls onCancel() on the OUTGOING tool when switching', () => {
    const cancelSpy = vi.fn();
    const spyTool: ITool = { ...NoOpTool, id: toToolId('spy'), onCancel: cancelSpy };
    const reg = createRegistry([NoOpTool, spyTool], toToolId('spy'));

    activateTool(reg, toToolId('noop'));

    expect(cancelSpy).toHaveBeenCalledOnce();
  });

  it('does NOT call onCancel on the incoming tool', () => {
    const cancelSpy = vi.fn();
    const incomingTool: ITool = { ...NoOpTool, id: toToolId('incoming'), onCancel: cancelSpy };
    const reg = createRegistry([toolA, incomingTool], toToolId('tool-a'));

    activateTool(reg, toToolId('incoming'));

    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it('calls onCancel on outgoing even when switching to the same tool', () => {
    // Switching tool-a → tool-a should still cancel (handles re-activation)
    const cancelSpy = vi.fn();
    const selfSwitchTool: ITool = { ...NoOpTool, id: toToolId('self'), onCancel: cancelSpy };
    const reg = createRegistry([selfSwitchTool], toToolId('self'));

    activateTool(reg, toToolId('self'));

    expect(cancelSpy).toHaveBeenCalledOnce();
  });

  it('throws if id is not in the registry', () => {
    const reg = createRegistry([toolA], toToolId('tool-a'));
    expect(() =>
      activateTool(reg, toToolId('nonexistent'))
    ).toThrow('nonexistent');
  });

  it('throws AFTER calling onCancel on the outgoing tool', () => {
    // onCancel must fire even if the incoming id is invalid
    const cancelSpy = vi.fn();
    const spyTool: ITool = { ...NoOpTool, id: toToolId('spy2'), onCancel: cancelSpy };
    const reg = createRegistry([spyTool], toToolId('spy2'));

    expect(() => activateTool(reg, toToolId('bad-id'))).toThrow();
    expect(cancelSpy).toHaveBeenCalledOnce(); // onCancel fired before the throw
  });
});

// ── getActiveTool ─────────────────────────────────────────────────────────────

describe('getActiveTool', () => {
  it('returns the tool matching activeToolId', () => {
    const reg = createRegistry([toolA, toolB], toToolId('tool-b'));
    expect(getActiveTool(reg).id).toBe('tool-b');
  });

  it('returns the same object reference as in the map', () => {
    const reg = createRegistry([toolA, toolB], toToolId('tool-a'));
    expect(getActiveTool(reg)).toBe(toolA);
  });
});

// ── registerTool ──────────────────────────────────────────────────────────────

describe('registerTool', () => {
  it('adds a new tool to the registry', () => {
    const reg = createRegistry([toolA], toToolId('tool-a'));
    const next = registerTool(reg, toolC);
    expect(next.tools.has(toToolId('tool-c'))).toBe(true);
    expect(next.tools.size).toBe(2);
  });

  it('does not change activeToolId', () => {
    const reg = createRegistry([toolA], toToolId('tool-a'));
    const next = registerTool(reg, toolC);
    expect(next.activeToolId).toBe('tool-a');
  });

  it('replaces an existing tool with the same id', () => {
    const reg = createRegistry([toolA], toToolId('tool-a'));
    const replacedA: ITool = { ...NoOpTool, id: toToolId('tool-a'), shortcutKey: 'x' };
    const next = registerTool(reg, replacedA);
    expect(next.tools.size).toBe(1); // no duplicate
    expect(next.tools.get(toToolId('tool-a'))!.shortcutKey).toBe('x');
  });

  it('does NOT mutate the original registry', () => {
    const reg = createRegistry([toolA], toToolId('tool-a'));
    registerTool(reg, toolC);
    expect(reg.tools.has(toToolId('tool-c'))).toBe(false);
  });
});

// ── NoOpTool ──────────────────────────────────────────────────────────────────

describe('NoOpTool', () => {
  it('has id "noop"', () => {
    expect(NoOpTool.id).toBe('noop');
  });

  it('getCursor returns "default"', () => {
    expect(NoOpTool.getCursor({} as ToolContext)).toBe('default');
  });

  it('getSnapCandidateTypes returns empty array', () => {
    expect(NoOpTool.getSnapCandidateTypes()).toEqual([]);
  });

  it('onPointerMove returns null', () => {
    const result = NoOpTool.onPointerMove(
      {} as TimelinePointerEvent,
      {} as ToolContext,
    );
    expect(result).toBeNull();
  });

  it('onPointerUp returns null', () => {
    const result = NoOpTool.onPointerUp(
      {} as TimelinePointerEvent,
      {} as ToolContext,
    );
    expect(result).toBeNull();
  });

  it('onKeyDown returns null', () => {
    const result = NoOpTool.onKeyDown(
      {} as TimelineKeyEvent,
      {} as ToolContext,
    );
    expect(result).toBeNull();
  });

  it('onCancel does not throw', () => {
    expect(() => NoOpTool.onCancel()).not.toThrow();
  });

  it('can be used as default in createRegistry', () => {
    const reg = createRegistry([NoOpTool], toToolId('noop'));
    expect(getActiveTool(reg).id).toBe('noop');
  });
});
