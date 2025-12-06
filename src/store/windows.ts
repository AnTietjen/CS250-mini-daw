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
  // Cache last sizes per window kind
  lastSizes: Partial<Record<WindowKind, { w: number; h: number }>>;
  // Cache last positions per window kind
  lastPositions: Partial<Record<WindowKind, { x: number; y: number }>>;

  bringToFront: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, w: number, h: number) => void;
  toggleMin: (id: string) => void;
  closeWindow: (id: string) => void;

  // Creation helpers (multi-instance where applicable)
  addMixerWindow: () => string;
  addPianoWindow: (instanceId?: string) => string;           // legacy multi-instance
  addStepSequencerWindow: (patternId?: string) => string;    // legacy multi-instance
  addPlaylistWindow: () => string;
  addVisualizerWindow: () => string;
  addSampleBrowserWindow: () => string;
  addKeyboardWindow: () => string;

  // Singleton openers (prefer these for editors)
  openPianoRoll: (instanceId?: string) => void;
  openStepSequencer: (patternId?: string) => void;

  // Editor instance / pattern setters
  setEditorInstance: (windowId: string, instanceId: string) => void;
  setEditorPattern: (windowId: string, patternId: string) => void;

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
  nextZ: 2,
  lastSizes: {},
  lastPositions: {},

  bringToFront: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, z: s.nextZ } : w)),
      nextZ: s.nextZ + 1,
    })),

  move: (id, x, y) =>
    set((s) => {
      const win = s.windows.find((w) => w.id === id);
      const kind = win?.kind;
      return {
        windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)),
        lastPositions: kind ? { ...s.lastPositions, [kind]: { x, y } } : s.lastPositions,
      };
    }),

  resize: (id, w, h) =>
    set((s) => {
      const win = s.windows.find((w) => w.id === id);
      const kind = win?.kind;
      const W = Math.max(200, w);
      const H = Math.max(120, h);
      return {
        windows: s.windows.map((win) =>
          win.id === id ? { ...win, w: W, h: H } : win
        ),
        lastSizes: kind ? { ...s.lastSizes, [kind]: { w: W, h: H } } : s.lastSizes,
      };
    }),

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

  // Singleton piano roll (reopen at last position)
  openPianoRoll: (instanceId) => {
    const state = get();
    const existing = state.windows.find(w => w.kind === "pianoRoll");
    const pos = state.lastPositions["pianoRoll"] ?? { x: 80, y: 100 };
    if (existing) {
      set(s => ({
        windows: s.windows.map(w =>
          w.id === existing.id
            ? { ...w, z: s.nextZ, minimized: false, instanceId: instanceId ?? w.instanceId, x: pos.x, y: pos.y }
            : w
        ),
        nextZ: s.nextZ + 1,
      }));
    } else {
      const size = state.lastSizes["pianoRoll"] ?? { w: 1000, h: 600 };
      const id = makeId("win-piano");
      set(s => ({
        windows: [
          ...s.windows,
          {
            id,
            kind: "pianoRoll",
            title: "Piano Roll",
            x: pos.x,
            y: pos.y,
            w: size.w,
            h: size.h,
            z: s.nextZ,
            minimized: false,
            instanceId,
          },
        ],
        nextZ: s.nextZ + 1,
      }));
    }
  },

  // Singleton step sequencer (reopen at last position)
  openStepSequencer: (patternId) => {
    const state = get();
    const existing = state.windows.find(w => w.kind === "stepSequencer");
    const pos = state.lastPositions["stepSequencer"] ?? { x: 40, y: 40 };
    if (existing) {
      set(s => ({
        windows: s.windows.map(w =>
          w.id === existing.id
            ? { ...w, z: s.nextZ, minimized: false, patternId: patternId ?? w.patternId, x: pos.x, y: pos.y }
            : w
        ),
        nextZ: s.nextZ + 1,
      }));
    } else {
      const size = state.lastSizes["stepSequencer"] ?? { w: 700, h: 240 };
      const id = makeId("win-step");
      set(s => ({
        windows: [
          ...s.windows,
          {
            id,
            kind: "stepSequencer",
            title: "Step Sequencer",
            x: pos.x,
            y: pos.y,
            w: size.w,
            h: size.h,
            z: s.nextZ,
            minimized: false,
            patternId,
          },
        ],
        nextZ: s.nextZ + 1,
      }));
    }
  },

  // Multi-instance creators (use lastSizes; positions are default)
  addMixerWindow: () => {
    const state = get();
    const size = state.lastSizes["mixer"] ?? { w: 1200, h: 600 };
    const pos = state.lastPositions["mixer"] ?? { x: 140, y: 100 };
    const id = makeId("win-mix");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "mixer",
          title: "Mixer",
          x: pos.x,
          y: pos.y,
          w: size.w,
          h: size.h,
          z: s.nextZ,
          minimized: false,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  addKeyboardWindow: () => {
    const state = get();
    const size = state.lastSizes["keyboard"] ?? { w: 600, h: 240 };
    const pos = state.lastPositions["keyboard"] ?? { x: 160, y: 160 };
    const id = makeId("win-keys");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "keyboard",
          title: "Keyboard",
          x: pos.x,
          y: pos.y,
          w: size.w,
          h: size.h,
          z: s.nextZ,
          minimized: false,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  addPianoWindow: (instanceId?: string) => {
    const state = get();
    const size = state.lastSizes["pianoRoll"] ?? { w: 560, h: 360 };
    const id = makeId("win-piano");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "pianoRoll",
          title: "Piano Roll",
          x: 80,
          y: 100,
          w: size.w,
          h: size.h,
          z: s.nextZ,
          minimized: false,
          instanceId,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  addStepSequencerWindow: (patternId?: string) => {
    const state = get();
    const size = state.lastSizes["stepSequencer"] ?? { w: 560, h: 240 };
    const id = makeId("win-step");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "stepSequencer",
          title: "Step Sequencer",
          x: 40,
          y: 40,
          w: size.w,
          h: size.h,
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
    const state = get();
    const size = state.lastSizes["playlist"] ?? { w: 720, h: 300 };
    const id = makeId("win-playlist");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "playlist",
          title: "Playlist",
          x: 60,
          y: 60,
          w: size.w,
          h: size.h,
          z: s.nextZ,
          minimized: false,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  addVisualizerWindow: () => {
    const state = get();
    const size = state.lastSizes["visualizer"] ?? { w: 520, h: 240 };
    const id = makeId("win-vis");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "visualizer",
          title: "Visualizer",
          x: 160,
          y: 220,
          w: size.w,
          h: size.h,
          z: s.nextZ,
          minimized: false,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  addSampleBrowserWindow: () => {
    const state = get();
    const size = state.lastSizes["sampleBrowser"] ?? { w: 400, h: 320 };
    const id = makeId("win-sample");
    set((s) => ({
      windows: [
        ...s.windows,
        {
          id,
          kind: "sampleBrowser",
          title: "Sample Browser",
          x: 180,
          y: 180,
          w: size.w,
          h: size.h,
          z: s.nextZ,
          minimized: false,
        },
      ],
      nextZ: s.nextZ + 1,
    }));
    return id;
  },

  // Set editor instance/pattern on a specific window
  setEditorInstance: (windowId: string, instanceId: string) =>
    set(s => ({
      windows: s.windows.map(w => w.id === windowId ? { ...w, instanceId } : w)
    })),

  setEditorPattern: (windowId: string, patternId: string) =>
    set(s => ({
      windows: s.windows.map(w => w.id === windowId ? { ...w, patternId } : w)
    })),

  hasKind: (kind) => get().windows.some(w => w.kind === kind),
  closeByKind: (kind) => set((s) => ({ windows: s.windows.filter(w => w.kind !== kind) })),
}));
