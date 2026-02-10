/**
 * ClipView Component
 * 
 * WHAT THIS DOES:
 * - Renders a single clip as a positioned block
 * - Shows clip metadata (type, duration)
 * - Uses viewport to calculate pixel position
 * 
 * WHAT THIS DOES NOT DO:
 * - Handle drag operations (keeping it simple for now)
 * - Apply fancy styling
 * - Manage clip state (parent does that)
 * 
 * WHY IT EXISTS:
 * - Visual representation of a clip
 * - Validates that viewport calculations work
 * - Shows that core data flows to UI correctly
 * 
 * INTENTIONALLY UGLY:
 * This is a validation component, not a product.
 * Inline styles and basic divs are fine.
 */

import type { Clip, ViewportState } from '@timeline/react-adapter';
import { timeToPixels, msToSeconds } from '@timeline/core';

interface ClipViewProps {
  clip: Clip;
  viewport: ViewportState;
  isSelected: boolean;
  onClick?: () => void;
}

export function ClipView({ clip, viewport, isSelected, onClick }: ClipViewProps) {
  // Calculate position using viewport
  const left = timeToPixels(viewport, clip.start);
  const width = timeToPixels(viewport, clip.duration);
  
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: `${left}px`,
        width: `${width}px`,
        height: '100%',
        background: isSelected ? '#4a9eff' : '#888',
        border: '1px solid #000',
        boxSizing: 'border-box',
        cursor: 'pointer',
        padding: '4px',
        fontSize: '11px',
        color: '#fff',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <div>{clip.type}</div>
      <div>{msToSeconds(clip.duration)}s</div>
    </div>
  );
}
