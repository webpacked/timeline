/**
 * TIMELINE ENGINE
 * 
 * The main public API for the timeline editing kernel.
 * 
 * WHAT IS THE TIMELINE ENGINE?
 * - A thin wrapper around the history and dispatch systems
 * - Provides a convenient, object-oriented API
 * - Manages internal state
 * - Coordinates operations, validation, and history
 * 
 * WHY A CLASS?
 * - Encapsulates state management
 * - Provides a clean API for users
 * - Hides complexity of history and dispatch
 * - Familiar OOP interface for most developers
 * 
 * USAGE:
 * ```typescript
 * const engine = new TimelineEngine(initialState);
 * 
 * // Add a clip
 * const result = engine.addClip(trackId, clip);
 * if (!result.success) {
 *   console.error('Failed to add clip:', result.errors);
 * }
 * 
 * // Undo/redo
 * engine.undo();
 * engine.redo();
 * 
 * // Query state
 * const clip = engine.findClipById('clip_1');
 * const state = engine.getState();
 * ```
 * 
 * DESIGN PHILOSOPHY:
 * - Business logic lives in pure modules (operations, validation, etc.)
 * - Engine is just a thin orchestration layer
 * - Easy to test (can test pure functions independently)
 */

import { TimelineState } from '../types/state';
import { Clip } from '../types/clip';
import { Track } from '../types/track';
import { Asset } from '../types/asset';
import { Frame } from '../types/frame';
import { HistoryState, createHistory, undo as undoHistory, redo as redoHistory, canUndo as canUndoHistory, canRedo as canRedoHistory, getCurrentState } from './history';
import { dispatch, DispatchResult } from './dispatcher';
import * as ClipOps from '../operations/clip-operations';
import * as TrackOps from '../operations/track-operations';
import * as TimelineOps from '../operations/timeline-operations';
import * as AssetRegistry from '../systems/asset-registry';
import * as Queries from '../systems/queries';

/**
 * TimelineEngine - The main timeline editing engine
 * 
 * Provides a high-level API for timeline editing with built-in
 * undo/redo, validation, and state management.
 */
export class TimelineEngine {
  private history: HistoryState;
  
  /**
   * Create a new timeline engine
   * 
   * @param initialState - Initial timeline state
   * @param historyLimit - Maximum number of undo steps (default: 50)
   */
  constructor(initialState: TimelineState, historyLimit: number = 50) {
    this.history = createHistory(initialState, historyLimit);
  }
  
  // ===== STATE ACCESS =====
  
  /**
   * Get the current timeline state
   * 
   * @returns Current timeline state
   */
  getState(): TimelineState {
    return getCurrentState(this.history);
  }
  
  // ===== ASSET OPERATIONS =====
  
