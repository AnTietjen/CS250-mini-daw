import { create } from "zustand";

interface PlayheadState {
  substep: number; // 0..47 (local within bar)
  bar: number;     // current bar index (0-based)
  absoluteSubstep: number; // global substep across arrangement
  playing: boolean;
  setSubstep: (n: number) => void; // sets local substep only
  setBar: (b: number) => void;
  setAbsoluteSubstep: (n: number) => void;
  setPlaying: (on: boolean) => void;
}

export const usePlayhead = create<PlayheadState>((set) => ({
  substep: 0,
  bar: 0,
  absoluteSubstep: 0,
  playing: false,
  setSubstep: (n) => set({ substep: ((n % 48) + 48) % 48 }),
  setBar: (b) => set({ bar: b < 0 ? 0 : b }),
  setAbsoluteSubstep: (n) => set({ absoluteSubstep: n < 0 ? 0 : n }),
  setPlaying: (on) => set({ playing: on })
}));
