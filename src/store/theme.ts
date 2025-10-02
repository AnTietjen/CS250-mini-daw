// src/store/theme.ts
import { create } from "zustand";

export interface ThemeState {
  primary: string; // hex or hsl
  setPrimary: (color: string) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  primary: "#10b981", // emerald default
  setPrimary: (color) => set({ primary: color })
}));

export const PRESET_COLORS: { name: string; value: string; bg?: string }[] = [
  { name: "Emerald", value: "#10b981" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Lime", value: "#84cc16" },
  { name: "Slate", value: "#64748b" },
];