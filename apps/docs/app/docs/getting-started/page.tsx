export default function GettingStartedPage() {
  return (
    <div>
      <h1>Getting Started</h1>
      
      <p>Welcome to Timeline - a framework-agnostic timeline infrastructure for video editing applications.</p>

      <h2>Installation</h2>

      <h3>Core Package</h3>
      <p>Install the core timeline engine:</p>
      
      <pre><code className="language-bash">npm install @timeline/core</code></pre>

      <h3>React Adapter</h3>
      <p>For React applications, also install the React adapter:</p>
      
      <pre><code className="language-bash">npm install @timeline/react</code></pre>

      <h2>Quick Start</h2>

      <h3>Using the Core Engine</h3>
      
      <pre><code className="language-typescript">{`import {
  TimelineEngine,
  createTimeline,
  createTimelineState,
  createTrack,
  createClip,
  createAsset,
  frame,
  frameRate,
} from '@timeline/core';

// Create a timeline
const timeline = createTimeline({
  id: 'timeline_1',
  name: 'My Timeline',
  fps: frameRate(30),
  duration: frame(9000), // 300 seconds @ 30fps
  tracks: [],
});

// Create the engine
const engine = new TimelineEngine(createTimelineState({ timeline }));

// Add a track
const track = createTrack({
  id: 'track_1',
  name: 'Video Track 1',
  type: 'video',
});
engine.addTrack(track);

// Register an asset
const asset = createAsset({
  id: 'asset_1',
  type: 'video',
  duration: frame(300),
  sourceUrl: 'video.mp4',
});
engine.registerAsset(asset);

// Add a clip
const clip = createClip({
  id: 'clip_1',
  assetId: asset.id,
  trackId: track.id,
  timelineStart: frame(0),
  timelineEnd: frame(100),
  mediaIn: frame(0),
  mediaOut: frame(100),
});
engine.addClip(track.id, clip);

// Get current state
const state = engine.getState();
console.log(state.timeline);`}</code></pre>

      <h3>Using with React</h3>
      
      <pre><code className="language-typescript">{`import { TimelineEngine, createTimeline, createTimelineState } from '@timeline/core';
import { TimelineProvider, useTimeline } from '@timeline/react';

// Create engine instance
const engine = new TimelineEngine(
  createTimelineState({
    timeline: createTimeline({
      id: 'timeline_1',
      name: 'My Timeline',
      fps: frameRate(30),
      duration: frame(9000),
      tracks: [],
    }),
  })
);

// Wrap your app with the provider
function App() {
  return (
    <TimelineProvider engine={engine}>
      <TimelineEditor />
    </TimelineProvider>
  );
}

// Use hooks in components
function TimelineEditor() {
  const { state, engine } = useTimeline();
  
  return (
    <div>
      <h1>{state.timeline.name}</h1>
      <p>Tracks: {state.timeline.tracks.length}</p>
      
      <button onClick={() => {
        const track = createTrack({
          id: generateTrackId(),
          name: 'New Track',
          type: 'video',
        });
        engine.addTrack(track);
      }}>
        Add Track
      </button>
    </div>
  );
}`}</code></pre>

      <h2>React Hooks</h2>
      
      <p>The <code>@timeline/react</code> package provides several hooks:</p>

      <h3><code>useTimeline()</code></h3>
      <p>Subscribe to the entire timeline state:</p>
      
      <pre><code className="language-typescript">{`const { state, engine } = useTimeline();`}</code></pre>

      <h3><code>useTrack(trackId)</code></h3>
      <p>Subscribe to a specific track:</p>
      
      <pre><code className="language-typescript">{`const track = useTrack('track_1');`}</code></pre>

      <h3><code>useClip(clipId)</code></h3>
      <p>Subscribe to a specific clip:</p>
      
      <pre><code className="language-typescript">{`const clip = useClip('clip_1');`}</code></pre>

      <h3><code>useEngine()</code></h3>
      <p>Access the engine instance:</p>
      
      <pre><code className="language-typescript">{`const engine = useEngine();`}</code></pre>

      <h2>Next Steps</h2>
      
      <ul>
        <li>Learn about the <a href="/docs/architecture">Architecture</a></li>
        <li>Explore the demo application</li>
        <li>Check out the API reference</li>
      </ul>

      <h2>Key Concepts</h2>

      <h3>Frame-Based Time</h3>
      <p>Timeline uses frame numbers instead of milliseconds for deterministic, reproducible behavior:</p>
      
      <pre><code className="language-typescript">{`const fps = frameRate(30);
const oneSecond = frame(30);  // 30 frames @ 30fps = 1 second`}</code></pre>

      <h3>Deterministic State</h3>
      <p>All operations are deterministic and reproducible. The same sequence of operations always produces the same result.</p>

      <h3>Subscription Model</h3>
      <p>The engine notifies subscribers when state changes, enabling automatic UI updates:</p>
      
      <pre><code className="language-typescript">{`const unsubscribe = engine.subscribe(() => {
  const newState = engine.getState();
  // Update UI
});

// Clean up
unsubscribe();`}</code></pre>

      <h3>Undo/Redo</h3>
      <p>Built-in history system for undo/redo:</p>
      
      <pre><code className="language-typescript">{`engine.undo();
engine.redo();
engine.canUndo(); // boolean
engine.canRedo(); // boolean`}</code></pre>
    </div>
  );
}
