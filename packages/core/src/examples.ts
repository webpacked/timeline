/**
 * Timeline Core - Usage Examples
 * 
 * This file demonstrates how to use the timeline core library.
 * These examples show the LOGIC only - no UI, no rendering.
 * 
 * Think of this as the "engine" that powers a timeline UI.
 */

import {
  // Types
  type Timeline,
  type Track,
  type Clip,
  type SelectionState,
  type ViewportState,
  
  // Factory functions
  timeMs,
  createTimeline,
  createTrack,
  createClip,
  createMarker,
  createSelectionState,
  createViewportState,
  
  // Timeline operations
  addTrack,
  addClip,
  addMarker,
  
  // Clip operations
  moveClip,
  resizeClip,
  splitClip,
  
  // Selection operations
  selectClip,
  addClipToSelection,
  
  // Snapping
  snapClipStart,
  
  // Utilities
  generateTimelineId,
  generateTrackId,
  generateClipId,
  generateMarkerId,
  msToMinutesSeconds,
} from './index';

/**
 * EXAMPLE 1: Creating a basic timeline
 * 
 * This shows how to create a timeline with tracks and clips.
 */
export function example1_CreateBasicTimeline(): Timeline {
  console.log('=== Example 1: Creating a basic timeline ===\n');
  
  // Step 1: Create an empty timeline (60 seconds long)
  let timeline = createTimeline({
    id: generateTimelineId(),
    name: 'My First Timeline',
    duration: timeMs(60000), // 60 seconds = 60,000 milliseconds
  });
  
  console.log(`Created timeline: "${timeline.name}"`);
  console.log(`Duration: ${msToMinutesSeconds(timeline.duration)}\n`);
  
  // Step 2: Create a video track
  const videoTrack = createTrack({
    id: generateTrackId(),
    name: 'Video Track 1',
  });
  
  // Step 3: Add the track to the timeline
  timeline = addTrack(timeline, videoTrack);
  console.log(`Added track: "${videoTrack.name}"\n`);
  
  // Step 4: Create a video clip (5 seconds long, starts at 2 seconds)
  const videoClip = createClip({
    id: generateClipId(),
    trackId: videoTrack.id,
    type: 'video',
    sourceId: 'video_file_123.mp4',
    start: timeMs(2000), // Start at 2 seconds
    duration: timeMs(5000), // 5 seconds long
  });
  
  // Step 5: Add the clip to the timeline
  timeline = addClip(timeline, videoClip);
  console.log(`Added clip: ${videoClip.type} from ${msToMinutesSeconds(videoClip.start)} to ${msToMinutesSeconds(timeMs(videoClip.start + videoClip.duration))}\n`);
  
  // Step 6: Add a marker at 10 seconds
  const marker = createMarker({
    id: generateMarkerId(),
    time: timeMs(10000),
    label: 'Important moment',
    color: '#ff0000',
  });
  
  timeline = addMarker(timeline, marker);
  console.log(`Added marker: "${marker.label}" at ${msToMinutesSeconds(marker.time)}\n`);
  
  return timeline;
}

/**
 * EXAMPLE 2: Editing clips
 * 
 * This shows how to move, resize, and split clips.
 */
export function example2_EditingClips(): void {
  console.log('=== Example 2: Editing clips ===\n');
  
  // Create a timeline with a clip
  let timeline = createTimeline({
    id: generateTimelineId(),
    name: 'Editing Demo',
    duration: timeMs(60000),
  });
  
  const track = createTrack({
    id: generateTrackId(),
    name: 'Track 1',
  });
  
  timeline = addTrack(timeline, track);
  
  let clip = createClip({
    id: generateClipId(),
    trackId: track.id,
    type: 'video',
    sourceId: 'video.mp4',
    start: timeMs(1000), // 1 second
    duration: timeMs(5000), // 5 seconds
  });
  
  timeline = addClip(timeline, clip);
  console.log(`Original clip: start=${msToMinutesSeconds(clip.start)}, duration=${msToMinutesSeconds(clip.duration)}\n`);
  
  // OPERATION 1: Move the clip to 3 seconds
  clip = moveClip(clip, timeMs(3000));
  console.log(`After move: start=${msToMinutesSeconds(clip.start)}\n`);
  
  // OPERATION 2: Resize the clip to 8 seconds
  clip = resizeClip(clip, timeMs(8000));
  console.log(`After resize: duration=${msToMinutesSeconds(clip.duration)}\n`);
  
  // OPERATION 3: Split the clip at 5 seconds
  const [leftClip, rightClip] = splitClip(clip, timeMs(5000), generateClipId);
  console.log(`After split:`);
  console.log(`  Left clip: start=${msToMinutesSeconds(leftClip.start)}, duration=${msToMinutesSeconds(leftClip.duration)}`);
  console.log(`  Right clip: start=${msToMinutesSeconds(rightClip.start)}, duration=${msToMinutesSeconds(rightClip.duration)}\n`);
}

/**
 * EXAMPLE 3: Selection and multi-select
 * 
 * This shows how to manage selection state.
 */
