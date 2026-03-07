/**
 * DaVinciRuler — timecode display + tick marks.
 *
 * Left section: current timecode (fixed label-width area).
 * Right section: scrollable tick marks with labels, markers, playhead triangle.
 */
import React, { useMemo, useCallback } from 'react';
import {
  usePlayheadFrame,
  useTimelineWithEngine,
  useMarkers,
} from '@timeline/react';
import { toFrame, toMarkerId } from '@timeline/core';
import { useTimelineContext } from '../../context/timeline-context';
import { frameToTimecode, rulerTickInterval } from '../../shared/time';

// ── Transaction ID helper ──────────────────────────────────────────────────

let _rulerTxSeq = 0;
const txId = () => `ruler-tx-${++_rulerTxSeq}`;

// ── Props ──────────────────────────────────────────────────────────────────

export interface DaVinciRulerProps {
  /** Ref attached to the tick content div — needed for scroll sync from parent */
  contentRef?: React.RefObject<HTMLDivElement>;
}

// ── Component ──────────────────────────────────────────────────────────────

export function DaVinciRuler({ contentRef }: DaVinciRulerProps) {
  const { engine, ppf, scrollLeft, vpWidth, labelWidth, rulerHeight } = useTimelineContext();
  const frame = usePlayheadFrame(engine);
  const timeline = useTimelineWithEngine(engine);
  const markers = useMarkers(engine);

  const fps = timeline.fps as number;
  const durationFrames = timeline.duration as number;
  const timelineWidth = durationFrames * ppf;

  // ── Timecode ──
  const timecode = useMemo(
    () => frameToTimecode(frame as number, fps),
    [frame, fps],
  );

  // ── Ruler ticks (visible only) ──
  const rulerTicks = useMemo(() => {
    const startF = Math.floor(scrollLeft / ppf);
    const endF = startF + Math.ceil(vpWidth / ppf) + 1;
    const { major, minor } = rulerTickInterval(ppf, fps);

    const ticks: Array<{ frame: number; isMajor: boolean; x: number }> = [];
    const first = Math.floor(startF / minor) * minor;
    for (let f = first; f <= endF; f += minor) {
      ticks.push({ frame: f, isMajor: f % major === 0, x: f * ppf });
    }
    return ticks;
  }, [scrollLeft, ppf, vpWidth, fps]);

  // ── Click handler (seek or add marker) ──
  const [, forceUpdate] = React.useState(0);
  const triggerUpdate = useCallback(() => forceUpdate((n) => n + 1), []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + (contentRef?.current?.scrollLeft ?? 0);
      const f = Math.max(0, Math.round(x / ppf));

      if (e.altKey) {
        engine.dispatch({
          id: txId(),
          label: 'Add Marker',
          timestamp: Date.now(),
          operations: [
            {
              type: 'ADD_MARKER',
              marker: {
                type: 'point',
                id: toMarkerId(`marker-${Date.now()}`),
                frame: toFrame(f),
                label: `M ${f}`,
                color: 'hsl(45 90% 60%)',
                scope: 'global',
                linkedClipId: null,
              },
            },
          ] as any,
        });
        triggerUpdate();
      } else {
        engine.seekTo(toFrame(f));
        triggerUpdate();
      }
    },
    [engine, ppf, contentRef, triggerUpdate],
  );

  return (
    <div
      style={{
        display: 'flex',
        height: rulerHeight,
        flexShrink: 0,
        background: 'var(--tl-ruler-bg)',
      }}
    >
      {/* ── Timecode (left, label-width, aligned with track labels) ── */}
      <div
        style={{
          width: labelWidth,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 12,
          background: 'var(--tl-label-bg)',
          borderRight: '1px solid hsl(220 13% 22%)',
          borderBottom: '1px solid var(--tl-track-border)',
        }}
      >
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 'var(--tl-timecode-size)',
            color: 'var(--tl-timecode-color)',
            letterSpacing: '0.04em',
            fontWeight: 600,
          }}
        >
          {timecode}
        </span>
      </div>

      {/* ── Ruler ticks (right, flex:1, overflow hidden) ── */}
      <div
        ref={contentRef as React.RefObject<HTMLDivElement>}
        style={{
          flex: 1,
          position: 'relative',
          overflowX: 'hidden',
          overflowY: 'hidden',
          cursor: 'pointer',
          borderBottom: '1px solid var(--tl-track-border)',
        }}
        onClick={handleClick}
      >
        <div style={{ width: Math.max(timelineWidth, vpWidth), height: '100%', position: 'relative' }}>
          {rulerTicks.map((tick) => (
            <div
              key={tick.frame}
              style={{
                position: 'absolute',
                left: tick.x,
                top: 0,
                bottom: 0,
                width: 1,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: 1,
                  height: tick.isMajor ? 12 : 6,
                  background: tick.isMajor ? 'var(--tl-ruler-tick-maj)' : 'var(--tl-ruler-tick)',
                }}
              />
              {tick.isMajor && tick.x > 4 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: 3,
                    fontSize: 9,
                    fontFamily: 'monospace',
                    color: 'var(--tl-ruler-text)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}
                >
                  {frameToTimecode(tick.frame, fps)}
                </span>
              )}
            </div>
          ))}

          {/* Marker triangles */}
          {markers.map((m) => {
            if (m.type !== 'point') return null;
            const mx = (m.frame as number) * ppf;
            return (
              <div
                key={m.id as string}
                title={m.label}
                style={{
                  position: 'absolute',
                  left: mx - 4,
                  bottom: 0,
                  width: 0,
                  height: 0,
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderBottom: `7px solid ${m.color ?? 'var(--tl-snap-color)'}`,
                  pointerEvents: 'none',
                  zIndex: 6,
                }}
              />
            );
          })}

          {/* Playhead triangle */}
          <div
            style={{
              position: 'absolute',
              left: (frame as number) * ppf - 5,
              bottom: 0,
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '6px solid var(--tl-playhead-color)',
              pointerEvents: 'none',
              zIndex: 7,
            }}
          />
        </div>
      </div>
    </div>
  );
}
