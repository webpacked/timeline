/**
 * STRESS TEST SUITE
 * 
 * Tests system performance and stability with large-scale operations:
 * - 1000 clips
 * - 100 link groups
 * - 50 nested groups
 * - 500 markers
 * - 200 ripple edits in a row
 * - 50 transaction rollbacks
 */

// Import all internal systems for testing
import {
  TimelineEngine,
  createTimeline,
  createTrack,
  createClip,
  createAsset,
  createTimelineState,
  frame,
  frameRate,
  generateClipId,
  generateTrackId,
  generateAssetId,
  generateTimelineId,
  generateLinkGroupId,
  generateGroupId,
  generateMarkerId,
  beginTransaction,
  applyOperation,
  commitTransaction,
  rollbackTransaction,
  createLinkGroup,
  createGroup,
  addTimelineMarker,
  addClipMarker,
  addRegionMarker,
  rippleDelete,
  addClip,
} from '../internal';

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void) {
  try {
    const start = Date.now();
    fn();
    const duration = Date.now() - start;
    console.log(`✓ ${name} (${duration}ms)`);
    testsPassed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    testsFailed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

// Setup helper
function createTestEngine() {
  const timeline = createTimeline({
    id: generateTimelineId(),
    name: 'Stress Test Timeline',
    fps: frameRate(30),
    duration: frame(1000000), // Very long timeline for stress testing
    tracks: [],
  });

  const state = createTimelineState({ timeline });
  return new TimelineEngine(state);
}

console.log('\n=== STRESS TEST SUITE ===\n');
console.log('Testing system stability with large-scale operations...\n');

// ===== STRESS TEST 1: 1000 CLIPS =====
console.log('--- Stress Test 1: 1000 Clips ---');

test('Add 1000 clips across 10 tracks', () => {
  const engine = createTestEngine();
  
  // Create 10 tracks
  const tracks = [];
  for (let i = 0; i < 10; i++) {
    const track = createTrack({
      id: generateTrackId(),
      name: `Track ${i + 1}`,
      type: i % 2 === 0 ? 'video' : 'audio',
    });
    engine.addTrack(track);
    tracks.push(track);
  }
  
  // Create assets
  const assets = [];
  for (let i = 0; i < 10; i++) {
    const asset = createAsset({
      id: generateAssetId(),
      type: i % 2 === 0 ? 'video' : 'audio',
      duration: frame(1000),
      sourceUrl: `test-${i}.mp4`,
    });
    engine.registerAsset(asset);
    assets.push(asset);
  }
  
  // Add 1000 clips (100 per track)
  let clipCount = 0;
  for (let trackIdx = 0; trackIdx < 10; trackIdx++) {
    const track = tracks[trackIdx]!;
    const asset = assets[trackIdx]!;
    
    for (let clipIdx = 0; clipIdx < 100; clipIdx++) {
      const startFrame = clipIdx * 1100; // 100 frame clip + 1000 frame gap
      const clip = createClip({
        id: generateClipId(),
        assetId: asset.id,
        trackId: track.id,
        timelineStart: frame(startFrame),
        timelineEnd: frame(startFrame + 100),
        mediaIn: frame(0),
        mediaOut: frame(100),
      });
      
      engine.addClip(track.id, clip);
      clipCount++;
    }
  }
  
  assert(clipCount === 1000, 'Added 1000 clips');
  
  const state = engine.getState();
  let totalClips = 0;
  for (const track of state.timeline.tracks) {
    totalClips += track.clips.length;
  }
  
  assert(totalClips === 1000, 'State contains 1000 clips');
});

// ===== STRESS TEST 2: 100 LINK GROUPS =====
console.log('--- Stress Test 2: 100 Link Groups ---');

test('Create 100 link groups with 10 clips each', () => {
  const engine = createTestEngine();
  
  // Create 1 track
  const track = createTrack({
    id: generateTrackId(),
    name: 'Track 1',
    type: 'video',
  });
  engine.addTrack(track);
  
  // Create asset
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(1000),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  // Add 1000 clips (10 per link group)
  const clipIds: string[] = [];
  for (let i = 0; i < 1000; i++) {
    const startFrame = i * 1100;
    const clip = createClip({
      id: generateClipId(),
      assetId: asset.id,
      trackId: track.id,
      timelineStart: frame(startFrame),
      timelineEnd: frame(startFrame + 100),
      mediaIn: frame(0),
      mediaOut: frame(100),
    });
    
    engine.addClip(track.id, clip);
    clipIds.push(clip.id);
  }
  
  // Create 100 link groups
  let state = engine.getState();
  for (let groupIdx = 0; groupIdx < 100; groupIdx++) {
    const groupClipIds = clipIds.slice(groupIdx * 10, (groupIdx + 1) * 10);
    state = createLinkGroup(state, groupClipIds);
  }
  
  assert(state.linkGroups.size === 100, 'Created 100 link groups');
  
  // Verify each link group has 10 clips
  let totalLinkedClips = 0;
  for (const [_, linkGroup] of state.linkGroups) {
    assert(linkGroup.clipIds.length === 10, 'Link group has 10 clips');
    totalLinkedClips += linkGroup.clipIds.length;
  }
  
  assert(totalLinkedClips === 1000, 'All 1000 clips are linked');
});

// ===== STRESS TEST 3: 50 NESTED GROUPS =====
console.log('--- Stress Test 3: 50 Nested Groups ---');

test('Create 50 levels of nested groups', () => {
  const engine = createTestEngine();
  
  // Create track
  const track = createTrack({
    id: generateTrackId(),
    name: 'Track 1',
    type: 'video',
  });
  engine.addTrack(track);
  
  // Create asset
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(1000),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  // Add 50 clips (one per group level)
  const clipIds: string[] = [];
  for (let i = 0; i < 50; i++) {
    const clip = createClip({
      id: generateClipId(),
      assetId: asset.id,
      trackId: track.id,
      timelineStart: frame(i * 1100),
      timelineEnd: frame(i * 1100 + 100),
      mediaIn: frame(0),
      mediaOut: frame(100),
    });
    
    engine.addClip(track.id, clip);
    clipIds.push(clip.id);
  }
  
  // Create nested groups (each child is nested under previous parent)
  let state = engine.getState();
  let parentGroupId: string | undefined = undefined;
  
  for (let i = 0; i < 50; i++) {
    const options = parentGroupId ? { parentGroupId } : undefined;
    state = createGroup(state, [clipIds[i]!], `Group Level ${i + 1}`, options);
    
    // Get the group ID of the clip we just added
    const clip = state.timeline.tracks[0]!.clips.find(c => c.id === clipIds[i])!;
    parentGroupId = clip.groupId;
  }
  
  assert(state.groups.size === 50, 'Created 50 nested groups');
  
  // Verify nesting depth
  let depth = 0;
  let currentParentId = parentGroupId;
  while (currentParentId) {
    depth++;
    const group = state.groups.get(currentParentId);
    currentParentId = group?.parentGroupId;
  }
  
  assert(depth === 50, 'Nesting depth is 50 levels');
});

// ===== STRESS TEST 4: 500 MARKERS =====
console.log('--- Stress Test 4: 500 Markers ---');

test('Add 500 markers (200 timeline, 200 clip, 100 region)', () => {
  const engine = createTestEngine();
  
  // Create track
  const track = createTrack({
    id: generateTrackId(),
    name: 'Track 1',
    type: 'video',
  });
  engine.addTrack(track);
  
  // Create asset
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(10000),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  // Add 100 clips for clip markers
  const clipIds: string[] = [];
  for (let i = 0; i < 100; i++) {
    const clip = createClip({
      id: generateClipId(),
      assetId: asset.id,
      trackId: track.id,
      timelineStart: frame(i * 1100),
      timelineEnd: frame(i * 1100 + 1000),
      mediaIn: frame(0),
      mediaOut: frame(1000),
    });
    
    engine.addClip(track.id, clip);
    clipIds.push(clip.id);
  }
  
  let state = engine.getState();
  
  // Add 200 timeline markers
  for (let i = 0; i < 200; i++) {
    state = addTimelineMarker(state, {
      id: generateMarkerId(),
      type: 'timeline',
      frame: frame(i * 500),
      label: `Timeline Marker ${i + 1}`,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    });
  }
  
  // Add 200 clip markers (2 per clip)
  for (let i = 0; i < 100; i++) {
    const clipId = clipIds[i]!;
    
    state = addClipMarker(state, {
      id: generateMarkerId(),
      type: 'clip',
      clipId,
      frame: frame(250),
      label: `Clip ${i + 1} Marker 1`,
    });
    
    state = addClipMarker(state, {
      id: generateMarkerId(),
      type: 'clip',
      clipId,
      frame: frame(750),
      label: `Clip ${i + 1} Marker 2`,
    });
  }
  
  // Add 100 region markers
  for (let i = 0; i < 100; i++) {
    state = addRegionMarker(state, {
      id: generateMarkerId(),
      type: 'region',
      startFrame: frame(i * 1000),
      endFrame: frame(i * 1000 + 500),
      label: `Region ${i + 1}`,
    });
  }
  
  assert(state.markers.timeline.length === 200, 'Added 200 timeline markers');
  assert(state.markers.clips.length === 200, 'Added 200 clip markers');
  assert(state.markers.regions.length === 100, 'Added 100 region markers');
  
  const totalMarkers = state.markers.timeline.length + 
                       state.markers.clips.length + 
                       state.markers.regions.length;
  assert(totalMarkers === 500, 'Total 500 markers');
});

// ===== STRESS TEST 5: 200 RIPPLE EDITS IN A ROW =====
console.log('--- Stress Test 5: 200 Ripple Edits in a Row ---');

test('Perform 200 consecutive ripple deletes', () => {
  const engine = createTestEngine();
  
  // Create track
  const track = createTrack({
    id: generateTrackId(),
    name: 'Track 1',
    type: 'video',
  });
  engine.addTrack(track);
  
  // Create asset
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(1000),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  // Add 300 clips
  const clipIds: string[] = [];
  for (let i = 0; i < 300; i++) {
    const clip = createClip({
      id: generateClipId(),
      assetId: asset.id,
      trackId: track.id,
      timelineStart: frame(i * 100), // No gaps - clips are adjacent
      timelineEnd: frame((i + 1) * 100),
      mediaIn: frame(0),
      mediaOut: frame(100),
    });
    
    engine.addClip(track.id, clip);
    clipIds.push(clip.id);
  }
  
  let state = engine.getState();
  
  // Perform 200 ripple deletes (always delete the first clip)
  for (let i = 0; i < 200; i++) {
    const firstClip = state.timeline.tracks[0]!.clips[0];
    if (!firstClip) {
      throw new Error('No clips remaining');
    }
    
    state = rippleDelete(state, firstClip.id);
  }
  
  // Should have 100 clips remaining
  const remainingClips = state.timeline.tracks[0]!.clips.length;
  assert(remainingClips === 100, `100 clips remaining (got ${remainingClips})`);
  
  // First clip should start at frame 0 (all previous clips rippled away)
  const firstClipStart = state.timeline.tracks[0]!.clips[0]!.timelineStart;
  assert(firstClipStart === frame(0), 'First clip starts at frame 0');
});

// ===== STRESS TEST 6: 50 TRANSACTION ROLLBACKS =====
console.log('--- Stress Test 6: 50 Transaction Rollbacks ---');

test('Perform 50 transaction rollbacks', () => {
  const engine = createTestEngine();
  
  // Create track
  const track = createTrack({
    id: generateTrackId(),
    name: 'Track 1',
    type: 'video',
  });
  engine.addTrack(track);
  
  // Create asset
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(1000),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  // Add initial clip
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
  
  const initialState = engine.getState();
  const initialClipCount = initialState.timeline.tracks[0]!.clips.length;
  
  // Perform 50 transaction rollbacks
  for (let i = 0; i < 50; i++) {
    let tx = beginTransaction(initialState);
    
    // Add multiple clips in transaction
    for (let j = 0; j < 10; j++) {
      const newClip = createClip({
        id: generateClipId(),
        assetId: asset.id,
        trackId: track.id,
        timelineStart: frame((i * 10 + j + 1) * 200),
        timelineEnd: frame((i * 10 + j + 1) * 200 + 100),
        mediaIn: frame(0),
        mediaOut: frame(100),
      });
      
      tx = applyOperation(tx, s => addClip(s, track.id, newClip));
    }
    
    // Rollback the transaction
    const rolledBackState = rollbackTransaction(tx);
    
    // Verify state is unchanged
    assert(
      rolledBackState.timeline.tracks[0]!.clips.length === initialClipCount,
      `Rollback ${i + 1}: State unchanged`
    );
  }
  
  // Final state should still have only 1 clip
  assert(initialState.timeline.tracks[0]!.clips.length === 1, 'Final state has 1 clip');
});

// ===== COMBINED STRESS TEST =====
console.log('--- Combined Stress Test ---');

test('Combined: 500 clips + 50 link groups + 25 nested groups + 250 markers', () => {
  const engine = createTestEngine();
  
  // Create 5 tracks
  const tracks = [];
  for (let i = 0; i < 5; i++) {
    const track = createTrack({
      id: generateTrackId(),
      name: `Track ${i + 1}`,
      type: 'video',
    });
    engine.addTrack(track);
    tracks.push(track);
  }
  
  // Create asset
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(1000),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  // Add 500 clips (100 per track)
  const clipIds: string[] = [];
  for (let trackIdx = 0; trackIdx < 5; trackIdx++) {
    const track = tracks[trackIdx]!;
    
    for (let clipIdx = 0; clipIdx < 100; clipIdx++) {
      const clip = createClip({
        id: generateClipId(),
        assetId: asset.id,
        trackId: track.id,
        timelineStart: frame(clipIdx * 1100),
        timelineEnd: frame(clipIdx * 1100 + 100),
        mediaIn: frame(0),
        mediaOut: frame(100),
      });
      
      engine.addClip(track.id, clip);
      clipIds.push(clip.id);
    }
  }
  
  let state = engine.getState();
  
  // Create 50 link groups (10 clips each)
  for (let i = 0; i < 50; i++) {
    const groupClipIds = clipIds.slice(i * 10, (i + 1) * 10);
    state = createLinkGroup(state, groupClipIds);
  }
  
  // Create 25 nested groups
  let parentGroupId: string | undefined = undefined;
  for (let i = 0; i < 25; i++) {
    const options = parentGroupId ? { parentGroupId } : undefined;
    state = createGroup(state, [clipIds[i]!], `Nested Group ${i + 1}`, options);
    
    const clip = state.timeline.tracks[0]!.clips.find(c => c.id === clipIds[i])!;
    parentGroupId = clip.groupId;
  }
  
  // Add 250 markers (100 timeline, 100 clip, 50 region)
  for (let i = 0; i < 100; i++) {
    state = addTimelineMarker(state, {
      id: generateMarkerId(),
      type: 'timeline',
      frame: frame(i * 1000),
      label: `Marker ${i + 1}`,
    });
  }
  
  for (let i = 0; i < 100; i++) {
    state = addClipMarker(state, {
      id: generateMarkerId(),
      type: 'clip',
      clipId: clipIds[i]!,
      frame: frame(50),
      label: `Clip Marker ${i + 1}`,
    });
  }
  
  for (let i = 0; i < 50; i++) {
    state = addRegionMarker(state, {
      id: generateMarkerId(),
      type: 'region',
      startFrame: frame(i * 2000),
      endFrame: frame(i * 2000 + 1000),
      label: `Region ${i + 1}`,
    });
  }
  
  // Verify final state
  let totalClips = 0;
  for (const track of state.timeline.tracks) {
    totalClips += track.clips.length;
  }
  
  assert(totalClips === 500, '500 clips in state');
  assert(state.linkGroups.size === 50, '50 link groups');
  assert(state.groups.size === 25, '25 nested groups');
  assert(
    state.markers.timeline.length + state.markers.clips.length + state.markers.regions.length === 250,
    '250 total markers'
  );
});

// ===== SUMMARY =====
console.log('='.repeat(50));
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log('='.repeat(50));

if (testsFailed === 0) {
  console.log('\n✓ ALL STRESS TESTS PASSED!\n');
  console.log('System is stable under heavy load.');
} else {
  console.log(`\n✗ ${testsFailed} test(s) failed.\n`);
  throw new Error(`${testsFailed} stress test(s) failed`);
}
