/**
 * @timeline/react - TimelineProvider
 *
 * React context provider for the Phase 1 TimelineEngine.
 *
 * Provides the engine to all child components via React context.
 * All hooks read from this context via useTimelineContext() in hooks.ts.
 *
 * @example
 * ```tsx
 * import { TimelineEngine } from '@timeline/react';
 * import { TimelineProvider } from '@timeline/react';
 *
 * const engine = new TimelineEngine(initialState);
 *
 * function App() {
 *   return (
 *     <TimelineProvider engine={engine}>
 *       <YourTimelineUI />
 *     </TimelineProvider>
 *   );
 * }
 * ```
 */

import { createContext, ReactNode } from 'react';
import type { TimelineEngine } from './engine';

/**
 * React context that holds the Phase 1 TimelineEngine instance.
 * Use via hooks — never access this directly in components.
 */
export const TimelineContext = createContext<TimelineEngine | null>(null);

export interface TimelineProviderProps {
  /** The Phase 1 timeline engine instance */
  engine:   TimelineEngine;
  children: ReactNode;
}

export function TimelineProvider({ engine, children }: TimelineProviderProps) {
  return (
    <TimelineContext.Provider value={engine}>
      {children}
    </TimelineContext.Provider>
  );
}
