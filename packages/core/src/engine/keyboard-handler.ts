/**
 * KeyboardHandler — Phase 6 Step 4
 *
 * J/K/L jog-shuttle and keyboard contract. Zero DOM deps;
 * accepts TimelineKeyEvent (host maps from KeyboardEvent).
 */

import { toFrame } from '../types/frame';
import type { TimelineFrame } from '../types/frame';
import type { TimelineState } from '../types/state';
import type { TimelineKeyEvent } from '../tools/types';
import type { KeyBinding, KeyboardHandlerOptions } from '../types/keyboard';
import { DEFAULT_KEY_BINDINGS } from '../types/keyboard';
import type { PlaybackRate } from '../types/playhead';
import { PlaybackEngine } from './playback-engine';

function jogLevelToRate(level: number): PlaybackRate {
  switch (level) {
    case -3:
      return -4.0;
    case -2:
      return -2.0;
    case -1:
      return -1.0;
    case 0:
      return 0.0;
    case 1:
      return 1.0;
    case 2:
      return 2.0;
    case 3:
      return 4.0;
    default:
      return level <= -4 ? -4.0 : 4.0;
  }
}

function matchBinding(binding: KeyBinding, event: TimelineKeyEvent): boolean {
  if (binding.code !== event.code) return false;
  if (binding.shift !== undefined && binding.shift !== event.shiftKey) return false;
  if (binding.alt !== undefined && binding.alt !== event.altKey) return false;
  if (binding.meta !== undefined && binding.meta !== event.metaKey) return false;
  if (binding.ctrl !== undefined && binding.ctrl !== event.ctrlKey) return false;
  if (binding.repeat === false && event.repeat === true) return false;
  return true;
}

/** Count how many modifier keys are specified (prefer more specific binding). */
function bindingSpecificity(b: KeyBinding): number {
  let n = 0;
  if (b.shift !== undefined) n++;
  if (b.alt !== undefined) n++;
  if (b.meta !== undefined) n++;
  if (b.ctrl !== undefined) n++;
  return n;
}

export class KeyboardHandler {
  private bindings: KeyBinding[];
  private engine: PlaybackEngine;
  private jogLevel = 0;
  private onMarkIn: ((frame: TimelineFrame) => void) | undefined;
  private onMarkOut: ((frame: TimelineFrame) => void) | undefined;
  private getTimelineState: (() => TimelineState) | undefined;

  constructor(
    engine: PlaybackEngine,
    options?: KeyboardHandlerOptions,
  ) {
    this.engine = engine;
    this.bindings = options?.bindings ?? DEFAULT_KEY_BINDINGS;
    this.onMarkIn = options?.onMarkIn;
    this.onMarkOut = options?.onMarkOut;
    this.getTimelineState = options?.getTimelineState;
  }

  handleKeyDown(event: TimelineKeyEvent): boolean {
    const matches = this.bindings.filter((b) => matchBinding(b, event));
    if (matches.length === 0) return false;
    const binding = matches.sort((a, b) => bindingSpecificity(b) - bindingSpecificity(a))[0]!;
    this.dispatchAction(binding.action);
    return true;
  }

  private dispatchAction(action: KeyBinding['action']): void {
    switch (action) {
      case 'play-pause':
        if (this.engine.getState().isPlaying) this.engine.pause();
        else this.engine.play();
        break;
      case 'stop':
        this.engine.pause();
        this.engine.seekTo(toFrame(0));
        break;
      case 'jog-forward': {
        this.jogLevel = Math.min(this.jogLevel + 1, 3);
        const rate = jogLevelToRate(this.jogLevel);
        this.engine.setPlaybackRate(rate);
        if (!this.engine.getState().isPlaying) this.engine.play();
        break;
      }
      case 'jog-backward': {
        this.jogLevel = Math.max(this.jogLevel - 1, -3);
        const rate = jogLevelToRate(this.jogLevel);
        this.engine.setPlaybackRate(rate);
        if (!this.engine.getState().isPlaying) this.engine.play();
        break;
      }
      case 'jog-stop':
        this.jogLevel = 0;
        this.engine.pause();
        this.engine.setPlaybackRate(1.0);
        break;
      case 'step-forward': {
        this.engine.pause();
        const s = this.engine.getState();
        const f = s.currentFrame as number;
        const max = s.durationFrames - 1;
        this.engine.seekTo(toFrame(Math.min(f + 1, max)));
        break;
      }
      case 'step-backward': {
        this.engine.pause();
        const f = (this.engine.getState().currentFrame as number) - 1;
        this.engine.seekTo(toFrame(Math.max(f, 0)));
        break;
      }
      case 'seek-start':
        this.engine.seekToStart();
        break;
      case 'seek-end':
        this.engine.seekToEnd();
        break;
      case 'next-clip':
        this.engine.seekToNextClipBoundary();
        break;
      case 'prev-clip':
        this.engine.seekToPrevClipBoundary();
        break;
      case 'next-marker':
        this.engine.seekToNextMarker();
        break;
      case 'prev-marker':
        this.engine.seekToPrevMarker();
        break;
      case 'mark-in':
        if (this.onMarkIn)
          this.onMarkIn(this.engine.getState().currentFrame);
        break;
      case 'mark-out':
        if (this.onMarkOut)
          this.onMarkOut(this.engine.getState().currentFrame);
        break;
      case 'toggle-loop': {
        const current = this.engine.getState().loopRegion;
        if (current !== null) {
          this.engine.setLoopRegion(null);
        } else if (this.getTimelineState) {
          const state = this.getTimelineState();
          const inPt = state.timeline.inPoint;
          const outPt = state.timeline.outPoint;
          if (inPt != null && outPt != null) {
            this.engine.setLoopRegion({
              startFrame: inPt,
              endFrame: outPt,
            });
          }
        }
        break;
      }
    }
  }
}
