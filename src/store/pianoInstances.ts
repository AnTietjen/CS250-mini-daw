// src/store/pianoInstances.ts
import { create } from "zustand";

export interface PianoNote {
  id: string;
  pitchIndex: number;
  start: number;
  length: number;
  selected?: boolean;
}

export interface PianoInstance {
  id: string;
  notes: PianoNote[];
  wave: "sine" | "square" | "sawtooth" | "triangle" | "piano";
  volume: number; // 0..1
}

interface PianoInstancesState {
  instances: Record<string, PianoInstance>;
  createInstance: (id: string) => void;
  deleteInstance: (id: string) => void;
  list: () => string[];

  addNote: (inst: string, n: Omit<PianoNote, "id">) => void;
  updateNote: (inst: string, id: string, patch: Partial<PianoNote>) => void;
  deleteNote: (inst: string, id: string) => void;
  setSelection: (inst: string, ids: string[], append?: boolean) => void;
  resizeNote: (inst: string, id: string, newLength: number) => void;
  replaceAll: (inst: string, notes: PianoNote[]) => void;
  setWave: (inst: string, wave: PianoInstance["wave"]) => void;
  setVolume: (inst: string, volume: number) => void;
}

const makeId = () => Math.random().toString(36).slice(2, 10);

export const usePianoInstances = create<PianoInstancesState>((set, get) => ({
  instances: {},
  createInstance: (id) => set(s => {
    if (s.instances[id]) return s;
    const inst: PianoInstance = { id, notes: [], wave: "sawtooth", volume: 0.8 };
    return { instances: { ...s.instances, [id]: inst } };
  }),
  deleteInstance: (id) => set(s => {
    const { [id]: _, ...rest } = s.instances;
    return { instances: rest };
  }),
  list: () => Object.keys(get().instances),

  addNote: (inst, n) => set(s => {
    const i = s.instances[inst]; if (!i) return s;
    const nn = { id: makeId(), ...n };
    return { instances: { ...s.instances, [inst]: { ...i, notes: [...i.notes, nn] } } };
  }),
  updateNote: (inst, id, patch) => set(s => {
    const i = s.instances[inst]; if (!i) return s;
    return { instances: { ...s.instances, [inst]: { ...i, notes: i.notes.map(n => n.id === id ? { ...n, ...patch } : n) } } };
  }),
  deleteNote: (inst, id) => set(s => {
    const i = s.instances[inst]; if (!i) return s;
    return { instances: { ...s.instances, [inst]: { ...i, notes: i.notes.filter(n => n.id !== id) } } };
  }),
  setSelection: (inst, ids, append) => set(s => {
    const i = s.instances[inst]; if (!i) return s;
    const idSet = new Set(ids);
    return { instances: { ...s.instances, [inst]: { ...i, notes: i.notes.map(n => ({ ...n, selected: append ? (n.selected || idSet.has(n.id)) : idSet.has(n.id) })) } } };
  }),
  resizeNote: (inst, id, newLength) => set(s => {
    const i = s.instances[inst]; if (!i) return s;
    return { instances: { ...s.instances, [inst]: { ...i, notes: i.notes.map(n => n.id === id ? { ...n, length: Math.max(1, newLength) } : n) } } };
  }),
  replaceAll: (inst, notes) => set(s => {
    const i = s.instances[inst]; if (!i) return s;
    return { instances: { ...s.instances, [inst]: { ...i, notes } } };
  }),
  setWave: (inst, wave) => set(s => {
    const i = s.instances[inst]; if (!i) return s;
    return { instances: { ...s.instances, [inst]: { ...i, wave } } };
  }),
  setVolume: (inst, volume) => set(s => {
    const i = s.instances[inst]; if (!i) return s;
    return { instances: { ...s.instances, [inst]: { ...i, volume: Math.max(0, Math.min(1, volume)) } } };
  }),
}));
