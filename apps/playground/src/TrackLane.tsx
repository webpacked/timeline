/**
 * TrackLane Component
 * 
 * WHAT THIS DOES:
 * - Renders a horizontal lane for clips
 * - Positions clips using viewport calculations
 * - Shows track name and metadata
 * 
 * WHAT THIS DOES NOT DO:
 * - Handle complex interactions
 * - Apply beautiful styling
 * - Manage its own state
 * 
 * WHY IT EXISTS:
 * - Container for clips
 * - Validates track rendering
 * - Shows parent-child data flow
 * 
 * DATA FLOW:
 * Timeline state → TrackLane props → ClipView props
 */

import type { Track, ViewportState, SelectionState } from '@timeline/react-adapter';
import { ClipView } from './ClipView';

interface TrackLaneProps {
  track: Track;
  viewport: ViewportState;
  selection: SelectionState;
  onClipClick?: (clipId: string) => void;
}

export function TrackLane({ track, viewport, selection, onClipClick }: TrackLaneProps) {
  return (
    <div
      style={{
        position: 'relative',
        height: track.height || 60,
        border: '1px solid #666',
        marginBottom: '4px',
        background: track.muted ? '#333' : '#222',
      }}
    >
      {/* Track label */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          padding: '4px',
          fontSize: '12px',
          color: '#aaa',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {track.name}
        {track.locked && ' 🔒'}
        {track.muted && ' 🔇'}
      </div>
      
      {/* Clips */}
      {track.clips.map(clip => (
        <ClipView
          key={clip.id}
          clip={clip}
          viewport={viewport}
          isSelected={selection.clipIds.has(clip.id)}
          onClick={() => onClipClick?.(clip.id)}
        />
      ))}
    </div>
  );
}
