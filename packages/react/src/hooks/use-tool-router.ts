/**
 * useToolRouter — Phase R Step 3
 *
 * Returns stable ToolRouterHandlers from createToolRouter.
 * Recreate only when engine changes.
 */

import { useMemo } from 'react';
import type { TimelineEngine } from '../engine';
import { createToolRouter } from '../adapter/tool-router';
import type { ToolRouterHandlers } from '../adapter/tool-router';

export function useToolRouter(
  engine: TimelineEngine,
  options: {
    getPixelsPerFrame: () => number;
    getScrollLeft?: () => number;
  },
): ToolRouterHandlers {
  return useMemo(
    () =>
      createToolRouter({
        engine,
        getPixelsPerFrame: options.getPixelsPerFrame,
        getScrollLeft: options.getScrollLeft,
      }),
    [engine],
  );
}
