/**
 * Timeline Provider and Hooks Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  createTimeline,
  createTimelineState,
  toFrame,
  frameRate,
} from '@webpacked-timeline/core';
import {
  TimelineEngine,         // Phase 1 engine from @webpacked-timeline/react
  TimelineProvider,
  useTimeline,
} from '../index';
import { useEngine } from '../hooks';

describe('TimelineProvider', () => {
  let engine: TimelineEngine;

  beforeEach(() => {
    const timeline = createTimeline({
      id:       'tl-provider-test',
      name:     'Test Timeline',
      fps:      frameRate(30),
      duration: toFrame(9000),
      tracks:   [],
    });
    const state = createTimelineState({ timeline });
    engine = new TimelineEngine({ initialState: state });
  });

  it('should provide timeline state via useTimeline hook', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TimelineProvider engine={engine}>{children}</TimelineProvider>
    );

    const { result } = renderHook(() => useTimeline(), { wrapper });

    expect(result.current).toBeDefined();
    expect(result.current.name).toBe('Test Timeline');
  });

  it('should provide engine instance via useEngine hook', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TimelineProvider engine={engine}>{children}</TimelineProvider>
    );

    const { result } = renderHook(() => useEngine(), { wrapper });

    expect(result.current).toBe(engine);
  });

  it('should throw error when useTimeline is used outside provider', () => {
    const originalError = console.error;
    console.error = () => {};

    expect(() => {
      renderHook(() => useTimeline());
    }).toThrow('TimelineProvider');

    console.error = originalError;
  });

  it('should throw error when useEngine is used outside provider', () => {
    const originalError = console.error;
    console.error = () => {};

    expect(() => {
      renderHook(() => useEngine());
    }).toThrow('TimelineProvider');

    console.error = originalError;
  });
});
