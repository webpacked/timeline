/**
 * DaVinciEditor — flagship timeline editor component.
 *
 * Composes all DaVinci preset components into a complete
 * DaVinci Resolve–style timeline editor. Owns all layout
 * coordination, pointer/keyboard handling, and scroll sync.
 *
 * Usage:
 *   import { DaVinciEditor } from '@timeline/ui';
 *   import '@timeline/ui/styles/davinci';
 *
 *   <DaVinciEditor
 *     engine={engine}
 *     onPpfChange={setEnginePixelsPerFrame}
 *     registerZoomHandler={setOnZoomChange}
 *     style={{ height: '100vh' }}
 *   />
 */
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  useTrackIdsWithEngine,
  useTimelineWithEngine,
  usePlayheadFrame,
  useIsPlaying,
  useActiveToolId,
  useHistory,
  useProvisionalWithEngine,
  useSelectedClipIds,
  useCursor,
  useVirtualWindow,
  useMarkers,
  useTrackWithEngine,
  useClips,
} from '@timeline/react';
import type { TimelineEngine } from '@timeline/react';
import type {
  TimelinePointerEvent,
  TimelineKeyEvent,
  Modifiers,
  ClipId,
  TrackId,
  ProvisionalState,
} from '@timeline/core';
import { toFrame, createTrack, toTrackId, createClip, toAssetId, createAsset, frameRate } from '@timeline/core';
import { TimelineProvider, useTimelineContext } from '../../context/timeline-context';
import { DaVinciToolbar } from './davinci-toolbar';
import { DaVinciRuler } from './davinci-ruler';
import { DaVinciTrack } from './davinci-track';
import { DaVinciClip } from './davinci-clip';
import { DaVinciPlayhead } from './davinci-playhead';

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_TRACK_HEIGHT_VIDEO = 80;
const DEFAULT_TRACK_HEIGHT_AUDIO = 80;
const MIN_TRACK_HEIGHT = 32;
const MAX_TRACK_HEIGHT = 125;

// ── Helpers ────────────────────────────────────────────────────────────────

let _txSeq = 0;
const txId = () => `ui-tx-${++_txSeq}`;

function extractModifiers(e: React.PointerEvent | React.KeyboardEvent): Modifiers {
  return { shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey };
}

function getShortTrackId(
  trackId: string,
  type: string,
  allTrackIds: readonly string[],
  trackTypes: Map<string, string>,
): string {
  const prefix = type === 'video' ? 'V' : type === 'audio' ? 'A' : type === 'subtitle' ? 'S' : 'T';
  let idx = 1;
  for (const tid of allTrackIds) {
    if (tid === trackId) break;
    if (trackTypes.get(tid) === type) idx++;
  }
  return `${prefix}${idx}`;
}

// ── ClipRow (internal) ─────────────────────────────────────────────────────

function ClipRow({
  trackId,
  ppf,
  provisional,
  selection,
  toolId,
  height,
  fps,
  startFrame,
  endFrame,
}: {
  trackId: string;
  ppf: number;
  provisional: ProvisionalState | null;
  selection: ReadonlySet<string>;
  toolId: string;
  height: number;
  fps: number;
  startFrame: number;
  endFrame: number;
}) {
  const { engine } = useTimelineContext();
  const track = useTrackWithEngine(engine, trackId);
  const clips = useClips(engine, trackId);
  const [trackHovered, setTrackHovered] = useState(false);

  if (!track) return null;
  const isAudio = track.type === 'audio';

  return (
    <div
      data-track-id={trackId}
      style={{
        height,
        position: 'relative',
        borderBottom: '1px solid var(--tl-track-border)',
        background: isAudio ? 'var(--tl-track-bg-audio)' : 'var(--tl-track-bg-video)',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setTrackHovered(true)}
      onMouseLeave={() => setTrackHovered(false)}
    >
      {/* Empty track indicator */}
      {clips.length === 0 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              borderTop: '1px dashed hsl(220 13% 22%)',
              pointerEvents: 'none',
            }}
          />
          {trackHovered && (
            <span
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 11,
                color: 'hsl(220 10% 35%)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Drop clips here or click +
            </span>
          )}
        </>
      )}

      {clips.map((clip) => (
        <DaVinciClip
          key={clip.id as string}
          clip={clip}
          provisional={provisional}
          trackId={trackId}
          isAudio={isAudio}
          ppf={ppf}
          height={height}
          isSelected={selection.has(clip.id as string)}
          toolId={toolId}
          fps={fps}
          startFrame={startFrame}
          endFrame={endFrame}
        />
      ))}
    </div>
  );
}

