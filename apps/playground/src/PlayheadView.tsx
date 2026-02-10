/**
 * PlayheadView Component
 * 
 * WHAT THIS DOES:
 * - Renders a vertical line at playhead position
 * - Updates when playhead moves
 * - Uses viewport for positioning
 * 
 * WHAT THIS DOES NOT DO:
 * - Handle dragging
 * - Show time tooltip
 * - Manage playhead state
 * 
 * WHY IT EXISTS:
 * - Visual indicator of current time
 * - Validates playhead state updates
 * - Shows reactive rendering works
 */

import type { PlayheadState, ViewportState } from '@timeline/react-adapter';
import { timeToPixels } from '@timeline/core';

interface PlayheadViewProps {
  playhead: PlayheadState;
  viewport: ViewportState;
}

export function PlayheadView({ playhead, viewport }: PlayheadViewProps) {
  const position = timeToPixels(viewport, playhead.current);
  
  return (
    <div
      style={{
        position: 'absolute',
        left: `${position}px`,
        top: 0,
        bottom: 0,
        width: '2px',
        background: 'red',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  );
}
