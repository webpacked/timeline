/**
 * SUBTITLE IMPORT TESTS — Phase 3 Step 3
 *
 * Pure function tests only. No dispatch, no TimelineState, no checkInvariants.
 */

import { describe, it, expect } from 'vitest';
import { parseSRT, parseVTT, defaultCaptionStyle, subtitleImportToOps } from '../engine/subtitle-import';
import { toTrackId } from '../types/track';

const FPS = 30;

// ── SRT tests ───────────────────────────────────────────────────────────────

describe('parseSRT', () => {
  it('parses single block: correct startFrame, endFrame, text', () => {
    const raw = `1
00:00:01,000 --> 00:00:02,500
Hello world`;
    const captions = parseSRT(raw, FPS);
    expect(captions).toHaveLength(1);
    expect(captions[0]!.startFrame).toBe(30);
    expect(captions[0]!.endFrame).toBe(75);
    expect(captions[0]!.text).toBe('Hello world');
  });

  it('parses multi-block SRT: returns correct count', () => {
    const raw = `1
00:00:00,000 --> 00:00:01,000
First

2
00:00:02,000 --> 00:00:03,000
Second

3
00:00:04,000 --> 00:00:05,000
Third`;
    const captions = parseSRT(raw, FPS);
    expect(captions).toHaveLength(3);
  });

  it('multi-line text joined with \\n', () => {
    const raw = `1
00:00:00,000 --> 00:00:02,000
Line one
Line two`;
    const captions = parseSRT(raw, FPS);
    expect(captions[0]!.text).toBe('Line one\nLine two');
  });

  it('strips <b>, <i>, <u> tags, keeps inner text', () => {
    const raw = `1
00:00:00,000 --> 00:00:01,000
<b>bold</b> <i>italic</i> <u>under</u>`;
    const captions = parseSRT(raw, FPS);
    expect(captions[0]!.text).toBe('bold italic under');
  });

  it('skips malformed block (missing timecode line)', () => {
    const raw = `1
not a timecode line
some text`;
    const captions = parseSRT(raw, FPS);
    expect(captions).toHaveLength(0);
  });

  it('options.language sets language on all captions', () => {
    const raw = `1
00:00:00,000 --> 00:00:01,000
Hi`;
    const captions = parseSRT(raw, FPS, { language: 'fr-FR' });
    expect(captions[0]!.language).toBe('fr-FR');
  });

  it('options.burnIn sets burnIn on all captions', () => {
    const raw = `1
00:00:00,000 --> 00:00:01,000
Hi`;
    const captions = parseSRT(raw, FPS, { burnIn: true });
    expect(captions[0]!.burnIn).toBe(true);
  });

  it('options.defaultStyle overrides specific style fields', () => {
    const raw = `1
00:00:00,000 --> 00:00:01,000
Hi`;
    const captions = parseSRT(raw, FPS, {
      defaultStyle: { fontSize: 24, color: '#ff0000' },
    });
    expect(captions[0]!.style.fontSize).toBe(24);
    expect(captions[0]!.style.color).toBe('#ff0000');
    expect(captions[0]!.style.fontFamily).toBe(defaultCaptionStyle.fontFamily);
  });

  it('toCaptionId called with srt-<N> pattern (id starts with srt-)', () => {
    const raw = `42
00:00:00,000 --> 00:00:01,000
X`;
    const captions = parseSRT(raw, FPS);
    expect(captions[0]!.id).toBe('srt-42');
  });
});

// ── VTT tests ───────────────────────────────────────────────────────────────

