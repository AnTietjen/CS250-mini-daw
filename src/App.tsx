// src/App.tsx
import { useEffect } from "react";
import { useWindows } from "./store/windows";
import { WindowFrame } from "./components/windows/WindowFrame";
import PlaylistBridge from './components/playlist/PlaylistBridge';
import ErrorBoundary from './components/common/ErrorBoundary';
import { usePianoInstances } from "./store/pianoInstances";
import { useDrumPatterns } from "./store/drumPatterns";
import { useTheme } from "./store/theme";

import SampleBrowser from "./components/rack/SampleBrowser";
import Transport from "./components/transport/Transport";
import Visualizer from "./components/visualizer/Visualizer";
import Playlist from "./components/playlist/Playlist";


export default function App() {
  const windows = useWindows((s) => s.windows);
  
  // Initialize default patterns on first load
  const createPianoInstance = usePianoInstances(s => s.createInstance);
  const createDrumPattern = useDrumPatterns(s => s.createPattern);
  
  useEffect(() => {
    // Create named defaults
    createPianoInstance('Melody Clip 1');
    createDrumPattern('Drum Clip 1');
  }, []);

  // Toggle handlers - use FL Studio-style singleton openers for editors
  const openStep = useWindows(s => s.openStepSequencer);
  const openPiano = useWindows(s => s.openPianoRoll);
  const addKeys = useWindows(s => s.addKeyboardWindow);
  const addMixer = useWindows(s => s.addMixerWindow);
  const closeByKind = useWindows(s => s.closeByKind);
  const hasKind = useWindows(s => s.hasKind);

  const toggle = (kind: string, addFn: () => void) => {
    if (hasKind(kind as any)) closeByKind(kind as any);
    else addFn();
  };

  // Get theme color
  const primary = useTheme(s => s.primary);

  // Floating windows area (exclude playlist - it's now a fixed panel)
  const floating = windows.filter(w =>
    w.kind !== "settings" &&
    w.kind !== "visualizer" &&
    w.kind !== "sampleBrowser" &&
    w.kind !== "playlist"
  );

  const btnStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 6,
    background: "#1e293b",
    border: `1px solid ${primary}55`,
    color: "#e2e8f0",
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.15s",
  };

  const btnActiveStyle: React.CSSProperties = {
    ...btnStyle,
    background: primary + "33",
    border: `1px solid ${primary}`,
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
              style={hasKind("stepSequencer") ? btnActiveStyle : btnStyle}
              onClick={() => toggle("stepSequencer", openStep)}
            >
              {hasKind("stepSequencer") ? "✓ Step Seq" : "Step Seq"}
            </button>
            <button
              style={hasKind("pianoRoll") ? btnActiveStyle : btnStyle}
              onClick={() => toggle("pianoRoll", openPiano)}
            >
              {hasKind("pianoRoll") ? "✓ Piano Roll" : "Piano Roll"}
            </button>
            <button
              style={hasKind("keyboard") ? btnActiveStyle : btnStyle}
              onClick={() => toggle("keyboard", addKeys)}
            >
              {hasKind("keyboard") ? "✓ Keyboard" : "Keyboard"}
            </button>
            <button
              style={hasKind("mixer") ? btnActiveStyle : btnStyle}
              onClick={() => toggle("mixer", addMixer)}
            >
              {hasKind("mixer") ? "✓ Mixer" : "Mixer"}
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

      {/* Bridge that feeds playlist arrangement into engine */}
      <PlaylistBridge />

      {/* Main Workspace: Playlist as fixed background (FL Studio style) */}
      <div
        style={{
          position: "absolute",
          left: 260,
          top: 180,
          right: 0,
          bottom: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Playlist fills the background */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <ErrorBoundary>
            <Playlist />
          </ErrorBoundary>
          
          {/* Floating windows rendered on top of playlist */}
          {floating.map((w) => (
            <ErrorBoundary key={w.id}>
              <WindowFrame id={w.id} />
            </ErrorBoundary>
          ))}
        </div>
      </div>
    </div>
  );
}