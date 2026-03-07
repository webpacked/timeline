/**
 * SUBTITLE IMPORT — Phase 3 Step 3
 *
 * Pure functions for parsing SRT/VTT into Caption[].
 * No file IO. No DOM. No external deps.
 */

import { toFrame } from '../types/frame';
import type { TimelineFrame } from '../types/frame';
import { toCaptionId } from '../types/caption';
import type { Caption, CaptionStyle } from '../types/caption';
import type { TrackId } from '../types/track';
import type { OperationPrimitive } from '../types/operations';

// ---------------------------------------------------------------------------
// Default style (exported)
// ---------------------------------------------------------------------------

export const defaultCaptionStyle: CaptionStyle = {
  fontFamily: 'sans-serif',
  fontSize: 16,
  color: '#ffffff',
  backgroundColor: 'rgba(0,0,0,0.75)',
  hAlign: 'center',
  vAlign: 'bottom',
};

// ---------------------------------------------------------------------------
// Options types
// ---------------------------------------------------------------------------

export type SRTParseOptions = {
  language?: string;
  burnIn?: boolean;
  defaultStyle?: Partial<CaptionStyle>;
};

export type VTTParseOptions = SRTParseOptions;

// ---------------------------------------------------------------------------
// timecodeToFrame (internal)
// ---------------------------------------------------------------------------

/**
 * Accepts SRT "HH:MM:SS,mmm" and VTT "HH:MM:SS.mmm" or "MM:SS.mmm".
 * Returns frame index at given fps.
 */
function timecodeToFrame(tc: string, fps: number): TimelineFrame {
  const normalized = tc.trim().replace(',', '.');
  const parts = normalized.split(':');
  let h = 0;
  let m: number;
  let s: number;
  let ms: number;
  if (parts.length === 3) {
    h = parseInt(parts[0]!, 10) || 0;
    m = parseInt(parts[1]!, 10) || 0;
    const sMs = parts[2]!.split('.');
    s = parseInt(sMs[0]!, 10) || 0;
    ms = parseInt(sMs[1] ?? '0', 10) || 0;
  } else if (parts.length === 2) {
    m = parseInt(parts[0]!, 10) || 0;
    const sMs = parts[1]!.split('.');
    s = parseInt(sMs[0]!, 10) || 0;
    ms = parseInt(sMs[1] ?? '0', 10) || 0;
  } else {
    return toFrame(0);
  }
  const totalSeconds = h * 3600 + m * 60 + s + ms / 1000;
  return toFrame(Math.round(totalSeconds * fps));
}

// ---------------------------------------------------------------------------
// SRT/VTT tag stripping
// ---------------------------------------------------------------------------

/** Strip SRT/VTT formatting tags, keep inner text. */
function stripTags(text: string): string {
  return text
    .replace(/<b>\s*<\/b>/gi, '')
    .replace(/<i>\s*<\/i>/gi, '')
    .replace(/<u>\s*<\/u>/gi, '')
    .replace(/<b>/gi, '')
    .replace(/<\/b>/gi, '')
    .replace(/<i>/gi, '')
    .replace(/<\/i>/gi, '')
    .replace(/<u>/gi, '')
    .replace(/<\/u>/gi, '')
    .replace(/<font[^>]*>/gi, '')
    .replace(/<\/font>/gi, '')
    .replace(/<ruby>\s*<\/ruby>/gi, '')
    .replace(/<rt>\s*<\/rt>/gi, '')
    .replace(/<ruby>/gi, '')
    .replace(/<\/ruby>/gi, '')
    .replace(/<rt>/gi, '')
    .replace(/<\/rt>/gi, '')
    .replace(/<lang[^>]*>/gi, '')
    .replace(/<\/lang>/gi, '')
    .replace(/<[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}>/g, ''); // VTT timestamp tags
}

// ---------------------------------------------------------------------------
// Timecode line regexes
// ---------------------------------------------------------------------------

