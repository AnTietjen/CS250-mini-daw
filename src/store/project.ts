// src/store/project.ts
import { create } from "zustand";

const ROWS = 3;  // Kick, Snare, Hat
const STEPS = 16;

type ProjectState = {
  bpm: number;
  drumSteps: boolean[][]; // [row][step]
  setBpm: (bpm: number) => void;
  toggleDrumStep: (row: number, step: number) => void;
  setDrumSteps: (steps: boolean[][]) => void;
};

export const useProject = create<ProjectState>((set, get) => ({
  bpm: 110,
  drumSteps: Array.from({ length: ROWS }, () => Array(STEPS).fill(false)),
  setBpm: (bpm) => set({ bpm }),
  toggleDrumStep: (row, step) =>
    set((s) => {
      const next = s.drumSteps.map((r) => r.slice());
      if (next[row] && typeof next[row][step] === "boolean") {
        next[row][step] = !next[row][step];
      }
      return { drumSteps: next };
    }),
  setDrumSteps: (steps) => set({ drumSteps: steps }),
}));
