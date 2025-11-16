// src/components/transport/Transport.tsx
import { useState, useEffect, useRef } from "react";
import { engine } from "../../audio/engine";
import { useSnap } from "../../store/snap";
import { usePlayhead } from "../../store/playhead";
import { useProject } from "../../store/project";
import { useTheme, PRESET_COLORS } from "../../store/theme";
import { useWindows } from "../../store/windows";

export default function Transport() {
  const [audioReady, setAudioReady] = useState(false);
  const bpm = useProject((s) => s.bpm);
  const setBpm = useProject((s) => s.setBpm);
  const primary = useTheme(s => s.primary);
  const setPrimary = useTheme(s => s.setPrimary);
  const [metOn, setMetOn] = useState(engine.getMetronomeEnabled());
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const tapTimes = useRef<number[]>([]);
  const tapTimeout = useRef<number | null>(null);
  const snap = useSnap(s => s.snap);
  const setSnap = useSnap(s => s.setSnap);
  const playing = usePlayhead(s => s.playing);
  const addPianoWindow = useWindows(s => s.addPianoWindow);
  const addPlaylistWindow = useWindows(s => s.addPlaylistWindow);

  useEffect(() => {
    // keep engine tempo in sync with store
    engine.setTempo(bpm);
  }, [bpm]);

  // Spacebar play/stop toggle (ignore when typing in inputs/textarea)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement | null;
        const isTyping = !!(target && (['INPUT','TEXTAREA','SELECT'].includes(target.tagName) || target.getAttribute('contenteditable') === 'true'));
        if (isTyping) return;
        e.preventDefault();
        if (!audioReady) {
          engine.startAudio().then(() => {
            setAudioReady(true);
            engine.play();
          });
          return;
        }
        if (playing) engine.stop(); else engine.play();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [audioReady, playing]);

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
              style={{ width: 64, marginLeft: 8, padding: '2px 6px', borderRadius: 6 }}
              title="Type tempo (BPM)"
            />
            <button
              onClick={() => {
                // Tap tempo: record time, compute from recent taps
                const now = Date.now();
                // Clear timeout that would reset taps
                if (tapTimeout.current) window.clearTimeout(tapTimeout.current);
                tapTimes.current.push(now);
                // Keep only last 8 taps
                if (tapTimes.current.length > 8) tapTimes.current.shift();
                // Need at least 2 taps
                if (tapTimes.current.length >= 2) {
                  const intervals: number[] = [];
                  for (let i = 1; i < tapTimes.current.length; i++) intervals.push(tapTimes.current[i] - tapTimes.current[i - 1]);
                  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                  const computed = Math.round(60000 / avg);
                  const clamped = Math.max(30, Math.min(300, computed));
                  setBpm(clamped);
                  setTapBpm(clamped);
                }
                // Reset tap buffer after 2 seconds of inactivity
                tapTimeout.current = window.setTimeout(() => {
                  tapTimes.current = [];
                  tapTimeout.current = null;
                }, 2000);
              }}
              style={{ marginLeft: 8, padding: '6px 8px', borderRadius: 6 }}
              title="Tap tempo"
            >
              Tap
            </button>
            <button
              onClick={() => { addPlaylistWindow(); }}
              style={{ padding: '6px 10px', borderRadius: 6 }}
              title="Add Playlist"
            >+ Playlist</button>
            {tapBpm ? <span style={{ marginLeft: 8, fontSize: 12, opacity: .8 }}>Tapped: <strong>{tapBpm}</strong> BPM</span> : null}
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12 }}>
              <input type="checkbox" checked={metOn} onChange={e => { setMetOn(e.target.checked); engine.setMetronomeEnabled(e.target.checked); }} />
              Metronome
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
              Snap
              <select value={snap} onChange={e => setSnap(e.target.value as any)} style={{ padding: '2px 6px' }}>
                <option value="1/4">1/4</option>
                <option value="1/8">1/8</option>
                <option value="1/16">1/16</option>
                <option value="1/3">1/3</option>
                <option value="1/6">1/6</option>
              </select>
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
          {/* Piano Roll add button (windows have their own close X) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                addPianoWindow();
              }}
              style={{ padding: '6px 10px', borderRadius: 6 }}
              title="Add Piano Roll"
            >+ Piano Roll</button>
          </div>
        </>
      )}
    </section>
  );
}
