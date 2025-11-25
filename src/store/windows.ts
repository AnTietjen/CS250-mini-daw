// src/store/windows.ts
// Window manager (draggable, resizable, minimizable) using Zustand.
import { create } from "zustand";

export type WindowKind = "stepSequencer" | "pianoRoll" | "settings" | "keyboard" | "mixer" | "visualizer" | "sampleBrowser" | "playlist";

export interface WindowState {
  id: string;           // stable id
  kind: WindowKind;     // which component to render
  title: string;        // header title
  x: number;            // top-left position (px)
  y: number;
  w: number;            // width (px)
  h: number;            // height (px)
  z: number;            // z-index stacking
  minimized: boolean;   // collapsed state
  instanceId?: string;  // tie a window to an existing piano instance when present
  patternId?: string;   // tie a window to a drum pattern
}

interface WindowsStore {
  windows: WindowState[];
  bringToFront: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, w: number, h: number) => void;
  toggleMin: (id: string) => void;
  nextZ: number; // incremental counter
  addPianoWindow: (instanceId?: string) => string; // returns id, optional instance id to open
  closeWindow: (id: string) => void;
  addKeyboardWindow: () => string;
  addMixerWindow: () => string;
  addVisualizerWindow: () => string;
  addStepSequencerWindow: (patternId?: string) => string;
  addPlaylistWindow: () => string;
}

export const useWindows = create<WindowsStore>((set) => ({
  windows: [
    { id: "win-settings", kind: "settings", title: "Master Control", x: 640, y: 120, w: 340, h: 200, z: 3, minimized: false },
  ],
  nextZ: 8,
  bringToFront: (id) => set((s) => {
    const z = s.nextZ;
    return {
      windows: s.windows.map(w => w.id === id ? { ...w, z } : w),
      nextZ: z + 1,
    };
  }),
  move: (id, x, y) => set((s) => ({
    windows: s.windows.map(w => w.id === id ? { ...w, x, y } : w)
  })),
  resize: (id, w, h) => set((s) => ({
    windows: s.windows.map(win => win.id === id ? { ...win, w: Math.max(200, w), h: Math.max(120, h) } : win)
  })),
  toggleMin: (id) => set((s) => ({
    windows: s.windows.map(win => win.id === id ? { ...win, minimized: !win.minimized } : win)
  })),
  addPianoWindow: (instanceId?: string) => {
    const id = `win-piano-${Math.random().toString(36).slice(2,7)}`;
    set((s) => ({
      windows: [...s.windows, { id, kind: "pianoRoll", title: "Piano Roll", x: 60 + (s.windows.length%4)*40, y: 100 + (s.windows.length%4)*40, w: 560, h: 360, z: s.nextZ, minimized: false, instanceId }],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },
  addKeyboardWindow: () => {
    const id = `win-keys-${Math.random().toString(36).slice(2,7)}`;
    set((s) => ({
      windows: [...s.windows, { id, kind: "keyboard", title: "Typing Keyboard", x: 80 + (s.windows.length%4)*40, y: 120 + (s.windows.length%4)*40, w: 360, h: 260, z: s.nextZ, minimized: false }],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },
  addMixerWindow: () => {
    const id = `win-mix-${Math.random().toString(36).slice(2,7)}`;
    set((s) => ({
      windows: [...s.windows, { id, kind: "mixer", title: "Mixer", x: 120 + (s.windows.length%4)*40, y: 140 + (s.windows.length%4)*40, w: 520, h: 340, z: s.nextZ, minimized: false }],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },
  addVisualizerWindow: () => {
    const id = `win-vis-${Math.random().toString(36).slice(2,7)}`;
    set((s) => ({
      windows: [...s.windows, { id, kind: "visualizer", title: "Visualizer", x: 140 + (s.windows.length%4)*40, y: 160 + (s.windows.length%4)*40, w: 520, h: 240, z: s.nextZ, minimized: false }],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },
  addStepSequencerWindow: (patternId?: string) => {
    const id = `win-step-${Math.random().toString(36).slice(2,7)}`;
    set((s) => ({
      windows: [...s.windows, { id, kind: "stepSequencer", title: "Step Sequencer", x: 40 + (s.windows.length%4)*40, y: 120 + (s.windows.length%4)*40, w: 520, h: 240, z: s.nextZ, minimized: false, patternId }],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },
  addPlaylistWindow: () => {
    const id = `win-playlist-${Math.random().toString(36).slice(2,7)}`;
    set((s) => ({
      windows: [...s.windows, { id, kind: "playlist", title: "Playlist", x: 260 + (s.windows.length%4)*30, y: 200 + (s.windows.length%4)*30, w: 720, h: 300, z: s.nextZ, minimized: false }],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },
addSampleBrowserWindow: () => {
  const id = `win-sample-${Math.random().toString(36).slice(2,7)}`;
  set((s) => ({
    windows: [...s.windows, { id, kind: "sampleBrowser", title: "Sample Browser", x: 180 + (s.windows.length%4)*40, y: 180 + (s.windows.length%4)*40, w: 400, h: 320, z: s.nextZ, minimized: false }],
    nextZ: s.nextZ + 1,
  }));
  return id;
},
  closeWindow: (id) => set((s) => ({ windows: s.windows.filter(w => w.id !== id) })),
}));
