ARCHITECTURE

src/
  App.tsx                          // layout/shell
  store/                           // Zustand, pure serializable state
    project.ts                     // Project state + actions (add instrument, etc.)
    selection.ts                   // UI selections (which tool, snap, etc.)
  audio/                           // Tone.js lives here only
    engine.ts                      // start/stop, create nodes from state, schedule clips
    nodes/                         // synth.ts, drums.ts, mixer.ts (Tone node builders)
    render.ts                      // offline render to WAV (stretch)
  components/
    rack/InstrumentRack.tsx        // add/remove instruments, open editors
    editor/PianoRoll.tsx           // note grid + snap handling
    editor/StepSequencer.tsx       // 16-step grid + rows
    playlist/Playlist.tsx          // timeline & clip interactions
    mixer/Mixer.tsx                // 8 channels + master
    transport/Transport.tsx        // play/stop, tempo, snap menu
  utils/
    grid.ts                        // math for snap (1, 1/2, 1/4 beat)
    io.ts                          // save/load JSON


DATA MODEL (what to save in JSON)

// Project root
export interface Project {
  id: string;
  name: string;
  bpm: number;          // 60–180
  timeSig: "4/4";       // fixed for now
  instruments: Instrument[];
  patterns: Pattern[];  // reusable patterns
  playlist: Clip[];     // arrangement of pattern instances
  mixer: Mixer;
}

// Instruments
export type InstrumentType = "synth" | "drums";
export interface Instrument {
  id: string;
  name: string;
  type: InstrumentType;
  mixerChannel: number | "master"; // 1..8 or master
  // parameters stored as plain data (no Tone nodes)
  params: SynthParams | DrumParams;
  // which pattern is being edited right now (UI helper)
  activePatternId?: string;
}

export interface SynthParams {
  osc: "sine" | "sawtooth" | "square" | "triangle";
  adsr: { a: number; d: number; s: number; r: number };
  filter: { cutoff: number; q: number };
  volume: number;  // -60..0 dB
  pan: number;     // -1..1
}
export interface DrumParams {
  pads: Array<{ name: string; sampleUrl: string; volume: number }>;
}

// Patterns
export interface Pattern {
  id: string;
  instrumentId: string;    // owner instrument
  kind: "piano" | "steps";
  bars: 1 | 2 | 4;
  // Piano roll notes (beats are fractional in 16th increments)
  notes?: Array<{ pitch: string; startBeats: number; durBeats: number; vel: number }>;
  // Step sequencer grid: rows = pads, cols = 16 * bars
  steps?: boolean[][];
}

// Playlist clips (instances of patterns on timeline)
export interface Clip {
  id: string;
  patternId: string;
  instrumentId: string; // redundant but handy
  startBeats: number;   // snapped
  lengthBeats: number;  // equals pattern length (4, 8, or 16)
}

// Mixer
export interface Mixer {
  channels: Array<{ id: number; name: string; volumeDb: number }>; // 1..8
  master: { volumeDb: number };
}