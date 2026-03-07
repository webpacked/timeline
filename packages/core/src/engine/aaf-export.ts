/**
 * AAF XML export — Phase 5 Step 4
 *
 * Simplified AAF XML representation for Avid interchange.
 * Pure function, returns string. No IO.
 */

import type { TimelineState } from '../types/state';
import type { Clip } from '../types/clip';
import type { Track } from '../types/track';
import type { Asset, FileAsset, GeneratorAsset } from '../types/asset';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type AAFExportOptions = {
  /** Default: timeline name */
  projectName?: string;
  /** Default: derived from state (e.g. 30 → "30/1") */
  frameRate?: string;
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

function clipDurationFrames(clip: Clip): number {
  return (clip.timelineEnd - clip.timelineStart) as number;
}

function sourceRefForClip(state: TimelineState, clip: Clip): string {
  const asset = state.assetRegistry.get(clip.assetId);
  if (!asset) return 'missing';
  if (asset.kind === 'file') return (asset as FileAsset).filePath;
  return (asset as GeneratorAsset).generatorDef.type;
}

function dataDefinition(track: Track): string {
  return track.type === 'video' ? 'Picture' : track.type === 'audio' ? 'Sound' : 'Picture';
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function exportToAAF(
  state: TimelineState,
  options?: AAFExportOptions,
): string {
  const projectName = xmlEscape(options?.projectName ?? state.timeline.name ?? 'Untitled');
  const fps = state.timeline.fps as number;
  const editRate = options?.frameRate ?? `${fps}/1`;
  const timelineName = xmlEscape(state.timeline.name ?? 'Timeline');

  const lines: string[] = [];
  const indent = (n: number) => '  '.repeat(n);

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<AAF version="1.1"`);
  lines.push(`     xmlns="urn:aaf:schema:1.1"`);
  lines.push(`     projectName="${projectName}">`);
  lines.push(`${indent(1)}<Dictionary/>`);
  lines.push(`${indent(1)}<ContentStorage>`);

  // One MasterMob per clip (all tracks)
  const clipTrackPairs: { clip: Clip; track: Track }[] = [];
  for (const track of state.timeline.tracks) {
    for (const clip of track.clips) clipTrackPairs.push({ clip, track });
  }
  for (const { clip, track } of clipTrackPairs) {
    const clipId = xmlEscape(clip.id);
    const len = clipDurationFrames(clip);
    const ref = xmlEscape(sourceRefForClip(state, clip));
    const def = dataDefinition(track);
    lines.push(`${indent(2)}<MasterMob name="${clipId}" mobID="${clipId}">`);
    lines.push(`${indent(3)}<TimelineMobSlot>`);
    lines.push(`${indent(4)}<Sequence dataDefinition="${def}">`);
    lines.push(`${indent(5)}<SourceClip length="${len}" sourceRef="${ref}"/>`);
    lines.push(`${indent(4)}</Sequence>`);
    lines.push(`${indent(3)}</TimelineMobSlot>`);
    lines.push(`${indent(2)}</MasterMob>`);
  }

  // CompositionMob: one TimelineMobSlot per track
  lines.push(`${indent(2)}<CompositionMob name="${timelineName}">`);
  state.timeline.tracks.forEach((track, slotIndex) => {
    const def = dataDefinition(track);
    lines.push(`${indent(3)}<TimelineMobSlot slotID="${slotIndex}" editRate="${editRate}">`);
    lines.push(`${indent(4)}<Sequence dataDefinition="${def}">`);

    let cursor = 0;
    for (const clip of track.clips) {
      const start = clip.timelineStart as number;
      const gapFrames = start - cursor;
      if (gapFrames > 0) {
        lines.push(`${indent(5)}<Filler length="${gapFrames}"/>`);
      }
      const len = clipDurationFrames(clip);
      const clipId = xmlEscape(clip.id);
      lines.push(`${indent(5)}<SourceClip length="${len}" sourceRef="${clipId}"/>`);
      cursor = (clip.timelineEnd as number);
    }
    lines.push(`${indent(4)}</Sequence>`);
    lines.push(`${indent(3)}</TimelineMobSlot>`);
  });
  lines.push(`${indent(2)}</CompositionMob>`);
  lines.push(`${indent(1)}</ContentStorage>`);
  lines.push('</AAF>');

  return lines.join('\n');
}
