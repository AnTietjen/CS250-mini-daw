// src/store/windows.ts
// Window manager (draggable, resizable, minimizable) using Zustand.
import { create } from "zustand";

export type WindowKind =
  | "stepSequencer"
  | "pianoRoll"
  | "settings"
  | "keyboard"
  | "mixer"
  | "visualizer"
  | "sampleBrowser"
  | "playlist";

export interface WindowState {
  id: string;
  kind: WindowKind;
  title: string;
  x: number;
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
  nextZ: number;
  bringToFront: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, w: number, h: number) => void;
  toggleMin: (id: string) => void;
  closeWindow: (id: string) => void;

  // Creation helpers
  addStepSequencerWindow: (patternId?: string) => string;
  addPianoWindow: (instanceId?: string) => string;
  addKeyboardWindow: () => string;
  addMixerWindow: () => string;
  addPlaylistWindow: () => string;
  addVisualizerWindow: () => string;
  addSampleBrowserWindow: () => string;

  // Query / bulk helpers
  closeByKind: (kind: WindowKind) => void;
  hasKind: (kind: WindowKind) => boolean;
}

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

// Dynamic workspace offsets (fixed regions: left sidebar + top bar)
const BASE_OFFSET_X = 0; // windows area already positioned in App
const BASE_OFFSET_Y = 0;

export const useWindows = create<WindowsStore>((set, get) => ({
  // All floating windows start empty; fixed UI pieces are rendered directly in App.
  windows: [
    { id: "win-settings", kind: "settings", title: "Master Control", x: 640, y: 120, w: 340, h: 200, z: 3, minimized: false },
  ],
  nextZ: 8,

  bringToFront: (id) =>
    set((s) => {
      const z = s.nextZ;
      return {
        windows: s.windows.map((w) => (w.id === id ? { ...w, z } : w)),
        nextZ: z + 1,
      };
    }),

  move: (id, x, y) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)),
    })),

  resize: (id, w, h) =>
    set((s) => ({
      windows: s.windows.map((win) =>
        win.id === id
          ? { ...win, w: Math.max(200, w), h: Math.max(120, h) }
          : win
      ),
    })),

  toggleMin: (id) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, minimized: !w.minimized } : w
      ),
    })),

  closeWindow: (id) =>
    set((s) => ({
      windows: s.windows.filter((w) => w.id !== id),
    })),

  addPianoWindow: (instanceId?: string) => {
    const id = makeId("win-piano");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "pianoRoll",
          title: "Piano Roll",
          x: BASE_OFFSET_X + 80,
          y: BASE_OFFSET_Y + 100,
          w: 560,
          h: 360,
          z: s.nextZ,
          minimized: false,
          instanceId,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  addKeyboardWindow: () => {
    const id = makeId("win-keys");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "keyboard",
          title: "Typing Keyboard",
          x: BASE_OFFSET_X + 100,
          y: BASE_OFFSET_Y + 140,
          w: 360,
          h: 260,
          z: s.nextZ,
          minimized: false,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  addMixerWindow: () => {
    const id = makeId("win-mix");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "mixer",
          title: "Mixer",
          x: BASE_OFFSET_X + 140,
          y: BASE_OFFSET_Y + 180,
          w: 520,
          h: 340,
          z: s.nextZ,
          minimized: false,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  addStepSequencerWindow: (patternId?: string) => {
    const id = makeId("win-step");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "stepSequencer",
          title: "Step Sequencer",
          x: BASE_OFFSET_X + 40,
          y: BASE_OFFSET_Y + 40,
          w: 560,
          h: 240,
          z: s.nextZ,
          minimized: false,
          patternId,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  addPlaylistWindow: () => {
    const id = makeId("win-playlist");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "playlist",
          title: "Playlist",
          x: BASE_OFFSET_X + 60,
          y: BASE_OFFSET_Y + 60,
          w: 720,
          h: 300,
          z: s.nextZ,
          minimized: false,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  addVisualizerWindow: () => {
    const id = makeId("win-vis");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "visualizer",
          title: "Visualizer",
          x: BASE_OFFSET_X + 160,
          y: BASE_OFFSET_Y + 220,
          w: 520,
          h: 240,
          z: s.nextZ,
          minimized: false,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  addSampleBrowserWindow: () => {
    const id = makeId("win-sample");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "sampleBrowser",
          title: "Sample Browser",
          x: BASE_OFFSET_X + 180,
          y: BASE_OFFSET_Y + 180,
          w: 400,
          h: 320,
          z: s.nextZ,
          minimized: false,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  closeByKind: (kind) =>
    set((s) => ({
      windows: s.windows.filter((w) => w.kind !== kind),
    })),

  hasKind: (kind) => get().windows.some((w) => w.kind === kind),
}));