export function example3_Selection(): void {
  console.log('=== Example 3: Selection ===\n');
  
  // Create a timeline with multiple clips
  let timeline = createTimeline({
    id: generateTimelineId(),
    name: 'Selection Demo',
    duration: timeMs(60000),
  });
  
  const track = createTrack({
    id: generateTrackId(),
    name: 'Track 1',
  });
  
  timeline = addTrack(timeline, track);
  
  const clip1 = createClip({
    id: generateClipId(),
    trackId: track.id,
    type: 'video',
    sourceId: 'video1.mp4',
    start: timeMs(1000),
    duration: timeMs(3000),
  });
  
  const clip2 = createClip({
    id: generateClipId(),
    trackId: track.id,
    type: 'video',
    sourceId: 'video2.mp4',
    start: timeMs(5000),
    duration: timeMs(3000),
  });
  
  timeline = addClip(timeline, clip1);
  timeline = addClip(timeline, clip2);
  
  // Create selection state
  let selection = createSelectionState();
  console.log(`Initial selection: ${selection.clipIds.size} clips selected\n`);
  
  // Select first clip
  selection = selectClip(selection, clip1.id);
  console.log(`Selected clip 1: ${selection.clipIds.size} clips selected\n`);
  
  // Add second clip to selection (multi-select)
  selection = addClipToSelection(selection, clip2.id);
  console.log(`Added clip 2 to selection: ${selection.clipIds.size} clips selected\n`);
  
  console.log(`Selected clip IDs: ${Array.from(selection.clipIds).join(', ')}\n`);
}

/**
 * EXAMPLE 4: Snapping
 * 
 * This shows how snapping works when moving clips.
 */
export function example4_Snapping(): void {
  console.log('=== Example 4: Snapping ===\n');
  
  // Create a timeline with clips and markers
  let timeline = createTimeline({
    id: generateTimelineId(),
    name: 'Snapping Demo',
    duration: timeMs(60000),
  });
  
  const track = createTrack({
    id: generateTrackId(),
    name: 'Track 1',
  });
  
  timeline = addTrack(timeline, track);
  
  // Add a clip at 5 seconds
  const existingClip = createClip({
    id: generateClipId(),
    trackId: track.id,
    type: 'video',
    sourceId: 'video1.mp4',
    start: timeMs(5000),
    duration: timeMs(3000),
  });
  
  timeline = addClip(timeline, existingClip);
  
  // Add a marker at 10 seconds
  const marker = createMarker({
    id: generateMarkerId(),
    time: timeMs(10000),
    label: 'Chapter 1',
  });
  
  timeline = addMarker(timeline, marker);
  
  // Now let's try to move a new clip to 5050ms (close to existing clip)
  const newClip = createClip({
    id: generateClipId(),
    trackId: track.id,
    type: 'video',
    sourceId: 'video2.mp4',
    start: timeMs(0),
    duration: timeMs(2000),
  });
  
  // Try to snap the clip start to 5050ms
  const snapResult = snapClipStart(timeline, newClip, timeMs(5050));
  
  console.log(`Trying to place clip at ${snapResult.originalTime}ms`);
  
  if (snapResult.snapped) {
    console.log(`✓ Snapped to ${snapResult.snappedTime}ms`);
    console.log(`  Target: ${snapResult.target?.type}`);
    console.log(`  Distance: ${snapResult.distance}ms\n`);
  } else {
    console.log(`✗ No snap target found\n`);
  }
}

/**
 * EXAMPLE 5: Viewport calculations
 * 
 * This shows how to convert between time and pixels.
 */
export function example5_Viewport(): void {
  console.log('=== Example 5: Viewport calculations ===\n');
  
  // Create a viewport (1000px wide, showing first 10 seconds)
  const viewport = createViewportState({
    zoom: 0.1, // 0.1 pixels per millisecond = 100 pixels per second
    scrollTime: timeMs(0), // Start at beginning
    viewportWidth: 1000, // 1000 pixels wide
  });
  
  console.log(`Viewport: ${viewport.viewportWidth}px wide`);
  console.log(`Zoom: ${viewport.zoom} pixels/ms (${viewport.zoom * 1000} pixels/second)\n`);
  
  // Calculate what time range is visible
  const visibleDuration = viewport.viewportWidth / viewport.zoom;
  console.log(`Visible duration: ${msToMinutesSeconds(timeMs(visibleDuration))}\n`);
  
  // Convert time to pixel position
  const time5s = timeMs(5000); // 5 seconds
  const pixelPos = (time5s - viewport.scrollTime) * viewport.zoom;
  console.log(`Time ${msToMinutesSeconds(time5s)} is at pixel ${pixelPos}\n`);
  
  // Convert pixel position back to time
  const pixel500 = 500;
  const timeAtPixel = timeMs(viewport.scrollTime + pixel500 / viewport.zoom);
  console.log(`Pixel ${pixel500} is at time ${msToMinutesSeconds(timeAtPixel)}\n`);
}

/**
 * Run all examples
 */
export function runAllExamples(): void {
  example1_CreateBasicTimeline();
  console.log('\n' + '='.repeat(50) + '\n');
  
  example2_EditingClips();
  console.log('\n' + '='.repeat(50) + '\n');
  
  example3_Selection();
  console.log('\n' + '='.repeat(50) + '\n');
  
  example4_Snapping();
  console.log('\n' + '='.repeat(50) + '\n');
  
  example5_Viewport();
}

// Run examples:
runAllExamples();
