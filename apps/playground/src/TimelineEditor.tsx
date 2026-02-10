/**
 * TimelineEditor Component
 * 
 * WHAT THIS DOES:
 * - Orchestrates all hooks and child components
 * - Manages timeline, viewport, selection, and playhead state
 * - Handles user interactions (click, keyboard)
 * - Coordinates data flow from core → UI
 * 
 * WHAT THIS DOES NOT DO:
 * - Complex drag-and-drop
 * - Advanced keyboard shortcuts
 * - Beautiful UI
 * 
 * WHY IT EXISTS:
 * - Main validation component for Phase 2
 * - Proves core works with React
 * - Shows data flow pattern works
 * 
 * DATA FLOW PATTERN (CRITICAL):
 * User clicks clip →
 * onClick handler →
 * selection.selectClip(clipId) →
 * Core returns new SelectionState →
 * React re-renders →
 * ClipView shows selected state
 * 
 * INTENTIONALLY SIMPLE:
 * This is validation, not production.
 * Basic interactions only.
 */

import { useTimeline, useViewport, useSelection, usePlayhead } from '@timeline/react-adapter';
import type { Timeline } from '@timeline/react-adapter';
import { TrackLane } from './TrackLane';
import { PlayheadView } from './PlayheadView';
import { TimeRuler } from './TimeRuler';

interface TimelineEditorProps {
  initialTimeline: Timeline;
}

export function TimelineEditor({ initialTimeline }: TimelineEditorProps) {
  // Initialize all hooks
  const timeline = useTimeline(initialTimeline);
  const viewport = useViewport({
    zoom: 0.1, // 0.1 pixels per millisecond = 100 pixels per second
    scrollTime: 0 as any,
    viewportWidth: 1200,
  });
  const selection = useSelection();
  const playhead = usePlayhead(0 as any);
  
  // Handle clip click
  const handleClipClick = (clipId: string) => {
    selection.selectClip(clipId);
  };
  
  // Handle keyboard shortcuts (basic)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Space = play/pause (just move playhead for now)
    if (e.key === ' ') {
      e.preventDefault();
      const newTime = (playhead.playhead.current + 1000) as any;
      playhead.setPlayheadTime(newTime);
    }
    
    // Escape = clear selection
    if (e.key === 'Escape') {
      selection.clearSelection();
    }
  };
  
  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        width: '100%',
        height: '100vh',
        background: '#000',
        color: '#fff',
        fontFamily: 'monospace',
        outline: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px',
          background: '#111',
          borderBottom: '1px solid #333',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px' }}>
          Timeline: {timeline.timeline.name}
        </h2>
        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
          Duration: {timeline.timeline.duration}ms | 
          Zoom: {viewport.viewport.zoom} | 
          Selected: {selection.selection.clipIds.size} clips
        </div>
      </div>
      
      {/* Timeline container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 'calc(100vh - 60px)',
          overflow: 'auto',
        }}
      >
        {/* Time ruler */}
        <TimeRuler
          viewport={viewport.viewport}
          duration={timeline.timeline.duration}
        />
        
        {/* Playhead */}
        <PlayheadView
          playhead={playhead.playhead}
          viewport={viewport.viewport}
        />
        
        {/* Tracks */}
        <div style={{ padding: '8px' }}>
          {timeline.timeline.tracks.map(track => (
            <TrackLane
              key={track.id}
              track={track}
              viewport={viewport.viewport}
              selection={selection.selection}
              onClipClick={handleClipClick}
            />
          ))}
        </div>
        
        {/* Empty state */}
        {timeline.timeline.tracks.length === 0 && (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              color: '#666',
            }}
          >
            No tracks yet. This is a minimal validation UI.
          </div>
        )}
      </div>
      
      {/* Footer with instructions */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '8px',
          background: '#111',
          borderTop: '1px solid #333',
          fontSize: '11px',
          color: '#666',
        }}
      >
        <strong>Phase 2 Validation UI</strong> | 
        Click clips to select | 
        Space = advance playhead | 
        Esc = clear selection
      </div>
    </div>
  );
}
