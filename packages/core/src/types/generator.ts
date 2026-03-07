/**
 * GENERATOR MODEL — Phase 3
 *
 * Generators are synthetic "assets" (solid, bars, countdown, etc.)
 * registered in AssetRegistry as GeneratorAsset. No filePath.
 */

import type { TimelineFrame } from './frame';

// ---------------------------------------------------------------------------
// Branded ID
// ---------------------------------------------------------------------------

export type GeneratorId = string & { readonly __brand: 'GeneratorId' };
export const toGeneratorId = (s: string): GeneratorId => s as GeneratorId;

// ---------------------------------------------------------------------------
// Generator type
// ---------------------------------------------------------------------------

export type GeneratorType = 'solid' | 'bars' | 'countdown' | 'noise' | 'text';

export type Generator = {
  readonly id: GeneratorId;
  readonly type: GeneratorType;
  readonly params: Record<string, unknown>;
  readonly duration: TimelineFrame;
  readonly name: string;
};
