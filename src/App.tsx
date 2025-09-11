// src/App.tsx
import Transport from "./components/transport/Transport";
import StepSequencer from "./components/editor/StepSequencer";

export default function App() {
  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui",
        color: "#e5e7eb",
        background: "#0b1220",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ marginBottom: 12 }}>Mini-DAW</h1>
      <Transport />
      <StepSequencer />
    </main>
  );
}