  /**
   * Register an asset
   * 
   * @param asset - Asset to register
   * @returns Dispatch result
   */
  registerAsset(asset: Asset): DispatchResult {
    const result = dispatch(this.history, (state) => 
      AssetRegistry.registerAsset(state, asset)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  /**
   * Get an asset by ID
   * 
   * @param assetId - Asset ID
   * @returns The asset, or undefined if not found
   */
  getAsset(assetId: string): Asset | undefined {
    return AssetRegistry.getAsset(this.getState(), assetId);
  }
  
  // ===== CLIP OPERATIONS =====
  
  /**
   * Add a clip to a track
   * 
   * @param trackId - ID of the track to add to
   * @param clip - Clip to add
   * @returns Dispatch result
   */
  addClip(trackId: string, clip: Clip): DispatchResult {
    const result = dispatch(this.history, (state) =>
      ClipOps.addClip(state, trackId, clip)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  /**
   * Remove a clip
   * 
   * @param clipId - ID of the clip to remove
   * @returns Dispatch result
   */
  removeClip(clipId: string): DispatchResult {
    const result = dispatch(this.history, (state) =>
      ClipOps.removeClip(state, clipId)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  /**
   * Move a clip to a new timeline position
   * 
   * @param clipId - ID of the clip to move
   * @param newStart - New timeline start frame
   * @returns Dispatch result
   */
  moveClip(clipId: string, newStart: Frame): DispatchResult {
    const result = dispatch(this.history, (state) =>
      ClipOps.moveClip(state, clipId, newStart)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  /**
   * Resize a clip
   * 
   * @param clipId - ID of the clip to resize
   * @param newStart - New timeline start frame
   * @param newEnd - New timeline end frame
   * @returns Dispatch result
   */
  resizeClip(clipId: string, newStart: Frame, newEnd: Frame): DispatchResult {
    const result = dispatch(this.history, (state) =>
      ClipOps.resizeClip(state, clipId, newStart, newEnd)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  /**
   * Trim a clip (change media bounds)
   * 
   * @param clipId - ID of the clip to trim
   * @param newMediaIn - New media in frame
   * @param newMediaOut - New media out frame
   * @returns Dispatch result
   */
  trimClip(clipId: string, newMediaIn: Frame, newMediaOut: Frame): DispatchResult {
    const result = dispatch(this.history, (state) =>
      ClipOps.trimClip(state, clipId, newMediaIn, newMediaOut)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  /**
   * Move a clip to a different track
   * 
   * @param clipId - ID of the clip to move
   * @param targetTrackId - ID of the target track
   * @returns Dispatch result
   */
  moveClipToTrack(clipId: string, targetTrackId: string): DispatchResult {
    const result = dispatch(this.history, (state) =>
      ClipOps.moveClipToTrack(state, clipId, targetTrackId)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  // ===== TRACK OPERATIONS =====
  
  /**
   * Add a track
   * 
   * @param track - Track to add
   * @returns Dispatch result
   */
  addTrack(track: Track): DispatchResult {
    const result = dispatch(this.history, (state) =>
      TrackOps.addTrack(state, track)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  /**
   * Remove a track
   * 
   * @param trackId - ID of the track to remove
   * @returns Dispatch result
   */
  removeTrack(trackId: string): DispatchResult {
    const result = dispatch(this.history, (state) =>
      TrackOps.removeTrack(state, trackId)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  /**
   * Move a track to a new position
   * 
   * @param trackId - ID of the track to move
   * @param newIndex - New index position
   * @returns Dispatch result
   */
  moveTrack(trackId: string, newIndex: number): DispatchResult {
    const result = dispatch(this.history, (state) =>
      TrackOps.moveTrack(state, trackId, newIndex)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  /**
   * Toggle track mute
   * 
   * @param trackId - ID of the track
   * @returns Dispatch result
   */
  toggleTrackMute(trackId: string): DispatchResult {
    const result = dispatch(this.history, (state) =>
      TrackOps.toggleTrackMute(state, trackId)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  /**
   * Toggle track lock
   * 
   * @param trackId - ID of the track
   * @returns Dispatch result
   */
  toggleTrackLock(trackId: string): DispatchResult {
    const result = dispatch(this.history, (state) =>
      TrackOps.toggleTrackLock(state, trackId)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  // ===== TIMELINE OPERATIONS =====
  
  /**
   * Set timeline duration
   * 
   * @param duration - New duration in frames
   * @returns Dispatch result
   */
  setTimelineDuration(duration: Frame): DispatchResult {
    const result = dispatch(this.history, (state) =>
      TimelineOps.setTimelineDuration(state, duration)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  /**
   * Set timeline name
   * 
   * @param name - New timeline name
   * @returns Dispatch result
   */
  setTimelineName(name: string): DispatchResult {
    const result = dispatch(this.history, (state) =>
      TimelineOps.setTimelineName(state, name)
    );
    if (result.success) {
      this.history = result.history;
    }
    return result;
  }
  
  // ===== HISTORY OPERATIONS =====
  
  /**
   * Undo the last action
   * 
   * @returns true if undo was performed
   */
  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }
    this.history = undoHistory(this.history);
    return true;
  }
  
  /**
   * Redo the last undone action
   * 
   * @returns true if redo was performed
   */
  redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }
    this.history = redoHistory(this.history);
    return true;
  }
  
  /**
   * Check if undo is available
   * 
   * @returns true if undo is available
   */
  canUndo(): boolean {
    return canUndoHistory(this.history);
  }
  
  /**
   * Check if redo is available
   * 
   * @returns true if redo is available
   */
  canRedo(): boolean {
    return canRedoHistory(this.history);
  }
  
  // ===== QUERY OPERATIONS =====
  
  /**
   * Find a clip by ID
   * 
   * @param clipId - Clip ID
   * @returns The clip, or undefined if not found
   */
  findClipById(clipId: string): Clip | undefined {
    return Queries.findClipById(this.getState(), clipId);
  }
  
  /**
   * Find a track by ID
   * 
   * @param trackId - Track ID
   * @returns The track, or undefined if not found
   */
  findTrackById(trackId: string): Track | undefined {
    return Queries.findTrackById(this.getState(), trackId);
  }
  
  /**
   * Get all clips on a track
   * 
   * @param trackId - Track ID
   * @returns Array of clips on the track
   */
  getClipsOnTrack(trackId: string): Clip[] {
    return Queries.getClipsOnTrack(this.getState(), trackId);
  }
  
  /**
   * Get all clips at a specific frame
   * 
   * @param frame - Frame to check
   * @returns Array of clips at that frame
   */
  getClipsAtFrame(frame: Frame): Clip[] {
    return Queries.getClipsAtFrame(this.getState(), frame);
  }
  
  /**
   * Get all clips in a frame range
   * 
   * @param start - Start frame
   * @param end - End frame
   * @returns Array of clips in the range
   */
  getClipsInRange(start: Frame, end: Frame): Clip[] {
    return Queries.getClipsInRange(this.getState(), start, end);
  }
  
  /**
   * Get all clips in the timeline
   * 
   * @returns Array of all clips
   */
  getAllClips(): Clip[] {
    return Queries.getAllClips(this.getState());
  }
  
  /**
   * Get all tracks in the timeline
   * 
   * @returns Array of all tracks
   */
  getAllTracks(): Track[] {
    return Queries.getAllTracks(this.getState());
  }
}
