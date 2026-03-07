/**
 * ToolRouter — Phase R Step 3
 *
 * Converts React pointer/keyboard events into engine events.
 * rAF throttle only on onPointerMove. Option Y: onPointerLeave
 * calls handlePointerUp then handlePointerLeave.
 */

import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { TimelineEngine } from '../engine';
import type { TimelinePointerEvent, TimelineKeyEvent, Modifiers, ClipId, TrackId } from '@webpacked-timeline/core';
import type { TimelineFrame } from '@webpacked-timeline/core';

export type ToolRouterOptions = {
  engine: TimelineEngine;
  getPixelsPerFrame: () => number;
  getScrollLeft?: () => number;
};

export type ToolRouterHandlers = {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
  onKeyDown: (e: ReactKeyboardEvent) => void;
};

function getScrollLeftDefault(): number {
  return 0;
}

const EDGE_HIT_PX = 8;

function convertPointerEvent(
  e: ReactPointerEvent,
  getPixelsPerFrame: () => number,
  getScrollLeft: () => number,
): TimelinePointerEvent {
  const ppf = getPixelsPerFrame();
  const sl = getScrollLeft();
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

  // x is in timeline coordinate space (scroll-adjusted, from timeline origin)
  const x = e.clientX - rect.left + sl;
  const y = e.clientY - rect.top;

  // Frame from x position
  const frame = Math.max(0, Math.round(x / ppf)) as TimelineFrame;

  // DOM hit-test: walk up from target
  let clipId: string | undefined;
  let trackId: string | undefined;
  let edge: 'left' | 'right' | 'none' = 'none';
  let clipEl: HTMLElement | null = null;

  let el: HTMLElement | null = e.target as HTMLElement | null;
  while (el && el !== e.currentTarget) {
    if (!clipId && el.dataset.clipId) {
      clipId = el.dataset.clipId;
      clipEl = el;
    }
    if (!trackId && el.dataset.trackId) {
      trackId = el.dataset.trackId;
    }
    if (clipId && trackId) break;
    el = el.parentElement;
  }

  // Edge detection
  if (clipId && clipEl) {
    const cr = clipEl.getBoundingClientRect();
    const localX = e.clientX - cr.left;
    const thresh = Math.min(EDGE_HIT_PX, cr.width * 0.15);
    if (localX <= thresh) edge = 'left';
    else if (localX >= cr.width - thresh) edge = 'right';
  }

  return {
    frame,
    trackId: (trackId as TrackId) ?? null,
    clipId: (clipId as ClipId) ?? null,
    x,
    y,
    buttons: e.buttons,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
    edge,
  };
}

function extractModifiers(e: ReactPointerEvent | ReactKeyboardEvent): Modifiers {
  return {
    shift: e.shiftKey,
    alt: e.altKey,
    ctrl: e.ctrlKey,
    meta: e.metaKey,
  };
}

function convertKeyEvent(e: ReactKeyboardEvent): TimelineKeyEvent {
  return {
    code: e.code,
    key: e.key,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
    ctrlKey: e.ctrlKey,
    repeat: e.repeat,
  };
}

export function createToolRouter(options: ToolRouterOptions): ToolRouterHandlers {
  const { engine } = options;
  const getScrollLeft = options.getScrollLeft ?? getScrollLeftDefault;
  const getPixelsPerFrame = options.getPixelsPerFrame;

  let rafId: number | null = null;
  let lastMoveEvent: ReactPointerEvent | null = null;
  let lastModifiers: Modifiers | null = null;

  return {
    onPointerDown(e: ReactPointerEvent): void {
      const converted = convertPointerEvent(e, getPixelsPerFrame, getScrollLeft);
      engine.handlePointerDown(converted, extractModifiers(e));
    },

    onPointerMove(e: ReactPointerEvent): void {
      e.preventDefault();
      lastMoveEvent = e;
      lastModifiers = extractModifiers(e);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (lastMoveEvent !== null && lastModifiers !== null) {
          const converted = convertPointerEvent(
            lastMoveEvent,
            getPixelsPerFrame,
            getScrollLeft,
          );
          engine.handlePointerMove(converted, lastModifiers);
        }
      });
    },

    onPointerUp(e: ReactPointerEvent): void {
      const converted = convertPointerEvent(e, getPixelsPerFrame, getScrollLeft);
      engine.handlePointerUp(converted, extractModifiers(e));
    },

    onPointerLeave(e: ReactPointerEvent): void {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastMoveEvent = null;
      lastModifiers = null;
      const converted = convertPointerEvent(e, getPixelsPerFrame, getScrollLeft);
      engine.handlePointerUp(converted, extractModifiers(e));
      engine.handlePointerLeave(converted);
    },

    onKeyDown(e: ReactKeyboardEvent): void {
      const converted = convertKeyEvent(e);
      const handled = engine.handleKeyDown(converted, extractModifiers(e));
      if (handled) e.preventDefault();
    },
  };
}
