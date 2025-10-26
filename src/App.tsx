// src/App.tsx
import { useWindows } from "./store/windows";
import { WindowFrame } from "./components/windows/WindowFrame";

export default function App() {
  const windows = useWindows(s => s.windows);
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
        zIndex: 1,
      }}
    >
      {/* Decorative ambient background removed for performance (was: aurora/trails/flares/grain) */}
      <header style={{ position: "absolute", top: 8, left: 16, fontSize: 20, fontWeight: 600, pointerEvents: "none", opacity: 0.8 }}>
        Mini-DAW
      </header>
      {windows.map(w => (
        <WindowFrame key={w.id} id={w.id} />
      ))}
    </div>
  );
}
