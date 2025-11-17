// src/audio/engine.ts
import * as Tone from "tone";
import { usePlayhead } from "../store/playhead";

type BuiltInKind = "kick" | "snare" | "hat";
type EngineLane =
  | { id: string; name: string; source: { type: "builtIn"; kind: BuiltInKind }; pattern: boolean[] }
  | { id: string; name: string; source: { type: "sample"; url: string }; pattern: boolean[] };

class Engine {
  private initialized = false;

  private limiter: Tone.Limiter | null = null;
  private analyserFFT: Tone.Analyser | null = null;
  private analyserWave: Tone.Analyser | null = null;
  private metSynth: Tone.Synth | null = null;
  private metLoop: Tone.Loop | null = null;
  private metronomeEnabled = true;

  // Built-in drums
  private kick: Tone.MembraneSynth | null = null;
  private snare: Tone.NoiseSynth | null = null;
  private hat: Tone.NoiseSynth | null = null;

  // Sample players per lane id
  private samplePlayers = new Map<
    string,
    { player: Tone.Player; gain: Tone.Gain; url: string }
  >();

  // High-res driver: 48 substeps per bar (4/4)
  private stepSeq: Tone.Sequence<number> | null = null;

  // Current lanes (order matters)
  private drumLanes: EngineLane[] = [];

  // --- Piano roll (unchanged) ---
  private lead: Tone.PolySynth | null = null;
  private synthGain: Tone.Gain | null = null;
  private leadSynths: Record<
    string,
    | { mode: "synth"; synth: Tone.PolySynth; gain: Tone.Gain }
    | { mode: "sampler"; sampler: Tone.Sampler; gain: Tone.Gain }
  > = {};
  private noise: Tone.Noise | null = null;
  private noiseEnv: Tone.AmplitudeEnvelope | null = null;
  private noiseGain: Tone.Gain | null = null;
  private synthNotes: {
    id: string;
    pitch: string;
    pitchIndex: number;
    start: number;
    length: number;
    instanceId: string;
  }[] = [];
  private synthNotesByStart: Record<
    number,
    {
      id: string;
      pitch: string;
      pitchIndex: number;
      start: number;
      length: number;
      instanceId: string;
    }[]
  > = {};
  private instanceNotes: Record<
    string,
    { id: string; pitch: string; pitchIndex: number; start: number; length: number }[]
  > = {};
  private pianoPitches = ["B4", "A#4", "A4", "G#4", "G4", "F#4", "F4", "E4", "D#4", "D4", "C#4", "C4"];

  private initGraph() {
    if (this.initialized) return;

    // Master
    this.limiter = new Tone.Limiter(-1).toDestination();
    this.analyserFFT = new Tone.Analyser("fft", 512);
    this.analyserWave = new Tone.Analyser("waveform", 1024);
    this.limiter.connect(this.analyserFFT);
    this.limiter.connect(this.analyserWave);

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

    // Built-in drums
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

    // Poly synth
    this.synthGain = new Tone.Gain(0.8);
    this.lead = new Tone.PolySynth(Tone.Synth).connect(this.synthGain);
    this.lead.set({
      volume: -6,
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 },
    });
    this.synthGain.connect(this.limiter);
    this.leadSynths["default"] = { mode: "synth", synth: this.lead, gain: this.synthGain } as any;

    // Noise overlay
    this.noise = new Tone.Noise("white").start();
    this.noiseEnv = new Tone.AmplitudeEnvelope({ attack: 0.005, decay: 0.02, sustain: 0.6, release: 0.03 });
    this.noiseGain = new Tone.Gain(0.0);
    this.noise.connect(this.noiseEnv);
    this.noiseEnv.connect(this.noiseGain);
    this.noiseGain.connect(this.limiter);

