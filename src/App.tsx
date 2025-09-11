<<<<<<< HEAD
import { useMemo, useState } from "react";
import * as Tone from "tone";

export default function App() {
  const [started, setStarted] = useState(false);

  // make a synth once
  const synth = useMemo(() => new Tone.Synth().toDestination(), []);

  async function startAudio() {
    await Tone.start(); // required by browsers
    setStarted(true);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Mini-DAW</h1>
      {!started ? (
        <button onClick={startAudio}>Click to enable audio</button>
      ) : (
        <>
          <button onClick={() => synth.triggerAttackRelease("C4", "8n")}>
            Play C4
          </button>
        </>
      )}
=======
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
>>>>>>> 5711520 (feat: transport, engine, step sequencer baseline)
    </main>
  );
}
