/**
 * @timeline/core
 * 
 * A deterministic, frame-based timeline editing kernel with professional editing intelligence.
 * 
 * ARCHITECTURE:
 * - Phase 1: Core kernel (deterministic, frame-based, immutable)
 * - Phase 2: Editing intelligence (snapping, linking, grouping, advanced edits)
 * 
 * PUBLIC API:
 * This file exports the stable, public API surface.
 * Internal systems are not exported and may change without notice.
 * 
 * For internal access (tests, advanced integrations), use:
 * import { ... } from '@timeline/core/internal'
 */

export * from './public-api';
