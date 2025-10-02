// src/audio/engine.ts
import * as Tone from "tone";

class Engine {
  private initialized = false;

  private limiter: Tone.Limiter | null = null;
  private metSynth: Tone.Synth | null = null;
  private metLoop: Tone.Loop | null = null;
  private metronomeEnabled = true;

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
  // Piano roll note objects (variable length)
  private synthNotes: { id: string; pitch: string; pitchIndex: number; start: number; length: number }[] = [];
  private synthNotesByStart: Record<number, { id: string; pitch: string; pitchIndex: number; start: number; length: number }[]> = {};

  // Dynamic pitch map (descending, top→bottom). Default one octave until UI sets full range.
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
      if (this.metronomeEnabled) {
        this.metSynth!.triggerAttackRelease("C6", "16n", time);
      }
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
    // 16 steps (1 bar of 16th notes)
    this.stepSeq = new Tone.Sequence(
      (time, stepIx) => {
        // Drums
        if (this.drumPattern[0][stepIx]) this.kick!.triggerAttackRelease("C2", "8n", time);
        if (this.drumPattern[1][stepIx]) this.snare!.triggerAttackRelease("16n", time);
        if (this.drumPattern[2][stepIx]) this.hat!.triggerAttackRelease("32n", time);

        // Variable-length notes: trigger any whose start == stepIx
        const starts = this.synthNotesByStart[stepIx];
        if (starts && starts.length) {
          const bpm = Tone.Transport.bpm.value;
          const secondsPerBeat = 60 / bpm;
          for (const n of starts) {
            const clampedLen = Math.max(1, n.length);
            const durSeconds = secondsPerBeat * 0.25 * clampedLen;
            this.lead!.triggerAttackRelease(n.pitch, durSeconds, time);
          }
        }
      },
      Array.from({ length: 16 }, (_, i) => i),
      "16n"
    ).start(0);

    Tone.Transport.bpm.value = 110;
    this.initialized = true;
    // Keep references so linter treats them as used
    void this.metLoop; void this.stepSeq;
  }

  async startAudio() { await Tone.start(); this.initGraph(); }
  play() { Tone.Transport.start(); }
  stop() { Tone.Transport.stop(); }
  setTempo(bpm: number) { Tone.Transport.bpm.value = bpm; }

  setDrumPattern(pattern: boolean[][]) {
    const safe = [0, 1, 2].map((r) => (pattern[r] ? pattern[r].slice(0, 16) : Array(16).fill(false)));
    this.drumPattern = safe as [boolean[], boolean[], boolean[]];
  }

  setSynthNotes(notes: { id: string; pitchIndex?: number; pitch?: string; start: number; length: number }[]) {
    // Clamp and normalize, prefer explicit pitch if provided
    this.synthNotes = notes.map(n => {
      let pIndex = n.pitchIndex ?? 0;
      pIndex = Math.min(this.pianoPitches.length - 1, Math.max(0, pIndex));
      const pitch = (n.pitch) ? n.pitch : (this.pianoPitches[pIndex] || "C4");
      return {
        id: n.id,
        pitchIndex: pIndex,
        pitch,
        start: Math.min(15, Math.max(0, Math.round(n.start))),
        length: Math.min(16, Math.max(1, Math.round(n.length)))
      };
    })
    .filter(n => n.start < 16)
    .sort((a, b) => a.start - b.start || a.pitchIndex - b.pitchIndex);

    const by: Record<number, typeof this.synthNotes> = {} as any;
    for (const n of this.synthNotes) {
      (by[n.start] ||= []).push(n);
    }
    this.synthNotesByStart = by;
  }
  setPitchMap(pitches: string[]) {
    if (!Array.isArray(pitches) || pitches.length === 0) return;
    this.pianoPitches = pitches.slice();
    // Re-apply note clamping to new range
    this.setSynthNotes(this.synthNotes);
  }

  setMetronomeEnabled(on: boolean) { this.metronomeEnabled = on; }
  getMetronomeEnabled() { return this.metronomeEnabled; }
}

export const engine = new Engine();
