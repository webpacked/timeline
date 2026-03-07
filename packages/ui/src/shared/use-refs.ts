/**
 * Hook providing the proven ppfRef + scrollRef pattern.
 *
 * Keeps both a reactive state value and a mutable ref in sync.
 * Pointer handlers read from the ref (never stale in closures),
 * while React re-renders on state changes.
 */
import { useState, useRef, useCallback } from 'react';

export function useTimelineRefs(initialPpf = 4, initialScroll = 0) {
  const [ppf, setPpfState] = useState(initialPpf);
  const ppfRef = useRef(initialPpf);

  const [scrollLeft, setScrollState] = useState(initialScroll);
  const scrollRef = useRef(initialScroll);

  const setPpf = useCallback((v: number) => {
    const clamped = Math.max(0.5, Math.min(100, v));
    ppfRef.current = clamped;
    setPpfState(clamped);
  }, []);

  const setScrollLeft = useCallback((v: number) => {
    const clamped = Math.max(0, v);
    scrollRef.current = clamped;
    setScrollState(clamped);
  }, []);

  return {
    ppf,
    ppfRef,
    setPpf,
    scrollLeft,
    scrollRef,
    setScrollLeft,
  };
}
