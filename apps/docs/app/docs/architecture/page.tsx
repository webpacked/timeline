export default function ArchitecturePage() {
  return (
    <div>
      <h1>Architecture</h1>
      
      <p>Timeline is built as a layered system, with each layer having clear responsibilities and boundaries.</p>

      <h2>System Layers</h2>
      
      <pre><code>{`┌─────────────────────────────────────┐
│           CLI / Registry            │  Future: Component installation
├─────────────────────────────────────┤
│          UI Components              │  Future: Installable components
├─────────────────────────────────────┤
│         React Adapter               │  Hooks, Context, Subscriptions
├─────────────────────────────────────┤
│          Core Engine                │  State, Validation, History
└─────────────────────────────────────┘`}</code></pre>

      <h3>Core Engine (<code>@timeline/core</code>)</h3>
      
      <p><strong>Responsibilities:</strong></p>
      <ul>
        <li>Timeline state management</li>
        <li>Frame-based time system</li>
        <li>Validation rules</li>
        <li>History (undo/redo)</li>
        <li>Built-in systems (snapping, grouping, linking)</li>
      </ul>

      <p><strong>Key Characteristics:</strong></p>
      <ul>
        <li>Framework-agnostic</li>
        <li>Pure TypeScript</li>
        <li>No DOM dependencies</li>
        <li>Deterministic</li>
        <li>Fully tested</li>
      </ul>

      <p><strong>Public API:</strong></p>
      <ul>
        <li><code>TimelineEngine</code> - Main engine class</li>
        <li>Factory functions (<code>createTimeline</code>, <code>createTrack</code>, <code>createClip</code>, etc.)</li>
        <li>Type definitions</li>
        <li>Utility functions (<code>frame</code>, <code>frameRate</code>, etc.)</li>
      </ul>

      <h3>React Adapter (<code>@timeline/react</code>)</h3>
      
      <p><strong>Responsibilities:</strong></p>
      <ul>
        <li>React integration</li>
        <li>Subscription management</li>
        <li>Hook-based API</li>
        <li>Context provider</li>
      </ul>

      <p><strong>Key Characteristics:</strong></p>
      <ul>
        <li>Thin adapter layer</li>
        <li>No business logic</li>
        <li>No state duplication</li>
        <li>Automatic cleanup</li>
      </ul>

      <p><strong>Public API:</strong></p>
      <ul>
        <li><code>TimelineProvider</code> - Context provider</li>
        <li><code>useTimeline()</code> - Full state hook</li>
        <li><code>useTrack(id)</code> - Track-specific hook</li>
        <li><code>useClip(id)</code> - Clip-specific hook</li>
        <li><code>useEngine()</code> - Engine access hook</li>
      </ul>

      <h3>UI Components (Future)</h3>
      
      <p><strong>Planned:</strong></p>
      <ul>
        <li>Installable via CLI</li>
        <li>Customizable</li>
        <li>Composable</li>
        <li>Framework-specific implementations</li>
      </ul>

      <h3>CLI / Registry (Future)</h3>
      
      <p><strong>Planned:</strong></p>
      <ul>
        <li>Component installation</li>
        <li>Registry hosting</li>
        <li>Version management</li>
        <li>Source code serving</li>
      </ul>

      <h2>Core Concepts</h2>

      <h3>Frame-Based Time</h3>
      
      <p>Timeline uses frame numbers instead of milliseconds for several reasons:</p>

      <p><strong>Deterministic:</strong></p>
      <pre><code className="language-typescript">{`// Always exact, no floating point errors
const start = frame(0);
const end = frame(100);
const duration = end - start; // Always 100`}</code></pre>

      <p><strong>Video-Native:</strong></p>
      <pre><code className="language-typescript">{`// Aligns with video frame boundaries
const fps = frameRate(30);
const oneSecond = frame(30); // Exactly 1 second @ 30fps`}</code></pre>

      <p><strong>Reproducible:</strong></p>
      <pre><code className="language-typescript">{`// Same operations always produce same result
const clip1 = createClip({ timelineStart: frame(0), timelineEnd: frame(100) });
const clip2 = createClip({ timelineStart: frame(0), timelineEnd: frame(100) });
// clip1 and clip2 are identical`}</code></pre>

      <h3>Deterministic State</h3>
      
      <p>Every operation is deterministic:</p>
      
      <pre><code className="language-typescript">{`// Given the same initial state and operations
const engine1 = new TimelineEngine(initialState);
engine1.addTrack(track);
engine1.addClip(trackId, clip);

const engine2 = new TimelineEngine(initialState);
engine2.addTrack(track);
engine2.addClip(trackId, clip);

// engine1 and engine2 have identical state`}</code></pre>

      <p>This enables:</p>
      <ul>
        <li>Reliable testing</li>
        <li>Reproducible bugs</li>
        <li>State serialization</li>
        <li>Collaborative editing (future)</li>
      </ul>

      <h3>Subscription Model</h3>
      
      <p>The engine uses a simple pub/sub pattern:</p>
      
      <pre><code className="language-typescript">{`class TimelineEngine {
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }
}`}</code></pre>

      <p><strong>Benefits:</strong></p>
      <ul>
        <li>Simple to understand</li>
        <li>Easy to implement</li>
        <li>Efficient for most use cases</li>
        <li>Framework-agnostic</li>
      </ul>

      <p><strong>React Integration:</strong></p>
      <pre><code className="language-typescript">{`function useTimeline() {
  const engine = useEngine();
  const [state, setState] = useState(() => engine.getState());

  useEffect(() => {
    const unsubscribe = engine.subscribe(() => {
      setState(engine.getState());
    });
    return unsubscribe;
  }, [engine]);

  return { state, engine };
}`}</code></pre>

      <h3>Validation System</h3>
      
      <p>Built-in validation ensures state integrity:</p>
      
      <pre><code className="language-typescript">{`// Clips cannot overlap on the same track
engine.addClip(trackId, {
  timelineStart: frame(0),
  timelineEnd: frame(100),
}); // ✓ OK

engine.addClip(trackId, {
  timelineStart: frame(50),
  timelineEnd: frame(150),
}); // ✗ Error: Overlaps with existing clip`}</code></pre>

      <p><strong>Validation Rules:</strong></p>
      <ul>
        <li>No overlapping clips on same track</li>
        <li>Clip duration must match media duration</li>
        <li>Timeline start must be before end</li>
        <li>Track IDs must be unique</li>
        <li>Asset must exist before creating clip</li>
      </ul>

      <h3>History System</h3>
      
      <p>Automatic undo/redo for all operations:</p>
      
      <pre><code className="language-typescript">{`// Operations are automatically tracked
engine.addTrack(track);
engine.addClip(trackId, clip);
engine.moveClip(clipId, frame(100));

// Undo last operation
engine.undo(); // Clip moved back

// Undo again
engine.undo(); // Clip removed

// Undo again
engine.undo(); // Track removed

// Redo
engine.redo(); // Track added back`}</code></pre>

      <p><strong>Implementation:</strong></p>
      <ul>
        <li>Command pattern</li>
        <li>Immutable snapshots</li>
        <li>Configurable history limit</li>
        <li>Memory efficient</li>
      </ul>

      <h2>Design Principles</h2>

      <h3>1. Framework Agnostic Core</h3>
      
      <p>The core engine has zero framework dependencies:</p>
      
      <pre><code className="language-typescript">{`// Works anywhere JavaScript runs
import { TimelineEngine } from '@timeline/core';

// Node.js
const engine = new TimelineEngine(state);

// Browser
const engine = new TimelineEngine(state);

// React, Vue, Angular, Svelte, etc.
const engine = new TimelineEngine(state);`}</code></pre>

      <h3>2. Thin Adapter Layers</h3>
      
      <p>Adapters contain no business logic - they only subscribe and re-render.</p>

      <h3>3. Single Source of Truth</h3>
      
      <p>Engine state is the only source of truth. No state duplication in React.</p>

      <h3>4. Explicit Over Implicit</h3>
      
      <p>Operations are explicit and clear:</p>
      
      <pre><code className="language-typescript">{`// ✓ Good: Explicit frame numbers
engine.moveClip(clipId, frame(100));

// ✗ Bad: Implicit time units
engine.moveClip(clipId, 100); // 100 what? Frames? Milliseconds?`}</code></pre>

      <h3>5. Immutable State</h3>
      
      <p>State is never mutated directly. Engine creates new state on every operation.</p>

      <h2>Performance Considerations</h2>

      <h3>Current Approach</h3>
      
      <p>The current subscription model is simple and sufficient for most use cases. All subscribers are notified on any change.</p>

      <h3>Future Optimizations</h3>
      
      <p>If profiling shows performance issues, consider:</p>
      <ul>
        <li>Selector-based subscriptions</li>
        <li>Memoized selectors</li>
        <li>Virtual scrolling</li>
        <li>Canvas rendering</li>
      </ul>

      <p><strong>Current principle:</strong> Optimize only when profiling shows actual issues.</p>
    </div>
  );
}
