// src/store/piano.ts
import { create } from "zustand";

export interface PianoNote {
  id: string;
  pitchIndex: number; // 0..11 (0 = top row B4 descending to 11 = C4)
  start: number;      // in 16th steps
  length: number;     // in 16th steps
  selected?: boolean;
}

interface PianoState {
  notes: PianoNote[];
  addNote: (n: Omit<PianoNote, "id">) => void;
  updateNote: (id: string, patch: Partial<PianoNote>) => void;
  deleteNote: (id: string) => void;
  setSelection: (ids: string[], append?: boolean) => void;
  resizeNote: (id: string, newLength: number) => void;
  moveNote: (id: string, deltaStart: number, deltaPitch: number) => void;
  replaceAll: (notes: PianoNote[]) => void;
}

const makeId = () => Math.random().toString(36).slice(2, 10);

export const usePiano = create<PianoState>((set) => ({
  notes: [],
  addNote: (n) => set(s => ({ notes: [...s.notes, { id: makeId(), ...n }] })),
  updateNote: (id, patch) => set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, ...patch } : n) })),
  deleteNote: (id) => set(s => ({ notes: s.notes.filter(n => n.id !== id) })),
  setSelection: (ids, append) => set(s => {
    const idSet = new Set(ids);
    return {
      notes: s.notes.map(n => ({ ...n, selected: append ? (n.selected || idSet.has(n.id)) : idSet.has(n.id) }))
    };
  }),
  resizeNote: (id, newLength) => set(s => ({
    notes: s.notes.map(n => n.id === id ? { ...n, length: Math.max(1, newLength) } : n)
  })),
  moveNote: (id, dStart, dPitch) => set(s => ({
    notes: s.notes.map(n => n.id === id ? {
      ...n,
      start: Math.max(0, n.start + dStart),
      pitchIndex: Math.min(11, Math.max(0, n.pitchIndex + dPitch)),
    } : n)
  })),
  replaceAll: (notes) => set({ notes }),
}));
