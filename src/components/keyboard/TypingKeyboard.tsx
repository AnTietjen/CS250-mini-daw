import React, { useEffect, useMemo, useRef, useState } from "react";
import { engine } from "../../audio/engine";
import { useTheme } from "../../store/theme";

interface Props {
  instanceId: string;
}

type SoundKind = "piano" | "sine" | "square";
type ScaleKind = "chromatic" | "major" | "minor" | "pentatonic-major" | "pentatonic-minor";

// FL-typing style: two rows, left-to-right continuous mapping across the chosen scale
const KEY_SEQUENCE: string[] = [
  "z","x","c","v","b","n","m",
  "a","s","d","f","g","h","j","k","l",
];

function scaleDegrees(kind: ScaleKind): number[] {
  switch (kind) {
    case "chromatic": return [0,1,2,3,4,5,6,7,8,9,10,11];
    case "major": return [0,2,4,5,7,9,11];
    case "minor": return [0,2,3,5,7,8,10]; // natural minor
    case "pentatonic-major": return [0,2,4,7,9];
    case "pentatonic-minor": return [0,3,5,7,10];
  }
}

// Map a key index in KEY_SEQUENCE to a semitone offset from root based on scale degrees
function keyIndexToSemitone(idx: number, kind: ScaleKind): number {
  const deg = scaleDegrees(kind);
  const perOct = deg.length; // how many keys per octave
  const octaveOffset = Math.floor(idx / perOct);
  const degree = deg[idx % perOct];
  return octaveOffset * 12 + degree; // semitone offset from root
}

