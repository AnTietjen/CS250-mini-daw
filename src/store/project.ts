// src/store/project.ts
import { create } from "zustand";

const DRUM_ROWS = 3;   // Kick, Snare, Hat
const STEPS = 16;

const PIANO_ROWS = 12; // chromatic (one octave)

type ProjectState = {
  bpm: number;

  // Drums (3 x 16)
  drumSteps: boolean[][];
  toggleDrumStep: (row: number, step: number) => void;
  setDrumSteps: (steps: boolean[][]) => void;

  // Piano roll grid (12 x 16)
  synthGrid: boolean[][];
  toggleSynthCell: (row: number, step: number) => void;
  setSynthGrid: (grid: boolean[][]) => void;

  setBpm: (bpm: number) => void;
};

export const useProject = create<ProjectState>((set) => ({
  bpm: 110,

  drumSteps: Array.from({ length: DRUM_ROWS }, () => Array(STEPS).fill(false)),
  toggleDrumStep: (row, step) =>
    set((s) => {
      const next = s.drumSteps.map((r) => r.slice());
      if (next[row] && step >= 0 && step < STEPS) next[row][step] = !next[row][step];
      return { drumSteps: next };
    }),
  setDrumSteps: (steps) => set({ drumSteps: steps }),

  synthGrid: Array.from({ length: PIANO_ROWS }, () => Array(STEPS).fill(false)),
  toggleSynthCell: (row, step) =>
    set((s) => {
      const next = s.synthGrid.map((r) => r.slice());
      if (next[row] && step >= 0 && step < STEPS) next[row][step] = !next[row][step];
      return { synthGrid: next };
    }),
  setSynthGrid: (grid) => set({ synthGrid: grid }),

  setBpm: (bpm) => set({ bpm }),
}));
