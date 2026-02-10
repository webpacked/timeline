import type { ID } from './common';
import type { Clip } from './clip';

/**
 * Track - A horizontal lane that holds clips
 * 
 * WHAT IS IT?
 * A track is like a layer in Photoshop or a track in a DAW (Digital Audio Workstation).
 * It's a container for clips that provides organization and isolation.
 * 
 * WHY IT EXISTS:
 * - Organizes clips into layers (video tracks, audio tracks, etc.)
 * - Enables stacking and compositing (track order matters!)
 * - Provides isolation for editing operations
 * - Allows track-level properties (mute, lock, visibility)
 * 
 * KEY CONCEPT: TRACK ORDER
 * Tracks are rendered bottom-to-top (like layers in design tools)
 * - Track[0] = bottom layer (rendered first)
 * - Track[n] = top layer (rendered last, appears on top)
 * 
 * WHAT IT DOESN'T CONTAIN:
 * - Rendering logic (that's the UI's job)
 * - Pixel positions (those are calculated)
 */
export interface Track {
  /** Unique identifier */
  id: ID;
  
  /** Human-readable name */
  name: string;
  
  /** Clips on this track, in temporal order */
  clips: Clip[];
  
  // ===== TRACK PROPERTIES =====
  
  /** 
   * Muted - Audio/visibility disabled
   * For video tracks: hides the track
   * For audio tracks: silences the track
   */
  muted: boolean;
  
  /** 
   * Locked - Prevents editing
   * When locked, clips cannot be added, moved, or deleted
   */
  locked: boolean;
  
  /** 
   * Visible - Show/hide in UI
   * This is different from muted:
   * - muted = affects playback/output
   * - visible = affects UI display only
   */
  visible: boolean;
  
  // ===== UI HINTS =====
  
  /** 
   * Preferred height in pixels
   * This is a UI hint, not rendering logic
   * Stored here so it persists across sessions
   */
  height?: number;
  
  /** Optional metadata for custom use cases */
  metadata?: Record<string, unknown>;
}

/**
 * Create a new track
 * Factory function with sensible defaults
 */
export const createTrack = (params: {
  id: ID;
  name: string;
  clips?: Clip[];
  muted?: boolean;
  locked?: boolean;
  visible?: boolean;
  height?: number;
  metadata?: Record<string, unknown>;
}): Track => {
  const track: Track = {
    id: params.id,
    name: params.name,
    clips: params.clips ?? [],
    muted: params.muted ?? false,
    locked: params.locked ?? false,
    visible: params.visible ?? true,
  };
  
  if (params.height !== undefined) {
    track.height = params.height;
  }
  
  if (params.metadata !== undefined) {
    track.metadata = params.metadata;
  }
  
  return track;
};
