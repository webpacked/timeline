/**
 * App Component
 * 
 * WHAT THIS DOES:
 * - Creates initial timeline with sample data
 * - Renders TimelineEditor
 * 
 * WHAT THIS DOES NOT DO:
 * - Persist data
 * - Load from server
 * - Handle routing
 * 
 * WHY IT EXISTS:
 * - Entry point for the app
 * - Sets up demo data for validation
 */

import {
  createTimeline,
  createTrack,
  createClip,
  timeMs,
  generateTimelineId,
  generateTrackId,
  generateClipId,
} from '@timeline/core';
import { TimelineEditor } from './TimelineEditor';

function App() {
  // Create a sample timeline for validation
  const initialTimeline = createTimeline({
    id: generateTimelineId(),
    name: 'Phase 2 Validation Timeline',
    duration: timeMs(60000), // 60 seconds
    tracks: [
      createTrack({
        id: generateTrackId(),
        name: 'Video Track 1',
        clips: [
          createClip({
            id: generateClipId(),
            trackId: 'track_1', // Will be updated
            type: 'video',
            sourceId: 'video1.mp4',
            start: timeMs(1000),
            duration: timeMs(5000),
          }),
          createClip({
            id: generateClipId(),
            trackId: 'track_1',
            type: 'video',
            sourceId: 'video2.mp4',
            start: timeMs(7000),
            duration: timeMs(3000),
          }),
        ],
      }),
      createTrack({
        id: generateTrackId(),
        name: 'Audio Track 1',
        clips: [
          createClip({
            id: generateClipId(),
            trackId: 'track_2',
            type: 'audio',
            sourceId: 'audio1.mp3',
            start: timeMs(2000),
            duration: timeMs(8000),
          }),
        ],
      }),
    ],
  });
  
  // Fix track IDs in clips
  initialTimeline.tracks[0].clips.forEach(clip => {
    clip.trackId = initialTimeline.tracks[0].id;
  });
  initialTimeline.tracks[1].clips.forEach(clip => {
    clip.trackId = initialTimeline.tracks[1].id;
  });
  
  return <TimelineEditor initialTimeline={initialTimeline} />;
}

export default App;
