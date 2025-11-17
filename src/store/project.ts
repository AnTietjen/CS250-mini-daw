// src/store/project.ts
import { create } from "zustand";

export const SUBSTEPS_PER_BAR = 48; // 12 per beat * 4 beats
export const MAX_DRUM_LANES = 10;   // hard limit for drum lanes

// Drum lane can be a built-in synth lane (kick/snare/hat) or a sample-based lane
export type DrumLane =
  | {
      id: string;
      name: string;
      source: { type: "builtIn"; kind: "kick" | "snare" | "hat" };
      pattern: boolean[]; // length 48
    }
  | {
      id: string;
      name: string;
      source: { type: "sample"; url: string };
      pattern: boolean[]; // length 48
    };

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

type ProjectState = {
  bpm: number;

  // Dynamic drum lanes (max 10)
  drumLanes: DrumLane[];
  addDrumLaneFromSample: (sample: { name: string; url: string }) => boolean; // false if at cap
  removeDrumLane: (index: number) => void;
  toggleDrumCell: (laneIndex: number, cellIndex: number, substepsPerCell: number) => void;
  setLanePattern: (laneIndex: number, pattern: boolean[]) => void;

  // Legacy synth grid (unchanged)
  synthGrid: boolean[][];
  toggleSynthCell: (row: number, step: number) => void;
  setSynthGrid: (grid: boolean[][]) => void;

  setBpm: (bpm: number) => void;
};

const PIANO_ROWS = 12;

export const useProject = create<ProjectState>((set, get) => ({
  bpm: 110,

  // Start with 3 built-in lanes so existing “Kick/Snare/Hat” continue to work.
  drumLanes: [
    { id: makeId("lane"), name: "Kick",  source: { type: "builtIn", kind: "kick"  }, pattern: Array(SUBSTEPS_PER_BAR).fill(false) },
    { id: makeId("lane"), name: "Snare", source: { type: "builtIn", kind: "snare" }, pattern: Array(SUBSTEPS_PER_BAR).fill(false) },
    { id: makeId("lane"), name: "Hat",   source: { type: "builtIn", kind: "hat"   }, pattern: Array(SUBSTEPS_PER_BAR).fill(false) },
  ],

  addDrumLaneFromSample: (sample) => {
    const lanes = get().drumLanes;
    if (lanes.length >= MAX_DRUM_LANES) return false;
    const lane: DrumLane = {
      id: makeId("lane"),
      name: sample.name || "Sample",
      source: { type: "sample", url: sample.url },
      pattern: Array(SUBSTEPS_PER_BAR).fill(false),
    };
    set({ drumLanes: [...lanes, lane] });
    return true;
  },

  removeDrumLane: (index) =>
    set((s) => {
      if (index < 0 || index >= s.drumLanes.length) return s;
      const next = s.drumLanes.slice();
      next.splice(index, 1);
      return { drumLanes: next };
    }),

  toggleDrumCell: (laneIndex, cellIndex, substepsPerCell) =>
    set((s) => {
      const lanes = s.drumLanes.slice();
      const lane = lanes[laneIndex];
      if (!lane) return s;
      const pattern = lane.pattern.slice();
      // Map UI cell to substep range
      const startSub = Math.max(0, Math.min(SUBSTEPS_PER_BAR - 1, Math.round(cellIndex * substepsPerCell)));
      const endSub = Math.min(SUBSTEPS_PER_BAR - 1, startSub + substepsPerCell - 1);
      const anyInCell = pattern.slice(startSub, endSub + 1).some(Boolean);
      if (anyInCell) {
        for (let i = startSub; i <= endSub; i++) pattern[i] = false;
      } else {
        pattern[startSub] = true;
      }
      lanes[laneIndex] = { ...lane, pattern };
      return { drumLanes: lanes };
    }),

  setLanePattern: (laneIndex, pattern) =>
    set((s) => {
      const lanes = s.drumLanes.slice();
      if (!lanes[laneIndex]) return s;
      lanes[laneIndex] = { ...lanes[laneIndex], pattern: pattern.slice(0, SUBSTEPS_PER_BAR) };
      return { drumLanes: lanes };
    }),

  // Legacy synth grid
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