/**
 * Tabler-based SVG icon components for the DaVinci preset.
 *
 * Sources: Tabler Icons (outline style, 24×24, stroke-1.5, round-cap).
 * Missing icons (playback, zoom, trim) are hand-drawn in the same style.
 */
import React from 'react';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

const defaults = { size: 16, color: 'currentColor', strokeWidth: 1.5 };

function svgProps(p: IconProps) {
  const s = p.size ?? defaults.size;
  const c = p.color ?? defaults.color;
  const sw = p.strokeWidth ?? defaults.strokeWidth;
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: c,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { display: 'block' } as React.CSSProperties,
  };
}

// ── Tool icons ─────────────────────────────────────────────────────────────

export function IconPointer(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M7.904 17.563a1.2 1.2 0 0 0 2.228 .308l2.09 -3.093l4.907 4.907a1.067 1.067 0 0 0 1.509 0l1.047 -1.047a1.067 1.067 0 0 0 0 -1.509l-4.907 -4.907l3.113 -2.09a1.2 1.2 0 0 0 -.309 -2.228l-13.582 -3.904l3.904 13.563" />
    </svg>
  );
}

export function IconScissors(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M3 7a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M3 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M8.6 8.6l10.4 10.4" />
      <path d="M8.6 15.4l10.4 -10.4" />
    </svg>
  );
}

export function IconRippleTrim(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M7 5v14" />
      <path d="M7 5h3" />
      <path d="M7 19h3" />
      <path d="M13 9l4 3l-4 3" />
    </svg>
  );
}

export function IconRollTrim(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M21 17l-18 0" />
      <path d="M6 10l-3 -3l3 -3" />
      <path d="M3 7l18 0" />
      <path d="M18 20l3 -3l-3 -3" />
    </svg>
  );
}

export function IconSlip(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M18 9l3 3l-3 3" />
      <path d="M15 12h6" />
      <path d="M6 9l-3 3l3 3" />
      <path d="M3 12h6" />
    </svg>
  );
}

export function IconSlide(p: IconProps = {}) {
  const s = p.size ?? defaults.size;
  const c = p.color ?? defaults.color;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill={c}
      stroke="none"
      style={{ display: 'block' }}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M13 6c0 -.89 1.077 -1.337 1.707 -.707l6 6a1 1 0 0 1 0 1.414l-6 6c-.63 .63 -1.707 .184 -1.707 -.707v-12z" />
      <path d="M9.293 5.293c.63 -.63 1.707 -.184 1.707 .707v12c0 .89 -1.077 1.337 -1.707 .707l-6 -6a1 1 0 0 1 0 -1.414l6 -6z" />
    </svg>
  );
}

export function IconHand(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M8 13v-7.5a1.5 1.5 0 0 1 3 0v6.5" />
      <path d="M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5" />
      <path d="M14 5.5a1.5 1.5 0 0 1 3 0v6.5" />
      <path d="M17 7.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47" />
    </svg>
  );
}

// ── Playback icons ─────────────────────────────────────────────────────

export function IconPlayerPlay(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M7 4v16l13 -8z" />
    </svg>
  );
}

export function IconPlayerPause(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M6 5h2v14h-2z" />
      <path d="M16 5h2v14h-2z" />
    </svg>
  );
}

// ── Edit icons ─────────────────────────────────────────────────────────

export function IconUndo(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M9 14l-4 -4l4 -4" />
      <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
    </svg>
  );
}

export function IconRedo(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M15 14l4 -4l-4 -4" />
      <path d="M19 10h-11a4 4 0 1 0 0 8h1" />
    </svg>
  );
}

// ── Zoom icons ─────────────────────────────────────────────────────────

export function IconZoomIn(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
      <path d="M7 10h6" />
      <path d="M10 7v6" />
      <path d="M21 21l-6 -6" />
    </svg>
  );
}

export function IconZoomOut(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
      <path d="M7 10h6" />
      <path d="M21 21l-6 -6" />
    </svg>
  );
}

// ── Exports (all icons keyed by tool id) ───────────────────────────────

export const TOOL_ICONS: Record<string, (p: IconProps) => React.JSX.Element> = {
  selection: IconPointer,
  razor: IconScissors,
  'ripple-trim': IconRippleTrim,
  'roll-trim': IconRollTrim,
  slip: IconSlip,
  slide: IconSlide,
  hand: IconHand,
};
