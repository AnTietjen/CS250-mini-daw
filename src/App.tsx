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
    </main>
  );
}
