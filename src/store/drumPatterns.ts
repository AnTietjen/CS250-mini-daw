import { create } from "zustand";

const DRUM_ROWS = 10;   // Max drum lanes
const SUBSTEPS_PER_BAR = 48; // 12 per beat * 4 beats

export interface DrumPattern {
  id: string;
  rows: boolean[][]; // 3 rows x 48 substeps
}

interface DrumPatternsState {
  patterns: Record<string, DrumPattern>;
  createPattern: (id: string) => void;
  deletePattern: (id: string) => void;
  list: () => string[];
  
  toggleCell: (id: string, row: number, cellIndex: number, substepsPerCell: number) => void;
  setPattern: (id: string, rows: boolean[][]) => void;
}

export const useDrumPatterns = create<DrumPatternsState>((set, get) => ({
  patterns: {},
  createPattern: (id) => set(s => {
    if (s.patterns[id]) return s;
    const rows = Array.from({ length: DRUM_ROWS }, () => Array(SUBSTEPS_PER_BAR).fill(false));
    return { patterns: { ...s.patterns, [id]: { id, rows } } };
  }),
  deletePattern: (id) => set(s => {
    const { [id]: _, ...rest } = s.patterns;
    return { patterns: rest };
  }),
  list: () => Object.keys(get().patterns),

  toggleCell: (id, row, cellIndex, substepsPerCell) => set(s => {
    const pat = s.patterns[id];
    if (!pat) return s;
    
    const newRows = pat.rows.map(r => r.slice());
    const startSub = Math.max(0, Math.min(SUBSTEPS_PER_BAR - 1, Math.round(cellIndex * substepsPerCell)));
    const endSub = Math.min(SUBSTEPS_PER_BAR - 1, startSub + substepsPerCell - 1);
    
    if (newRows[row]) {
      const anyInCell = newRows[row].slice(startSub, endSub + 1).some(Boolean);
      if (anyInCell) {
        // Clear all hits in this cell range
        for (let i = startSub; i <= endSub; i++) newRows[row][i] = false;
      } else {
        // Place a single hit at the cell's start
        newRows[row][startSub] = true;
      }
    }
    return { patterns: { ...s.patterns, [id]: { ...pat, rows: newRows } } };
  }),
  
  setPattern: (id, rows) => set(s => {
    const pat = s.patterns[id];
    if (!pat) return s;
    return { patterns: { ...s.patterns, [id]: { ...pat, rows } } };
  })
}));