    // High-resolution driver
    this.stepSeq = new Tone.Sequence(
      (time, stepIx) => {
        try {
          usePlayhead.getState().setSubstep(stepIx % 48);
        } catch {}

        // Drums: iterate all lanes
        for (const lane of this.drumLanes) {
          if (!lane.pattern[stepIx]) continue;
          if (lane.source.type === "builtIn") {
            switch (lane.source.kind) {
              case "kick":
                this.kick?.triggerAttackRelease("C2", "8n", time);
                break;
              case "snare":
                this.snare?.triggerAttackRelease("16n", time);
                break;
              case "hat":
                this.hat?.triggerAttackRelease("32n", time);
                break;
            }
          } else {
            const entry = this.samplePlayers.get(lane.id);
            if (entry) {
              try {
                entry.player.start(time);
              } catch {}
            }
          }
        }

        // Piano roll notes
        const starts = this.synthNotesByStart[stepIx];
        if (starts && starts.length) {
          const bpm = Tone.Transport.bpm.value;
          const secondsPerBeat = 60 / bpm;
          for (const n of starts) {
            const clampedLen = Math.max(1, n.length);
            const durSeconds = secondsPerBeat * (clampedLen / 12);
            const instEntry = this.leadSynths[n.instanceId] || this.leadSynths["default"];
            try {
              if ((instEntry as any).synth) (instEntry as any).synth.triggerAttackRelease(n.pitch, durSeconds, time);
              else if ((instEntry as any).sampler) (instEntry as any).sampler.triggerAttackRelease(n.pitch, durSeconds, time);
              if (this.noiseEnv && this.noiseGain && this.noiseGain.gain.value > 0) {
                this.noiseEnv.triggerAttackRelease(durSeconds, time);
              }
            } catch {}
          }
        }
      },
      Array.from({ length: 48 }, (_, i) => i),
      "48n"
    ).start(0);

