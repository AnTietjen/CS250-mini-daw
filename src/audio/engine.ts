// src/audio/engine.ts
import * as Tone from "tone";

class Engine {
  private initialized = false;

  private limiter: Tone.Limiter | null = null;
  private metSynth: Tone.Synth | null = null;
  private metLoop: Tone.Loop | null = null;

  // --- Drums ---
  private kick: Tone.MembraneSynth | null = null;
  private snare: Tone.NoiseSynth | null = null;
  private hat: Tone.NoiseSynth | null = null;

  // Shared 16th driver
  private stepSeq: Tone.Sequence<number> | null = null;

  // Patterns
  private drumPattern: boolean[][] = [
    Array(16).fill(false), // kick
    Array(16).fill(false), // snare
    Array(16).fill(false), // hat
  ];

  // --- Piano roll (12 chromatic notes × 16 steps)
  private lead: Tone.PolySynth | null = null;
  private synthGrid: boolean[][] = Array.from({ length: 12 }, () => Array(16).fill(false));

  // Top→bottom rows (descending): B4 down to C4 (1 octave, chromatic)
  private pianoPitches = ["B4","A#4","A4","G#4","G4","F#4","F4","E4","D#4","D4","C#4","C4"];

  private initGraph() {
    if (this.initialized) return;

    // Master
    this.limiter = new Tone.Limiter(-1).toDestination();

    // Metronome
    this.metSynth = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
      volume: -10,
    }).connect(this.limiter);
    this.metLoop = new Tone.Loop((time) => {
      this.metSynth!.triggerAttackRelease("C6", "16n", time);
    }, "4n").start(0);

    // Drums
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0.0, release: 0.3 },
      volume: -4,
    }).connect(this.limiter);

    this.snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
      volume: -8,
    }).connect(this.limiter);

    this.hat = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
      volume: -12,
    }).connect(this.limiter);

    // Poly synth = chords
    this.lead = new Tone.PolySynth(Tone.Synth).connect(this.limiter);
    this.lead.set({
      volume: -6,
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 },
    });

    // 16th-note driver
    this.stepSeq = new Tone.Sequence(
      (time, stepIx) => {
        // Drums
        if (this.drumPattern[0][stepIx]) this.kick!.triggerAttackRelease("C2", "8n", time);
        if (this.drumPattern[1][stepIx]) this.snare!.triggerAttackRelease("16n", time);
        if (this.drumPattern[2][stepIx]) this.hat!.triggerAttackRelease("32n", time);

        // Chords: collect all active notes in this column
        const notes: string[] = [];
        for (let r = 0; r < this.synthGrid.length; r++) {
          if (this.synthGrid[r][stepIx]) notes.push(this.pianoPitches[r]);
        }
        if (notes.length) this.lead!.triggerAttackRelease(notes, "16n", time);
      },
      Array.from({ length: 16 }, (_, i) => i),
      "16n"
    ).start(0);

    Tone.Transport.bpm.value = 110;
    this.initialized = true;
  }

  async startAudio() { await Tone.start(); this.initGraph(); }
  play() { Tone.Transport.start(); }
  stop() { Tone.Transport.stop(); }
  setTempo(bpm: number) { Tone.Transport.bpm.value = bpm; }

  setDrumPattern(pattern: boolean[][]) {
    const safe = [0, 1, 2].map((r) => (pattern[r] ? pattern[r].slice(0, 16) : Array(16).fill(false)));
    this.drumPattern = safe as [boolean[], boolean[], boolean[]];
  }

  setSynthGrid(grid: boolean[][]) {
    const rows = Math.min(grid.length, 12);
    const next: boolean[][] = [];
    for (let r = 0; r < rows; r++) next.push((grid[r] || []).slice(0, 16));
    this.synthGrid = next.length ? next : this.synthGrid;
  }
}

export const engine = new Engine();
