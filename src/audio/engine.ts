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
  private arrangementRepeat: number | null = null; // transport id
  private arrangementLengthSubsteps = 48; // default 1 bar
  private globalSubstep = 0;
  private arrangementNotes: { id: string; pitch: string; pitchIndex: number; start: number; length: number; instanceId: string }[] = [];
  private arrangementNotesByStart: Record<number, { id: string; pitch: string; pitchIndex: number; start: number; length: number; instanceId: string }[]> = {};
  private arrangementDrumBars: Record<number, string[]> = {};


  // Patterns
  private drumPatterns: Record<string, boolean[][]> = {
    'Drum Clip 1': [
      Array(48).fill(false), // kick
      Array(48).fill(false), // snare
      Array(48).fill(false), // hat
    ]
  };
  // Legacy single pattern accessor
  private get drumPattern() { return this.drumPatterns['Drum Clip 1']; }
  private set drumPattern(p: boolean[][]) { this.drumPatterns['Drum Clip 1'] = p; }

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

  // Mixer channels: id 0 = master, 1-15 = insert channels
  // Signal flow: input -> panner -> gain -> output
  private mixerChannels: { 
    id: number; 
    input: Tone.Gain;  // Input node for routing sources
    panner: Tone.Panner;
    gain: Tone.Gain;
    volume: number;
    pan: number;
    muted: boolean;
    solo: boolean;
  }[] = [];
  private mixerInitialized = false;
  
  // Individual drum routing (kick, snare, hat can each go to different channels)
  private drumRouting: { kick: number; snare: number; hat: number } = { kick: 0, snare: 0, hat: 0 };
  // Gain nodes for each drum to route through mixer
  private kickGain: Tone.Gain | null = null;
  private snareGain: Tone.Gain | null = null;
  private hatGain: Tone.Gain | null = null;
  
  // Pattern to mixer channel routing
  private patternRouting: Record<string, number> = {};

  private initGraph() {
    if (this.initialized) return;

    // Master
    this.limiter = new Tone.Limiter(-1).toDestination();
    this.analyserFFT = new Tone.Analyser("fft", 512);
    this.analyserWave = new Tone.Analyser("waveform", 1024);
    this.limiter.connect(this.analyserFFT);
    this.limiter.connect(this.analyserWave);

    // Initialize mixer channels
    this.initMixerChannels();

    // Metronome (no separate Tone.Loop; trigger inside driver to avoid drift)
    this.metSynth = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
      volume: -10,
    }).connect(this.limiter);
    // Remove standalone loop to prevent desync
    this.metLoop = null;

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

    // High-resolution driver replaced by arrangement-aware repeat callback
    this.setupDriver();

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
  pause() {
    try {
      Tone.Transport.pause();
    } catch {}
  }
  resetToStart() {
    try {
      // Stop and set position to start
      Tone.Transport.stop();
      Tone.Transport.position = "0:0:0";
      // Reset internal driver counters
      this.globalSubstep = 0;

      // Important: clear and reschedule any Transport callbacks to avoid stale scheduling
      this.setupDriver();

      // Reflect in UI playhead
      const ph = usePlayhead.getState();
      ph.setAbsoluteSubstep(0);
      ph.setSubstep(0);
      ph.setBar(0);
    } catch {}
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
    // this.drumLanes = lanes.map((l) => ({
    //   ...l,
    //   pattern: (l.pattern || []).slice(0, 48),
    // }));
  }

  setDrumPattern(idOrPattern: string | boolean[][], pattern?: boolean[][]) {
    if (typeof idOrPattern === 'string' && pattern) {
      const safe = [0, 1, 2].map((r) => (pattern[r] ? pattern[r].slice(0, 48) : Array(48).fill(false)));
      this.drumPatterns[idOrPattern] = safe as [boolean[], boolean[], boolean[]];
    } else if (Array.isArray(idOrPattern)) {
      // Legacy single pattern
      const safe = [0, 1, 2].map((r) => (idOrPattern[r] ? idOrPattern[r].slice(0, 48) : Array(48).fill(false)));
      this.drumPatterns['Drum Clip 1'] = safe as [boolean[], boolean[], boolean[]];
    }
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

  // Build arrangement index from current instance notes & provided clips mapping
  rebuildArrangementFromPlaylist(clips: { id: string; sourceKind: string; sourceId: string; startBar: number; lengthBars: number; muted?: boolean; }[]) {
    // Expand piano instance notes across bars; drums handled dynamically each tick.
    const notes: typeof this.arrangementNotes = [];
    // reset drum map
    this.arrangementDrumBars = {};
    for (const clip of clips) {
      if (clip.muted) continue;
      if (clip.sourceKind === 'piano') {
        const instNotes = this.instanceNotes[clip.sourceId];
        if (!instNotes || !instNotes.length) continue;
        const base = clip.startBar * 48;
        const clipLenSub = clip.lengthBars * 48;
        for (const n of instNotes) {
          const absStart = base + n.start;
          if (n.start >= clipLenSub) continue; // starts outside clip length
          const remaining = clipLenSub - n.start;
            const len = Math.min(n.length, remaining);
          notes.push({ id: `${clip.id}:${n.id}`, pitch: n.pitch, pitchIndex: n.pitchIndex, start: absStart, length: len, instanceId: clip.sourceId });
        }
      }
      if (clip.sourceKind === 'drums') {
        for (let b = clip.startBar; b < clip.startBar + clip.lengthBars; b++) {
          (this.arrangementDrumBars[b] ||= []).push(clip.sourceId);
        }
      }
    }
    this.arrangementNotes = notes.sort((a,b)=>a.start-b.start||a.pitchIndex-b.pitchIndex);
    const by: Record<number, typeof this.arrangementNotes> = {} as any;
    for (const n of this.arrangementNotes) (by[n.start] ||= []).push(n);
    this.arrangementNotesByStart = by;
    // Reconfigure driver to use arrangement when clips present, or fallback
    this.setupDriver();
  }
  setArrangementLengthBars(bars: number) {
    this.arrangementLengthSubsteps = Math.max(48, Math.round(bars * 48));
  }
  private setupDriver() {
    // Dispose existing
    if (this.stepSeq) { try { this.stepSeq.dispose(); } catch {} this.stepSeq = null; }
    if (this.arrangementRepeat != null) { Tone.Transport.clear(this.arrangementRepeat); this.arrangementRepeat = null; }
    this.globalSubstep = 0;

    const hasArrangement = this.arrangementNotes.length > 0 || Object.keys(this.arrangementDrumBars).length > 0;
    const triggerMetronome = (time: number, localSubstep: number) => {
      if (!this.metronomeEnabled || !this.metSynth) return;
      // 48 substeps per bar → 12 per beat. Accented on beat 1.
      const isBeat = (localSubstep % 12) === 0;
      if (!isBeat) return;
      const isDownbeat = localSubstep === 0;
      try {
        this.metSynth.triggerAttackRelease(isDownbeat ? "C6" : "A5", "16n", time);
      } catch {}
    };

    if (hasArrangement) {
      this.arrangementRepeat = Tone.Transport.scheduleRepeat((time) => {
        const step = this.globalSubstep;
        const bar = Math.floor(step / 48);
        const local = step % 48;

        try {
          const ph = usePlayhead.getState();
          ph.setAbsoluteSubstep(step);
          ph.setSubstep(local);
          ph.setBar(bar);
        } catch {}

        // Metronome locked to driver
        triggerMetronome(time as any, local);

        // Drums
        const activeDrumIds = this.arrangementDrumBars[bar];
        if (activeDrumIds && activeDrumIds.length) {
          let k=false, s=false, h=false;
          for (const id of activeDrumIds) {
            const pat = this.drumPatterns[id];
            if (pat) {
              if (pat[0][local]) k = true;
              if (pat[1][local]) s = true;
              if (pat[2][local]) h = true;
            }
          }
          if (k) this.kick?.triggerAttackRelease("C2", "8n", time);
          if (s) this.snare?.triggerAttackRelease("16n", time);
          if (h) this.hat?.triggerAttackRelease("32n", time);
        }

        // Piano notes
        const starts = this.arrangementNotesByStart[step];
        if (starts && starts.length) {
          const bpm = Tone.Transport.bpm.value;
          const secondsPerBeat = 60 / bpm;
          for (const n of starts) {
            const clampedLen = Math.max(1, n.length);
            const durSeconds = secondsPerBeat * (clampedLen / 12);
            const instEntry = this.leadSynths[n.instanceId] || this.leadSynths["default"];
            try {
              if ((instEntry as any)?.synth) (instEntry as any).synth.triggerAttackRelease(n.pitch, durSeconds, time);
              else if ((instEntry as any)?.sampler) (instEntry as any).sampler.triggerAttackRelease(n.pitch, durSeconds, time);
              else this.lead?.triggerAttackRelease(n.pitch, durSeconds, time);
            } catch {}
            if (this.noiseEnv && this.noiseGain && this.noiseGain.gain.value > 0) {
              this.noiseEnv.triggerAttackRelease(durSeconds, time);
            }
          }
        }

        this.globalSubstep++;
        if (this.globalSubstep >= this.arrangementLengthSubsteps) {
          this.globalSubstep = 0; // loop arrangement
        }
      }, '48n');
    } else {
      // legacy 48-step sequence for single-bar playback
      this.stepSeq = new Tone.Sequence(
        (time, stepIx) => {
          const local = stepIx % 48;
          try { usePlayhead.getState().setSubstep(local); } catch {}

          // Metronome locked to sequence
          triggerMetronome(time as any, local);

          if (this.drumPattern[0][stepIx]) this.kick!.triggerAttackRelease("C2", "8n", time);
          if (this.drumPattern[1][stepIx]) this.snare!.triggerAttackRelease("16n", time);
          if (this.drumPattern[2][stepIx]) this.hat!.triggerAttackRelease("32n", time);

          const starts = this.synthNotesByStart[stepIx];
          if (starts && starts.length) {
            const bpm = Tone.Transport.bpm.value;
            const secondsPerBeat = 60 / bpm;
            for (const n of starts) {
              const clampedLen = Math.max(1, n.length);
              const durSeconds = secondsPerBeat * (clampedLen / 12);
              const instEntry = this.leadSynths[n.instanceId] || this.leadSynths["default"];
              if (instEntry) {
                if ((instEntry as any).synth) (instEntry as any).synth.triggerAttackRelease(n.pitch, durSeconds, time);
                else if ((instEntry as any).sampler) (instEntry as any).sampler.triggerAttackRelease(n.pitch, durSeconds, time);
                else this.lead!.triggerAttackRelease(n.pitch, durSeconds, time);
              } else {
                this.lead!.triggerAttackRelease(n.pitch, durSeconds, time);
              }
              if (this.noiseEnv && this.noiseGain && this.noiseGain.gain.value > 0) this.noiseEnv.triggerAttackRelease(durSeconds, time);
            }
          }
        }, Array.from({ length: 48 }, (_, i) => i), '48n'
      ).start(0);
    }
  }

  // ============ MIXER ============
  
  private initMixerChannels() {
    if (this.mixerInitialized) return;
    
    // Create 16 mixer channels (0 = master, 1-15 = inserts)
    // Signal flow: input -> panner -> gain -> output
    for (let i = 0; i < 16; i++) {
      const input = new Tone.Gain(1);  // Input summing node
      const panner = new Tone.Panner(0);
      const gain = new Tone.Gain(0.8);
      
      // Connect: input -> panner -> gain
      input.connect(panner);
      panner.connect(gain);
      
      if (i === 0) {
        // Master channel goes to limiter
        gain.connect(this.limiter!);
      }
      // Insert channels will be connected to master after all are created
      
      this.mixerChannels.push({
        id: i,
        input,
        panner,
        gain,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      });
    }
    
    // Connect all insert channels to master's input
    const master = this.mixerChannels[0];
    for (let i = 1; i < 16; i++) {
      this.mixerChannels[i].gain.connect(master.input);
    }
    
    this.mixerInitialized = true;
  }
  
  initMixer() {
    if (!this.initialized) this.initGraph();
    if (!this.mixerInitialized) this.initMixerChannels();
    
    // Reconnect instruments through mixer
    this.reconnectInstrumentsToMixer();
  }
  
  private reconnectInstrumentsToMixer() {
    // Disconnect existing connections and route through mixer
    const master = this.mixerChannels[0];
    
    // Create individual gain nodes for drums if not exists
    if (!this.kickGain) {
      this.kickGain = new Tone.Gain(1);
    }
    if (!this.snareGain) {
      this.snareGain = new Tone.Gain(1);
    }
    if (!this.hatGain) {
      this.hatGain = new Tone.Gain(1);
    }
    
    // Reconnect drums through their individual gain nodes
    if (this.kick) {
      this.kick.disconnect();
      this.kick.connect(this.kickGain);
    }
    if (this.snare) {
      this.snare.disconnect();
      this.snare.connect(this.snareGain);
    }
    if (this.hat) {
      this.hat.disconnect();
      this.hat.connect(this.hatGain);
    }
    
    // Route drum gains to their designated mixer channels
    this.updateDrumRouting();
    
    // Reconnect synths to master (default) - routing happens per-instance
    if (this.synthGain) {
      this.synthGain.disconnect();
      this.synthGain.connect(master.input);
    }
    if (this.noiseGain) {
      this.noiseGain.disconnect();
      this.noiseGain.connect(master.input);
    }
  }
  
  private updateDrumRouting() {
    if (!this.mixerInitialized) return;
    
    const kickChannel = this.mixerChannels[this.drumRouting.kick] || this.mixerChannels[0];
    const snareChannel = this.mixerChannels[this.drumRouting.snare] || this.mixerChannels[0];
    const hatChannel = this.mixerChannels[this.drumRouting.hat] || this.mixerChannels[0];
    
    if (this.kickGain) {
      this.kickGain.disconnect();
      this.kickGain.connect(kickChannel.input);
    }
    if (this.snareGain) {
      this.snareGain.disconnect();
      this.snareGain.connect(snareChannel.input);
    }
    if (this.hatGain) {
      this.hatGain.disconnect();
      this.hatGain.connect(hatChannel.input);
    }
  }
  
  setDrumRouting(drum: 'kick' | 'snare' | 'hat', channelId: number) {
    this.drumRouting[drum] = channelId;
    this.updateDrumRouting();
  }
  
  getDrumRouting(drum: 'kick' | 'snare' | 'hat'): number {
    return this.drumRouting[drum];
  }
  
  setMixerChannel(channelId: number, volume: number, pan: number, muted: boolean, solo: boolean) {
    if (!this.mixerInitialized) return;
    
    const channel = this.mixerChannels[channelId];
    if (!channel) return;
    
    channel.volume = volume;
    channel.pan = pan;
    channel.muted = muted;
    channel.solo = solo;
    
    // Apply to audio nodes
    channel.panner.pan.value = pan;
    
    // Check solo state across all channels
    const anySolo = this.mixerChannels.some(c => c.solo && c.id !== 0);
    
    if (channelId === 0) {
      // Master channel
      channel.gain.gain.value = muted ? 0 : volume;
    } else {
      // Insert channel - respect solo logic
      if (anySolo) {
        channel.gain.gain.value = (solo && !muted) ? volume : 0;
      } else {
        channel.gain.gain.value = muted ? 0 : volume;
      }
    }
  }
  
  setPatternRouting(patternId: string, channelId: number) {
    this.patternRouting[patternId] = channelId;
    
    // Update synth routing if it's a piano instance
    const synthEntry = this.leadSynths[patternId];
    if (synthEntry && this.mixerInitialized) {
      const channel = this.mixerChannels[channelId] || this.mixerChannels[0];
      if ((synthEntry as any).gain) {
        (synthEntry as any).gain.disconnect();
        (synthEntry as any).gain.connect(channel.input);
      }
    }
  }
  
  getPatternChannel(patternId: string): number {
    return this.patternRouting[patternId] ?? 0;
  }
}

export const engine = new Engine();