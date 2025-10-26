import React, { useMemo, useState } from "react";
import Knob from "../controls/Knob";
import { useTheme } from "../../store/theme";
import { useElementSize } from "../../hooks/useElementSize";

interface MixerStripProps {
  index: number;
  width: number;
  meterHeight: number;
  faderHeight: number;
}

const Strip: React.FC<MixerStripProps> = ({ index, width, meterHeight, faderHeight }) => {
  const primary = useTheme(s => s.primary);
  const [gain, setGain] = useState(0.8);
  const [pan, setPan] = useState(0);

  return (
  <div style={{ ...stripStyle, width, minWidth: width }}>
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
      <div style={{ height: meterHeight, border: "1px solid #1e293b", background: "linear-gradient(180deg,#1e293b,#0b1220)", borderRadius: 4, marginBottom: 8, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: Math.round(gain * meterHeight), background: primary + "cc" }} />
      </div>

      {/* Fader */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
        <input type="range" min={0} max={1} step={0.01} value={gain} onChange={(e) => setGain(Number(e.target.value))}
          style={{ ...faderStyle, height: faderHeight } as any} />
      </div>
    </div>
  );
};

const Mixer: React.FC = () => {
  const [count, setCount] = useState(5);
  const strips = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  const addTrack = () => setCount(c => c + 1);
  const [scrollRef, size] = useElementSize<HTMLDivElement>();

  // Base dimensions (design size). We'll scale the entire content uniformly to fit.
  const BASE_STRIP_W = 84;
  const BASE_GAP = 10;
  const BASE_FADER_H = 120;
  const BASE_METER_H = 80;
  const HEADER_H = 32; // top bar height approx
  const V_PADDING = 16; // inner vertical paddings

  const contentWidth = count * BASE_STRIP_W + Math.max(0, count - 1) * BASE_GAP;
  const contentHeight = V_PADDING + HEADER_H + BASE_FADER_H + 80; // rough total including other UI

  const scaleX = contentWidth > 0 ? Math.min(1, size.width / contentWidth) : 1;
  const scaleY = contentHeight > 0 ? Math.min(1, size.height / contentHeight) : 1;
  const scale = Math.min(scaleX, scaleY);
  const scaledWidth = Math.max(0, Math.floor(contentWidth * scale));
  const scaledHeight = Math.max(0, Math.floor(contentHeight * scale));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "#cbd5e1", opacity: 0.9 }}>Work in progress</div>
        <button onClick={addTrack} style={addBtnStyle}>+ Track</button>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", border: "1px solid #1e293b", background: "#0f172a", padding: 8 }}>
        <div
          style={{
            position: "relative",
            width: scaledWidth,
            height: scaledHeight,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: contentWidth,
              // Use a generous height to avoid clipping; internal elements define their own heights.
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              display: "flex",
              gap: BASE_GAP,
              paddingTop: 0,
            }}
          >
            {strips.map(i => (
              <Strip key={i} index={i} width={BASE_STRIP_W} meterHeight={BASE_METER_H} faderHeight={BASE_FADER_H} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const stripStyle: React.CSSProperties = {
  background: "#111827",
  border: "1px solid #1f2937",
  borderRadius: 8,
  padding: 8,
  display: "flex",
  flexDirection: "column",
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
  WebkitAppearance: "slider-vertical" as any,
  width: 24,
  height: 120,
  background: "transparent",
};

export default Mixer;
