/**
 * Pure timing curves for the mascots' idle life (blinks, landings, springs and idle moments). The
 * meshes live in `characterMeshes.ts`; these are only numbers, so they are unit tested.
 */

/** Eye height while blinking: 1 when open, down to 0.1 halfway through a blink of `dur` seconds. */
export function blinkScale(since: number, dur: number): number {
  if (since < 0 || since >= dur) return 1;
  const u = since / dur;
  return 0.1 + 0.9 * Math.abs(2 * u - 1);
}

/** A quick happy squint right after landing: 0.7 at touchdown, back to 1 after 0.2 s. */
export function landingSquint(since: number): number {
  return since < 0 || since >= 0.2 ? 1 : 0.7 + 0.3 * (since / 0.2);
}

/** A damped wobble for springy parts (cowlicks, antennae): starts at 0, dies out after a second. */
export function springWobble(since: number, amp: number, freq = 26, decay = 6): number {
  if (since < 0 || since > 1.2) return 0;
  return amp * Math.exp(-decay * since) * Math.sin(freq * since);
}

/** 0 → 1 → 0 over `dur` seconds after an event, and 0 outside it (a one-shot flick). */
export function flick(since: number, dur: number): number {
  return since < 0 || since >= dur ? 0 : Math.sin((since / dur) * Math.PI);
}

/**
 * A character's idle moment (a wink, a ponder, a big spout puff): after standing still for `every`
 * seconds it plays for `dur` seconds, then again every `every` seconds. Returns progress in 0..1
 * while playing, or -1.
 */
export function idleMoment(idle: number, every: number, dur: number): number {
  if (idle < every) return -1;
  const into = idle % every;
  return into < dur ? into / dur : -1;
}

/** A pop-in scale for something appearing: 0 at u = 0, overshooting to about 1.15, settling at 1 from u = 1. */
export function popIn(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return Math.sin((u * Math.PI) / 2) * (1 + 0.3 * Math.sin(u * Math.PI));
}

/** A smooth 0 → 1 → 0 envelope over an idle moment's progress (-1 outside it), holding at 1 in the middle. */
export function hold(p: number, edge = 0.2): number {
  if (p < 0 || p >= 1) return 0;
  const u = Math.min(1, p / edge, (1 - p) / edge);
  return u * u * (3 - 2 * u);
}

/** Radians per second of the stride cycle at a given running speed (world units per second). */
export const strideRate = (speed: number): number => 4 + Math.min(speed, 16) * 1.1;

/** Seconds until the next blink: every 3–5 s, from a 0..1 random draw. */
export const nextBlink = (rand: number): number => 3 + 2 * rand;

/** A stable 0..1 number per name, so each mascot blinks on its own phase. */
export function phaseOf(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** Moves `from` toward `to` by a frame-rate independent fraction (rate per second). */
export const ease = (from: number, to: number, rate: number, dt: number): number => from + (to - from) * Math.min(1, rate * dt);
