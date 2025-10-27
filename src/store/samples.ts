import { create } from "zustand";

export interface Sample {
  name: string;
  url: string;
}

interface SamplesStore {
  samples: Sample[];
  addSamples: (files: FileList | null) => void;
  clearSamples: () => void;
}

export const useSamples = create<SamplesStore>((set) => ({
  samples: [],
  addSamples: (files) => {
    if (!files) return;
    const newSamples: Sample[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      newSamples.push({ name: file.name, url });
    }
    set((s) => ({ samples: [...s.samples, ...newSamples] }));
  },
  clearSamples: () => set({ samples: [] }),
}));