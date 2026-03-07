/**
 * DaVinciTrack — renders a track label row.
 *
 * Displays track name, type badge, lock/visibility icons,
 * solo/mute buttons (audio), clip count, and action buttons.
 * Uses CSS variables for theming.
 */
import React, { useState } from 'react';
import { useTrackWithEngine } from '@timeline/react';
import { useTimelineContext } from '../../context/timeline-context';

// ── Props ──────────────────────────────────────────────────────────────────

export interface DaVinciTrackProps {
  trackId: string;
  shortId: string;
  height: number;
  clipCount: number;
  onDelete: (trackId: string) => void;
  onAddClip: (trackId: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function DaVinciTrack({
  trackId,
  shortId,
  height,
  clipCount,
  onDelete,
  onAddClip,
}: DaVinciTrackProps) {
  const { engine } = useTimelineContext();
  const track = useTrackWithEngine(engine, trackId);
  const [soloActive, setSoloActive] = useState(false);
  const [muteActive, setMuteActive] = useState(false);
  const [lockActive, setLockActive] = useState(false);
  const [visActive, setVisActive] = useState(true);

  if (!track) return null;

  const isAudio = track.type === 'audio';
  const typeVar =
    track.type === 'video'
      ? 'var(--tl-type-video)'
      : track.type === 'audio'
        ? 'var(--tl-type-audio)'
        : track.type === 'subtitle'
          ? 'var(--tl-type-subtitle)'
          : 'var(--tl-type-title)';

  return (
    <div
      data-track-id={trackId}
      style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: 'var(--tl-label-bg)',
        borderBottom: '1px solid var(--tl-label-border)',
        borderRight: '1px solid var(--tl-label-border)',
        overflow: 'hidden',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* Type color bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 4, height: '100%', background: typeVar }} />

      {/* Row 1: short id + name + icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px 0 10px' }}>
        <span
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            fontWeight: 700,
            color: typeVar,
            background: 'hsl(220 13% 16%)',
            padding: '1px 4px',
            borderRadius: 2,
            flexShrink: 0,
          }}
        >
          {shortId}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: 'system-ui, sans-serif',
            color: 'var(--tl-label-text)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {track.name ?? shortId}
        </span>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <div
            onClick={() => setLockActive(!lockActive)}
            style={{
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              color: lockActive ? 'var(--tl-btn-text-active)' : 'var(--tl-label-text)',
              background: lockActive ? 'hsl(220 13% 20%)' : 'transparent',
              borderRadius: 2,
              cursor: 'pointer',
            }}
          >
            🔒
          </div>
          <div
            onClick={() => setVisActive(!visActive)}
            style={{
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              color: visActive ? 'var(--tl-label-text)' : 'hsl(0 0% 40%)',
              background: !visActive ? 'hsl(220 13% 20%)' : 'transparent',
              borderRadius: 2,
              cursor: 'pointer',
            }}
          >
            👁
          </div>
        </div>
      </div>

      {/* Delete track button — top-right */}
      <div
        onClick={(ev) => {
          ev.stopPropagation();
          onDelete(trackId);
        }}
        style={{
          position: 'absolute',
          top: 2,
          right: 6,
          width: 16,
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'var(--tl-label-text-dim)',
          cursor: 'pointer',
          borderRadius: 2,
          background: 'transparent',
        }}
        onMouseEnter={(ev) => {
          (ev.currentTarget as HTMLElement).style.background = 'hsl(0 60% 40%)';
          (ev.currentTarget as HTMLElement).style.color = '#fff';
        }}
        onMouseLeave={(ev) => {
          (ev.currentTarget as HTMLElement).style.background = 'transparent';
          (ev.currentTarget as HTMLElement).style.color = 'var(--tl-label-text-dim)';
        }}
        title="Delete track"
      >
        ×
      </div>

      {/* Row 2: clip count + add clip + S/M buttons for audio */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '1px 6px 0 10px', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--tl-label-text-dim)' }}>
          {clipCount} Clip{clipCount !== 1 ? 's' : ''}
        </span>
        <div
          onClick={(ev) => {
            ev.stopPropagation();
            onAddClip(trackId);
          }}
          style={{
            fontSize: 9,
            color: 'hsl(220 10% 55%)',
            cursor: 'pointer',
            padding: '0 3px',
            borderRadius: 2,
            background: 'transparent',
          }}
          onMouseEnter={(ev) => {
            (ev.currentTarget as HTMLElement).style.color = 'hsl(213 70% 55%)';
          }}
          onMouseLeave={(ev) => {
            (ev.currentTarget as HTMLElement).style.color = 'hsl(220 10% 55%)';
          }}
          title="Add clip to this track"
        >
          + Clip
        </div>
        <div style={{ flex: 1 }} />
        {isAudio && (
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <div
              onClick={() => setSoloActive(!soloActive)}
              style={{
                width: 20,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontFamily: 'monospace',
                fontWeight: 700,
                color: soloActive ? 'hsl(0 0% 10%)' : 'var(--tl-label-text)',
                background: soloActive ? 'var(--tl-solo-active)' : 'hsl(220 13% 16%)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              S
            </div>
            <div
              onClick={() => setMuteActive(!muteActive)}
              style={{
                width: 20,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontFamily: 'monospace',
                fontWeight: 700,
                color: muteActive ? 'hsl(0 0% 100%)' : 'var(--tl-label-text)',
                background: muteActive ? 'var(--tl-mute-active)' : 'hsl(220 13% 16%)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              M
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
