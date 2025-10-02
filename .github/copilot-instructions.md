# AI Coding Agent Instructions for Mini-DAW

Purpose: Enable an agent to quickly extend this minimal React + Tone.js mini-DAW while preserving architectural boundaries.

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

## Planned / Placeholder Files
- `src/audio/render.ts`, `src/utils/grid`, `src/utils/io` are empty placeholders (future: offline render, snap math helpers, save/load JSON). Implement only if a feature explicitly needs them.

## Adding Features (Patterns to Follow)
- New instrument type: extend store state shape first, then add builder logic in a new `audio/` helper (e.g., `audio/nodes/<instrument>.ts`) and expose minimal methods on engine to apply state changes.
- Persistence: implement pure (de)serialization functions in `utils/io` that read/write the Zustand snapshot (avoid Tone objects).
- Snap/Grid features: create functions in `utils/grid` (e.g., `quantizeStep(index: number, snap: Snap)`) and consume in editors—never inside engine.

## Tone Transport Usage
- Engine sets `Tone.Transport.bpm` and runs a single `Tone.Sequence` for 16th resolution; pattern arrays are read column-wise each callback.
- Keep additional timing logic consolidated (add another `Tone.Loop` only if it cannot be expressed inside the existing sequence callback).

## Testing / Verification (Lightweight)
- Run dev server: `npm run dev` (hot reload). No test harness present—prefer adding small logic utilities (e.g., grid math) to `utils/` which can be unit tested later if a test framework is introduced.
- Lint: `npm run lint` (ESLint + TypeScript recommended rules).
- Build: `npm run build` (tsc project refs + Vite).

## Safe Extension Checklist (Before PR / Commit)
1. State changes confined to stores; no Tone objects leaked.  
2. Engine API surface small (add methods like `setX`, `updateY`, avoid large refactors).  
3. Effects guard side effects with proper dependency arrays.  
4. Arrays cloned before mutation (avoid in-place toggles on existing state references).  
5. New dependencies justified (keep footprint lean; ask before adding audio libs).  

## Example: Adding Swing (Hypothetical)
- Store: add `swing: number` (0–1) + setter in `project.ts`.
- Transport UI: slider bound to `swing`.
- Engine: inside `initGraph()` (after ensuring initialized) set `Tone.Transport.swing` & `swingSubdivision = '8n'`; add a `setSwing()` method called from effect watching store value.

## What NOT To Do
- Don’t schedule notes directly in components.  
- Don’t store Tone objects or functions in Zustand.  
- Don’t expand engine complexity without first extracting small builder helpers if it grows large.  
- Don’t assume persistence/state schema beyond what’s implemented (future model exists in `ARCHITECTURE & DATA MODEL NOTES.txt`).

## Key Reference Files
- `src/audio/engine.ts` – Tone graph & sequencing logic.
- `src/store/project.ts` – main musical state (tempo + patterns).
- `src/store/selection.ts` – UI snap (future grid math consumer).
- `src/components/editor/*` – pattern editors showing state→engine sync pattern.
- `ARCHITECTURE & DATA MODEL NOTES.txt` – forward-looking model (consult before structural changes).

---
If adding a new feature and something here is ambiguous, annotate the uncertainty with a `TODO:` comment and surface for refinement.