// SRT / VTT full: HH:MM:SS,mmm --> HH:MM:SS.mmm
const FULL_TIMECODE_RE = /^(\d{1,2}:\d{1,2}:\d{1,2}[,.]\d{3})\s*-->\s*(\d{1,2}:\d{1,2}:\d{1,2}[,.]\d{3})/;
// VTT short: MM:SS.mmm --> MM:SS.mmm (hours optional)
const SHORT_TIMECODE_RE = /^(\d{1,2}:\d{1,2}[,.]\d{3})\s*-->\s*(\d{1,2}:\d{1,2}[,.]\d{3})/;

function matchTimecodeLine(line: string): { start: string; end: string } | null {
  const full = line.match(FULL_TIMECODE_RE);
  if (full) return { start: full[1]!, end: full[2]! };
  const short = line.match(SHORT_TIMECODE_RE);
  if (short) return { start: short[1]!, end: short[2]! };
  return null;
}

// ---------------------------------------------------------------------------
// parseSRT
// ---------------------------------------------------------------------------

export function parseSRT(
  raw: string,
  fps: number,
  options?: SRTParseOptions,
): Caption[] {
  const language = options?.language ?? 'en-US';
  const burnIn = options?.burnIn ?? false;
  const style: CaptionStyle = { ...defaultCaptionStyle, ...options?.defaultStyle };

  const blocks = raw.split(/\r?\n\r?\n/).filter((b) => b.trim().length > 0);
  const captions: Caption[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const indexStr = lines[0]!;
    const timecodeLine = lines[1]!;
    const matched = matchTimecodeLine(timecodeLine);
    if (!matched) continue;

    const startTc = matched.start.replace(',', '.');
    const endTc = matched.end.replace(',', '.');
    const textLines = lines.slice(2);
    const text = stripTags(textLines.join('\n'));

    const index = indexStr.replace(/\D/g, '') || indexStr;
    captions.push({
      id: toCaptionId(`srt-${index}`),
      text,
      startFrame: timecodeToFrame(startTc, fps),
      endFrame: timecodeToFrame(endTc, fps),
      language,
      style,
      burnIn,
    });
  }

  return captions;
}

// ---------------------------------------------------------------------------
// parseVTT
// ---------------------------------------------------------------------------

export function parseVTT(
  raw: string,
  fps: number,
  options?: VTTParseOptions,
): Caption[] {
  const lines = raw.split(/\r?\n/);
  if (lines.length === 0 || !lines[0]!.trim().startsWith('WEBVTT')) {
    return [];
  }

  const language = options?.language ?? 'en-US';
  const burnIn = options?.burnIn ?? false;
  const style: CaptionStyle = { ...defaultCaptionStyle, ...options?.defaultStyle };

  const captions: Caption[] = [];
  let cueIndex = 0;
  const blocks = raw.split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const blockLines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (blockLines.length === 0) continue;

    const first = blockLines[0]!;
    if (first.startsWith('NOTE') || first.startsWith('STYLE') || first.startsWith('REGION')) continue;

    let timecodeLine: string;
    let textLines: string[];
    if (first.includes('-->')) {
      timecodeLine = first;
      textLines = blockLines.slice(1);
    } else if (blockLines.length >= 2 && blockLines[1]!.includes('-->')) {
      timecodeLine = blockLines[1]!;
      textLines = blockLines.slice(2);
    } else {
      continue;
    }

    const matched = matchTimecodeLine(timecodeLine);
    if (!matched) continue;

    cueIndex++;
    const startTc = matched.start.replace(',', '.');
    const endTc = matched.end.replace(',', '.');

    const text = stripTags(textLines.join('\n'));

    captions.push({
      id: toCaptionId(`vtt-${cueIndex}`),
      text,
      startFrame: timecodeToFrame(startTc, fps),
      endFrame: timecodeToFrame(endTc, fps),
      language,
      style,
      burnIn,
    });
  }

  return captions;
}

// ---------------------------------------------------------------------------
// subtitleImportToOps
// ---------------------------------------------------------------------------

export function subtitleImportToOps(
  captions: Caption[],
  trackId: TrackId,
): OperationPrimitive[] {
  return captions.map((caption) => ({
    type: 'ADD_CAPTION',
    caption,
    trackId,
  }));
}
