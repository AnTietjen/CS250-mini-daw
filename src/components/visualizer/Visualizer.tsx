import React, { useEffect, useRef, useState } from "react";
import { engine } from "../../audio/engine";
import { useTheme } from "../../store/theme";

// Lightweight visualizer with multiple modes; taps Tone.Analyser from engine.
const MODES = ["Waveform", "Bars", "Radial", "Dots"] as const;

type Mode = typeof MODES[number];

const Visualizer: React.FC = () => {
  const primary = useTheme(s => s.primary);
  const [mode, setMode] = useState<Mode>("Bars");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Do NOT cache analysers at mount; engine may initialize later after a user gesture.
  // We'll fetch them inside the draw loop so the visualizer starts moving as soon as audio starts.

  useEffect(() => {
    let last = 0;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const draw = (t: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (!canvasRef.current) return;
      const cvs = canvasRef.current;
      const { width, height } = cvs.getBoundingClientRect();
      if (cvs.width !== Math.floor(width * dpr) || cvs.height !== Math.floor(height * dpr)) {
        cvs.width = Math.floor(width * dpr);
        cvs.height = Math.floor(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Throttle to ~60fps max, ~30fps on slower devices
      const delta = t - last;
      if (delta < 16) return; // ~60fps
      last = t;

      // Clear
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, width, height);

  // Choose data source (pull fresh references each frame in case engine was initialized later)
  const { fft, wave } = engine.getAnalysers();
  const fftVals = (fft ? (fft.getValue() as Float32Array) : null) || new Float32Array(512).fill(-100);
  const waveVals = (wave ? (wave.getValue() as Float32Array) : null) || new Float32Array(1024);

      // Theme colors
      const base = primary;
      const dim = base + "66";

      switch (mode) {
        case "Waveform":
          drawWaveform(ctx, waveVals, width, height, base);
          break;
        case "Bars":
          drawBars(ctx, fftVals, width, height, base, dim);
          break;
        case "Radial":
          drawRadial(ctx, fftVals, width, height, base, dim);
          break;
        case "Dots":
          drawDots(ctx, fftVals, width, height, base);
          break;
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [mode, primary]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ fontSize: 12, color: "#cbd5e1" }}>Mode</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} style={selectStyle}>
          {MODES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>Lightweight</div>
      </div>
      <div style={{ position: "relative", flex: 1, border: "1px solid #1e293b", background: "#0f172a", borderRadius: 8, overflow: "hidden" }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>
    </div>
  );
};

function drawWaveform(ctx: CanvasRenderingContext2D, values: Float32Array, w: number, h: number, color: string) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.beginPath();
  const len = values.length;
  for (let i = 0; i < len; i++) {
    const x = (i / (len - 1)) * w;
    const y = (0.5 - values[i] * 0.45) * h;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// FFT values are in dB. Map to 0..1 range and draw bars.
function drawBars(ctx: CanvasRenderingContext2D, values: Float32Array, w: number, h: number, color: string, dim: string) {
  const bins = values.length;
  const barCount = Math.min(64, bins);
  const barW = w / barCount;
  for (let i = 0; i < barCount; i++) {
    const v = values[i]; // dB
    const mag = Math.max(0, Math.min(1, (v + 100) / 100));
    const bh = mag * (h * 0.9);
    ctx.fillStyle = dim;
    ctx.fillRect(i * barW, h - bh, barW * 0.9, bh);
    ctx.fillStyle = color;
    ctx.fillRect(i * barW, h - bh, barW * 0.9, 2);
  }
}

function drawRadial(ctx: CanvasRenderingContext2D, values: Float32Array, w: number, h: number, color: string, dim: string) {
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(cx, cy) * 0.6;
  const bins = values.length;
  const spokeCount = Math.min(64, bins);
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < spokeCount; i++) {
    const v = values[i];
    const mag = Math.max(0, Math.min(1, (v + 100) / 100));
    const len = radius * (0.4 + mag * 0.6);
    const a = (i / spokeCount) * Math.PI * 2;
    const x = Math.cos(a) * len;
    const y = Math.sin(a) * len;
    ctx.strokeStyle = dim;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * radius * 0.4, Math.sin(a) * radius * 0.4); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawDots(ctx: CanvasRenderingContext2D, values: Float32Array, w: number, h: number, color: string) {
  const bins = values.length;
  const count = Math.min(72, bins);
  for (let i = 0; i < count; i++) {
    const v = values[i];
    const mag = Math.max(0, Math.min(1, (v + 100) / 100));
    const x = (i / (count - 1)) * w;
    const y = (1 - mag) * (h * 0.9);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 2 + mag * 3, 0, Math.PI * 2); ctx.fill();
  }
}

const selectStyle: React.CSSProperties = { background: "#1f2937", color: "#e5e7eb", border: "1px solid #4b5563", borderRadius: 6, padding: "4px 8px" };

export default Visualizer;
