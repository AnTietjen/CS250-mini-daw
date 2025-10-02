// src/App.tsx
import Transport from "./components/transport/Transport";
import StepSequencer from "./components/editor/StepSequencer";
import PianoRoll from "./components/editor/PianoRoll";
import { useWindows } from "./store/windows";
import { WindowFrame } from "./components/windows/WindowFrame";

function WindowContents({ kind }: { kind: string }) {
  switch (kind) {
    case "stepSequencer":
      return <StepSequencer />;
    case "pianoRoll":
      return <PianoRoll />;
    case "settings":
      return <Transport />;
    default:
      return <div>Unknown window: {kind}</div>;
  }
}

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
      }}
    >
      <header style={{ position: "absolute", top: 8, left: 16, fontSize: 20, fontWeight: 600, pointerEvents: "none", opacity: 0.8 }}>
        Mini-DAW
      </header>
      {windows.map(w => (
        <WindowFrame key={w.id} win={w}>
          <WindowContents kind={w.kind} />
        </WindowFrame>
      ))}
    </div>
  );
}
