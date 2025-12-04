// src/store/mixer.ts
// FL Studio-style mixer with channels that instruments can route to
import { create } from "zustand";

export interface MixerChannel {
  id: number; // 0 = Master, 1-16 = Insert channels
  name: string;
  volume: number; // 0..1.25 (125% max like FL)
  pan: number; // -1 (L) to 1 (R)
  muted: boolean;
  solo: boolean;
}

export type DrumType = 'kick' | 'snare' | 'hat';

interface MixerState {
  channels: MixerChannel[];
  // Pattern/instrument to mixer channel routing
  // Key is pattern ID (piano instance or drum pattern), value is mixer channel ID
  routing: Record<string, number>;
  // Individual drum routing
  drumRouting: Record<DrumType, number>;
  
  // Actions
  setVolume: (channelId: number, volume: number) => void;
  setPan: (channelId: number, pan: number) => void;
  setMuted: (channelId: number, muted: boolean) => void;
  setSolo: (channelId: number, solo: boolean) => void;
  setChannelName: (channelId: number, name: string) => void;
  setRouting: (patternId: string, channelId: number) => void;
  getRouting: (patternId: string) => number;
  setDrumRouting: (drum: DrumType, channelId: number) => void;
  getDrumRouting: (drum: DrumType) => number;
}

const NUM_CHANNELS = 16; // Master (0) + 15 insert channels

const createDefaultChannels = (): MixerChannel[] => {
  const channels: MixerChannel[] = [];
  // Master channel
  channels.push({
    id: 0,
    name: "Master",
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
  });
  // Insert channels 1-15
  for (let i = 1; i < NUM_CHANNELS; i++) {
    channels.push({
      id: i,
      name: `Insert ${i}`,
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
    });
  }
  return channels;
};

export const useMixer = create<MixerState>((set, get) => ({
  channels: createDefaultChannels(),
  routing: {},
  drumRouting: { kick: 0, snare: 0, hat: 0 },

  setVolume: (channelId, volume) => set(s => ({
    channels: s.channels.map(ch => 
      ch.id === channelId ? { ...ch, volume: Math.max(0, Math.min(1.25, volume)) } : ch
    )
  })),

  setPan: (channelId, pan) => set(s => ({
    channels: s.channels.map(ch => 
      ch.id === channelId ? { ...ch, pan: Math.max(-1, Math.min(1, pan)) } : ch
    )
  })),

  setMuted: (channelId, muted) => set(s => ({
    channels: s.channels.map(ch => 
      ch.id === channelId ? { ...ch, muted } : ch
    )
  })),

  setSolo: (channelId, solo) => set(s => ({
    channels: s.channels.map(ch => 
      ch.id === channelId ? { ...ch, solo } : ch
    )
  })),

  setChannelName: (channelId, name) => set(s => ({
    channels: s.channels.map(ch => 
      ch.id === channelId ? { ...ch, name } : ch
    )
  })),

  setRouting: (patternId, channelId) => set(s => ({
    routing: { ...s.routing, [patternId]: channelId }
  })),

  getRouting: (patternId) => {
    return get().routing[patternId] ?? 0; // Default to master
  },

  setDrumRouting: (drum, channelId) => set(s => ({
    drumRouting: { ...s.drumRouting, [drum]: channelId }
  })),

  getDrumRouting: (drum) => {
    return get().drumRouting[drum] ?? 0;
  },
}));
