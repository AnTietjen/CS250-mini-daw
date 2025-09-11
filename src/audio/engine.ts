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
  private stepSeq: Tone.Sequence<number> | null = null;
  private drumPattern: boolean[][] = [
    Array(16).fill(false), // kick
    Array(16).fill(false), // snare
    Array(16).fill(false), // hat
  ];

  private initGraph() {
    if (this.initialized) return;

    // Master
    this.limiter = new Tone.Limiter(-1).toDestination();

    // Metronome (quiet)
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

    // 16th-note driver
    this.stepSeq = new Tone.Sequence(
      (time, stepIx) => {
        if (this.drumPattern[0][stepIx]) this.kick!.triggerAttackRelease("C2", "8n", time);
        if (this.drumPattern[1][stepIx]) this.snare!.triggerAttackRelease("16n", time);
        if (this.drumPattern[2][stepIx]) this.hat!.triggerAttackRelease("32n", time);
      },
      Array.from({ length: 16 }, (_, i) => i),
      "16n"
    ).start(0);

    Tone.Transport.bpm.value = 110;
    this.initialized = true;
  }

  async startAudio() {
    await Tone.start();
    this.initGraph();
  }

  play() {
    Tone.Transport.start();
  }

  stop() {
    Tone.Transport.stop();
  }

  setTempo(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  /** Update the drum pattern (3 rows x 16 steps) */
  setDrumPattern(pattern: boolean[][]) {
    // ensure dimensions
    const safe = [0, 1, 2].map((r) => (pattern[r] ? pattern[r].slice(0, 16) : Array(16).fill(false)));
    this.drumPattern = safe as [boolean[], boolean[], boolean[]];
  }
}

export const engine = new Engine();
