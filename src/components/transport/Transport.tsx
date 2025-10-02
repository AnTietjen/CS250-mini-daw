// src/components/transport/Transport.tsx
import { useState, useEffect } from "react";
import { engine } from "../../audio/engine";
import { useProject } from "../../store/project";
import { useTheme, PRESET_COLORS } from "../../store/theme";

export default function Transport() {
  const [audioReady, setAudioReady] = useState(false);
  const bpm = useProject((s) => s.bpm);
  const setBpm = useProject((s) => s.setBpm);
  const primary = useTheme(s => s.primary);
  const setPrimary = useTheme(s => s.setPrimary);
  const [metOn, setMetOn] = useState(engine.getMetronomeEnabled());

  useEffect(() => {
    // keep engine tempo in sync with store
    engine.setTempo(bpm);
  }, [bpm]);

  async function enable() {
    await engine.startAudio();
    setAudioReady(true);
  }

  // Reflect chosen color into CSS variable so other components can consume
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-primary', primary);
  }, [primary]);

  return (
    <section style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: 'wrap' }}>
      {!audioReady ? (
        <button onClick={enable} style={{ padding: 8, borderRadius: 8 }}>
          Enable Audio
        </button>
      ) : (
        <>
          <button onClick={() => engine.play()} style={{ padding: 8, borderRadius: 8 }}>
            Play
          </button>
          <button onClick={() => engine.stop()} style={{ padding: 8, borderRadius: 8 }}>
            Stop
          </button>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Tempo: <strong>{bpm}</strong>
            <input
              type="range"
              min={60}
              max={180}
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value, 10))}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12 }}>
              <input type="checkbox" checked={metOn} onChange={e => { setMetOn(e.target.checked); engine.setMetronomeEnabled(e.target.checked); }} />
              Metronome
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, opacity: .8 }}>Theme:</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 280 }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setPrimary(c.value)}
                  title={c.name}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: c.value === primary ? '2px solid #fff' : '2px solid #1e293b',
                    background: c.value,
                    cursor: 'pointer',
                    boxShadow: c.value === primary ? '0 0 0 2px rgba(255,255,255,0.3)' : 'none'
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
