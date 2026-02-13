/**
 * PHASE 2 TEST SUITE
 * 
 * Comprehensive tests for editing intelligence features:
 * - Transactions
 * - Snapping
 * - Linking
 * - Grouping
 * - Markers
 * - Clipboard
 * - Drag State
 * - Ripple Operations
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
  findSnapTargets,
  calculateSnap,
  calculateSnapExcluding,
  createLinkGroup,
  breakLinkGroup,
  getLinkedClips,
  moveLinkedClips,
  deleteLinkedClips,
  createGroup,
  ungroupClips,
  getGroupClips,
  getChildGroups,
  addTimelineMarker,
  addClipMarker,
  addRegionMarker,
  setWorkArea,
  clearWorkArea,
  copyClips,
  cutClips,
  pasteClips,
  duplicateClips,
  calculateDragPreview,
  calculateResizeDragPreview,
  rippleDelete,
  rippleTrim,
  insertEdit,
  moveClip,
  addClip,
} from '../internal';

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
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
    name: 'Test Timeline',
    fps: frameRate(30),
    duration: frame(9000),
    tracks: [],
  });

  const state = createTimelineState({ timeline });
  return new TimelineEngine(state);
}

console.log('\n=== PHASE 2 TEST SUITE ===\n');

// ===== TRANSACTION TESTS =====
console.log('--- Transaction System ---');

test('Transaction batches multiple operations', () => {
  const engine = createTestEngine();
  
  // Add track and asset
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  // Create two clips
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const clip2 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(200),
    timelineEnd: frame(300),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  engine.addClip(track.id, clip2);
  
  const historyBefore = engine.canUndo();
  
  // Use transaction to move both clips
  let tx = beginTransaction(engine.getState());
  tx = applyOperation(tx, s => moveClip(s, clip1.id, frame(500)));
  tx = applyOperation(tx, s => moveClip(s, clip2.id, frame(700)));
  const newState = commitTransaction(tx);
  
  // Manually update engine state (in real usage, this would be through engine)
  assert(newState.timeline.tracks[0]!.clips[0]!.timelineStart === frame(500), 'Clip 1 moved');
  assert(newState.timeline.tracks[0]!.clips[1]!.timelineStart === frame(700), 'Clip 2 moved');
});

test('Transaction rollback discards changes', () => {
  const engine = createTestEngine();
  const initialState = engine.getState();
  
  let tx = beginTransaction(initialState);
  tx = applyOperation(tx, s => s); // No-op
  const rolledBack = rollbackTransaction(tx);
  
  assert(rolledBack === initialState, 'State unchanged after rollback');
});

// ===== SNAPPING TESTS =====
console.log('--- Snapping System ---');

test('Snapping finds clip boundaries as targets', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(100),
    timelineEnd: frame(200),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip);
  
  const targets = findSnapTargets(engine.getState());
  
  assert(targets.length >= 2, 'Found snap targets');
  assert(targets.some(t => t.type === 'clip-start' && t.frame === frame(100)), 'Found clip start');
  assert(targets.some(t => t.type === 'clip-end' && t.frame === frame(200)), 'Found clip end');
});

test('Snapping calculates correct snap within threshold', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(100),
    timelineEnd: frame(200),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip);
  
  const targets = findSnapTargets(engine.getState());
  
  // Try to snap to frame 103 (within 5 frame threshold of 100)
  const result = calculateSnap(frame(103), targets, frame(5));
  
  assert(result.snapped === true, 'Snapping occurred');
  assert(result.snappedFrame === frame(100), 'Snapped to clip start');
  assert(result.distance === 3, 'Correct distance');
});

test('Snapping does not snap beyond threshold', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(100),
    timelineEnd: frame(200),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip);
  
  const targets = findSnapTargets(engine.getState());
  
  // Try to snap to frame 110 (beyond 5 frame threshold)
  const result = calculateSnap(frame(110), targets, frame(5));
  
  assert(result.snapped === false, 'No snapping occurred');
  assert(result.snappedFrame === frame(110), 'Frame unchanged');
});

test('Snapping excludes specified clips', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(100),
    timelineEnd: frame(200),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  
  const targets = findSnapTargets(engine.getState());
  
  // Exclude clip1 from snapping
  const result = calculateSnapExcluding(frame(103), targets, frame(5), [clip1.id]);
  
  assert(result.snapped === false, 'Excluded clip not snapped to');
});

// ===== LINKING TESTS =====
console.log('--- Linking System ---');

test('Create link group links clips together', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const clip2 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(200),
    timelineEnd: frame(300),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  engine.addClip(track.id, clip2);
  
  const state = createLinkGroup(engine.getState(), [clip1.id, clip2.id]);
  
  const linked = getLinkedClips(state, clip1.id);
  assert(linked.length === 2, 'Both clips linked');
  assert(linked.some(c => c.id === clip1.id), 'Clip 1 in group');
  assert(linked.some(c => c.id === clip2.id), 'Clip 2 in group');
});

test('Move linked clips maintains relative positions', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const clip2 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(200),
    timelineEnd: frame(300),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  engine.addClip(track.id, clip2);
  
  let state = createLinkGroup(engine.getState(), [clip1.id, clip2.id]);
  
  // Move clip1 to frame 500 (delta = +500)
  state = moveLinkedClips(state, clip1.id, frame(500));
  
  const linked = getLinkedClips(state, clip1.id);
  const movedClip1 = linked.find(c => c.id === clip1.id)!;
  const movedClip2 = linked.find(c => c.id === clip2.id)!;
  
  assert(movedClip1.timelineStart === frame(500), 'Clip 1 moved to 500');
  assert(movedClip2.timelineStart === frame(700), 'Clip 2 moved to 700 (maintained 200 frame offset)');
});

test('Break link group removes linking', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const clip2 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(200),
    timelineEnd: frame(300),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  engine.addClip(track.id, clip2);
  
  let state = createLinkGroup(engine.getState(), [clip1.id, clip2.id]);
  const linkGroupId = getLinkedClips(state, clip1.id)[0]!.linkGroupId!;
  
  state = breakLinkGroup(state, linkGroupId);
  
  const linked = getLinkedClips(state, clip1.id);
  assert(linked.length === 1, 'Only one clip (itself) after breaking link');
  assert(linked[0]!.linkGroupId === undefined, 'Link group ID cleared');
});

// ===== GROUPING TESTS =====
console.log('--- Grouping System ---');

test('Create group organizes clips', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  
  const state = createGroup(engine.getState(), [clip1.id], 'Scene 1', {
    color: '#ff0000',
  });
  
  // Get the updated clip from the new state
  const updatedClip = state.timeline.tracks[0]!.clips[0]!;
  assert(updatedClip.groupId !== undefined, 'Clip has groupId');
  
  const grouped = getGroupClips(state, updatedClip.groupId!);
  assert(grouped.length === 1, 'Clip in group');
  assert(grouped[0]!.id === clip1.id, 'Correct clip grouped');
});

test('Nested groups work correctly', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const clip2 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(200),
    timelineEnd: frame(300),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  engine.addClip(track.id, clip2);
  
  // Create parent group with clip1
  let state = createGroup(engine.getState(), [clip1.id], 'Parent Group');
  const updatedClip1 = state.timeline.tracks[0]!.clips.find(c => c.id === clip1.id)!;
  const parentGroupId = updatedClip1.groupId!;
  
  // Create child group with clip2, nested under parent
  state = createGroup(state, [clip2.id], 'Child Group', {
    parentGroupId,
  });
  
  const children = getChildGroups(state, parentGroupId);
  assert(children.length === 1, 'One child group');
  assert(children[0]!.name === 'Child Group', 'Correct child group');
  assert(children[0]!.parentGroupId === parentGroupId, 'Child has correct parent');
});

// ===== MARKER TESTS =====
console.log('--- Marker System ---');

test('Add timeline marker', () => {
  const engine = createTestEngine();
  
  const state = addTimelineMarker(engine.getState(), {
    id: generateMarkerId(),
    type: 'timeline',
    frame: frame(1000),
    label: 'Chapter 1',
    color: '#00ff00',
  });
  
  assert(state.markers.timeline.length === 1, 'Marker added');
  assert(state.markers.timeline[0]!.frame === frame(1000), 'Correct frame');
  assert(state.markers.timeline[0]!.label === 'Chapter 1', 'Correct label');
});

test('Add clip marker', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
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
  
  const state = addClipMarker(engine.getState(), {
    id: generateMarkerId(),
    type: 'clip',
    clipId: clip.id,
    frame: frame(50),
    label: 'Important moment',
  });
  
  assert(state.markers.clips.length === 1, 'Clip marker added');
  assert(state.markers.clips[0]!.clipId === clip.id, 'Correct clip');
});

test('Set work area', () => {
  const engine = createTestEngine();
  
  const state = setWorkArea(engine.getState(), {
    startFrame: frame(100),
    endFrame: frame(500),
  });
  
  assert(state.workArea !== undefined, 'Work area set');
  assert(state.workArea!.startFrame === frame(100), 'Correct start');
  assert(state.workArea!.endFrame === frame(500), 'Correct end');
});

test('Clear work area', () => {
  const engine = createTestEngine();
  
  let state = setWorkArea(engine.getState(), {
    startFrame: frame(100),
    endFrame: frame(500),
  });
  
  state = clearWorkArea(state);
  
  assert(state.workArea === undefined, 'Work area cleared');
});

// ===== CLIPBOARD TESTS =====
console.log('--- Clipboard System ---');

test('Copy clips preserves relative positions', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const clip2 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(200),
    timelineEnd: frame(300),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  engine.addClip(track.id, clip2);
  
  const clipboard = copyClips(engine.getState(), [clip1.id, clip2.id]);
  
  assert(clipboard.clips.length === 2, 'Two clips copied');
  assert(clipboard.relativePositions[0] === frame(0), 'First clip at offset 0');
  assert(clipboard.relativePositions[1] === frame(200), 'Second clip at offset 200');
});

test('Paste clips generates new IDs', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  
  const clipboard = copyClips(engine.getState(), [clip1.id]);
  const state = pasteClips(engine.getState(), track.id, frame(500), clipboard);
  
  const allClips = state.timeline.tracks[0]!.clips;
  assert(allClips.length === 2, 'Two clips after paste');
  assert(allClips[0]!.id !== allClips[1]!.id, 'Different IDs');
  assert(allClips[1]!.timelineStart === frame(500), 'Pasted at correct position');
});

test('Duplicate clips with offset', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  
  const state = duplicateClips(engine.getState(), [clip1.id], frame(200));
  
  const allClips = state.timeline.tracks[0]!.clips;
  assert(allClips.length === 2, 'Two clips after duplicate');
  assert(allClips[1]!.timelineStart === frame(200), 'Duplicated with offset');
});

// ===== DRAG STATE TESTS =====
console.log('--- Drag State ---');

test('Drag preview calculates valid position', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
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
  
  const preview = calculateDragPreview(
    engine.getState(),
    clip.id,
    frame(500),
    frame(5)
  );
  
  assert(preview.valid === true, 'Drag is valid');
  assert(preview.proposedStart === frame(500), 'Correct proposed position');
  assert(preview.proposedEnd === frame(600), 'Correct proposed end');
});

test('Drag preview with snapping', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const clip2 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(500),
    timelineEnd: frame(600),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  engine.addClip(track.id, clip2);
  
  // Drag clip1 near clip2's start (503 is within 5 frame threshold)
  const preview = calculateDragPreview(
    engine.getState(),
    clip1.id,
    frame(503),
    frame(5)
  );
  
  assert(preview.snapped === true, 'Snapping occurred');
  assert(preview.proposedStart === frame(500), 'Snapped to clip2 start');
});

// ===== RIPPLE OPERATION TESTS =====
console.log('--- Ripple Operations ---');

test('Ripple delete shifts subsequent clips', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const clip2 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(100),
    timelineEnd: frame(200),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  engine.addClip(track.id, clip2);
  
  const state = rippleDelete(engine.getState(), clip1.id);
  
  const remainingClips = state.timeline.tracks[0]!.clips;
  assert(remainingClips.length === 1, 'One clip remaining');
  assert(remainingClips[0]!.timelineStart === frame(0), 'Clip shifted left by 100 frames');
});

test('Ripple trim shifts subsequent clips', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  const clip2 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(100),
    timelineEnd: frame(200),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  engine.addClip(track.id, clip2);
  
  // Trim clip1 to 50 frames (reduce by 50)
  const state = rippleTrim(engine.getState(), clip1.id, frame(50));
  
  const clips = state.timeline.tracks[0]!.clips;
  assert(clips[0]!.timelineEnd === frame(50), 'Clip trimmed');
  assert(clips[1]!.timelineStart === frame(50), 'Subsequent clip shifted left by 50');
});

test('Insert edit shifts clips right', () => {
  const engine = createTestEngine();
  
  const track = createTrack({ id: generateTrackId(), name: 'Track 1', type: 'video' });
  engine.addTrack(track);
  
  const asset = createAsset({
    id: generateAssetId(),
    type: 'video',
    duration: frame(300),
    sourceUrl: 'test.mp4',
  });
  engine.registerAsset(asset);
  
  const clip1 = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0),
    timelineEnd: frame(100),
    mediaIn: frame(0),
    mediaOut: frame(100),
  });
  
  engine.addClip(track.id, clip1);
  
  const newClip = createClip({
    id: generateClipId(),
    assetId: asset.id,
    trackId: track.id,
    timelineStart: frame(0), // Will be adjusted
    timelineEnd: frame(50),
    mediaIn: frame(0),
    mediaOut: frame(50),
  });
  
  // Insert at frame 50 (middle of clip1)
  const state = insertEdit(engine.getState(), track.id, newClip, frame(50));
  
  const clips = state.timeline.tracks[0]!.clips;
  assert(clips.length === 2, 'Two clips after insert');
  // Original clip1 should be shifted right
  assert(clips.some(c => c.timelineStart === frame(50)), 'Clip shifted right by 50');
});

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
