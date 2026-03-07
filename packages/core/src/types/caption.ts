/**
 * CAPTION MODEL — Phase 3
 *
 * Captions live on Track.captions[]. Used for SRT/VTT and burn-in.
 */

import type { TimelineFrame } from './frame';

// ---------------------------------------------------------------------------
// Branded ID
// ---------------------------------------------------------------------------

export type CaptionId = string & { readonly __brand: 'CaptionId' };
export const toCaptionId = (s: string): CaptionId => s as CaptionId;

// ---------------------------------------------------------------------------
// CaptionStyle
// ---------------------------------------------------------------------------

export type CaptionStyle = {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly color: string;
  readonly backgroundColor: string;
  readonly hAlign: 'left' | 'center' | 'right';
  readonly vAlign: 'top' | 'center' | 'bottom';
};

// ---------------------------------------------------------------------------
// Caption
// ---------------------------------------------------------------------------

export type Caption = {
  readonly id: CaptionId;
  readonly text: string;
  readonly startFrame: TimelineFrame;
  readonly endFrame: TimelineFrame;
  readonly language: string; // BCP-47: 'en-US', 'fr-FR'
  readonly style: CaptionStyle;
  readonly burnIn: boolean;
};
