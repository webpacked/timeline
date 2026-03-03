/**
 * Keyboard contract — Phase 6 Step 4 + Step 5
 *
 * Key bindings and actions for J/K/L jog-shuttle and timeline navigation.
 */

import type { TimelineFrame } from './frame';
import type { TimelineState } from './state';

export type TimelineKeyAction =
  | 'play-pause'
  | 'stop'
  | 'jog-forward'
  | 'jog-backward'
  | 'jog-stop'
  | 'step-forward'
  | 'step-backward'
  | 'seek-start'
  | 'seek-end'
  | 'next-clip'
  | 'prev-clip'
  | 'next-marker'
  | 'prev-marker'
  | 'mark-in'
  | 'mark-out'
  | 'toggle-loop';

export type KeyBinding = {
  readonly code: string;
  readonly shift?: boolean;
  readonly alt?: boolean;
  readonly meta?: boolean;
  readonly ctrl?: boolean;
  readonly action: TimelineKeyAction;
  readonly repeat?: boolean;
};

export const DEFAULT_KEY_BINDINGS: KeyBinding[] = [
  { code: 'Space', action: 'play-pause' },
  { code: 'KeyK', action: 'jog-stop' },
  { code: 'KeyJ', action: 'jog-backward' },
  { code: 'KeyL', action: 'jog-forward' },
  { code: 'ArrowRight', action: 'step-forward', repeat: true },
  { code: 'ArrowLeft', action: 'step-backward', repeat: true },
  { code: 'Home', action: 'seek-start' },
  { code: 'End', action: 'seek-end' },
  { code: 'ArrowRight', shift: true, action: 'next-clip' },
  { code: 'ArrowLeft', shift: true, action: 'prev-clip' },
  { code: 'ArrowRight', alt: true, action: 'next-marker' },
  { code: 'ArrowLeft', alt: true, action: 'prev-marker' },
  { code: 'KeyI', action: 'mark-in' },
  { code: 'KeyO', action: 'mark-out' },
  { code: 'KeyQ', action: 'toggle-loop' },
];

export type KeyboardHandlerOptions = {
  bindings?: KeyBinding[];
  onMarkIn?: (frame: TimelineFrame) => void;
  onMarkOut?: (frame: TimelineFrame) => void;
  getTimelineState?: () => TimelineState;
};
