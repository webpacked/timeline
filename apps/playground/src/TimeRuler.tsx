/**
 * TimeRuler Component
 * 
 * WHAT THIS DOES:
 * - Shows time markers along the top
 * - Uses viewport to calculate positions
 * - Displays time in seconds
 * 
 * WHAT THIS DOES NOT DO:
 * - Handle complex time formatting
 * - Show frame numbers
 * - Be beautiful
 * 
 * WHY IT EXISTS:
 * - Helps visualize time scale
 * - Validates viewport calculations
 * - Shows zoom level works
 */

import type { ViewportState } from '@timeline/react-adapter';
import { timeToPixels, msToSeconds, timeMs } from '@timeline/core';

interface TimeRulerProps {
  viewport: ViewportState;
  duration: number;
}

export function TimeRuler({ viewport, duration }: TimeRulerProps) {
  // Calculate visible time range
  const visibleDuration = viewport.viewportWidth / viewport.zoom;
  const startTime = viewport.scrollTime;
  const endTime = Math.min(startTime + visibleDuration, duration);
  
  // Generate markers every second (simplified)
  const markers: number[] = [];
  const intervalMs = 1000; // 1 second
  
  for (let time = 0; time <= duration; time += intervalMs) {
    if (time >= startTime && time <= endTime) {
      markers.push(time);
    }
  }
  
  return (
    <div
      style={{
        position: 'relative',
        height: '30px',
        background: '#111',
        borderBottom: '1px solid #666',
        marginBottom: '4px',
      }}
    >
      {markers.map(time => {
        const position = timeToPixels(viewport, timeMs(time));
        return (
          <div
            key={time}
            style={{
              position: 'absolute',
              left: `${position}px`,
              top: 0,
              bottom: 0,
              borderLeft: '1px solid #444',
              paddingLeft: '4px',
              fontSize: '10px',
              color: '#888',
            }}
          >
            {msToSeconds(timeMs(time))}s
          </div>
        );
      })}
    </div>
  );
}
