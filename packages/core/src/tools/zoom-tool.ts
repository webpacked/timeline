/**
 * ZoomTool — Phase 7 Step 5
 *
 * Adjusts pixelsPerFrame (zoom level) via callback only.
 * Does NOT dispatch any operations; pixelsPerFrame is UI state.
 */

import type { ITool, ToolContext, TimelinePointerEvent, TimelineKeyEvent } from './types';
import { toToolId, type ToolId, type SnapPointType } from './types';

export type ZoomToolOptions = {
  onZoomChange: (pixelsPerFrame: number) => void;
  minPixelsPerFrame?: number;
  maxPixelsPerFrame?: number;
  initialPixelsPerFrame?: number;
};

const DEFAULT_MIN = 0.5;
const DEFAULT_MAX = 200;
const DEFAULT_INITIAL = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class ZoomTool implements ITool {
  readonly id: ToolId = toToolId('zoom');
  readonly shortcutKey = 'Z';

  private dragStartX = 0;
  private dragStartZoom = 0;

  private readonly options: Required<ZoomToolOptions>;

  constructor(options: ZoomToolOptions) {
    this.options = {
      onZoomChange: options.onZoomChange,
      minPixelsPerFrame: options.minPixelsPerFrame ?? DEFAULT_MIN,
      maxPixelsPerFrame: options.maxPixelsPerFrame ?? DEFAULT_MAX,
      initialPixelsPerFrame: options.initialPixelsPerFrame ?? DEFAULT_INITIAL,
    };
  }

  getCursor(_ctx: ToolContext): string {
    return 'zoom-in';
  }

  getSnapCandidateTypes(): readonly SnapPointType[] {
    return [];
  }

  onPointerDown(event: TimelinePointerEvent, ctx: ToolContext): void {
    this.dragStartX = event.x;
    this.dragStartZoom = ctx.pixelsPerFrame;
  }

  onPointerMove(event: TimelinePointerEvent, ctx: ToolContext): null {
    const deltaX = event.x - this.dragStartX;
    const factor = Math.pow(1.01, deltaX);
    const newZoom = clamp(
      this.dragStartZoom * factor,
      this.options.minPixelsPerFrame,
      this.options.maxPixelsPerFrame,
    );
    this.options.onZoomChange(newZoom);
    return null;
  }

  onPointerUp(_event: TimelinePointerEvent, _ctx: ToolContext): null {
    this.dragStartX = 0;
    this.dragStartZoom = 0;
    return null;
  }

  onKeyDown(event: TimelineKeyEvent, ctx: ToolContext): null {
    const current = ctx.pixelsPerFrame;
    const { minPixelsPerFrame, maxPixelsPerFrame, initialPixelsPerFrame, onZoomChange } = this.options;
    if (event.key === '+' || event.key === '=') {
      onZoomChange(clamp(current * 1.25, minPixelsPerFrame, maxPixelsPerFrame));
    } else if (event.key === '-') {
      onZoomChange(clamp(current * 0.8, minPixelsPerFrame, maxPixelsPerFrame));
    } else if (event.key === '0') {
      onZoomChange(clamp(initialPixelsPerFrame, minPixelsPerFrame, maxPixelsPerFrame));
    }
    return null;
  }

  onKeyUp(_event: TimelineKeyEvent, _ctx: ToolContext): void {}

  onCancel(): void {
    this.dragStartX = 0;
    this.dragStartZoom = 0;
  }
}

/** Returns an ITool that wraps ZoomTool with the given options (for host registration). */
export function createZoomTool(options: ZoomToolOptions): ITool {
  return new ZoomTool(options);
}