const TypingKeyboard: React.FC<Props> = ({ instanceId }) => {
  const [sound, setSound] = useState<SoundKind>("piano");
  const [scale, setScale] = useState<ScaleKind>("chromatic");
  const [root, setRoot] = useState<number>(0); // 0=C, 1=C#, ... 11=B
  const [octave, setOctave] = useState(4);
  const pressed = useRef<Set<string>>(new Set());
  const sounding = useRef<Map<string, number>>(new Map());
  const [activeMidis, setActiveMidis] = useState<Set<number>>(new Set());
  const initialized = useRef(false);

  // Ensure synth exists for this window
  useEffect(() => {
    engine.ensureInstanceSynth(instanceId);
    // Default to piano-ish params
    applySound("piano");
    return () => {
      // On unmount, release any held notes and remove instance synth
      for (const [, midi] of sounding.current) engine.noteOff(instanceId, midi);
      sounding.current.clear();
      try { engine.removePianoInstance(instanceId); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  const applySound = (kind: SoundKind) => {
    switch (kind) {
      case "piano":
        engine.setInstanceToPianoSampler(instanceId);
        break;
      case "sine":
        engine.setInstanceToBasicSynth(instanceId, "sine", { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 });
        break;
      case "square":
        engine.setInstanceToBasicSynth(instanceId, "square", { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 });
        break;
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    // Octave shift: Shift+Z / Shift+X or [ / ]
    if ((key === "z" && e.shiftKey) || key === "[") {
      e.preventDefault();
      setOctave(o => Math.max(0, o - 1));
      return;
    }
    if ((key === "x" && e.shiftKey) || key === "]") {
      e.preventDefault();
      setOctave(o => Math.min(8, o + 1));
      return;
    }

    const idx = KEY_SEQUENCE.indexOf(key);
    if (idx === -1) return;
    if (pressed.current.has(key)) return; // ignore repeats
    pressed.current.add(key);
    e.preventDefault();

    // First interaction starts audio context
    if (!initialized.current) {
      initialized.current = true;
      engine.startAudio();
    }

    // Root is C (0) for now. Map across selected scale.
    const semiFromRoot = keyIndexToSemitone(idx, scale);
    const midi = (octave + 1) * 12 + root + semiFromRoot; // root inside octave
    engine.noteOn(instanceId, midi, 0.9);
    sounding.current.set(key, midi);
    setActiveMidis(prev => new Set([...prev, midi]));
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    pressed.current.delete(key);
    const midi = sounding.current.get(key);
    if (typeof midi === "number") {
      engine.noteOff(instanceId, midi);
      sounding.current.delete(key);
      setActiveMidis(prev => {
        const next = new Set(prev);
        next.delete(midi);
        return next;
      });
    }
  };

  useEffect(() => {
    const down = (ev: KeyboardEvent) => onKeyDown(ev);
    const up = (ev: KeyboardEvent) => onKeyUp(ev);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    // Safety: release on blur
    const onBlur = () => {
      pressed.current.clear();
      for (const [, midi] of sounding.current) engine.noteOff(instanceId, midi);
      sounding.current.clear();
      setActiveMidis(new Set());
    };
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, octave, root, instanceId]);

  // Update engine when UI sound changes
  useEffect(() => { applySound(sound); }, [sound]);

  // Compute how many octaves we need to visually display so all typing keys map within the visible piano
  const requiredOctaves = useMemo(() => {
    const lastIdx = KEY_SEQUENCE.length - 1; // index of last typing key
    const maxSemi = keyIndexToSemitone(lastIdx, scale); // semitones from root
    // Include root offset so the visible C-anchored piano spans all typing notes
    return Math.max(1, Math.ceil((root + maxSemi + 1) / 12));
  }, [scale, root]);

  const help = useMemo(() => (
    <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.4 }}>
      <div>Note: MIDI input not supported yet.</div>
    </div>
  ), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={labelStyle}>Sound</label>
        <select value={sound} onChange={(e) => setSound(e.target.value as SoundKind)} style={selectStyle}>
          <option value="piano">Piano</option>
          <option value="sine">Sine</option>
          <option value="square">Square</option>
        </select>
  <label style={{ ...labelStyle, marginLeft: 8 }}>Scale</label>
        <select value={scale} onChange={(e) => setScale(e.target.value as ScaleKind)} style={selectStyle}>
          <option value="chromatic">Chromatic (all keys)</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
          <option value="pentatonic-major">Pentatonic Major</option>
          <option value="pentatonic-minor">Pentatonic Minor</option>
        </select>
        <label style={{ ...labelStyle, marginLeft: 8 }}>Root</label>
        <select value={root} onChange={(e) => setRoot(Number(e.target.value))} style={selectStyle}>
          {NOTE_NAMES.map((n, i) => (
            <option key={n} value={i}>{n}</option>
          ))}
        </select>
  <label style={{ ...labelStyle, marginLeft: 8 }}>Octave</label>
        <input type="number" min={0} max={8} value={octave} onChange={(e) => setOctave(Math.max(0, Math.min(8, Number(e.target.value)||0)))} style={numStyle} />
      </div>
      {help}
      <PianoView
        baseMidi={(octave + 1) * 12}
        octaves={requiredOctaves}
        active={activeMidis}
        onMousePlay={(m) => { engine.noteOn(instanceId, m, 0.9); setActiveMidis(p => new Set([...p, m])); }}
        onMouseStop={(m) => { engine.noteOff(instanceId, m); setActiveMidis(p => { const n = new Set(p); n.delete(m); return n; }); }}
      />
    </div>
  );
};

// (old legend renderer removed)

const labelStyle: React.CSSProperties = { color: "#e2e8f0", fontSize: 12 };
const selectStyle: React.CSSProperties = { background: "#1f2937", color: "#e5e7eb", border: "1px solid #4b5563", borderRadius: 6, padding: "4px 8px" };
const numStyle: React.CSSProperties = { width: 60, background: "#1f2937", color: "#e5e7eb", border: "1px solid #4b5563", borderRadius: 6, padding: "4px 8px" };

export default TypingKeyboard;

// ---------- Visual Piano ----------

function PianoView({ baseMidi, octaves, active, onMousePlay, onMouseStop }: {
  baseMidi: number;
  octaves: number;
  active: Set<number>;
  onMousePlay: (midi: number) => void;
  onMouseStop: (midi: number) => void;
}) {
  const primary = useTheme(s => s.primary);
  const totalSemis = octaves * 12;
  const whites: { midi: number; noteInOct: number }[] = [];
  const blacks: { midi: number; noteInOct: number; leftIndex: number }[] = [];

  // Build arrays for layout
  const isBlack = (n: number) => [1,3,6,8,10].includes(n % 12);
  const isWhite = (n: number) => !isBlack(n);
  const whiteOrderInOct = [0,2,4,5,7,9,11];
  // Map semitone to white position (0..6) within the octave
  // const whitePos = (n: number) => whiteOrderInOct.indexOf(n % 12); // kept for reference

  for (let s = 0; s < totalSemis; s++) {
    const midi = baseMidi + s;
    const within = s % 12;
    if (isWhite(within)) whites.push({ midi, noteInOct: within });
  }
  // For black keys, compute position relative to the previous white
  const blackLeftMap: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 }; // between whites
  for (let s = 0; s < totalSemis; s++) {
    const midi = baseMidi + s;
    const within = s % 12;
    if (isBlack(within)) {
      const octBase = Math.floor(s / 12) * 7; // 7 whites per octave
      const leftIndex = octBase + (blackLeftMap[within] ?? 0);
      blacks.push({ midi, noteInOct: within, leftIndex });
    }
  }

  const whiteWidth = 22; // compact size
  const whiteHeight = 80;
  const blackWidth = 14;
  const blackHeight = 52;

  const totalWhites = octaves * 7;
  const pianoWidth = totalWhites * whiteWidth;

  return (
    <div style={{ position: "relative", width: pianoWidth, height: whiteHeight, userSelect: "none" }}>
      {/* White keys */}
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {Array.from({ length: totalWhites }, (_, i) => i).map((wIx) => {
          // Find corresponding midi(s) for this white index
          const oct = Math.floor(wIx / 7);
          const posInOct = wIx % 7; // 0..6 mapping to whiteOrderInOct
          const semiInOct = whiteOrderInOct[posInOct];
          const midi = baseMidi + oct * 12 + semiInOct;
          const activeKey = active.has(midi);
          return (
            <div
              key={`w${wIx}`}
              onMouseDown={(e) => { e.preventDefault(); onMousePlay(midi); }}
              onMouseUp={(e) => { e.preventDefault(); onMouseStop(midi); }}
              onMouseLeave={(e) => { if (e.buttons) onMouseStop(midi); }}
              style={{
                width: whiteWidth,
                height: whiteHeight,
                border: "1px solid #475569",
                background: activeKey ? primary : "#e5e7eb",
                boxSizing: "border-box",
              }}
            />
          );
        })}
      </div>
      {/* Black keys */}
      <div style={{ position: "absolute", top: 0, left: 0, height: blackHeight, width: pianoWidth, pointerEvents: "none" }}>
        {blacks.map((b, i) => {
          const left = b.leftIndex * whiteWidth + (whiteWidth - blackWidth / 2);
          const activeKey = active.has(b.midi);
          return (
            <div
              key={`b${i}`}
              onMouseDown={(e) => { e.preventDefault(); onMousePlay(b.midi); }}
              onMouseUp={(e) => { e.preventDefault(); onMouseStop(b.midi); }}
              onMouseLeave={(e) => { if ((e as any).buttons) onMouseStop(b.midi); }}
              style={{
                position: "absolute",
                left,
                width: blackWidth,
                height: blackHeight,
                background: activeKey ? primary : "#0f172a",
                border: "1px solid #1f2937",
                borderRadius: 4,
                pointerEvents: "auto",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
