/**
 * Minimal Timeline Example
 * 
 * This is a simple example showing how to use the timeline packages.
 * For a more complete demo, see apps/demo/
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
import { TimelineProvider } from '@timeline/react';
import { Timeline } from '@timeline/ui';

// Import internal utilities for this example
import {
  generateTimelineId,
  generateTrackId,
  generateClipId,
  generateAssetId,
} from '@timeline/core/internal';

// Create a simple timeline with one track and one clip
const timeline = createTimeline({
  id: generateTimelineId(),
  name: 'Example Timeline',
  fps: frameRate(30),
  duration: frame(3000), // 100 seconds @ 30fps
  tracks: [],
});

const initialState = createTimelineState({ timeline });
const engine = new TimelineEngine(initialState);

// Add a video track
const videoTrack = createTrack({
  id: generateTrackId(),
  type: 'video',
  name: 'Video Track 1',
  locked: false,
  clips: [],
});

engine.addTrack(videoTrack);

// Add a sample video asset and clip
const videoAsset = createAsset({
  id: generateAssetId(),
  type: 'video',
  name: 'Sample Video',
  duration: frame(300),
  sourceStart: frame(0),
  sourceEnd: frame(300),
  metadata: { width: 1920, height: 1080, frameRate: 30 },
});

engine.addAsset(videoAsset);

const videoClip = createClip({
  id: generateClipId(),
  assetId: videoAsset.id,
  timelineStart: frame(0),
  timelineEnd: frame(300),
  sourceStart: frame(0),
  sourceEnd: frame(300),
  locked: false,
  effects: [],
});

engine.addClip(videoTrack.id, videoClip);

function App() {
  return (
    <TimelineProvider engine={engine}>
      <div className="h-screen flex flex-col">
        <header className="bg-zinc-900 text-white p-4 border-b border-zinc-700">
          <h1 className="text-xl font-bold">Timeline Example</h1>
          <p className="text-sm text-zinc-400">
            A minimal example showing timeline integration
          </p>
        </header>
        <main className="flex-1 overflow-hidden">
          <Timeline />
        </main>
      </div>
    </TimelineProvider>
  );
}

export default App;
