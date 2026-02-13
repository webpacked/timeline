/**
 * @timeline/react - TimelineProvider
 * 
 * React context provider for the timeline engine.
 * 
 * This component provides the TimelineEngine instance to all child components
 * via React context. Use the hooks (useEngine, useTimeline, etc.) to access
 * the engine and subscribe to state changes.
 * 
 * @example
 * ```tsx
 * import { TimelineEngine } from '@timeline/core';
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
import { TimelineEngine } from '@timeline/core';

/**
 * Timeline context
 * 
 * Provides the TimelineEngine instance to child components.
 * Use the hooks to access this context.
 */
export const TimelineContext = createContext<TimelineEngine | null>(null);

/**
 * Timeline provider props
 */
export interface TimelineProviderProps {
  /** The timeline engine instance */
  engine: TimelineEngine;
  /** Child components */
  children: ReactNode;
}

/**
 * Timeline provider component
 * 
 * Wraps your application to provide the timeline engine to all child components.
 * 
 * @param props - Provider props
 * @returns Provider component
 */
export function TimelineProvider({ engine, children }: TimelineProviderProps) {
  return (
    <TimelineContext.Provider value={engine}>
      {children}
    </TimelineContext.Provider>
  );
}
