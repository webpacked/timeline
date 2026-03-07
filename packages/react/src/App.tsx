/**
 * Minimal Timeline Example
 *
 * Uses Phase R TimelineEngine with options-based constructor.
 * For a full demo with @timeline/ui, see apps/demo/
 */

import {
  createTimeline,
  createTimelineState,
  createTrack,
  createClip,
  createAsset,
  toFrame,
  frameRate,
} from '@timeline/core';
import { TimelineEngine } from './engine';
import { TimelineProvider } from './index';

const timeline = createTimeline({
  id: 'tl-1',
  name: 'Example Timeline',
  fps: frameRate(30),
  duration: toFrame(3000),
  tracks: [],
});

const videoTrack = createTrack({
  id: 'track-v1',
  name: 'Video Track 1',
  type: 'video',
  locked: false,
  clips: [],
});

const videoAsset = createAsset({
  id: 'asset-v1',
  name: 'Sample Video',
  mediaType: 'video',
  filePath: '/sample.mp4',
  intrinsicDuration: toFrame(300),
  nativeFps: frameRate(30),
  sourceTimecodeOffset: toFrame(0),
});

const videoClip = createClip({
  id: 'clip-1',
  assetId: videoAsset.id,
  trackId: videoTrack.id,
  timelineStart: toFrame(0),
  timelineEnd: toFrame(300),
  mediaIn: toFrame(0),
  mediaOut: toFrame(300),
  effects: [],
});

const timelineWithTrack = createTimeline({
  ...timeline,
  tracks: [
    createTrack({
      ...videoTrack,
      clips: [videoClip],
    }),
  ],
});

const initialState = createTimelineState({
  timeline: timelineWithTrack,
  assetRegistry: new Map([[videoAsset.id, videoAsset]]),
});

const engine = new TimelineEngine({ initialState });

function App() {
  return (
    <TimelineProvider engine={engine}>
      <div className="h-screen flex flex-col">
        <header className="bg-zinc-900 text-white p-4 border-b border-zinc-700">
          <h1 className="text-xl font-bold">Timeline Example</h1>
          <p className="text-sm text-zinc-400">
            Phase R engine — for full UI use apps/demo with @timeline/ui
          </p>
        </header>
        <main className="flex-1 overflow-hidden" />
      </div>
    </TimelineProvider>
  );
}

export default App;
