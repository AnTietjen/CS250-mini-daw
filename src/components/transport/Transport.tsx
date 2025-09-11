// src/components/transport/Transport.tsx
import { useState, useEffect } from "react";
import { engine } from "../../audio/engine";
import { useProject } from "../../store/project";
import { useSelection } from "../../store/selection";
import type { Snap } from "../../store/selection"; // <-- type-only import

export default function Transport() {
  const [audioReady, setAudioReady] = useState(false);
  const bpm = useProject((s) => s.bpm);
  const setBpm = useProject((s) => s.setBpm);
  const snap = useSelection((s) => s.snap);
  const setSnap = useSelection((s) => s.setSnap);

  useEffect(() => {
    // keep engine tempo in sync with store
    engine.setTempo(bpm);
  }, [bpm]);

  async function enable() {
    await engine.startAudio();
    setAudioReady(true);
  }

  return (
    <section style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
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

          {/* Snap selector (will be used by editors & playlist later) */}
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Snap:
            <select value={snap} onChange={(e) => setSnap(e.target.value as Snap)}>
              <option value="1">Beat</option>
              <option value="1/2">1/2 Beat</option>
              <option value="1/4">1/4 Beat</option>
            </select>
          </label>
        </>
      )}
    </section>
  );
}
