import { create } from "zustand";
import { engine } from "../audio/engine";

export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle';

interface InstrumentState {
  wave: WaveType;
  volume: number; // 0..1 linear gain
  noise: number;  // 0..1 linear gain
  setWave: (w: WaveType) => void;
  setVolume: (v: number) => void;
  setNoise: (v: number) => void;
}

export const useInstrument = create<InstrumentState>((set) => ({
  wave: 'sawtooth',
  volume: 0.8,
  noise: 0.0,
  setWave: (w) => { engine.setOscillator(w); set({ wave: w }); },
  setVolume: (v) => { engine.setSynthVolume(v); set({ volume: v }); },
  setNoise: (v) => { engine.setNoiseAmount(v); set({ noise: v }); },
}));