    Tone.Transport.bpm.value = 110;
    this.initialized = true;
    void this.metLoop;
    void this.stepSeq;
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
  constructor() {
    Tone.Transport.on("start", () => {
      try {
        usePlayhead.getState().setPlaying(true);
      } catch {}
    });
    Tone.Transport.on("stop", () => {
      try {
        usePlayhead.getState().setPlaying(false);
      } catch {}
    });
    Tone.Transport.on("pause", () => {
      try {
        usePlayhead.getState().setPlaying(false);
      } catch {}
    });
  }
  setTempo(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  // New: dynamic drum lanes
  setDrumLanes(lanes: EngineLane[]) {
    if (!this.initialized) this.initGraph();
    // Prepare/cleanup sample players based on lanes
    const nextIds = new Set<string>();
    for (const lane of lanes) {
      nextIds.add(lane.id);
      if (lane.source.type === "sample") {
        const existing = this.samplePlayers.get(lane.id);
        const needNew = !existing || existing.url !== lane.source.url;
        if (needNew) {
          // Dispose old if URL changed
          if (existing) {
            try {
              existing.player.dispose();
              existing.gain.dispose();
            } catch {}
            this.samplePlayers.delete(lane.id);
          }
          // Create new player+gain
          const gain = new Tone.Gain(0.9);
          const player = new Tone.Player({
            url: lane.source.url,
            autostart: false,
            fadeOut: 0.02,
          }).connect(gain);
          gain.connect(this.limiter!);
          this.samplePlayers.set(lane.id, { player, gain, url: lane.source.url });
        }
      }
    }
    // Remove players for lanes no longer present
    for (const [id, entry] of Array.from(this.samplePlayers.entries())) {
      if (!nextIds.has(id)) {
        try {
          entry.player.dispose();
          entry.gain.dispose();
        } catch {}
        this.samplePlayers.delete(id);
      }
    }
    // Store lanes (clone patterns, clamp to 48)
    this.drumLanes = lanes.map((l) => ({
      ...l,
      pattern: (l.pattern || []).slice(0, 48),
    }));
  }

  // Legacy (no-op compatibility): maps 3 rows into built-ins if someone still calls it
  setDrumPattern(pattern: boolean[][]) {
    const safe = [0, 1, 2].map((r) => (pattern[r] ? pattern[r].slice(0, 48) : Array(48).fill(false)));
    const lanes: EngineLane[] = [
      { id: "builtin-kick", name: "Kick", source: { type: "builtIn", kind: "kick" }, pattern: safe[0] },
      { id: "builtin-snare", name: "Snare", source: { type: "builtIn", kind: "snare" }, pattern: safe[1] },
      { id: "builtin-hat", name: "Hat", source: { type: "builtIn", kind: "hat" }, pattern: safe[2] },
    ];
    this.setDrumLanes(lanes);
  }

  // ===== Piano roll (unchanged) =====
  private normalizeNotes(notes: { id: string; pitchIndex?: number; pitch?: string; start: number; length: number }[]) {
    const normalized = notes
      .map((n) => {
        let pIndex = n.pitchIndex ?? 0;
        pIndex = Math.min(this.pianoPitches.length - 1, Math.max(0, pIndex));
        const pitch = n.pitch ? n.pitch : this.pianoPitches[pIndex] || "C4";
        return {
          id: n.id,
          pitchIndex: pIndex,
          pitch,
          start: Math.min(47, Math.max(0, Math.round(n.start))),
          length: Math.min(48, Math.max(1, Math.round(n.length))),
        };
      })
      .filter((n) => n.start < 48)
      .sort((a, b) => a.start - b.start || a.pitchIndex - b.pitchIndex);
    return normalized;
  }
  private rebuildSynthIndex() {
    const merged: typeof this.synthNotes = [] as any;
    for (const key of Object.keys(this.instanceNotes)) {
      const arr = this.instanceNotes[key];
      if (arr && arr.length) merged.push(...arr.map((n) => ({ ...n, instanceId: key })));
    }
    this.synthNotes = merged.sort((a, b) => a.start - b.start || a.pitchIndex - b.pitchIndex);
    const by: Record<number, typeof this.synthNotes> = {} as any;
    for (const n of this.synthNotes) (by[n.start] ||= []).push(n);
    this.synthNotesByStart = by;
  }
  setSynthNotes(notes: { id: string; pitchIndex?: number; pitch?: string; start: number; length: number }[]) {
    this.instanceNotes["default"] = this.normalizeNotes(notes);
    this.rebuildSynthIndex();
  }
  setSynthNotesForInstance(instanceId: string, notes: { id: string; pitchIndex?: number; pitch?: string; start: number; length: number }[]) {
    this.instanceNotes[instanceId] = this.normalizeNotes(notes);
    this.rebuildSynthIndex();
  }
  removePianoInstance(instanceId: string) {
    delete this.instanceNotes[instanceId];
    const e = this.leadSynths[instanceId];
    if (e) {
      try {
        (e as any).synth ? (e as any).synth.dispose() : (e as any).sampler.dispose();
      } catch {}
      try {
        e.gain.dispose();
      } catch {}
      delete this.leadSynths[instanceId];
    }
    this.rebuildSynthIndex();
  }
  setPitchMap(pitches: string[]) {
    if (!Array.isArray(pitches) || pitches.length === 0) return;
    this.pianoPitches = pitches.slice();
    const inst = this.instanceNotes;
    for (const key of Object.keys(inst)) inst[key] = this.normalizeNotes(inst[key]);
    this.rebuildSynthIndex();
  }
  setOscillator(type: "sine" | "square" | "sawtooth" | "triangle") {
    const entry = this.leadSynths["default"];
    if (!entry || entry.mode !== "synth") return;
    entry.synth.set({ oscillator: { type } });
  }
  setSynthVolume(linear: number) {
    const entry = this.leadSynths["default"];
    if (!entry) return;
    const v = Math.max(0, Math.min(1, linear));
    entry.gain.gain.value = v;
  }
  setNoiseAmount(linear: number) {
    if (!this.noiseGain) return;
    const v = Math.max(0, Math.min(1, linear));
    this.noiseGain.gain.value = v;
  }
  setMetronomeEnabled(on: boolean) {
    this.metronomeEnabled = on;
  }
  getMetronomeEnabled() {
    return this.metronomeEnabled;
  }
  getAnalysers() {
    return { fft: this.analyserFFT, wave: this.analyserWave };
  }
  ensureInstanceSynth(instanceId: string) {
    if (this.leadSynths[instanceId]) return;
    if (!this.limiter) this.initGraph();
    const gain = new Tone.Gain(0.8);
    const synth = new Tone.PolySynth(Tone.Synth).connect(gain);
    synth.set({
      volume: -6,
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 },
    });
    gain.connect(this.limiter!);
    this.leadSynths[instanceId] = { mode: "synth", synth, gain } as any;
  }
  setInstanceWave(instanceId: string, type: "sine" | "square" | "sawtooth" | "triangle") {
    const entry = this.leadSynths[instanceId];
    if (!entry || entry.mode !== "synth") return;
    entry.synth.set({ oscillator: { type } });
  }
  setInstanceVolume(instanceId: string, linear: number) {
    const entry = this.leadSynths[instanceId];
    if (!entry) return;
    const v = Math.max(0, Math.min(1, linear));
    entry.gain.gain.value = v;
  }
  setInstanceEnvelope(instanceId: string, env: Partial<Tone.SynthOptions["envelope"]>) {
    const entry = this.leadSynths[instanceId];
    if (!entry || entry.mode !== "synth") return;
    entry.synth.set({ envelope: { ...env } as any });
  }
  setInstanceToPianoSampler(instanceId: string) {
    if (!this.limiter) this.initGraph();
    const existing = this.leadSynths[instanceId];
    if (existing) {
      try {
        if (existing.mode === "synth") existing.synth.dispose();
        else existing.sampler.dispose();
      } catch {}
    }
    const gain = new Tone.Gain(existing?.gain?.gain?.value ?? 0.9);
    const sampler = new Tone.Sampler({
      urls: {
        A1: "A1.mp3",
        C2: "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        A2: "A2.mp3",
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        A5: "A5.mp3",
        C6: "C6.mp3",
      },
      release: 1,
      baseUrl: "https://tonejs.github.io/audio/salamander/",
    }).connect(gain);
    gain.connect(this.limiter!);
    this.leadSynths[instanceId] = { mode: "sampler", sampler, gain } as any;
  }
  setInstanceToBasicSynth(instanceId: string, wave: "sine" | "square" | "sawtooth" | "triangle", env?: Partial<Tone.SynthOptions["envelope"]>) {
    if (!this.limiter) this.initGraph();
    const existing = this.leadSynths[instanceId];
    if (existing && existing.mode === "synth") {
      existing.synth.set({ oscillator: { type: wave }, envelope: { ...(env as any) } });
      return;
    }
    if (existing && existing.mode === "sampler") {
      try {
        existing.sampler.dispose();
      } catch {}
    }
    const gain = new Tone.Gain(existing?.gain?.gain?.value ?? 0.8);
    const synth = new Tone.PolySynth(Tone.Synth).connect(gain);
    synth.set({
      volume: -6,
      oscillator: { type: wave },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2, ...(env as any) },
    });
    gain.connect(this.limiter!);
    this.leadSynths[instanceId] = { mode: "synth", synth, gain } as any;
  }

  // Live play helpers
  noteOn(instanceId: string, note: number | string, velocity: number = 0.9) {
    if (!this.initialized) this.initGraph();
    if (!this.leadSynths[instanceId]) this.ensureInstanceSynth(instanceId);
    const entry = this.leadSynths[instanceId];
    if (!entry) return;
    const freq = typeof note === "number" ? Tone.Frequency(note, "midi").toNote() : note;
    try {
      if ((entry as any).synth) (entry as any).synth.triggerAttack(freq, undefined, velocity);
      else (entry as any).sampler.triggerAttack(freq, undefined, velocity);
    } catch {}
  }
  noteOff(instanceId: string, note: number | string) {
    const entry = this.leadSynths[instanceId];
    if (!entry) return;
    const freq = typeof note === "number" ? Tone.Frequency(note, "midi").toNote() : note;
    try {
      if ((entry as any).synth) (entry as any).synth.triggerRelease(freq);
      else (entry as any).sampler.triggerRelease(freq);
    } catch {}
  }
}

export const engine = new Engine();