describe('parseVTT', () => {
  it('returns [] if first line is not WEBVTT', () => {
    const raw = `NOT WEBVTT

00:00:01.000 --> 00:00:02.000
text`;
    expect(parseVTT(raw, FPS)).toEqual([]);
  });

  it('parses single cue: correct frames and text', () => {
    const raw = `WEBVTT

00:00:01.000 --> 00:00:02.500
Hello world`;
    const captions = parseVTT(raw, FPS);
    expect(captions).toHaveLength(1);
    expect(captions[0]!.startFrame).toBe(30);
    expect(captions[0]!.endFrame).toBe(75);
    expect(captions[0]!.text).toBe('Hello world');
  });

  it('skips NOTE blocks', () => {
    const raw = `WEBVTT

NOTE this is a note
and more note

00:00:01.000 --> 00:00:02.000
cue text`;
    const captions = parseVTT(raw, FPS);
    expect(captions).toHaveLength(1);
    expect(captions[0]!.text).toBe('cue text');
  });

  it('hours-optional timecode MM:SS.mmm parses correctly', () => {
    const raw = `WEBVTT

01:00.000 --> 02:00.000
One minute to two`;
    const captions = parseVTT(raw, FPS);
    expect(captions).toHaveLength(1);
    expect(captions[0]!.startFrame).toBe(1800);
    expect(captions[0]!.endFrame).toBe(3600);
  });

  it('strips VTT cue tags <b>, <i>, timestamp tags', () => {
    const raw = `WEBVTT

00:00:00.000 --> 00:00:01.000
<b>bold</b> <00:00:00.500>`;
    const captions = parseVTT(raw, FPS);
    expect(captions[0]!.text).toBe('bold ');
  });

  it('cue counter is 1-based and independent of cue id line', () => {
    const raw = `WEBVTT

cue-id-optional
00:00:00.000 --> 00:00:01.000
First

00:00:02.000 --> 00:00:03.000
Second`;
    const captions = parseVTT(raw, FPS);
    expect(captions).toHaveLength(2);
    expect(captions[0]!.id).toBe('vtt-1');
    expect(captions[1]!.id).toBe('vtt-2');
  });

  it('positioning text after --> is ignored (no crash)', () => {
    const raw = `WEBVTT

00:00:00.000 --> 00:00:01.000 line:90% align:center
Some text`;
    const captions = parseVTT(raw, FPS);
    expect(captions).toHaveLength(1);
    expect(captions[0]!.text).toBe('Some text');
  });
});

// ── timecodeToFrame (via parseSRT) ──────────────────────────────────────────

describe('timecodeToFrame (via parseSRT)', () => {
  it('00:01:00,000 at 30fps → frame 1800', () => {
    const raw = `1
00:01:00,000 --> 00:01:01,000
x`;
    const captions = parseSRT(raw, FPS);
    expect(captions[0]!.startFrame).toBe(1800);
  });

  it('00:00:01,001 at 30fps → Math.round(1.001 * 30) = 30', () => {
    const raw = `1
00:00:01,001 --> 00:00:02,000
x`;
    const captions = parseSRT(raw, FPS);
    expect(captions[0]!.startFrame).toBe(30);
  });

  it('00:00:00,033 at 30fps → Math.round(0.033 * 30) = 1', () => {
    const raw = `1
00:00:00,033 --> 00:00:01,000
x`;
    const captions = parseSRT(raw, FPS);
    expect(captions[0]!.startFrame).toBe(1);
  });
});

// ── subtitleImportToOps ─────────────────────────────────────────────────────

describe('subtitleImportToOps', () => {
  it('returns ADD_CAPTION ops equal to caption count', () => {
    const raw = `1
00:00:00,000 --> 00:00:01,000
A

2
00:00:01,000 --> 00:00:02,000
B`;
    const captions = parseSRT(raw, FPS);
    const ops = subtitleImportToOps(captions, toTrackId('track-1'));
    expect(ops).toHaveLength(2);
    expect(ops.every((o) => o.type === 'ADD_CAPTION')).toBe(true);
  });

  it('each op has correct trackId and caption reference', () => {
    const raw = `1
00:00:00,000 --> 00:00:01,000
Hi`;
    const captions = parseSRT(raw, FPS);
    const trackId = toTrackId('subtitle-track');
    const ops = subtitleImportToOps(captions, trackId);
    expect(ops[0]!.type).toBe('ADD_CAPTION');
    if (ops[0]!.type === 'ADD_CAPTION') {
      expect(ops[0].trackId).toBe(trackId);
      expect(ops[0].caption).toBe(captions[0]);
      expect(ops[0].caption.text).toBe('Hi');
    }
  });
});
