/**
 * Frame / pixel / timecode math utilities.
 * Extracted from proven demo logic.
 */

export function frameToPx(frame: number, ppf: number, scrollLeft = 0): number {
  return frame * ppf - scrollLeft;
}

export function pxToFrame(x: number, ppf: number, scrollLeft = 0): number {
  return Math.max(0, Math.round((x + scrollLeft) / ppf));
}

export function frameToTimecode(frame: number, fps: number): string {
  const totalSeconds = Math.floor(frame / fps);
  const f = Math.round(frame % fps);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

export function rulerTickInterval(
  pixelsPerFrame: number,
  fps: number,
): { major: number; minor: number } {
  const LABEL_MIN_GAP = 120;
  const TICK_MIN_GAP = 6;

  const candidates = [
    1, 2, 5, 10, 15, 30,
    fps, fps * 2, fps * 5, fps * 10, fps * 30, fps * 60, fps * 300,
    fps * 600, fps * 1800, fps * 3600,
  ];

  const major =
    candidates.find((c) => c * pixelsPerFrame >= LABEL_MIN_GAP) ??
    candidates[candidates.length - 1]!;

  let minor: number;
  if (major >= fps) {
    minor = major / (fps === 30 ? 5 : 4);
  } else {
    minor = Math.max(1, major / 5);
  }
  minor = Math.round(minor);

  while (minor * pixelsPerFrame < TICK_MIN_GAP && minor < major) {
    minor *= 2;
  }

  return { major, minor };
}
