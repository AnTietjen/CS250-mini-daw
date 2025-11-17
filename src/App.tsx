// src/App.tsx
import { useWindows } from "./store/windows";
import { WindowFrame } from "./components/windows/WindowFrame";

import SampleBrowser from "./components/rack/SampleBrowser";
import Transport from "./components/transport/Transport";
import Visualizer from "./components/visualizer/Visualizer";

export default function App() {
  const windows = useWindows((s) => s.windows);

  // Toggle handlers
  const addStep = useWindows(s => s.addStepSequencerWindow);
  const addPiano = useWindows(s => s.addPianoWindow);
  const addKeys = useWindows(s => s.addKeyboardWindow);
  const addMixer = useWindows(s => s.addMixerWindow);
  const closeByKind = useWindows(s => s.closeByKind);
  const hasKind = useWindows(s => s.hasKind);

  const toggle = (kind: string, addFn: () => string) => {
    if (hasKind(kind as any)) closeByKind(kind as any);
    else addFn();
  };

  // Floating windows area (only dynamic kinds)
  const floating = windows.filter(w =>
    w.kind !== "settings" &&
    w.kind !== "visualizer" &&
    w.kind !== "sampleBrowser"
  );

  const btnStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 6,
    background: "#334155",
    border: "1px solid #64748b",
    color: "#e2e8f0",
    fontSize: 12,
    cursor: "pointer"
  };

  return (
    <div
      style={{
        fontFamily: "system-ui",
        color: "#e5e7eb",
        background: "#0b1220",
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Fixed Left Sidebar: Sample Browser */}
      <aside style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 260,
        borderRight: "1px solid #1e293b",
        background: "#0f172a",
        overflow: "auto",
      }}>
        <SampleBrowser />
      </aside>

      {/* Fixed Top Bar: Master Control + Visualizer + Window Toggles */}
      <header style={{
        position: "absolute",
        left: 260,
        top: 0,
        right: 0,
        height: 180,
        display: "flex",
        flexDirection: "column",
        borderBottom: "1px solid #1e293b",
        background: "#0f172a",
        padding: 12,
        boxSizing: "border-box",
        gap: 8,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>Mini-DAW</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={btnStyle}
              onClick={() => toggle("stepSequencer", addStep)}
            >
              {hasKind("stepSequencer") ? "Hide Step Seq" : "Show Step Seq"}
            </button>
            <button
              style={btnStyle}
              onClick={() => toggle("pianoRoll", addPiano)}
            >
              {hasKind("pianoRoll") ? "Hide Piano Roll" : "Show Piano Roll"}
            </button>
            <button
              style={btnStyle}
              onClick={() => toggle("keyboard", addKeys)}
            >
              {hasKind("keyboard") ? "Hide Keyboard" : "Show Keyboard"}
            </button>
            <button
              style={btnStyle}
              onClick={() => toggle("mixer", addMixer)}
            >
              {hasKind("mixer") ? "Hide Mixer" : "Show Mixer"}
            </button>
          </div>
        </div>
        {/* Master Control (Transport) */}
        <Transport />
        {/* Visualizer integrated under controls */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <Visualizer />
        </div>
      </header>

      {/* Floating Windows Workspace */}
      <div
        style={{
          position: "absolute",
          left: 260,
          top: 180,
          right: 0,
          bottom: 0,
          overflow: "hidden",
        }}
      >
        {floating.map((w) => (
          <WindowFrame key={w.id} id={w.id} />
        ))}
      </div>
    </div>
  );
}