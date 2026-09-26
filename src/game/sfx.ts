/** Tiny WebAudio sound effects. No audio files; everything is synthesized. */
let ctx: AudioContext | null = null;
let muted = false;

/** Call from a user gesture (browsers block audio until then). */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function setMuted(value: boolean): void {
  muted = value;
}

function tone(freqs: number[], step: number, type: OscillatorType = 'square', volume = 0.08): void {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, t0 + i * step));
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + freqs.length * step + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + freqs.length * step + 0.06);
}

export const sfx = {
  jump: () => tone([330, 440, 550], 0.03),
  token: () => tone([988, 1319], 0.06, 'square', 0.05),
  stomp: () => tone([220, 110], 0.05, 'triangle', 0.15),
  bump: () => tone([140, 120], 0.04, 'triangle', 0.12),
  powerup: () => tone([523, 659, 784, 1047, 1319], 0.06),
  hurt: () => tone([440, 330, 220], 0.08, 'sawtooth', 0.06),
  die: () => tone([494, 440, 392, 330, 262, 196], 0.1, 'square', 0.07),
  flag: () => tone([392, 523, 659, 784, 1047, 784, 1047], 0.09),
  boss: () => tone([98, 92, 87], 0.12, 'sawtooth', 0.1),
};
