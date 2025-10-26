# AI Coding Agent Instructions for Mini-DAW

Purpose: Enable an agent to quickly extend this minimal React + Tone.js mini-DAW while preserving architectural boundaries.

IMPORTANT - DON'T USE TOO MANY CMD COMMANDS. IT USUALLY DOESN'T WORK. ESPECIALLY NO SERVERS OR PYLANCE STUFF. 

## Core Architecture (Know This First)
- React + TypeScript + Vite app. Entry: `src/main.tsx` → `App.tsx` → feature components.
- Deterministic state is kept in small Zustand stores under `src/store/` (pure serializable data, no Tone objects).
  - `project.ts`: tempo (bpm), drumSteps (3×16), synthGrid (12×16). Actions mutate via immutable-ish copy patterns.
  - `selection.ts`: UI-level snap value ("1" | "1/2" | "1/4").
- Audio side-effect layer isolated in `src/audio/engine.ts` only. Tone.js objects (synths, drums, transport) live here. UI never constructs Tone nodes directly.
- Components read/write store state; side effects propagate into the engine with `useEffect` syncing patterns/tempo.
- Data shaping principle: UI/store hold primitive grids (boolean[][]). Engine converts those into Tone scheduling on a 16‑step sequence (16th-note resolution).

## Update Flow Examples
- User toggles a drum step → `toggleDrumStep` mutates `drumSteps` → `StepSequencer` effect calls `engine.setDrumPattern()` → next 16th tick plays new pattern.
- User changes tempo slider → `setBpm` → `Transport` effect calls `engine.setTempo()` (bpm applied immediately).
- Piano roll toggle → `toggleSynthCell` → `PianoRoll` effect calls `engine.setSynthGrid()` → engine gathers active notes per column on each step.

## Constraints & Conventions
- Do not import Tone.js outside `src/audio/engine.ts` (future: additional files inside `audio/` are acceptable but keep UI decoupled).
- Keep Zustand store values JSON-serializable (anticipates persistence via future `utils/io.ts`). Never store Tone node instances in state.
- Step grid dimensions are currently fixed: drums = 3×16, synth = 12×16 (B4→C4 descending). If you generalize sizes, update both store initializers and engine slicing logic (`setDrumPattern`, `setSynthGrid`).
- Use functional `set` patterns already present when mutating nested arrays (copy rows before toggling).
- Keep new side effects behind `useEffect` that depend on specific slices of state; avoid calling engine mutators unconditionally in render.

## Style & Simplicity
- Minimal inline styling via style objects; introducing a styling system is out-of-scope unless explicitly requested.
- Prefer small focused components colocated under `src/components/<domain>/`.
- Name new hooks with `useX` and keep them framework-pure (no Tone directly; delegate to engine functions).

## Copilot / Agent instructions — Mini-DAW (concise)

Target: help contributors make safe, small changes. Keep UI state and audio engine separated.

- Project: React + TypeScript + Vite. Entry: `src/main.tsx` → `App.tsx`.
- State: lightweight Zustand stores live in `src/store/`. Store values must be JSON-serializable — do not place Tone objects or functions in state.
- Audio: all Tone.js usage is isolated to `src/audio/engine.ts`. Only call engine methods from effects/hooks; do not import Tone elsewhere.

- Common patterns:
  - UI mutates store (e.g., `project.ts` for bpm/patterns).
  - A component `useEffect` watches a slice and calls `engine.setX(...)` to apply changes.
  - Arrays are cloned before mutation (follow existing functional `set` patterns).

- Timing/conventions:
  - Engine uses a high-resolution driver (48 substeps per bar). Drum and synth scheduling is performed inside `engine.ts`.
  - If you change grid sizes, update both store initializers and engine normalization (`setDrumPattern`, `setSynthNotes*`).

- Dev commands (use these exactly):
  - Start dev server: `npm run dev`
  - Build: `npm run build` (runs `tsc -b` then `vite build`)
  - Lint: `npm run lint`

- When adding features:
  1. Extend store shape first (under `src/store/`).
  2. Add minimal engine API in `src/audio/engine.ts` (e.g., `setSynthNotesForInstance`, `setDrumPattern`).
  3. Wire with `useEffect` in a component/hook — avoid doing audio work directly in render.

- Files to consult for examples: `src/audio/engine.ts`, `src/store/project.ts`, `src/components/editor/*`, `ARCHITECTURE & DATA MODEL NOTES.txt`.

If anything here is unclear or you need deeper examples (e.g., adding a new instrument instance), tell me which area and I’ll expand with a precise code example.
