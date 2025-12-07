// src/components/transport/Transport.tsx
import { useState, useEffect, useRef } from "react";
import { engine } from "../../audio/engine";
import { useSnap } from "../../store/snap";
import { usePlayhead } from "../../store/playhead";
import { useProject } from "../../store/project";
import { useTheme, PRESET_COLORS } from "../../store/theme";
import { saveProject, loadProject } from "../../utils/io/projectIO";

export default function Transport() {
  const [audioReady, setAudioReady] = useState(false);
  const bpm = useProject((s) => s.bpm);
  const setBpm = useProject((s) => s.setBpm);
  const primary = useTheme((s) => s.primary);
  const setPrimary = useTheme((s) => s.setPrimary);
  const [metOn, setMetOn] = useState(engine.getMetronomeEnabled());
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const tapTimes = useRef<number[]>([]);
  const tapTimeout = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Merged Hooks
  const snap = useSnap((s) => s.snap);
  const setSnap = useSnap((s) => s.setSnap);
  const playing = usePlayhead((s) => s.playing);

  useEffect(() => {
    engine.setTempo(bpm);
  }, [bpm]);

  // Spacebar: pause/resume for instant resume; Prevent defaults.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        if (!audioReady) {
          engine.startAudio().then(() => {
            setAudioReady(true);
            engine.play();
          });
          return;
        }
        if (playing) engine.pause(); // use pause to resume instantly
        else engine.play();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [audioReady, playing]);

  // Reflect theme color
  useEffect(() => {
    document.documentElement.style.setProperty("--ui-primary", primary);
  }, [primary]);

  useEffect(() => {
    return () => {
      if (tapTimeout.current) window.clearTimeout(tapTimeout.current);
    };
  }, []);

  async function onPlay() {
    if (!audioReady) {
      try {
        await engine.startAudio();
        setAudioReady(true);
      } catch (e) {
        console.error("Failed to start audio context", e);
        return;
      }
    }
    engine.play();
  }

  const btnStyle: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: 6,
    background: '#1e293b',
    border: `1px solid ${primary}55`,
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: 12,
  };

  const inputStyle: React.CSSProperties = {
    background: '#1e293b',
    border: `1px solid ${primary}44`,
    color: '#e2e8f0',
    borderRadius: 6,
    padding: '4px 8px',
  };

  return (
    <section style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button onClick={onPlay} style={{ ...btnStyle, background: playing ? primary + '33' : '#1e293b', border: `1px solid ${primary}` }}>
        {playing ? '▶ Playing' : '▶ Play'}
      </button>
      <button onClick={() => engine.pause()} style={btnStyle} title="Pause (Space)">
        ⏸ Pause
      </button>
      <button
        onClick={() => {
          // Ensure audio is initialized, then reset transport to start
          if (!audioReady) {
            engine.startAudio().then(() => setAudioReady(true)).catch(() => {});
          }
          engine.resetToStart();
        }}
        style={btnStyle}
        title="Reset to start"
      >
        ⏮ Reset
      </button>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <span style={{ opacity: 0.7 }}>Tempo:</span>
        <strong style={{ color: primary }}>{bpm}</strong>
        <input
          type="range"
          min={30}
          max={300}
          value={bpm}
          onChange={(e) => setBpm(parseInt(e.target.value, 10))}
          style={{ accentColor: primary }}
        />
        <input
          type="number"
          min={30}
          max={300}
          value={bpm}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) setBpm(Math.max(30, Math.min(300, Math.round(v))));
          }}
          style={{ ...inputStyle, width: 56 }}
          title="Type tempo (BPM)"
        />
        <button
          onClick={() => {
            const now = Date.now();
            if (tapTimeout.current) window.clearTimeout(tapTimeout.current);
            tapTimes.current.push(now);
            if (tapTimes.current.length > 8) tapTimes.current.shift();
            if (tapTimes.current.length >= 2) {
              const intervals: number[] = [];
              for (let i = 1; i < tapTimes.current.length; i++) {
                intervals.push(tapTimes.current[i] - tapTimes.current[i - 1]);
              }
              const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
              const bpmCalc = Math.round(60000 / avg);
              setTapBpm(bpmCalc);
              setBpm(Math.max(30, Math.min(300, bpmCalc)));
            }
            tapTimeout.current = window.setTimeout(() => {
              tapTimes.current = [];
              setTapBpm(null);
            }, 2000);
          }}
          style={btnStyle}
          title="Tap tempo"
        >
          Tap
        </button>
        {tapBpm ? (
          <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.8 }}>
            <strong style={{ color: primary }}>{tapBpm}</strong> BPM
          </span>
        ) : null}
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12 }}>
          <input type="checkbox" checked={metOn} onChange={e => { setMetOn(e.target.checked); engine.setMetronomeEnabled(e.target.checked); }} style={{ accentColor: primary }} />
          Metronome
        </label>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
          <span style={{ opacity: 0.7 }}>Snap</span>
          <select value={snap} onChange={e => setSnap(e.target.value as any)} style={{ ...inputStyle, padding: '2px 6px' }}>
            <option value="1/4">1/4</option>
            <option value="1/8">1/8</option>
            <option value="1/16">1/16</option>
            <option value="1/3">1/3</option>
            <option value="1/6">1/6</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, opacity: .7 }}>Theme:</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setPrimary(c.value)}
              title={c.name}
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                border: c.value === primary ? '2px solid #fff' : '1px solid #1e293b',
                background: c.value,
                cursor: 'pointer',
                boxShadow: c.value === primary ? '0 0 0 2px rgba(255,255,255,0.2)' : 'none'
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ width: 1, height: 24, background: '#334155', margin: '0 4px' }} />
      
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={saveProject} style={btnStyle} title="Save Project">
          💾 Save
        </button>
        <button onClick={() => fileInputRef.current?.click()} style={btnStyle} title="Load Project">
          📂 Load
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              loadProject(file);
              e.target.value = ''; // reset
            }
          }}
        />
      </div>

    </section>
  );
}