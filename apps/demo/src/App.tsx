/**
 * Demo App - Architecture Validation
 * 
 * Minimal timeline editor to validate:
 * - Core engine integration
 * - React adapter functionality
 * - UI package ergonomics
 * - State consistency
 */

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
import { TimelineProvider, useTimeline } from '@timeline/react';
import { Timeline } from '@timeline/ui';

// Import internal utilities for demo
import {
  generateTimelineId,
  generateTrackId,
  generateClipId,
  generateAssetId,
} from '@timeline/core/internal';

// Create initial timeline
const timeline = createTimeline({
  id: generateTimelineId(),
  name: 'Demo Timeline',
  fps: frameRate(30),
  duration: frame(9000), // 300 seconds @ 30fps
  tracks: [],
});

// Create initial state (markers and work area can be added via UI)
const initialState = createTimelineState({
  timeline,
});

// Create engine with initial state
const engine = new TimelineEngine(initialState);

// Add initial track
const track1 = createTrack({
  id: generateTrackId(),
  name: 'Video Track 1',
  type: 'video',
});
engine.addTrack(track1);

// Add an audio track for testing type enforcement
const track2 = createTrack({
  id: generateTrackId(),
  name: 'Audio Track 1',
  type: 'audio',
});
engine.addTrack(track2);

// Register video asset
const asset1 = createAsset({
  id: generateAssetId(),
  type: 'video',
  duration: frame(300),
  sourceUrl: 'video.mp4',
});
engine.registerAsset(asset1);

// Register audio asset
const asset2 = createAsset({
  id: generateAssetId(),
  type: 'audio',
  duration: frame(200),
  sourceUrl: 'audio.mp3',
});
engine.registerAsset(asset2);

// Add initial video clip
const clip1 = createClip({
  id: generateClipId(),
  assetId: asset1.id,
  trackId: track1.id,
  timelineStart: frame(0),
  timelineEnd: frame(100),
  mediaIn: frame(0),
  mediaOut: frame(100),
});
engine.addClip(track1.id, clip1);

// Add initial audio clip
const clip2 = createClip({
  id: generateClipId(),
  assetId: asset2.id,
  trackId: track2.id,
  timelineStart: frame(0),
  timelineEnd: frame(100),
  mediaIn: frame(0),
  mediaOut: frame(100),
});
engine.addClip(track2.id, clip2);

