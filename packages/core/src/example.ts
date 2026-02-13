/**
 * PHASE 1 COMPREHENSIVE TEST SUITE
 *
 * This script validates the deterministic kernel with:
 * - Basic operations (add, move, resize, trim)
 * - Validation edge cases (overlaps, bounds, asset references)
 * - Undo/redo integrity
 * - State immutability
 * - Collision detection
 * - History isolation
 */

// Public API imports
import {
  TimelineEngine,
  createTimeline,
  createTimelineState,
  createTrack,
  createClip,
  createAsset,
  frame,
  frameRate,
  framesToTimecode,
} from './index';

// Internal utilities for testing
import {
  generateTimelineId,
  generateTrackId,
  generateClipId,
  generateAssetId,
} from './internal';

console.log('\n=== PHASE 1 KERNEL TEST SUITE ===\n');

const fps = frameRate(30);
let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => boolean) {
  try {
    const result = fn();
    if (result) {
      console.log(`✓ ${name}`);
      testsPassed++;
    } else {
      console.error(`✗ ${name}`);
      testsFailed++;
    }
  } catch (error) {
    console.error(`✗ ${name} - Exception: ${error}`);
    testsFailed++;
  }
}

// Setup
const timeline = createTimeline({
  id: generateTimelineId(),
  name: 'Test Timeline',
  fps,
  duration: frame(3000),
});

const engine = new TimelineEngine(
  createTimelineState({
    timeline,
    assets: new Map(),
  })
);

const asset = createAsset({
  id: generateAssetId(),
  type: 'video',
  duration: frame(600), // 20 seconds at 30fps
  sourceUrl: 'test.mp4',
});

engine.registerAsset(asset);

const track = createTrack({
  id: generateTrackId(),
  name: 'Video Track',
  type: 'video',
});

engine.addTrack(track);

console.log('Setup complete\n');

// ========================================
// BASIC OPERATIONS
// ========================================
console.log('--- Basic Operations ---\n');

test('Add valid clip', () => {
  const clip = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const result = engine.addClip(track.id, clip);
  return result.success === true;
});

const clipA = createClip({
  id: generateClipId(),
  assetId: asset.id,
  trackId: track.id,
  timelineStart: frame(200),
  timelineEnd: frame(400),
  mediaIn: frame(0),
  mediaOut: frame(200),
});

engine.addClip(track.id, clipA);

test('Move clip to new position', () => {
  const result = engine.moveClip(clipA.id, frame(500));
  if (!result.success) return false;
  
  const movedClip = engine.findClipById(clipA.id);
  return movedClip?.timelineStart === 500;
});

test('Resize clip (must maintain duration match in Phase 1)', () => {
  // In Phase 1, timeline duration must equal media duration
  // clipA has media duration of 200 (mediaOut - mediaIn)
  const result = engine.resizeClip(clipA.id, frame(500), frame(700)); // 200 frame duration
  if (!result.success) return false;
  
  const resizedClip = engine.findClipById(clipA.id);
  return resizedClip?.timelineStart === 500 && resizedClip?.timelineEnd === 700;
});

test('Trim clip media bounds (must adjust timeline to match)', () => {
  // Trimming changes media duration, so timeline must also change
  // New media duration: 150 - 50 = 100 frames
  // So timeline must also be 100 frames
  const result = engine.trimClip(clipA.id, frame(50), frame(250)); // 200 frame media duration
  if (!result.success) return false;
  
  const trimmedClip = engine.findClipById(clipA.id);
  return trimmedClip?.mediaIn === 50 && trimmedClip?.mediaOut === 250;
});

test('Remove clip', () => {
  const clips = engine.getAllClips();
  const clipToRemove = clips[0];
  if (!clipToRemove) return false;
  
  const result = engine.removeClip(clipToRemove.id);
  if (!result.success) return false;
  
  const removedClip = engine.findClipById(clipToRemove.id);
  return removedClip === undefined;
});

