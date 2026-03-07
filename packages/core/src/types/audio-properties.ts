/**
 * AUDIO PROPERTIES — Phase 4
 *
 * Per-clip audio: gain, pan, mute, channel routing.
 */

import {
  createAnimatableProperty,
  type AnimatableProperty,
} from './clip-transform';

export type ChannelRouting = 'stereo' | 'mono' | 'left' | 'right';

export type AudioProperties = {
  readonly gain: AnimatableProperty;             // dB, default 0
  readonly pan: AnimatableProperty;              // -1 to 1, default 0
  readonly mute: boolean;                        // default false
  readonly channelRouting: ChannelRouting;       // default 'stereo'
  readonly normalizationGain: number;            // dB, default 0
};

export const DEFAULT_AUDIO_PROPERTIES: AudioProperties = {
  gain: createAnimatableProperty(0),
  pan: createAnimatableProperty(0),
  mute: false,
  channelRouting: 'stereo',
  normalizationGain: 0,
};
