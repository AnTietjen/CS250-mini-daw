// src/store/theme.ts
import { create } from "zustand";

type ThemeColor = { name: string; value: string; alt: string };

// Hex helpers
function clamp(v: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, v));
}
function hexToRgb(hex: string) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((c) => clamp(Math.round(c)).toString(16).padStart(2, "0"))
      .join("")
  );
}
// Slightly darken a hex color by percent (0.0–1.0). Default ~12% darker.
function darken(hex: string, percent = 0.50) {
  const { r, g, b } = hexToRgb(hex);
  const k = 1 - percent;
  return rgbToHex(r * k, g * k, b * k);
}

export const PRESET_COLORS: ThemeColor[] = [
  { name: "Cyan",   value: "#06b6d4", alt: darken("#06b6d4") },
  { name: "Purple", value: "#8b5cf6", alt: darken("#8b5cf6") },
  { name: "Green",  value: "#22c55e", alt: darken("#22c55e") },
  { name: "Orange", value: "#f97316", alt: darken("#f97316") },
  { name: "Pink",   value: "#ec4899", alt: darken("#ec4899") },
  { name: "Blue",   value: "#3b82f6", alt: darken("#3b82f6") },
];

type ThemeState = {
  primary: string;     // main accent color
  primaryAlt: string;  // slightly darker secondary accent
  setPrimary: (hex: string) => void;
  setPrimaryByName: (name: string) => void;
};

export const useTheme = create<ThemeState>((set) => ({
  primary: PRESET_COLORS[0].value,
  primaryAlt: PRESET_COLORS[0].alt,
  setPrimary: (hex) => set({ primary: hex, primaryAlt: darken(hex) }),
  setPrimaryByName: (name) => {
    const found = PRESET_COLORS.find((c) => c.name === name);
    if (found) set({ primary: found.value, primaryAlt: found.alt });
  },
}));