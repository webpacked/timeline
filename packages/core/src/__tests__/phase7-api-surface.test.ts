/**
 * Phase 7 Step 6 — Public API surface audit
 *
 * Import from public API and verify key exports exist at runtime.
 * Prevents accidental omissions from public-api.ts.
 */

import { describe, it, expect } from 'vitest';
import * as Core from '../public-api';

describe('Phase 7 — Public API surface', () => {
  it('all key exports are defined', () => {
    // Core engine
    expect(typeof Core.dispatch).toBe('function');
    expect(typeof Core.checkInvariants).toBe('function');
    expect(typeof Core.createTimelineState).toBe('function');
    expect(typeof Core.HistoryStack).toBe('function');

    // Types/factories
    expect(typeof Core.createClip).toBe('function');
    expect(typeof Core.createTrack).toBe('function');
    expect(typeof Core.createTimeline).toBe('function');
    expect(typeof Core.toClipId).toBe('function');
    expect(typeof Core.toTrackId).toBe('function');
    expect(typeof Core.toFrame).toBe('function');
    expect(typeof Core.createEffect).toBe('function');
    expect(typeof Core.createTransition).toBe('function');
    expect(typeof Core.createTrackGroup).toBe('function');
    expect(typeof Core.createLinkGroup).toBe('function');

    // Phase 3
    expect(typeof Core.parseSRT).toBe('function');
    expect(typeof Core.parseVTT).toBe('function');
    expect(typeof Core.subtitleImportToOps).toBe('function');
    expect(typeof Core.findMarkersByColor).toBe('function');
    expect(typeof Core.findMarkersByLabel).toBe('function');

    // Phase 4
    expect(typeof Core.DEFAULT_CLIP_TRANSFORM).toBe('object');
    expect(typeof Core.DEFAULT_AUDIO_PROPERTIES).toBe('object');
    expect(typeof Core.LINEAR_EASING).toBe('object');

    // Phase 5
    expect(typeof Core.serializeTimeline).toBe('function');
    expect(typeof Core.deserializeTimeline).toBe('function');
    expect(typeof Core.exportToOTIO).toBe('function');
    expect(typeof Core.importFromOTIO).toBe('function');
    expect(typeof Core.exportToEDL).toBe('function');
    expect(typeof Core.exportToAAF).toBe('function');
    expect(typeof Core.exportToFCPXML).toBe('function');

    // Phase 6
    expect(typeof Core.PlayheadController).toBe('function');
    expect(typeof Core.PlaybackEngine).toBe('function');
    expect(typeof Core.KeyboardHandler).toBe('function');
    expect(typeof Core.DEFAULT_KEY_BINDINGS).toBe('object');
    expect(typeof Core.resolveFrame).toBe('function');

    // Phase 7
    expect(typeof Core.IntervalTree).toBe('function');
    expect(typeof Core.TrackIndex).toBe('function');
    expect(typeof Core.ThumbnailCache).toBe('function');
    expect(typeof Core.ThumbnailQueue).toBe('function');
    expect(typeof Core.SnapIndexManager).toBe('function');
    expect(typeof Core.getVisibleClips).toBe('function');
    expect(typeof Core.diffStates).toBe('function');
  });
});
