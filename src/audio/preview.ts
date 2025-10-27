import * as Tone from "tone";

let player: Tone.Player | null = null;

export function previewSample(url: string) {
  if (player) {
    player.stop();
    player.dispose();
  }
  player = new Tone.Player(url, () => {
    player!.toDestination();
    player!.start();
  });
}