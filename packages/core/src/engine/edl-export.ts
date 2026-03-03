/**
 * CMX3600 EDL export — Phase 5 Step 3
 *
 * Single video track only. Pure function, returns string.
 * No IO.
 */

import type { TimelineState } from '../types/state';
import type { Clip } from '../types/clip';
import type { Asset, FileAsset, GeneratorAsset } from '../types/asset';
import type { Track } from '../types/track';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type EDLExportOptions = {
  /** Default: state.timeline.name */
  title?: string;
  /** Default: false (non-drop). True = 29.97 drop frame only. */
  dropFrame?: boolean;
  /** Which video track to export. Default: 0 (first video track). */
  trackIndex?: number;
};

// ---------------------------------------------------------------------------
// Frame → Timecode
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Non-drop: HH:MM:SS:FF from frame count at given fps.
 */
function frameToTimecodeNonDrop(frame: number, fps: number): string {
  const totalSeconds = Math.floor(frame / fps);
  const ff = Math.floor(frame % fps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}:${pad2(ff)}`;
}

/** SMPTE drop-frame for 29.97fps only. */
function frameToTimecodeDropFrame29_97(frame: number): string {
  const FRAMES_PER_MIN = 1798;
  const FRAMES_PER_10_MIN = 17982;
  const d = Math.floor(frame / FRAMES_PER_10_MIN);
  const m = Math.floor((frame % FRAMES_PER_10_MIN) / FRAMES_PER_MIN);
  const totalMinutes = 10 * d + m;
  const r = frame % FRAMES_PER_MIN;
  const ss = Math.floor(r / 30);
  const ff = r % 30;
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}:${pad2(ff)}`;
}

/**
 * Convert frame count to timecode string.
 * dropFrame true: only 29.97fps uses real drop-frame; others fall back to non-drop.
 */
export function frameToTimecode(
  frame: number,
  fps: number,
  dropFrame: boolean,
): string {
  if (!dropFrame || fps !== 29.97) {
    return frameToTimecodeNonDrop(frame, fps);
  }
  return frameToTimecodeDropFrame29_97(frame);
}

// ---------------------------------------------------------------------------
// Reel name
// ---------------------------------------------------------------------------

/**
 * FileAsset: filename without extension, truncate 8 chars, uppercase.
 * GeneratorAsset or undefined: "AX".
 */
export function reelName(asset: Asset | undefined): string {
  let raw: string;
  if (!asset || asset.kind === 'generator') raw = 'AX';
  else {
    const fa = asset as FileAsset;
    const path = fa.filePath;
    const base = path.split('/').pop() ?? path;
    const noExt = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
    raw = noExt.toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 8);
  }
  return raw.padEnd(8).slice(0, 8);
}

// ---------------------------------------------------------------------------
// Transition type
// ---------------------------------------------------------------------------

function transitionCode(clip: Clip): 'C' | 'D' {
  const t = clip.transition;
  if (t && t.type === 'dissolve') return 'D';
  return 'C';
}

// ---------------------------------------------------------------------------
// Comment line: FROM CLIP NAME
// ---------------------------------------------------------------------------

function clipDisplayName(asset: Asset | undefined, clipName: string | null): string {
  if (!asset) return clipName ?? 'unknown';
  if (asset.kind === 'file') return (asset as FileAsset).filePath.split('/').pop() ?? (asset as FileAsset).filePath;
  return (asset as GeneratorAsset).generatorDef?.type ?? (asset as GeneratorAsset).name ?? 'generator';
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function clipDurationFrames(clip: Clip): number {
  return (clip.timelineEnd - clip.timelineStart) as number;
}

/**
 * Export a single video track to CMX3600 EDL string.
 * trackIndex selects which video track (default 0).
 */
export function exportToEDL(
  state: TimelineState,
  options?: EDLExportOptions,
): string {
  const title = options?.title ?? state.timeline.name ?? 'Untitled';
  const dropFrame = options?.dropFrame ?? false;
  const trackIndex = options?.trackIndex ?? 0;

  const videoTracks = state.timeline.tracks.filter((t) => t.type === 'video');
  const track: Track | undefined = videoTracks[trackIndex];
  if (!track) {
    return `TITLE: ${title}\nFCM: ${dropFrame ? 'DROP FRAME' : 'NON-DROP FRAME'}\n`;
  }

  const fps = state.timeline.fps as number;
  const useDropFrame = dropFrame && fps === 29.97;
  let headerComment = '';
  if (dropFrame && fps !== 29.97) {
    headerComment = '* DROP FRAME NOT SUPPORTED FOR THIS FRAME RATE\n\n';
  }

  const lines: string[] = [];
  lines.push(`TITLE: ${title}`);
  lines.push(`FCM: ${useDropFrame ? 'DROP FRAME' : 'NON-DROP FRAME'}`);
  if (headerComment) lines.push(headerComment.trim());

  const clips = track.clips;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]!;
    const asset = state.assetRegistry.get(clip.assetId);
    const eventNum = String(i + 1).padStart(3, '0');
    const reel = reelName(asset);
    const channel = 'V';
    const trans = transitionCode(clip);
    const startFrame = clip.timelineStart as number;
    const dur = clipDurationFrames(clip);
    const mediaStart = clip.mediaIn as number;

    const srcIn = frameToTimecode(mediaStart, fps, useDropFrame);
    const srcOut = frameToTimecode(mediaStart + dur, fps, useDropFrame);
    const recIn = frameToTimecode(startFrame, fps, useDropFrame);
    const recOut = frameToTimecode(startFrame + dur, fps, useDropFrame);

    const eventLine = `${eventNum}  ${reel}       ${channel}     ${trans}        ${srcIn} ${srcOut} ${recIn} ${recOut}`;
    lines.push(eventLine);
    lines.push(`* FROM CLIP NAME: ${clipDisplayName(asset, clip.name)}`);
    if (i < clips.length - 1) lines.push('');
  }

  return lines.join('\n');
}
