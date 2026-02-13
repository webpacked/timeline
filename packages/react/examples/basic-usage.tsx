/**
 * @timeline/react - Basic Usage Example
 * 
 * This example demonstrates how to use the React adapter with the timeline core.
 * 
 * It shows:
 * - Creating a timeline engine
 * - Wrapping the app in TimelineProvider
 * - Using hooks to access state
 * - Triggering updates via engine methods
 * - Undo/redo functionality
 */

import React from 'react';
import {
  TimelineEngine,
  createTimeline,
  createTimelineState,
  createTrack,
  createClip,
  createAsset,
  frame,
  frameRate,
} from '@timeline/core';
import {
  TimelineProvider,
  useTimeline,
  useTrack,
  useClip,
  useEngine,
} from '@timeline/react';

// Import internal utilities for example
import {
  generateTimelineId,
  generateTrackId,
  generateClipId,
  generateAssetId,
} from '@timeline/core/internal';

// ===== CREATE ENGINE =====

// Create initial timeline
const timeline = createTimeline({
  id: generateTimelineId(),
  name: 'My Timeline',
  fps: frameRate(30),
  duration: frame(3000),
  tracks: [],
});

// Create initial state
const initialState = createTimelineState({ timeline });

// Create engine
const engine = new TimelineEngine(initialState);

// Add a track
const track = createTrack({
  id: generateTrackId(),
  name: 'Video Track 1',
  type: 'video',
});
engine.addTrack(track);

// Register an asset
const asset = createAsset({
  id: generateAssetId(),
  type: 'video',
  duration: frame(300),
  sourceUrl: 'video.mp4',
});
engine.registerAsset(asset);

// Add a clip
const clip = createClip({
  id: generateClipId(),
  assetId: asset.id,
  trackId: track.id,
  timelineStart: frame(0),
  timelineEnd: frame(100),
  mediaIn: frame(0),
  mediaOut: frame(100),
});
engine.addClip(track.id, clip);

// ===== REACT COMPONENTS =====

/**
 * Main app component
 * 
 * Wraps the timeline view in the provider
 */
function App() {
  return (
    <TimelineProvider engine={engine}>
      <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
        <h1>Timeline React Adapter Example</h1>
        <TimelineView />
      </div>
    </TimelineProvider>
  );
}

/**
 * Timeline view component
 * 
 * Uses useTimeline to access full state and engine
 */
function TimelineView() {
  const { state, engine } = useTimeline();
  
  const handleAddClip = () => {
    const newClip = createClip({
      id: generateClipId(),
      assetId: asset.id,
      trackId: track.id,
      timelineStart: frame(200),
      timelineEnd: frame(300),
      mediaIn: frame(0),
      mediaOut: frame(100),
    });
    
    engine.addClip(track.id, newClip);
  };
  
  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2>{state.timeline.name}</h2>
        <p>Duration: {state.timeline.duration} frames @ {state.timeline.fps} fps</p>
        <p>Tracks: {state.timeline.tracks.length}</p>
      </div>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => engine.undo()}
          disabled={!engine.canUndo()}
          style={{ padding: '8px 16px' }}
        >
          Undo
        </button>
        <button 
          onClick={() => engine.redo()}
          disabled={!engine.canRedo()}
          style={{ padding: '8px 16px' }}
        >
          Redo
        </button>
        <button 
          onClick={handleAddClip}
          style={{ padding: '8px 16px' }}
        >
          Add Clip
        </button>
      </div>
      
      <div>
        <h3>Tracks</h3>
        {state.timeline.tracks.map(t => (
          <TrackView key={t.id} trackId={t.id} />
        ))}
      </div>
    </div>
  );
}

/**
 * Track view component
 * 
 * Uses useTrack to subscribe to specific track
 */
function TrackView({ trackId }: { trackId: string }) {
  const track = useTrack(trackId);
  const engine = useEngine();
  
  if (!track) {
    return <div>Track not found</div>;
  }
  
  const handleRemoveTrack = () => {
    engine.removeTrack(trackId);
  };
  
  return (
    <div style={{ 
      border: '1px solid #ccc', 
      padding: '16px', 
      marginBottom: '16px',
      borderRadius: '4px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4>{track.name}</h4>
        <button onClick={handleRemoveTrack} style={{ padding: '4px 12px' }}>
          Remove Track
        </button>
      </div>
      
      <p>Type: {track.type}</p>
      <p>Clips: {track.clips.length}</p>
      
      <div style={{ marginTop: '12px' }}>
        {track.clips.map(c => (
          <ClipView key={c.id} clipId={c.id} />
        ))}
      </div>
    </div>
  );
}

/**
 * Clip view component
 * 
 * Uses useClip to subscribe to specific clip
 */
function ClipView({ clipId }: { clipId: string }) {
  const clip = useClip(clipId);
  const engine = useEngine();
  
  if (!clip) {
    return <div>Clip not found</div>;
  }
  
  const handleMoveClip = () => {
    const newStart = frame(clip.timelineStart + 50);
    engine.moveClip(clipId, newStart);
  };
  
  const handleRemoveClip = () => {
    engine.removeClip(clipId);
  };
  
  return (
    <div style={{ 
      border: '1px solid #ddd', 
      padding: '12px', 
      marginBottom: '8px',
      borderRadius: '4px',
      backgroundColor: '#f9f9f9'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>Clip {clipId.slice(0, 8)}</strong>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleMoveClip} style={{ padding: '4px 8px', fontSize: '12px' }}>
            Move +50
          </button>
          <button onClick={handleRemoveClip} style={{ padding: '4px 8px', fontSize: '12px' }}>
            Remove
          </button>
        </div>
      </div>
      
      <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
        <div>Timeline: {clip.timelineStart} → {clip.timelineEnd}</div>
        <div>Media: {clip.mediaIn} → {clip.mediaOut}</div>
      </div>
    </div>
  );
}

export default App;

/**
 * KEY OBSERVATIONS:
 * 
 * 1. **Automatic Updates**: When you click "Add Clip", "Move +50", or "Remove",
 *    the UI automatically updates because the hooks subscribe to engine changes.
 * 
 * 2. **Undo/Redo**: Clicking undo/redo updates the entire UI automatically.
 *    All components re-render with the new state.
 * 
 * 3. **Granular Subscriptions**: TrackView uses useTrack, ClipView uses useClip.
 *    Each component only cares about its specific data.
 * 
 * 4. **No State Duplication**: All state lives in the engine. React components
 *    are just views that subscribe to changes.
 * 
 * 5. **Clean Separation**: The engine handles all logic. React handles rendering.
 *    The adapter is just glue.
 */