function Controls() {
  const { state, engine } = useTimeline();
  
  const handleAddVideoTrack = () => {
    const videoTracks = state.timeline.tracks.filter(t => t.type === 'video');
    const track = createTrack({
      id: generateTrackId(),
      name: `Video Track ${videoTracks.length + 1}`,
      type: 'video',
    });
    engine.addTrack(track);
  };
  
  const handleAddAudioTrack = () => {
    const audioTracks = state.timeline.tracks.filter(t => t.type === 'audio');
    const track = createTrack({
      id: generateTrackId(),
      name: `Audio Track ${audioTracks.length + 1}`,
      type: 'audio',
    });
    engine.addTrack(track);
  };
  
  const handleAddVideoClip = () => {
    const videoTrack = state.timeline.tracks.find(t => t.type === 'video');
    if (!videoTrack) {
      alert('Add a video track first!');
      return;
    }
    
    // Find the last clip on the track to position the new clip after it
    const existingClips = videoTrack.clips;
    let startFrame = frame(0);
    if (existingClips.length > 0) {
      const lastClip = existingClips[existingClips.length - 1];
      startFrame = frame(lastClip.timelineEnd + 10); // Add 10 frames gap
    }
    
    const asset = createAsset({
      id: generateAssetId(),
      type: 'video',
      duration: frame(150),
      sourceUrl: 'video-clip.mp4',
    });
    engine.registerAsset(asset);
    
    const clip = createClip({
      id: generateClipId(),
      assetId: asset.id,
      trackId: videoTrack.id,
      timelineStart: startFrame,
      timelineEnd: frame(startFrame + 150),
      mediaIn: frame(0),
      mediaOut: frame(150),
    });
    engine.addClip(videoTrack.id, clip);
  };
  
  const handleAddAudioClip = () => {
    const audioTrack = state.timeline.tracks.find(t => t.type === 'audio');
    if (!audioTrack) {
      alert('Add an audio track first!');
      return;
    }
    
    // Find the last clip on the track to position the new clip after it
    const existingClips = audioTrack.clips;
    let startFrame = frame(0);
    if (existingClips.length > 0) {
      const lastClip = existingClips[existingClips.length - 1];
      startFrame = frame(lastClip.timelineEnd + 10); // Add 10 frames gap
    }
    
    const asset = createAsset({
      id: generateAssetId(),
      type: 'audio',
      duration: frame(150),
      sourceUrl: 'audio-clip.mp3',
    });
    engine.registerAsset(asset);
    
    const clip = createClip({
      id: generateClipId(),
      assetId: asset.id,
      trackId: audioTrack.id,
      timelineStart: startFrame,
      timelineEnd: frame(startFrame + 150),
      mediaIn: frame(0),
      mediaOut: frame(150),
    });
    engine.addClip(audioTrack.id, clip);
  };
  
  const buttonStyle = {
    padding: '6px 12px',
    backgroundColor: '#27272a',
    color: '#d4d4d8',
    border: '1px solid #3f3f46',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  };

  return (
    <div style={{
      padding: '12px',
      backgroundColor: '#18181b',
      borderBottom: '1px solid #3f3f46',
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      {/* Track Controls */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button onClick={handleAddVideoTrack} style={buttonStyle}>
          📹 Add Video Track
        </button>
        <button onClick={handleAddAudioTrack} style={buttonStyle}>
          🎵 Add Audio Track
        </button>
      </div>
      
      <div style={{ width: '1px', height: '24px', backgroundColor: '#3f3f46' }} />
      
      {/* Clip Controls */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button onClick={handleAddVideoClip} style={buttonStyle}>
          📹 Add Video Clip
        </button>
        <button onClick={handleAddAudioClip} style={buttonStyle}>
          🎵 Add Audio Clip
        </button>
      </div>
      
      <div style={{ width: '1px', height: '24px', backgroundColor: '#3f3f46' }} />
      
      {/* History Controls */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button
          onClick={() => engine.undo()}
          disabled={!engine.canUndo()}
          style={{
            ...buttonStyle,
            color: engine.canUndo() ? '#d4d4d8' : '#52525b',
            cursor: engine.canUndo() ? 'pointer' : 'not-allowed',
          }}
        >
          Undo
        </button>
        <button
          onClick={() => engine.redo()}
          disabled={!engine.canRedo()}
          style={{
            ...buttonStyle,
            color: engine.canRedo() ? '#d4d4d8' : '#52525b',
            cursor: engine.canRedo() ? 'pointer' : 'not-allowed',
          }}
        >
          Redo
        </button>
      </div>
      
      <div style={{ width: '1px', height: '24px', backgroundColor: '#3f3f46' }} />
      
      {/* Info & Shortcuts */}
      <div style={{ 
        fontSize: '12px', 
        color: '#71717a',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span>Clips: {state.timeline.tracks.reduce((sum, t) => sum + t.clips.length, 0)}</span>
          <span>Tracks: {state.timeline.tracks.length}</span>
        </div>
        <span>•</span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span>⌘/Ctrl+C: Copy</span>
          <span>⌘/Ctrl+V: Paste</span>
          <span>⌘/Ctrl+A: Select All</span>
          <span>Del: Delete</span>
          <span>Esc: Deselect</span>
          <span>←/→: Playhead</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <TimelineProvider engine={engine}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#09090b',
      }}>
        <header style={{
          padding: '16px 24px',
          backgroundColor: '#18181b',
          borderBottom: '1px solid #3f3f46',
        }}>
          <h1 style={{ margin: 0, color: '#fafafa', fontSize: '20px', fontWeight: 600 }}>
            Timeline Demo
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#a1a1aa', fontSize: '14px' }}>
            UI Package Integration Validation
          </p>
        </header>
        <Controls />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Timeline />
        </div>
      </div>
    </TimelineProvider>
  );
}

export default App;
