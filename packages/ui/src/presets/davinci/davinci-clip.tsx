/**
 * DaVinciClip — renders a single clip block.
 *
 * Purely presentational: receives all data as props.
 * Positioned absolutely within its parent track clip row.
 * Uses CSS variables for theming.
 */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { Clip, ProvisionalState } from '@timeline/core';

// ── Helpers ────────────────────────────────────────────────────────────────

function getDisplayClip(clip: Clip, provisional: ProvisionalState | null): Clip {
  if (!provisional?.clips) return clip;
  return provisional.clips.find((c) => c.id === clip.id) ?? clip;
}

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h ^= h << 13;
    h ^= h >> 17;
    h ^= h << 5;
    return (h >>> 0) / 0xffffffff;
  };
}

// ── ClipWaveform ───────────────────────────────────────────────────────────

function ClipWaveform({ clipId, width, height }: { clipId: string; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samples = useMemo(() => {
    const rand = seededRandom(clipId);
    const w = Math.max(1, Math.round(width));
    return Array.from({ length: w }, () => rand() * 2 - 1);
  }, [clipId, width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = Math.round(width);
    const h = height;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;

    // Subtle center line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    // Continuous waveform line
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const sampleIndex = Math.floor(x / w * samples.length);
      const sample = samples[sampleIndex]!;
      const y = mid + sample * mid * 0.6;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [samples, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: Math.round(width),
        height,
        pointerEvents: 'none',
        opacity: 0.7,
      }}
    />
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface DaVinciClipProps {
  clip: Clip;
  provisional: ProvisionalState | null;
  trackId: string;
  isAudio: boolean;
  ppf: number;
  height: number;
  isSelected: boolean;
  toolId: string;
  fps: number;
  startFrame: number;
  endFrame: number;
}

// ── Component ──────────────────────────────────────────────────────────────

export function DaVinciClip({
  clip,
  provisional,
  trackId,
  isAudio,
  ppf,
  height,
  isSelected,
  toolId,
  fps,
  startFrame,
  endFrame,
}: DaVinciClipProps) {
  const [isHovered, setIsHovered] = useState(false);

  const dc = getDisplayClip(clip, provisional);
  const start = dc.timelineStart as number;
  const dur = (dc.timelineEnd as number) - start;
  const left = start * ppf;
  const width = dur * ppf;

  // Virtual windowing: skip clips entirely outside visible range
  if (start + dur <= startFrame || start >= endFrame) return null;
  if (width < 1) return null;

  const isProvisional = !!provisional?.clips?.find((c) => c.id === clip.id);
  const showClipDetail = ppf >= 3;
  const showClipFull = ppf >= 8;
  const showDuration = ppf >= 5;
  const isThin = width < 4;
  const durationSec = (dur / fps).toFixed(1);

  return (
    <div
      data-clip-id={clip.id}
      data-track-id={trackId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        left,
        top: 0,
        width: Math.max(width, 2),
        height,
        background: isThin
          ? isAudio ? 'var(--tl-clip-audio-accent)' : 'var(--tl-clip-video-accent)'
          : isProvisional
            ? 'var(--tl-clip-provisional)'
            : isAudio
              ? 'linear-gradient(to bottom, var(--tl-clip-audio-top), var(--tl-clip-audio-bg))'
              : 'linear-gradient(to bottom, var(--tl-clip-video-top), var(--tl-clip-video-bg))',
        border: isThin ? 'none' : '1px solid',
        borderColor: isSelected ? 'var(--tl-clip-border-sel)' : 'var(--tl-clip-border)',
        borderRadius: isThin ? 0 : 'var(--tl-clip-radius)',
        overflow: 'hidden',
        cursor:
          toolId === 'razor'
            ? 'crosshair'
            : toolId === 'hand'
              ? 'grab'
              : 'pointer',
        userSelect: 'none',
        filter: isSelected ? 'brightness(1.3)' : isHovered ? 'brightness(1.1)' : undefined,
      }}
    >
      {!isThin && (
        <>
          {/* Top accent strip — video clips only */}
          {!isAudio && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: 'var(--tl-clip-video-accent)',
                borderRadius:
                  'var(--tl-clip-radius) '
                  + 'var(--tl-clip-radius) 0 0',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Clip label */}
          {showClipDetail && width > 30 && (
            <span
              style={{
                position: 'absolute',
                bottom: 4,
                left: 6,
                maxWidth: '75%',
                fontSize: 10,
                fontFamily: 'system-ui, sans-serif',
                color: isAudio ? 'var(--tl-clip-audio-text)' : 'var(--tl-clip-video-text)',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                pointerEvents: 'none',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              🔗 {clip.name ?? clip.id}
            </span>
          )}

          {/* Type icon — bottom-left */}
          {showClipFull && width > 80 && (
            <span
              style={{
                position: 'absolute',
                bottom: 2,
                left: 4,
                fontSize: 9,
                pointerEvents: 'none',
                color: 'var(--tl-clip-text-dim)',
              }}
            >
              {isAudio ? '♪' : '▶'}
            </span>
          )}

          {/* Duration label — bottom-right */}
          {showDuration && width > 60 && (
            <span
              style={{
                position: 'absolute',
                bottom: 2,
                right: 4,
                fontSize: 9,
                fontFamily: 'monospace',
                color: 'var(--tl-clip-text-dim)',
                pointerEvents: 'none',
              }}
            >
              {durationSec}s
            </span>
          )}

          {/* Audio waveform */}
          {isAudio && width > 40 && (
            <ClipWaveform clipId={clip.id as string} width={width - 2} height={height} />
          )}

          {/* Trim handles on hover */}
          {showClipFull && isHovered && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: 4,
                  height: '100%',
                  background: 'hsl(0 0% 100% / 0.15)',
                  cursor: 'ew-resize',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  width: 4,
                  height: '100%',
                  background: 'hsl(0 0% 100% / 0.15)',
                  cursor: 'ew-resize',
                  pointerEvents: 'none',
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