// ── Public Props ───────────────────────────────────────────────────────────

export interface DaVinciEditorProps {
  engine: TimelineEngine;
  initialPpf?: number;
  /** Called when ppf changes (sync to engine's getPixelsPerFrame) */
  onPpfChange?: (ppf: number) => void;
  /** Editor calls this on mount with its setPpf function (for engine → editor zoom) */
  registerZoomHandler?: (handler: (ppf: number) => void) => void;
  className?: string;
  style?: React.CSSProperties;
}

// ── Public Component ───────────────────────────────────────────────────────

export function DaVinciEditor({
  engine,
  initialPpf = 4,
  onPpfChange,
  registerZoomHandler,
  className,
  style,
}: DaVinciEditorProps) {
  return (
    <TimelineProvider engine={engine} initialPpf={initialPpf} onPpfChange={onPpfChange}>
      <EditorInner
        registerZoomHandler={registerZoomHandler}
        className={className}
        style={style}
      />
    </TimelineProvider>
  );
}

// ── Inner Editor (reads from context) ──────────────────────────────────────

function EditorInner({
  registerZoomHandler,
  className,
  style,
}: {
  registerZoomHandler?: (handler: (ppf: number) => void) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const {
    engine,
    ppf,
    ppfRef,
    setPpf,
    scrollLeft,
    scrollRef,
    setScrollLeft,
    vpWidth,
    setVpWidth,
    labelWidth,
    rulerHeight,
    toolbarHeight,
  } = useTimelineContext();

  // ── Force re-render ──
  const [, forceUpdate] = useState(0);
  const triggerUpdate = useCallback(() => forceUpdate((n) => n + 1), []);

  // ── Refs ──
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const labelColumnRef = useRef<HTMLDivElement>(null);
  const rulerContentRef = useRef<HTMLDivElement>(null);
  const handDragRef = useRef<{ startX: number; startScroll: number } | null>(null);
  const resizeDragRef = useRef<{ trackId: string; startY: number; startHeight: number } | null>(null);

  // ── Track height state ──
  const [trackHeights, setTrackHeights] = useState<Record<string, number>>({});

  // ── Engine data ──
  const trackIds = useTrackIdsWithEngine(engine);
  const timeline = useTimelineWithEngine(engine);
  const frame = usePlayheadFrame(engine);
  const isPlaying = useIsPlaying(engine);
  const toolId = useActiveToolId(engine);
  const provisional = useProvisionalWithEngine(engine);
  const selection = useSelectedClipIds(engine);
  const cursor = useCursor(engine);
  const virtualWindow = useVirtualWindow(engine, vpWidth, scrollLeft, ppf);

  const fps = timeline.fps as number;
  const durationFrames = timeline.duration as number;

  // ── Snap indicator frames ──
  const snapFrames = useMemo(() => {
    if (!provisional?.clips?.length) return [];
    const state = engine.getState();
    const committedEdges = new Set<number>();
    const committedClipMap = new Map<string, { start: number; end: number }>();
    for (const track of state.timeline.tracks) {
      for (const clip of track.clips) {
        const s = clip.timelineStart as number;
        const e = clip.timelineEnd as number;
        committedEdges.add(s);
        committedEdges.add(e);
        committedClipMap.set(clip.id as string, { start: s, end: e });
      }
    }
    committedEdges.add(frame as number);
    const snapped = new Set<number>();
    for (const pc of provisional.clips) {
      const committed = committedClipMap.get(pc.id as string);
      if (!committed) continue;
      const ps = pc.timelineStart as number;
      const pe = pc.timelineEnd as number;
      if (ps !== committed.start && committedEdges.has(ps)) snapped.add(ps);
      if (pe !== committed.end && committedEdges.has(pe)) snapped.add(pe);
    }
    return Array.from(snapped);
  }, [provisional, frame, engine]);

  // ── Build track type map ──
  const trackTypesMap = useMemo(() => {
    const map = new Map<string, string>();
    const state = engine.getState();
    for (const t of state.timeline.tracks) {
      map.set(t.id as string, t.type);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIds]);

  // ── Get height for a track ──
  const getTrackHeight = useCallback(
    (trackId: string) => {
      if (trackHeights[trackId] !== undefined) return trackHeights[trackId];
      const type = trackTypesMap.get(trackId);
      return type === 'video' ? DEFAULT_TRACK_HEIGHT_VIDEO : DEFAULT_TRACK_HEIGHT_AUDIO;
    },
    [trackHeights, trackTypesMap],
  );

  const totalTrackHeight = useMemo(
    () => trackIds.reduce((sum, tid) => sum + getTrackHeight(tid), 0),
    [trackIds, getTrackHeight],
  );

  // ── Track add / delete ──
  const addTrack = useCallback(
    (type: 'video' | 'audio') => {
      const id = `track-${Date.now()}`;
      const name =
        type === 'video'
          ? `Video ${trackIds.filter((t) => trackTypesMap.get(t) === 'video').length + 1}`
          : `Audio ${trackIds.filter((t) => trackTypesMap.get(t) === 'audio').length + 1}`;
      engine.dispatch({
        id: txId(),
        label: `Add ${type} track`,
        timestamp: Date.now(),
        operations: [{ type: 'ADD_TRACK', track: createTrack({ id, name, type }) }] as any,
      });
      triggerUpdate();
    },
    [engine, trackIds, trackTypesMap, triggerUpdate],
  );

  const deleteTrack = useCallback(
    (trackId: string) => {
      engine.dispatch({
        id: txId(),
        label: 'Delete track',
        timestamp: Date.now(),
        operations: [{ type: 'DELETE_TRACK', trackId }] as any,
      });
      triggerUpdate();
    },
    [engine, triggerUpdate],
  );

  // ── Add clip to track ──
  const addClip = useCallback(
    (trackId: string) => {
      const state = engine.getState();
      const track = state.timeline.tracks.find((t) => (t.id as string) === trackId);
      const lastClip = track?.clips.reduce(
        (latest: any, c: any) =>
          (c.timelineEnd as number) > ((latest?.timelineEnd as number) ?? 0) ? c : latest,
        null as any,
      );
      const startFrame = lastClip ? (lastClip.timelineEnd as number) + 30 : 0;
      const dur = 90;
      const clipId = `clip-${Date.now()}`;
      const assetId = `asset-${clipId}`;
      const trackType = track?.type ?? 'video';
      const mediaType = trackType === 'audio' ? 'audio' : 'video';

      const asset = createAsset({
        id: assetId,
        name: `New ${mediaType} clip`,
        mediaType: mediaType as any,
        filePath: `generator://${assetId}`,
        intrinsicDuration: toFrame(dur),
        nativeFps: frameRate(fps),
        sourceTimecodeOffset: toFrame(0),
      });

      const clip = createClip({
        id: clipId,
        assetId,
        trackId,
        timelineStart: toFrame(startFrame),
        timelineEnd: toFrame(startFrame + dur),
        mediaIn: toFrame(0),
        mediaOut: toFrame(dur),
        name: `New ${mediaType} clip`,
      });

      engine.dispatch({
        id: txId(),
        label: 'Add Clip',
        timestamp: Date.now(),
        operations: [{ type: 'INSERT_CLIP', clip, trackId }] as any,
      });
      triggerUpdate();
    },
    [engine, fps, triggerUpdate],
  );

  // ── Clip counts per track ──
  const clipCounts = useMemo(() => {
    const map = new Map<string, number>();
    const state = engine.getState();
    for (const t of state.timeline.tracks) {
      map.set(t.id as string, t.clips.length);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIds, provisional]);

  // ── Observe viewport width ──
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setVpWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setVpWidth]);

  // ── Wire zoom callback on mount ──
  useEffect(() => {
    registerZoomHandler?.(setPpf);
  }, [registerZoomHandler, setPpf]);

  // ── Playhead auto-scroll during playback ──
  useEffect(() => {
    if (!isPlaying) return;
    const playheadX = (frame as number) * ppfRef.current;
    const viewStart = scrollRef.current;
    const viewEnd = viewStart + vpWidth;
    if (playheadX > viewEnd - 80 || playheadX < viewStart + 20) {
      const newScroll = Math.max(0, playheadX - vpWidth * 0.2);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = newScroll;
      }
      setScrollLeft(newScroll);
    }
  }, [frame, isPlaying, vpWidth, setScrollLeft, ppfRef, scrollRef]);

  // ── Track resize: document-level listeners ──
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!resizeDragRef.current) return;
      const dy = e.clientY - resizeDragRef.current.startY;
      const newH = Math.max(MIN_TRACK_HEIGHT, Math.min(MAX_TRACK_HEIGHT, resizeDragRef.current.startHeight + dy));
      setTrackHeights((prev) => ({ ...prev, [resizeDragRef.current!.trackId]: newH }));
    };
    const onUp = () => {
      resizeDragRef.current = null;
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, []);

  // ── Pointer event converter ──
  const convertEvent = useCallback(
    (e: React.PointerEvent): TimelinePointerEvent => {
      const currentPpf = ppfRef.current;
      const rect = trackAreaRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const f = Math.max(0, Math.round(x / currentPpf));

      let clipId: string | null = null;
      let trackId: string | null = null;
      let clipEl: HTMLElement | null = null;

      let el = e.target as HTMLElement | null;
      while (el && el !== trackAreaRef.current) {
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

      let edge: 'left' | 'right' | 'none' = 'none';
      if (clipEl) {
        const cr = clipEl.getBoundingClientRect();
        const lx = e.clientX - cr.left;
        const thresh = Math.min(8, cr.width * 0.2);
        edge = lx <= thresh ? 'left' : lx >= cr.width - thresh ? 'right' : 'none';
      }

      return {
        x,
        y,
        frame: toFrame(f),
        buttons: e.buttons,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        clipId: clipId as ClipId | null,
        trackId: trackId as TrackId | null,
        edge,
      };
    },
    [ppfRef],
  );

  // ── Pointer handlers ──
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const currentToolId = engine.getActiveToolId();
      if (currentToolId === 'hand') {
        handDragRef.current = { startX: e.clientX, startScroll: scrollRef.current };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        return;
      }
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      engine.handlePointerDown(convertEvent(e), extractModifiers(e));
      triggerUpdate();
    },
    [engine, convertEvent, triggerUpdate, scrollRef],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const currentToolId = engine.getActiveToolId();
      if (currentToolId === 'hand' && handDragRef.current && e.buttons & 1) {
        const dx = e.clientX - handDragRef.current.startX;
        const newScroll = Math.max(0, handDragRef.current.startScroll - dx);
        setScrollLeft(newScroll);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = newScroll;
        }
        return;
      }
      if (!(e.buttons & 1)) return;
      engine.handlePointerMove(convertEvent(e), extractModifiers(e));
      triggerUpdate();
    },
    [engine, convertEvent, triggerUpdate, setScrollLeft],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const currentToolId = engine.getActiveToolId();
      if (currentToolId === 'hand') {
        handDragRef.current = null;
        return;
      }
      engine.handlePointerUp(convertEvent(e), extractModifiers(e));
      triggerUpdate();
    },
    [engine, convertEvent, triggerUpdate],
  );

  const onPointerLeave = useCallback(
    (e: React.PointerEvent) => {
      const currentToolId = engine.getActiveToolId();
      if (currentToolId === 'hand') {
        handDragRef.current = null;
        return;
      }
      const evt = convertEvent(e);
      engine.handlePointerUp(evt, extractModifiers(e));
      engine.handlePointerLeave(evt);
    },
    [engine, convertEvent],
  );

  // ── Keyboard handler ──
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const toolKeys: Record<string, string> = {
        v: 'selection',
        c: 'razor',
        t: 'ripple-trim',
        r: 'roll-trim',
        s: 'slip',
        y: 'slide',
        h: 'hand',
      };
      if (!e.metaKey && !e.ctrlKey && !e.altKey && toolKeys[e.key.toLowerCase()]) {
        e.preventDefault();
        engine.activateTool(toolKeys[e.key.toLowerCase()]);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? engine.redo() : engine.undo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = engine.getSnapshot().selectedClipIds;
        if (sel.size > 0) {
          e.preventDefault();
          const ops: Array<{ type: 'DELETE_CLIP'; clipId: ClipId; trackId: TrackId }> = [];
          for (const cid of sel) {
            for (const trk of engine.getState().timeline.tracks) {
              const c = trk.clips.find((cl) => cl.id === cid);
              if (c) {
                ops.push({ type: 'DELETE_CLIP', clipId: c.id, trackId: trk.id });
                break;
              }
            }
          }
          if (ops.length > 0) {
            engine.dispatch({
              id: `delete-${Date.now()}`,
              label: 'Delete clips',
              timestamp: Date.now(),
              operations: ops as any,
            });
            engine.clearSelection();
          }
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        engine.seekTo(toFrame(Math.max(0, (frame as number) - step)));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        engine.seekTo(toFrame(Math.min(durationFrames - 1, (frame as number) + step)));
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        isPlaying ? engine.playbackEngine?.pause() : engine.playbackEngine?.play();
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        engine.seekTo(toFrame(0));
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        engine.seekTo(toFrame(durationFrames - 1));
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        engine.clearSelection();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        const allIds = new Set<string>();
        for (const trk of engine.getState().timeline.tracks) {
          for (const c of trk.clips) allIds.add(c.id as string);
        }
        engine.setSelectedClipIds(allIds);
        return;
      }

      const keyEvt: TimelineKeyEvent = {
        code: e.code,
        key: e.key,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        repeat: e.repeat,
      };
      const handled = engine.handleKeyDown(keyEvt, extractModifiers(e));
      if (handled) e.preventDefault();
    },
    [engine, frame, durationFrames, isPlaying],
  );

  // ── Scroll handler ──
  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const sl = e.currentTarget.scrollLeft;
      const st = e.currentTarget.scrollTop;
      setScrollLeft(sl);
      if (labelColumnRef.current) {
        labelColumnRef.current.scrollTop = st;
      }
      if (rulerContentRef.current) {
        rulerContentRef.current.scrollLeft = sl;
      }
    },
    [setScrollLeft],
  );

  // ── Computed ──
  const timelineWidth = durationFrames * ppf;
  const firstAudioIdx = trackIds.findIndex((tid) => trackTypesMap.get(tid) === 'audio');

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--tl-app-bg)',
        color: 'hsl(220 10% 85%)',
        fontFamily: 'system-ui, sans-serif',
        ...style,
      }}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      {/* ═══ TOOLBAR ═══ */}
      <DaVinciToolbar />

      {/* ═══ RULER ROW ═══ */}
      <DaVinciRuler contentRef={rulerContentRef} />

      {/* ═══ TRACK AREA ═══ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── Left: track labels ── */}
        <div
          ref={labelColumnRef}
          style={{
            width: labelWidth,
            flexShrink: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--tl-label-bg)',
            borderRight: '1px solid var(--tl-track-border)',
          }}
        >
          {/* Add track buttons header */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '3px 8px',
              height: 24,
              alignItems: 'center',
              borderBottom: '1px solid var(--tl-track-border)',
              background: 'var(--tl-label-bg)',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => addTrack('video')}
              style={{
                flex: 1,
                padding: '1px 0',
                fontSize: 9,
                fontFamily: 'system-ui, sans-serif',
                background: 'transparent',
                color: 'var(--tl-label-text-dim)',
                border: '1px solid hsl(220 13% 25%)',
                borderRadius: 3,
                cursor: 'pointer',
                fontWeight: 400,
                height: 18,
              }}
            >
              + Video
            </button>
            <button
              onClick={() => addTrack('audio')}
              style={{
                flex: 1,
                padding: '1px 0',
                fontSize: 9,
                fontFamily: 'system-ui, sans-serif',
                background: 'transparent',
                color: 'var(--tl-label-text-dim)',
                border: '1px solid hsl(220 13% 25%)',
                borderRadius: 3,
                cursor: 'pointer',
                fontWeight: 400,
                height: 18,
              }}
            >
              + Audio
            </button>
          </div>
          {trackIds.map((tid, i) => {
            const h = getTrackHeight(tid);
            const type = trackTypesMap.get(tid) ?? 'video';
            const shortId = getShortTrackId(tid, type, trackIds, trackTypesMap);
            const isSep = firstAudioIdx > 0 && i === firstAudioIdx;
            return (
              <div key={tid} style={{ position: 'relative' }}>
                {isSep && <div style={{ height: 2, background: 'hsl(220 13% 22%)' }} />}
                <DaVinciTrack
                  trackId={tid}
                  shortId={shortId}
                  height={h}
                  clipCount={clipCounts.get(tid) ?? 0}
                  onDelete={deleteTrack}
                  onAddClip={addClip}
                />
                {/* Resize handle */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 4,
                    cursor: 'row-resize',
                    zIndex: 3,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    resizeDragRef.current = { trackId: tid, startY: e.clientY, startHeight: h };
                  }}
                  onMouseEnter={(ev) => {
                    (ev.currentTarget as HTMLElement).style.background = 'var(--tl-resize-handle)';
                  }}
                  onMouseLeave={(ev) => {
                    (ev.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* ── Right: clip scroll area ── */}
        <div
          ref={scrollContainerRef}
          className="tl-scroll-area"
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'auto',
            position: 'relative',
            background: 'var(--tl-panel-bg)',
          }}
          onScroll={onScroll}
        >
          <div
            ref={trackAreaRef}
            style={{
              width: Math.max(timelineWidth, vpWidth),
              minHeight: totalTrackHeight + 24,
              position: 'relative',
              paddingTop: 24,
              cursor:
                toolId === 'hand'
                  ? handDragRef.current
                    ? 'grabbing'
                    : 'grab'
                  : cursor,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
          >
            {/* Track clip rows */}
            {trackIds.map((tid, i) => {
              const isSep = firstAudioIdx > 0 && i === firstAudioIdx;
              return (
                <React.Fragment key={tid}>
                  {isSep && <div style={{ height: 2, background: 'hsl(220 13% 22%)' }} />}
                  <ClipRow
                    trackId={tid}
                    ppf={ppf}
                    provisional={provisional}
                    selection={selection}
                    toolId={toolId}
                    height={getTrackHeight(tid)}
                    fps={fps}
                    startFrame={virtualWindow.startFrame as number}
                    endFrame={virtualWindow.endFrame as number}
                  />
                </React.Fragment>
              );
            })}

            {/* Snap indicator lines */}
            {snapFrames.map((sf) => (
              <div
                key={`snap-${sf}`}
                style={{
                  position: 'absolute',
                  left: sf * ppf,
                  top: 24,
                  width: 1,
                  height: totalTrackHeight,
                  background: 'var(--tl-snap-color)',
                  pointerEvents: 'none',
                  zIndex: 15,
                }}
              />
            ))}

            {/* Playhead */}
            <DaVinciPlayhead totalHeight={totalTrackHeight} topOffset={24} />
          </div>
        </div>
      </div>
    </div>
  );
}
