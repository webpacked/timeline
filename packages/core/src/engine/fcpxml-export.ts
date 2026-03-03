/**
 * FCP XML (FCPX) export — Phase 5 Step 4
 *
 * Final Cut Pro XML 1.10 interchange. Pure function, returns string. No IO.
 */

import type { TimelineState } from '../types/state';
import type { Clip } from '../types/clip';
import type { Track } from '../types/track';
import type { Asset, FileAsset, GeneratorAsset } from '../types/asset';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type FCPXMLExportOptions = {
  libraryName?: string;
  eventName?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * FCPXML rational time: "0s" or "{frames}/{fps}s".
 */
export function toFCPTime(frames: number, fps: number): string {
  if (frames === 0) return '0s';
  return `${frames}/${fps}s`;
}

function clipDurationFrames(clip: Clip): number {
  return (clip.timelineEnd - clip.timelineStart) as number;
}

const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function exportToFCPXML(
  state: TimelineState,
  options?: FCPXMLExportOptions,
): string {
  const libraryName = xmlEscape(options?.libraryName ?? 'Library');
  const eventName = xmlEscape(options?.eventName ?? state.timeline.name ?? 'Event');
  const timelineName = xmlEscape(state.timeline.name ?? 'Project');
  const fps = state.timeline.fps as number;

  const lines: string[] = [];
  const indent = (n: number) => '  '.repeat(n);

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<!DOCTYPE fcpxml>');
  lines.push('<fcpxml version="1.10">');
  lines.push(`${indent(1)}<resources>`);

  // Format
  const frameDuration = fps > 0 ? `1/${fps}s` : '1/30s';
  lines.push(`${indent(2)}<format id="r1" name="FFVideoFormat${DEFAULT_WIDTH}x${DEFAULT_HEIGHT}p${fps}" frameDuration="${frameDuration}" width="${DEFAULT_WIDTH}" height="${DEFAULT_HEIGHT}"/>`);

  // One <asset> per FileAsset
  const fileAssets = Array.from(state.assetRegistry.values()).filter((a) => a.kind === 'file');
  for (const asset of fileAssets) {
    const fa = asset as FileAsset;
    const id = xmlEscape(fa.id);
    const name = xmlEscape(fa.name);
    const src = 'file://' + xmlEscape(fa.filePath);
    const duration = toFCPTime(fa.intrinsicDuration as number, fps);
    const hasVideo = fa.mediaType === 'video' ? '1' : '0';
    const hasAudio = fa.mediaType === 'audio' ? '1' : '0';
    lines.push(`${indent(2)}<asset id="${id}" name="${name}" src="${src}" duration="${duration}" hasVideo="${hasVideo}" hasAudio="${hasAudio}"/>`);
  }

  // One <effect> per GeneratorAsset
  const genAssets = Array.from(state.assetRegistry.values()).filter((a) => a.kind === 'generator');
  for (const asset of genAssets) {
    const ga = asset as GeneratorAsset;
    const id = xmlEscape(ga.id);
    const genType = xmlEscape(ga.generatorDef.type);
    const uid = `.../Generators.localized/${genType}`;
    lines.push(`${indent(2)}<effect id="${id}" name="${genType}" uid="${xmlEscape(uid)}"/>`);
  }

  lines.push(`${indent(1)}</resources>`);
  lines.push(`${indent(1)}<library name="${libraryName}">`);
  lines.push(`${indent(2)}<event name="${eventName}">`);
  lines.push(`${indent(3)}<project name="${timelineName}">`);

  // Total duration from last clip end on first track
  let totalDurationFrames = 0;
  const firstTrack = state.timeline.tracks[0];
  if (firstTrack?.clips.length) {
    const last = firstTrack.clips[firstTrack.clips.length - 1]!;
    totalDurationFrames = last.timelineEnd as number;
  }
  const totalDuration = toFCPTime(totalDurationFrames, fps);
  lines.push(`${indent(4)}<sequence duration="${totalDuration}" format="r1" tcStart="0s" tcFormat="NDF">`);
  lines.push(`${indent(5)}<spine>`);

  // Primary video track: clip and gap elements
  const videoTrack = state.timeline.tracks.find((t) => t.type === 'video') ?? state.timeline.tracks[0];
  if (videoTrack) {
    let cursor = 0;
    for (const clip of videoTrack.clips) {
      const start = clip.timelineStart as number;
      const gapFrames = start - cursor;
      if (gapFrames > 0) {
        const gapOffset = toFCPTime(start, fps);
        const gapDur = toFCPTime(gapFrames, fps);
        lines.push(`${indent(6)}<gap name="Gap" offset="${gapOffset}" duration="${gapDur}" start="0s"/>`);
      }
      const asset = state.assetRegistry.get(clip.assetId);
      const dur = clipDurationFrames(clip);
      const offset = toFCPTime(start, fps);
      const durationStr = toFCPTime(dur, fps);
      const mediaStart = toFCPTime(clip.mediaIn as number, fps);
      const clipId = xmlEscape(clip.id);

      if (asset?.kind === 'generator') {
        const ga = asset as GeneratorAsset;
        const ref = xmlEscape(ga.id);
        lines.push(`${indent(6)}<clip name="${clipId}" offset="${offset}" duration="${durationStr}" start="${mediaStart}" tcFormat="NDF">`);
        lines.push(`${indent(7)}<generator ref="${ref}" offset="0s" duration="${durationStr}" start="0s">`);
        lines.push(`${indent(8)}<param name="Generator" value="${xmlEscape(ga.generatorDef.type)}"/>`);
        lines.push(`${indent(7)}</generator>`);
        lines.push(`${indent(6)}</clip>`);
      } else {
        const ref = asset ? xmlEscape(asset.id) : 'missing';
        lines.push(`${indent(6)}<clip name="${clipId}" offset="${offset}" duration="${durationStr}" start="${mediaStart}" tcFormat="NDF">`);
        lines.push(`${indent(7)}<video ref="${ref}" offset="0s" duration="${durationStr}" start="0s"/>`);
        lines.push(`${indent(6)}</clip>`);
      }
      cursor = clip.timelineEnd as number;
    }
  }

  // Audio tracks: asset-clip with role="dialogue" on spine (simplified)
  for (const track of state.timeline.tracks) {
    if (track.type !== 'audio') continue;
    for (const clip of track.clips) {
      const dur = clipDurationFrames(clip);
      const start = clip.timelineStart as number;
      const offset = toFCPTime(start, fps);
      const durationStr = toFCPTime(dur, fps);
      const asset = state.assetRegistry.get(clip.assetId);
      const ref = asset ? xmlEscape(asset.id) : 'missing';
      const clipId = xmlEscape(clip.id);
      lines.push(`${indent(6)}<asset-clip ref="${ref}" name="${clipId}" offset="${offset}" duration="${durationStr}" start="0s" role="dialogue"/>`);
    }
  }

  lines.push(`${indent(5)}</spine>`);
  lines.push(`${indent(4)}</sequence>`);
  lines.push(`${indent(3)}</project>`);
  lines.push(`${indent(2)}</event>`);
  lines.push(`${indent(1)}</library>`);
  lines.push('</fcpxml>');

  return lines.join('\n');
}
