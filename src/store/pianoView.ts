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

  // Persist scroll positions per piano instance/pattern id
  scroll: Record<string, { left: number; top: number }>;
  setScroll: (id: string, left: number, top: number) => void;
  getScroll: (id: string) => { left: number; top: number } | undefined;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const usePianoView = create<PianoViewState>((set, get) => ({
  vZoom: 1.4,
  hZoom: 1.2,
  setVZoom: (z) => set({ vZoom: clamp(z, 0.5, 3) }),
  setHZoom: (z) => set({ hZoom: clamp(z, 0.5, 3) }),
  zoomInV: () => set(s => ({ vZoom: clamp(s.vZoom * 1.15, 0.5, 3) })),
  zoomOutV: () => set(s => ({ vZoom: clamp(s.vZoom / 1.15, 0.5, 3) })),
  zoomInH: () => set(s => ({ hZoom: clamp(s.hZoom * 1.15, 0.5, 3) })),
  zoomOutH: () => set(s => ({ hZoom: clamp(s.hZoom / 1.15, 0.5, 3) })),

  // New: scroll persistence
  scroll: {},
  setScroll: (id, left, top) => set(s => ({
    scroll: { ...s.scroll, [id]: { left: Math.max(0, left), top: Math.max(0, top) } }
  })),
  getScroll: (id) => {
    const s = get();
    return s.scroll[id];
  },
}));
