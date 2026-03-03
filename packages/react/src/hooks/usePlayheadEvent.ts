/**
 * usePlayheadEvent — Phase 6 Step 6
 *
 * Subscribe to specific playhead events without causing re-renders on every frame.
 * Handler is called only when event type matches. Exclude handler from deps —
 * use useCallback at call site if needed.
 */

import { useEffect } from 'react';
import type {
  PlaybackEngine,
  PlayheadEventType,
  PlayheadListener,
  PlayheadEvent,
} from '@timeline/core';

export function usePlayheadEvent(
  engine: PlaybackEngine,
  eventType: PlayheadEventType | PlayheadEventType[],
  handler: PlayheadListener,
): void {
  useEffect(() => {
    const types = Array.isArray(eventType) ? eventType : [eventType];
    const unsub = engine.on((event: PlayheadEvent) => {
      if (types.includes(event.type)) handler(event);
    });
    return unsub;
  }, [engine]);
}
