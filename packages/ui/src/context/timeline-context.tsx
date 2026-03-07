/**
 * Timeline Context — coordination hub for all timeline components.
 *
 * Provides engine, zoom/scroll state, and layout constants to all
 * child components via React context. No prop drilling needed.
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { TimelineEngine } from '@webpacked-timeline/react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TimelineContextValue {
  engine: TimelineEngine;
  ppf: number;
  ppfRef: React.MutableRefObject<number>;
  setPpf: (v: number) => void;
  scrollLeft: number;
  scrollRef: React.MutableRefObject<number>;
  setScrollLeft: (v: number) => void;
  vpWidth: number;
  setVpWidth: (v: number) => void;
  labelWidth: number;
  rulerHeight: number;
  toolbarHeight: number;
}

export interface TimelineProviderProps {
  engine: TimelineEngine;
  children: React.ReactNode;
  initialPpf?: number;
  onPpfChange?: (ppf: number) => void;
  labelWidth?: number;
  rulerHeight?: number;
  toolbarHeight?: number;
}

// ── Context ────────────────────────────────────────────────────────────────

const TimelineCtx = createContext<TimelineContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function TimelineProvider({
  engine,
  children,
  initialPpf = 4,
  onPpfChange,
  labelWidth = 200,
  rulerHeight = 32,
  toolbarHeight = 40,
}: TimelineProviderProps) {
  // ── PPF (pixels per frame) ──
  const [ppf, setPpfState] = useState(initialPpf);
  const ppfRef = useRef(initialPpf);

  const setPpf = useCallback(
    (v: number) => {
      const clamped = Math.max(0.5, Math.min(100, v));
      ppfRef.current = clamped;
      setPpfState(clamped);
      onPpfChange?.(clamped);
    },
    [onPpfChange],
  );

  // ── Scroll ──
  const [scrollLeft, setScrollState] = useState(0);
  const scrollRef = useRef(0);

  const setScrollLeft = useCallback((v: number) => {
    const clamped = Math.max(0, v);
    scrollRef.current = clamped;
    setScrollState(clamped);
  }, []);

  // ── Viewport width ──
  const [vpWidth, setVpWidth] = useState(1200);

  const value: TimelineContextValue = {
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
  };

  return <TimelineCtx.Provider value={value}>{children}</TimelineCtx.Provider>;
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useTimelineContext(): TimelineContextValue {
  const ctx = useContext(TimelineCtx);
  if (!ctx) {
    throw new Error('useTimelineContext must be used within a <TimelineProvider>');
  }
  return ctx;
}

export function useEngine(): TimelineEngine {
  return useTimelineContext().engine;
}
