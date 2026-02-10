/**
 * Test Script for Timeline Core
 * 
 * This script tests all major functionality of the timeline core library.
 */

import {
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
  removeClip,
  updateClip,
  addMarker,
  
  // Clip operations
  moveClip,
  resizeClip,
  splitClip,
  getClipEnd,
  
  // Selection operations
  selectClip,
  addClipToSelection,
  clearSelection,
  
  // Snapping
  snapTime,
  
  // Viewport
  timeToPixels,
  pixelsToTime,
  
  // Utilities
  generateTimelineId,
  generateTrackId,
  generateClipId,
  generateMarkerId,
  msToSeconds,
  msToMinutesSeconds,
} from './index';

// Test counter
let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error}`);
    testsFailed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log('🧪 Running Timeline Core Tests\n');

// ===== BASIC CREATION TESTS =====

test('Create timeline', () => {
  const timeline = createTimeline({
    id: generateTimelineId(),
    name: 'Test Timeline',
    duration: timeMs(60000),
  });
  
  assert(timeline.name === 'Test Timeline', 'Timeline name should match');
  assert(timeline.duration === 60000, 'Timeline duration should be 60000ms');
  assert(timeline.tracks.length === 0, 'Timeline should start with no tracks');
});

test('Create track', () => {
  const track = createTrack({
    id: generateTrackId(),
    name: 'Test Track',
  });
  
  assert(track.name === 'Test Track', 'Track name should match');
  assert(track.clips.length === 0, 'Track should start with no clips');
  assert(track.muted === false, 'Track should not be muted by default');
  assert(track.locked === false, 'Track should not be locked by default');
  assert(track.visible === true, 'Track should be visible by default');
});

test('Create clip', () => {
  const clip = createClip({
    id: generateClipId(),
    trackId: 'track_1',
    type: 'video',
    sourceId: 'video.mp4',
    start: timeMs(1000),
    duration: timeMs(5000),
  });
  
  assert(clip.type === 'video', 'Clip type should be video');
  assert(clip.start === 1000, 'Clip start should be 1000ms');
  assert(clip.duration === 5000, 'Clip duration should be 5000ms');
  assert(getClipEnd(clip) === 6000, 'Clip end should be 6000ms');
});

// ===== TIMELINE OPERATIONS TESTS =====

test('Add track to timeline', () => {
  let timeline = createTimeline({
    id: generateTimelineId(),
    name: 'Test',
    duration: timeMs(60000),
  });
  
  const track = createTrack({
    id: generateTrackId(),
    name: 'Track 1',
  });
  
  timeline = addTrack(timeline, track);
  
  assert(timeline.tracks.length === 1, 'Timeline should have 1 track');
  assert(timeline.tracks[0].id === track.id, 'Track ID should match');
});

test('Add clip to timeline', () => {
  let timeline = createTimeline({
    id: generateTimelineId(),
    name: 'Test',
    duration: timeMs(60000),
  });
  
  const track = createTrack({
    id: generateTrackId(),
    name: 'Track 1',
  });
  
  timeline = addTrack(timeline, track);
  
  const clip = createClip({
    id: generateClipId(),
    trackId: track.id,
    type: 'video',
    sourceId: 'video.mp4',
    start: timeMs(1000),
    duration: timeMs(5000),
  });
  
  timeline = addClip(timeline, clip);
  
  assert(timeline.tracks[0].clips.length === 1, 'Track should have 1 clip');
  assert(timeline.tracks[0].clips[0].id === clip.id, 'Clip ID should match');
});

// ===== CLIP OPERATIONS TESTS =====

test('Move clip', () => {
  const clip = createClip({
    id: generateClipId(),
    trackId: 'track_1',
    type: 'video',
    sourceId: 'video.mp4',
    start: timeMs(1000),
    duration: timeMs(5000),
  });
  
  const movedClip = moveClip(clip, timeMs(3000));
  
  assert(movedClip.start === 3000, 'Clip should be moved to 3000ms');
  assert(movedClip.duration === 5000, 'Duration should remain unchanged');
  assert(clip.start === 1000, 'Original clip should be unchanged (immutable)');
});

test('Resize clip', () => {
  const clip = createClip({
    id: generateClipId(),
    trackId: 'track_1',
    type: 'video',
    sourceId: 'video.mp4',
    start: timeMs(1000),
    duration: timeMs(5000),
  });
  
  const resizedClip = resizeClip(clip, timeMs(8000));
  
  assert(resizedClip.duration === 8000, 'Clip should be resized to 8000ms');
  assert(resizedClip.start === 1000, 'Start should remain unchanged');
  assert(clip.duration === 5000, 'Original clip should be unchanged (immutable)');
});

test('Split clip', () => {
  const clip = createClip({
    id: generateClipId(),
    trackId: 'track_1',
    type: 'video',
    sourceId: 'video.mp4',
    start: timeMs(1000),
    duration: timeMs(6000),
  });
  
  const [leftClip, rightClip] = splitClip(clip, timeMs(4000), generateClipId);
  
  assert(leftClip.start === 1000, 'Left clip should start at 1000ms');
  assert(leftClip.duration === 3000, 'Left clip should be 3000ms long');
  assert(rightClip.start === 4000, 'Right clip should start at 4000ms');
  assert(rightClip.duration === 3000, 'Right clip should be 3000ms long');
  assert(getClipEnd(leftClip) === 4000, 'Left clip should end at 4000ms');
  assert(getClipEnd(rightClip) === 7000, 'Right clip should end at 7000ms');
});

// ===== SELECTION TESTS =====

test('Selection state', () => {
  let selection = createSelectionState();
  
  assert(selection.clipIds.size === 0, 'Selection should start empty');
  
  selection = selectClip(selection, 'clip_1');
  assert(selection.clipIds.size === 1, 'Selection should have 1 clip');
  assert(selection.clipIds.has('clip_1'), 'Selection should contain clip_1');
  
  selection = addClipToSelection(selection, 'clip_2');
  assert(selection.clipIds.size === 2, 'Selection should have 2 clips');
  
  selection = clearSelection(selection);
  assert(selection.clipIds.size === 0, 'Selection should be cleared');
});

// ===== SNAPPING TESTS =====

test('Snapping to clip edges', () => {
  let timeline = createTimeline({
    id: generateTimelineId(),
    name: 'Test',
    duration: timeMs(60000),
  });
  
  const track = createTrack({
    id: generateTrackId(),
    name: 'Track 1',
  });
  
  timeline = addTrack(timeline, track);
  
  const clip = createClip({
    id: generateClipId(),
    trackId: track.id,
    type: 'video',
    sourceId: 'video.mp4',
    start: timeMs(5000),
    duration: timeMs(3000),
  });
  
  timeline = addClip(timeline, clip);
  
  // Try to snap to 5050ms (close to clip start at 5000ms)
  const snapResult = snapTime(timeline, timeMs(5050));
  
  assert(snapResult.snapped === true, 'Should snap to nearby clip edge');
  assert(snapResult.snappedTime === 5000, 'Should snap to clip start at 5000ms');
  assert(snapResult.target?.type === 'clip-start', 'Should snap to clip-start');
});

// ===== VIEWPORT TESTS =====

test('Viewport calculations', () => {
  const viewport = createViewportState({
    zoom: 0.1, // 0.1 pixels per millisecond
    scrollTime: timeMs(0),
    viewportWidth: 1000,
  });
  
  // Time to pixels
  const pixels = timeToPixels(viewport, timeMs(5000));
  assert(pixels === 500, 'Time 5000ms should be at pixel 500');
  
  // Pixels to time
  const time = pixelsToTime(viewport, 500);
  assert(time === 5000, 'Pixel 500 should be at time 5000ms');
});

// ===== TIME UTILITY TESTS =====

test('Time conversions', () => {
  assert(msToSeconds(timeMs(5000)) === 5, 'Should convert 5000ms to 5 seconds');
  assert(msToMinutesSeconds(timeMs(125000)) === '2:05', 'Should format as 2:05');
});

// ===== IMMUTABILITY TESTS =====

test('Immutability - operations return new objects', () => {
  const originalClip = createClip({
    id: generateClipId(),
    trackId: 'track_1',
    type: 'video',
    sourceId: 'video.mp4',
    start: timeMs(1000),
    duration: timeMs(5000),
  });
  
  const movedClip = moveClip(originalClip, timeMs(3000));
  
  assert(originalClip.start === 1000, 'Original clip should be unchanged');
  assert(movedClip.start === 3000, 'New clip should have new start time');
  assert(originalClip !== movedClip, 'Should be different objects');
});

// ===== MARKER TESTS =====

test('Add marker to timeline', () => {
  let timeline = createTimeline({
    id: generateTimelineId(),
    name: 'Test',
    duration: timeMs(60000),
  });
  
  const marker = createMarker({
    id: generateMarkerId(),
    time: timeMs(10000),
    label: 'Chapter 1',
  });
  
  timeline = addMarker(timeline, marker);
  
  assert(timeline.markers.length === 1, 'Timeline should have 1 marker');
  assert(timeline.markers[0].time === 10000, 'Marker should be at 10000ms');
});

// ===== PRINT RESULTS =====

console.log('\n' + '='.repeat(50));
console.log(`\n📊 Test Results:`);
console.log(`   ✅ Passed: ${testsPassed}`);
console.log(`   ❌ Failed: ${testsFailed}`);
console.log(`   📈 Total: ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
  console.log('\n🎉 All tests passed!\n');
} else {
  console.log(`\n⚠️  ${testsFailed} test(s) failed\n`);
  process.exit(1);
}
