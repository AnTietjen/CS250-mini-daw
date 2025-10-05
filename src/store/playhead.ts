import { create } from "zustand";

interface PlayheadState {
  substep: number; // 0..47 (48 per bar)
  playing: boolean;
  setSubstep: (n: number) => void;
  setPlaying: (on: boolean) => void;
}

export const usePlayhead = create<PlayheadState>((set) => ({
  substep: 0,
  playing: false,
  setSubstep: (n) => set({ substep: ((n % 48) + 48) % 48 }),
  setPlaying: (on) => set({ playing: on })
}));
