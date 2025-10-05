import { create } from "zustand";

export type SnapValue = '1/4' | '1/8' | '1/16' | '1/3' | '1/6';

// We use 12 substeps per beat (48 per bar). Map snap to substeps per cell.
export const SNAP_TO_SUBSTEPS: Record<SnapValue, number> = {
  '1/4': 12, // quarter note (1 beat) = 12 substeps
  '1/8': 6,  // eighth (1/2 beat) = 6 substeps
  '1/16': 3, // sixteenth (1/4 beat) = 3 substeps
  '1/3': 4,  // third of a beat (triplet within beat) = 4 substeps
  '1/6': 2   // sixth of a beat = 2 substeps
};

interface SnapState {
  snap: SnapValue;
  setSnap: (snap: SnapValue) => void;
}

export const useSnap = create<SnapState>((set) => ({
  snap: '1/16',
  setSnap: (snap) => set({ snap })
}));