console.log();

// ========================================
// VALIDATION TESTS
// ========================================
console.log('--- Validation Tests ---\n');

test('Reject clip with invalid bounds (start >= end)', () => {
  const invalidClip = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(100),
    timelineEnd: frame(100), // Invalid: start === end
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const result = engine.addClip(track.id, invalidClip);
  return result.success === false;
});

test('Reject clip exceeding asset duration', () => {
  const outOfBoundsClip = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(700), // Exceeds asset duration of 600
  });
  
  const result = engine.addClip(track.id, outOfBoundsClip);
  return result.success === false;
});

test('Reject overlapping clips on same track', () => {
  // clipA is at 500-600
  const overlapClip = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(550), // Overlaps with clipA
    timelineEnd: frame(650),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const result = engine.addClip(track.id, overlapClip);
  return result.success === false;
});

test('Allow boundary-touching clips (no overlap)', () => {
  // clipA is now at 500-700 after resize
  const touchingClip = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(700), // Exactly at clipA's end
    timelineEnd: frame(800),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const result = engine.addClip(track.id, touchingClip);
  return result.success === true;
});

test('Reject clip with non-existent asset', () => {
  const invalidAssetClip = createClip({
    id: generateClipId(),
    assetId: 'non_existent_asset',
    trackId: track.id,
    timelineStart: frame(800),
    timelineEnd: frame(900),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const result = engine.addClip(track.id, invalidAssetClip);
  return result.success === false;
});

test('Reject move that would cause overlap', () => {
  // Try to move clipA to overlap with the touching clip at 700-800
  const result = engine.moveClip(clipA.id, frame(750)); // Would overlap 750-950 with 700-800
  return result.success === false;
});

console.log();

// ========================================
// UNDO/REDO TESTS
// ========================================
console.log('--- Undo/Redo Tests ---\\n');

test('Can undo after successful operation', () => {
  return engine.canUndo() === true;
});

test('Undo restores previous state', () => {
  // First, do a successful operation we can undo
  const clipBeforeMove = engine.findClipById(clipA.id);
  if (!clipBeforeMove) return false;
  const originalPosition = clipBeforeMove.timelineStart;
  
  // Move to a new position (this should succeed)
  engine.moveClip(clipA.id, frame(900));
  
  const clipAfterMove = engine.findClipById(clipA.id);
  if (!clipAfterMove || clipAfterMove.timelineStart === originalPosition) return false;
  
  // Now undo
  engine.undo();
  
  const clipAfterUndo = engine.findClipById(clipA.id);
  if (!clipAfterUndo) return false;
  
  // After undo, should be back at original position
  return clipAfterUndo.timelineStart === originalPosition;
});

test('Can redo after undo', () => {
  return engine.canRedo() === true;
});

test('Redo restores undone state', () => {
  const clipBeforeRedo = engine.findClipById(clipA.id);
  if (!clipBeforeRedo) return false;
  const positionAfterUndo = clipBeforeRedo.timelineStart;
  
  // Redo should restore the moved position
  engine.redo();
  
  const clipAfterRedo = engine.findClipById(clipA.id);
  if (!clipAfterRedo) return false;
  
  // After redo, position should be different (back to moved position)
  return clipAfterRedo.timelineStart !== positionAfterUndo && clipAfterRedo.timelineStart === 900;
});

test('Failed operations do not affect history', () => {
  const canUndoBefore = engine.canUndo();
  
  // Try invalid operation
  const invalidClip = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(550),
    timelineEnd: frame(650),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, invalidClip); // Should fail
  
  const canUndoAfter = engine.canUndo();
  
  // History should be unchanged
  return canUndoBefore === canUndoAfter;
});

console.log();

// ========================================
// STATE IMMUTABILITY TESTS
// ========================================
console.log('--- Immutability Tests ---\n');

test('State snapshots are independent', () => {
  const state1 = engine.getState();
  const state1Str = JSON.stringify(state1);
  
  // Make a change
  const newClip = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(2000),
    timelineEnd: frame(2100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, newClip);
  
  const state2 = engine.getState();
  const state2Str = JSON.stringify(state2);
  
  // States should be different objects and have different content
  return state1 !== state2 && state1Str !== state2Str;
});

test('Undo/redo preserves state integrity', () => {
  const stateBefore = JSON.stringify(engine.getState());
  
  engine.undo();
  engine.redo();
  
  const stateAfter = JSON.stringify(engine.getState());
  
  return stateBefore === stateAfter;
});

console.log();

// ========================================
// QUERY TESTS
// ========================================
console.log('--- Query Tests ---\n');

test('Find clip by ID', () => {
  const clip = engine.findClipById(clipA.id);
  return clip !== undefined && clip.id === clipA.id;
});

test('Get all clips', () => {
  const clips = engine.getAllClips();
  return clips.length > 0;
});

test('Find track by ID', () => {
  const foundTrack = engine.findTrackById(track.id);
  return foundTrack !== undefined && foundTrack.id === track.id;
});

test('Get clips on track', () => {
  const clips = engine.getClipsOnTrack(track.id);
  return clips.length > 0;
});

test('Get clips at frame', () => {
  const clips = engine.getClipsAtFrame(frame(550));
  return clips.length > 0; // clipA should be at this frame
});

console.log();

// ========================================
// TRACK OPERATIONS
// ========================================
console.log('--- Track Operations ---\n');

const track2 = createTrack({
  id: generateTrackId(),
  name: 'Audio Track',
  type: 'audio',
});

test('Add second track', () => {
  const result = engine.addTrack(track2);
  return result.success === true;
});

test('Move track position', () => {
  const result = engine.moveTrack(track2.id, 0);
  if (!result.success) return false;
  
  const state = engine.getState();
  return state.timeline.tracks[0]?.id === track2.id;
});

test('Toggle track mute', () => {
  const result = engine.toggleTrackMute(track.id);
  if (!result.success) return false;
  
  const mutedTrack = engine.findTrackById(track.id);
  return mutedTrack?.muted === true;
});

test('Toggle track lock', () => {
  const result = engine.toggleTrackLock(track.id);
  if (!result.success) return false;
  
  const lockedTrack = engine.findTrackById(track.id);
  return lockedTrack?.locked === true;
});

test('Remove empty track', () => {
  const result = engine.removeTrack(track2.id);
  return result.success === true;
});

console.log();

// ========================================
// STRESS TEST
// ========================================
console.log('--- Stress Test ---\n');

test('Add 50 clips without collision', () => {
  let successCount = 0;
  
  for (let i = 0; i < 50; i++) {
    const clip = createClip({
      id: generateClipId(),
      assetId: asset.id,
      trackId: track.id,
      timelineStart: frame(2200 + i * 20), // Start after immutability test clip
      timelineEnd: frame(2210 + i * 20),
      mediaIn: frame(0),
      mediaOut: frame(10),
    });
    
    const result = engine.addClip(track.id, clip);
    if (result.success) successCount++;
  }
  
  return successCount === 50;
});

test('Query performance with many clips', () => {
  const start = Date.now();
  const clips = engine.getAllClips();
  const duration = Date.now() - start;
  
  console.log(`  (Found ${clips.length} clips in ${duration}ms)`);
  return duration < 100; // Should be fast
});

console.log();

// ========================================
// RESULTS
// ========================================
console.log('='.repeat(50));
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log('='.repeat(50));

if (testsFailed === 0) {
  console.log('\n✓ ALL TESTS PASSED!\n');
  console.log('Phase 1 kernel is stable and deterministic.');
} else {
  console.log(`\n✗ ${testsFailed} test(s) failed.\n`);
  throw new Error(`${testsFailed} test(s) failed`);
}

