// src/store/selection.ts
import { create } from "zustand";

export type Snap = "1" | "1/2" | "1/4"; // Beat, 1/2 beat, 1/4 beat

type SelectionState = {
  snap: Snap;
  setSnap: (snap: Snap) => void;
};

export const useSelection = create<SelectionState>((set) => ({
  snap: "1/4",
  setSnap: (snap) => set({ snap }),
}));
