/**
 * ASSET MODEL TESTS — Phase 0
 *
 * Verifies the Asset spec: all required fields, status, and factory.
 */

import { describe, it, expect } from 'vitest';
import { createAsset, toAssetId } from '../types/asset';
import { toFrame, frameRate } from '../types/frame';

describe('createAsset factory', () => {
  it('creates an asset with all required Phase 0 fields', () => {
    const asset = createAsset({
      id: 'a1',
      name: 'Interview',
      mediaType: 'video',
      filePath: '/footage/interview.mp4',
      intrinsicDuration: toFrame(3600),
      nativeFps: 29.97,
      sourceTimecodeOffset: toFrame(0),
    });

    expect(asset.id).toBe('a1');
    expect(asset.name).toBe('Interview');
    expect(asset.mediaType).toBe('video');
    expect(asset.filePath).toBe('/footage/interview.mp4');
    expect(asset.intrinsicDuration).toBe(3600);
    expect(asset.nativeFps).toBe(29.97);
    expect(asset.sourceTimecodeOffset).toBe(0);
    expect(asset.status).toBe('online'); // default
  });

  it('toAssetId brands the id correctly', () => {
    const id = toAssetId('my-asset');
    expect(id).toBe('my-asset');
  });

  it('status defaults to "online"', () => {
    const asset = createAsset({
      id: 'x', name: 'x', mediaType: 'audio',
      filePath: '/a.wav', intrinsicDuration: toFrame(100),
      nativeFps: 30, sourceTimecodeOffset: toFrame(0),
    });
    expect(asset.status).toBe('online');
  });

  it('accepts all valid AssetStatus values', () => {
    const statuses = ['online', 'offline', 'proxy-only', 'missing'] as const;
    for (const status of statuses) {
      const a = createAsset({
        id: 's', name: 's', mediaType: 'video',
        filePath: '/f.mp4', intrinsicDuration: toFrame(100),
        nativeFps: 24, sourceTimecodeOffset: toFrame(0), status,
      });
      expect(a.status).toBe(status);
    }
  });

  it('supports all TrackType values as mediaType', () => {
    for (const t of ['video', 'audio', 'subtitle', 'title'] as const) {
      const a = createAsset({
        id: t, name: t, mediaType: t,
        filePath: '/f', intrinsicDuration: toFrame(1),
        nativeFps: 24, sourceTimecodeOffset: toFrame(0),
      });
      expect(a.mediaType).toBe(t);
    }
  });

  it('returns FileAsset with kind "file" (Phase 3 discriminated union)', () => {
    const asset = createAsset({
      id: 'f1',
      name: 'File',
      mediaType: 'video',
      filePath: '/f.mp4',
      intrinsicDuration: toFrame(100),
      nativeFps: 24,
      sourceTimecodeOffset: toFrame(0),
    });
    expect(asset).toHaveProperty('kind', 'file');
    expect(asset.filePath).toBe('/f.mp4');
  });
});
