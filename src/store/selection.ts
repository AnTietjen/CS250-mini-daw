// src/store/selection.ts
import { create } from "zustand";

// Previously held snap settings (removed for now) – left placeholder for future additions.
type SelectionState = Record<string, never>;

export const useSelection = create<SelectionState>(() => ({}));
