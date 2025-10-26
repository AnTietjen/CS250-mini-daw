import React, { useMemo, useState } from "react";
import Knob from "../controls/Knob";
import { useTheme } from "../../store/theme";

interface MixerStripProps {
  index: number;
}

const Strip: React.FC<MixerStripProps> = ({ index }) => {
  const primary = useTheme(s => s.primary);
  const [gain, setGain] = useState(0.8);
  const [pan, setPan] = useState(0);
  const [mute, setMute] = useState(false);
  const [solo, setSolo] = useState(false);

  return (
    <div style={stripStyle}>
      <div style={{ fontSize: 11, textAlign: "center", marginBottom: 6, opacity: 0.9 }}>Track {index + 1}</div>

      {/* Insert slots (placeholders) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{
            height: 18,
            border: "1px solid #334155",
            background: "#0b1220",
            borderRadius: 4,
            fontSize: 10,
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>Insert</div>
        ))}
      </div>

      {/* Pan */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
        <Knob value={(pan + 1) / 2} onChange={v => setPan(v * 2 - 1)} size={28} color={primary} label="Pan" showLabel={false} />
      </div>
      <div style={{ fontSize: 10, textAlign: "center", marginBottom: 6, color: "#94a3b8" }}>
        {pan < -0.01 ? `${Math.round(-pan * 100)}L` : pan > 0.01 ? `${Math.round(pan * 100)}R` : "C"}
      </div>

      {/* Meter placeholder */}
      <div style={{ height: 80, border: "1px solid #1e293b", background: "linear-gradient(180deg,#1e293b,#0b1220)", borderRadius: 4, marginBottom: 8, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: Math.round(gain * 80), background: primary + "cc" }} />
      </div>

      {/* Fader */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
        <input type="range" min={0} max={1} step={0.01} value={gain} onChange={(e) => setGain(Number(e.target.value))}
          style={faderStyle as any} />
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
        <button style={{ ...btnStyle, background: mute ? "#ef4444" : "#334155" }} onClick={() => setMute(m => !m)}>M</button>
        <button style={{ ...btnStyle, background: solo ? primary : "#334155" }} onClick={() => setSolo(s => !s)}>S</button>
      </div>
    </div>
  );
};

const Mixer: React.FC = () => {
  const [count, setCount] = useState(5);
  const strips = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  const addTrack = () => setCount(c => c + 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "#cbd5e1", opacity: 0.9 }}>FL-style Mixer (UI only)</div>
        <button onClick={addTrack} style={addBtnStyle}>+ Track</button>
      </div>
      <div style={{ flex: 1, overflow: "auto", border: "1px solid #1e293b", background: "#0f172a", padding: 8 }}>
        <div style={{ display: "flex", gap: 10, minHeight: "100%" }}>
          {strips.map(i => <Strip key={i} index={i} />)}
        </div>
      </div>
    </div>
  );
};

const stripStyle: React.CSSProperties = {
  width: 84,
  minWidth: 84,
  background: "#111827",
  border: "1px solid #1f2937",
  borderRadius: 8,
  padding: 8,
  display: "flex",
  flexDirection: "column",
};

const btnStyle: React.CSSProperties = {
  width: 28,
  height: 22,
  border: "1px solid #334155",
  borderRadius: 4,
  color: "#e5e7eb",
  cursor: "pointer"
};

const addBtnStyle: React.CSSProperties = {
  padding: "4px 8px",
  background: "#334155",
  border: "1px solid #64748b",
  color: "#e5e7eb",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12
};

const faderStyle: React.CSSProperties = {
  // Vertical slider (browser-specific). Leaving as horizontal fallback if unsupported.
  WebkitAppearance: "slider-vertical" as any,
  width: 24,
  height: 120,
  background: "transparent",
};

export default Mixer;
