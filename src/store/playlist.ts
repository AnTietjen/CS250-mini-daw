// Minimal playlist store: holds clips that reference piano instances or drums.
import { create } from 'zustand';

export type PlaylistClip = {
  id: string;
  sourceKind: 'piano' | 'drums';
  sourceId: string; // piano instance id or 'drums' for drum clip
  startBar: number; // integer >= 0
  lengthBars: number; // integer >= 1
  lane: number; // vertical track index (0-based)
  muted?: boolean;
  selected?: boolean;
}

export const NUM_LANES = 16; // FL Studio-style multiple lanes

interface PlaylistState {
  clips: PlaylistClip[];
  arrangementBars: number;
  addClip: (c: Omit<PlaylistClip, 'id'|'muted'|'selected'|'lane'> & { id?: string; lane?: number }) => string | null;
  moveClip: (id: string, startBar: number) => void;
  moveClipToLane: (id: string, lane: number) => void;
  resizeClip: (id: string, lengthBars: number) => void;
  deleteClip: (id: string) => void;
  duplicateClip: (id: string) => void;
  setMuted: (id: string, muted: boolean) => void;
  setSelection: (ids: string[], append?: boolean) => void;
  clearSelection: () => void;
  setArrangementBars: (bars: number) => void;
}

const makeId = () => Math.random().toString(36).slice(2,9);

export const usePlaylist = create<PlaylistState>((set) => ({
  clips: [],
  arrangementBars: 4,
  addClip: (c) => {
    const id = c.id ?? makeId();
    const startBar = Math.max(0, Math.round(c.startBar));
    const lengthBars = Math.max(1, Math.round(c.lengthBars));
    const lane = c.lane ?? 0;
    const clip = { id, sourceKind: c.sourceKind, sourceId: c.sourceId, startBar, lengthBars, lane } as PlaylistClip;
    set(s => ({ clips: [...s.clips, clip], arrangementBars: Math.max(s.arrangementBars, startBar + lengthBars) }));
    return id;
  },
  moveClip: (id, startBar) => set(s => ({ clips: s.clips.map(c => c.id === id ? { ...c, startBar: Math.max(0, Math.round(startBar)) } : c), arrangementBars: Math.max(s.arrangementBars, startBar + (s.clips.find(c=>c.id===id)?.lengthBars ?? 1)) })),
  resizeClip: (id, lengthBars) => set(s => ({ clips: s.clips.map(c => c.id === id ? { ...c, lengthBars: Math.max(1, Math.round(lengthBars)) } : c), arrangementBars: Math.max(s.arrangementBars, Math.max(...s.clips.map(c => c.startBar + (c.id===id ? Math.max(1,Math.round(lengthBars)) : c.lengthBars)), 1)) })),
  deleteClip: (id) => set(s => ({ clips: s.clips.filter(c => c.id !== id), arrangementBars: Math.max(1, s.clips.filter(c => c.id!==id).reduce((m, c) => Math.max(m, c.startBar + c.lengthBars), 1)) })),
  duplicateClip: (id) => set(s => {
    const c = s.clips.find(x => x.id === id);
    if (!c) return s;
    const newId = makeId();
    const startBar = c.startBar + c.lengthBars;
    const clone: PlaylistClip = { ...c, id: newId, startBar, lane: c.lane ?? 0 };
    const nextClips = [...s.clips, clone];
    const nextBars = Math.max(s.arrangementBars, startBar + c.lengthBars);
    return { clips: nextClips, arrangementBars: nextBars };
  }),
  moveClipToLane: (id: string, lane: number) => set(s => ({
    clips: s.clips.map(c => c.id === id ? { ...c, lane: Math.max(0, Math.min(NUM_LANES - 1, lane)) } : c)
  })),
  setMuted: (id, muted) => set(s => ({ clips: s.clips.map(c => c.id === id ? { ...c, muted } : c) })),
  setSelection: (ids, append=false) => set(s => {
    const setIds = new Set(ids);
    return { clips: s.clips.map(c => ({ ...c, selected: append ? (c.selected || setIds.has(c.id)) : setIds.has(c.id) })) };
  }),
  clearSelection: () => set(s => ({ clips: s.clips.map(c => ({ ...c, selected: false })) })),
  setArrangementBars: (bars) => set(() => ({ arrangementBars: Math.max(1, Math.round(bars)) })),
}));

export default usePlaylist;
