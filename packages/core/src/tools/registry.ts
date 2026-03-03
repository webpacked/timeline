/**
 * TOOL REGISTRY — Phase 1
 *
 * Pure functions. No classes. No React. No state mutation.
 *
 * ToolRegistry is immutable data — activateTool returns a NEW registry.
 * The active tool lives here, not on TimelineEngine, keeping the engine thin.
 *
 * RULES:
 *   - activateTool calls outgoing.onCancel() before switching
 *   - activateTool throws on unknown id (programmer error, never user error)
 *   - NoOpTool is the canonical do-nothing ITool (test double + startup default)
 */

import type {
  ITool,
  ToolId,
  ToolContext,
  TimelinePointerEvent,
  TimelineKeyEvent,
  ProvisionalState,
  SnapPointType,
} from './types';
import { toToolId } from './types';

// ---------------------------------------------------------------------------
// ToolRegistry
// ---------------------------------------------------------------------------

export type ToolRegistry = {
  readonly tools:        ReadonlyMap<ToolId, ITool>;
  readonly activeToolId: ToolId;
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Create an initial registry from an array of tools.
 *
 * @throws if defaultId is not present in the tools array
 */
export function createRegistry(
  tools:     readonly ITool[],
  defaultId: ToolId,
): ToolRegistry {
  const map = new Map<ToolId, ITool>();
  for (const tool of tools) {
    map.set(tool.id, tool);
  }
  if (!map.has(defaultId)) {
    throw new Error(
      `createRegistry: defaultId "${defaultId}" not found in tools. ` +
      `Available: [${[...map.keys()].join(', ')}]`,
    );
  }
  return { tools: map, activeToolId: defaultId };
}

/**
 * Activate a new tool.
 *
 * Steps (must run in order):
 *   1. Call outgoing tool's onCancel() — cleans up any in-progress drag state
 *   2. Validate that the new id exists in the registry
 *   3. Return a new ToolRegistry with activeToolId updated
 *
 * @throws if id is not registered
 */
export function activateTool(
  registry: ToolRegistry,
  id:       ToolId,
): ToolRegistry {
  // Step 1 — notify outgoing tool (idempotent, always safe to call)
  getActiveTool(registry).onCancel();

  // Step 2 — validate
  if (!registry.tools.has(id)) {
    throw new Error(
      `activateTool: unknown toolId "${id}". ` +
      `Registered: [${[...registry.tools.keys()].join(', ')}]`,
    );
  }

  // Step 3 — return updated registry (new object, no mutation)
  return { ...registry, activeToolId: id };
}

/**
 * Return the currently active ITool.
 * Never returns undefined — registry invariant guarantees activeToolId is registered.
 */
export function getActiveTool(registry: ToolRegistry): ITool {
  const tool = registry.tools.get(registry.activeToolId);
  if (!tool) {
    // This should never happen if createRegistry and activateTool are used correctly.
    throw new Error(
      `getActiveTool: activeToolId "${registry.activeToolId}" is not registered. ` +
      `Registry is corrupt.`,
    );
  }
  return tool;
}

/**
 * Return a new registry with the tool added.
 * If a tool with the same id already exists, it is replaced.
 * activeToolId is unchanged.
 */
export function registerTool(
  registry: ToolRegistry,
  tool:     ITool,
): ToolRegistry {
  const next = new Map(registry.tools);
  next.set(tool.id, tool);
  return { ...registry, tools: next };
}

// ---------------------------------------------------------------------------
// NoOpTool — canonical do-nothing ITool
// ---------------------------------------------------------------------------

/**
 * Satisfies ITool with no side effects.
 *
 * Use for:
 *   - Test doubles (spread and override only the methods you need)
 *   - Default active tool on engine startup
 *   - ToolRouter smoke tests
 *
 * onCancel() is a deliberate no-op: NoOpTool has no drag state to clean up.
 * Real tools will clear instance variables there.
 */
export const NoOpTool: ITool = {
  id:          toToolId('noop'),
  shortcutKey: '',

  getCursor(_ctx: ToolContext): string {
    return 'default';
  },

  getSnapCandidateTypes(): readonly SnapPointType[] {
    return [];
  },

  onPointerDown(_evt: TimelinePointerEvent, _ctx: ToolContext): void {
    // intentional no-op
  },

  onPointerMove(_evt: TimelinePointerEvent, _ctx: ToolContext): ProvisionalState | null {
    return null;
  },

  onPointerUp(_evt: TimelinePointerEvent, _ctx: ToolContext): null {
    return null;
  },

  onKeyDown(_evt: TimelineKeyEvent, _ctx: ToolContext): null {
    return null;
  },

  onKeyUp(_evt: TimelineKeyEvent, _ctx: ToolContext): void {
    // intentional no-op
  },

  onCancel(): void {
    // intentional no-op — NoOpTool has no drag state
  },
};
