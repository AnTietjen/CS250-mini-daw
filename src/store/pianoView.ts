// src/store/pianoView.ts
import { create } from "zustand";

interface PianoViewState {
  vZoom: number;
  hZoom: number;
  setVZoom: (z: number) => void;
  setHZoom: (z: number) => void;
  zoomInV: () => void;
  zoomOutV: () => void;
  zoomInH: () => void;
  zoomOutH: () => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const usePianoView = create<PianoViewState>((set) => ({
  vZoom: 1.4,
  hZoom: 1.2,
  setVZoom: (z) => set({ vZoom: clamp(z, 0.5, 3) }),
  setHZoom: (z) => set({ hZoom: clamp(z, 0.5, 3) }),
  zoomInV: () => set(s => ({ vZoom: clamp(s.vZoom * 1.15, 0.5, 3) })),
  zoomOutV: () => set(s => ({ vZoom: clamp(s.vZoom / 1.15, 0.5, 3) })),
  zoomInH: () => set(s => ({ hZoom: clamp(s.hZoom * 1.15, 0.5, 3) })),
  zoomOutH: () => set(s => ({ hZoom: clamp(s.hZoom / 1.15, 0.5, 3) })),
}));
