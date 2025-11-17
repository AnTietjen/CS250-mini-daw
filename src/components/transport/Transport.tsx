// src/components/transport/Transport.tsx
import { useState, useEffect, useRef } from "react";
import { engine } from "../../audio/engine";
import { useSnap } from "../../store/snap";
import { usePlayhead } from "../../store/playhead";
import { useProject } from "../../store/project";
import { useTheme, PRESET_COLORS } from "../../store/theme";

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
  const snap = useSnap((s) => s.snap);
  const setSnap = useSnap((s) => s.setSnap);
  const playing = usePlayhead((s) => s.playing);

  useEffect(() => {
    engine.setTempo(bpm);
  }, [bpm]);

  // Spacebar: always play/stop. Prevent every other default action.
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
        if (playing) engine.stop();
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

  const colorBtn: React.CSSProperties = {
    width: 20,
    height: 20,
    borderRadius: 4,
    border: "1px solid #334155",
    cursor: "pointer",
    padding: 0,
    background: "transparent",
  };

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

  return (
    <section style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button onClick={onPlay} style={{ padding: 8, borderRadius: 8 }}>
        Play
      </button>
      <button onClick={() => engine.stop()} style={{ padding: 8, borderRadius: 8 }}>
        Stop
      </button>

      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        Tempo: <strong>{bpm}</strong>
        <input
          type="range"
          min={30}
          max={300}
          value={bpm}
          onChange={(e) => setBpm(parseInt(e.target.value, 10))}
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
          style={{ width: 64, marginLeft: 8, padding: "2px 6px", borderRadius: 6 }}
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
          style={{ padding: "4px 8px", borderRadius: 6 }}
          title="Tap tempo"
        >
          Tap
        </button>
        {tapBpm ? (
          <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>
            Tapped: <strong>{tapBpm}</strong> BPM
          </span>
        ) : null}
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={metOn}
            onChange={(e) => {
              setMetOn(e.target.checked);
              engine.setMetronomeEnabled(e.target.checked);
            }}
          />
          Metronome
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          Snap
          <select
            value={snap}
            onChange={(e) => setSnap(e.target.value as any)}
            style={{ padding: "2px 6px" }}
          >
            <option value="1/4">1/4</option>
            <option value="1/8">1/8</option>
            <option value="1/16">1/16</option>
          </select>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setPrimary(c.value)}
              style={{
                ...colorBtn,
                background: c.value,
                boxShadow: c.value === primary ? "0 0 0 2px rgba(255,255,255,0.3)" : "none",
              }}
              title={c.name}
            />
          ))}
        </div>
      </div>
    </section>
  );
}