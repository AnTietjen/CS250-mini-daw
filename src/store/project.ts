// src/store/project.ts
import { create } from "zustand";

const DRUM_ROWS = 3;   // Kick, Snare, Hat
const SUBSTEPS_PER_BAR = 48; // 12 per beat * 4 beats

const PIANO_ROWS = 12; // chromatic (one octave)

type ProjectState = {
  bpm: number;

  // Drums (3 x 48 substeps per bar). A hit triggers at the substep index when true.
  drumPattern: boolean[][];
  toggleDrumCell: (row: number, cellIndex: number, substepsPerCell: number) => void; // maps cell to substep start
  setDrumPattern: (pattern: boolean[][]) => void;

  // Piano roll grid (legacy, currently unused)
  synthGrid: boolean[][];
  toggleSynthCell: (row: number, step: number) => void;
  setSynthGrid: (grid: boolean[][]) => void;

  setBpm: (bpm: number) => void;
};

export const useProject = create<ProjectState>((set) => ({
  bpm: 110,

  drumPattern: Array.from({ length: DRUM_ROWS }, () => Array(SUBSTEPS_PER_BAR).fill(false)),
  toggleDrumCell: (row, cellIndex, substepsPerCell) =>
    set((s) => {
      const pattern = s.drumPattern.map((r) => r.slice());
      const startSub = Math.max(0, Math.min(SUBSTEPS_PER_BAR - 1, Math.round(cellIndex * substepsPerCell)));
      const endSub = Math.min(SUBSTEPS_PER_BAR - 1, startSub + substepsPerCell - 1);
      if (pattern[row]) {
        const anyInCell = pattern[row].slice(startSub, endSub + 1).some(Boolean);
        if (anyInCell) {
          // Clear all hits in this cell range
          for (let i = startSub; i <= endSub; i++) pattern[row][i] = false;
        } else {
          // Place a single hit at the cell's start
          pattern[row][startSub] = true;
        }
      }
      return { drumPattern: pattern };
    }),
  setDrumPattern: (pattern) => set({ drumPattern: pattern }),

  synthGrid: Array.from({ length: PIANO_ROWS }, () => Array(16).fill(false)),
  toggleSynthCell: (row, step) =>
    set((s) => {
      const next = s.synthGrid.map((r) => r.slice());
      if (next[row] && step >= 0 && step < 16) next[row][step] = !next[row][step];
      return { synthGrid: next };
    }),
  setSynthGrid: (grid) => set({ synthGrid: grid }),

  setBpm: (bpm) => set({ bpm }),
}));
