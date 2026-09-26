import type { CharacterId } from '../config/characters';
import type { KartSpec } from '../config/karts';
import type { Pad } from './pad';
import { mulberry32 } from './rng';

/**
 * Benchmark Kart: a pure, fixed-step race sim (no three.js). Three lanes, hurdles to hop or dodge,
 * boost pads, and tokens that fill a boost meter. Players drive with pads; rival karts drive
 * themselves with a seeded AI, so the same inputs always give the same race. Rivals are friends:
 * their speeds are seeded jitter, never real benchmark scores.
 */

export const LANES = 3;

export const KART = {
  /** Top speed, in track units per second. */
  top: 20,
  accel: 10,
  /** Speed factor while stunned by a hurdle. */
  slow: 0.4,
  stun: 0.8,
  hop: 0.55,
  boost: 1.5,
  boostSpeed: 1.45,
  /** Boost pads give a short boost. */
  padBoost: 0.7,
  /** Lanes per second when switching. */
  laneSpeed: 7,
  /** Tokens a boost costs. */
  boostCost: 3,
};

export type ThingKind = 'hurdle' | 'pad' | 'token';

export interface TrackThing {
  kind: ThingKind;
  /** Distance along the track. */
  at: number;
  lane: number;
}

export interface Track {
  length: number;
  things: TrackThing[];
}

export interface Racer {
  id: string;
  human: boolean;
  /** Distance along the track. */
  s: number;
  v: number;
  /** Target lane, 0..LANES-1. */
  lane: number;
  /** Current lateral position, easing toward `lane`. */
  z: number;
  hop: number;
  stun: number;
  boost: number;
  tokens: number;
  /** Race time at the finish line, or null while racing. */
  finished: number | null;
  /** Rivals only: a seeded top-speed factor and how often they read the track right. */
  pace: number;
  skill: number;
  prev: { left: boolean; right: boolean; jump: boolean; run: boolean };
  /** Indices of pads and tokens this racer has used. */
  used: Set<number>;
  /** Rivals only: what it decided to do about the next hurdle (decided once per hurdle). */
  plan: { at: number; act: 'dodge' | 'hop' | 'miss' } | null;
}

export interface Race {
  t: number;
  track: Track;
  racers: Racer[];
  /** Racer ids in finishing order. */
  order: string[];
  rng: () => number;
}

/** A seeded track: hurdles, pads and tokens spread along its length. */
export function makeTrack(length: number, counts: { hurdles: number; pads: number; tokens: number }, seed: number): Track {
  const rng = mulberry32(seed);
  const things: TrackThing[] = [];
  const start = 40;
  const span = length - start - 30;
  const place = (kind: ThingKind, n: number) => {
    for (let i = 0; i < n; i++) {
      const at = start + ((i + 0.5 + (rng() - 0.5) * 0.6) / n) * span;
      things.push({ kind, at: Math.round(at), lane: Math.floor(rng() * LANES) });
    }
  };
  place('hurdle', counts.hurdles);
  place('pad', counts.pads);
  place('token', counts.tokens);
  // Never block all three lanes at the same spot: at most two hurdles within 6 units.
  things.sort((a, b) => a.at - b.at);
  const hurdles = things.filter((t) => t.kind === 'hurdle');
  for (let i = 2; i < hurdles.length; i++) {
    if (hurdles[i].at - hurdles[i - 2].at < 6) hurdles[i].at = hurdles[i - 2].at + 6;
  }
  things.sort((a, b) => a.at - b.at);
  return { length, things };
}

function newRacer(id: string, human: boolean, lane: number, rng: () => number): Racer {
  return {
    id,
    human,
    s: 0,
    v: 0,
    lane,
    z: lane,
    hop: 0,
    stun: 0,
    boost: 0,
    tokens: 0,
    finished: null,
    pace: human ? 1 : 0.95 + rng() * 0.06,
    skill: human ? 1 : 0.6 + rng() * 0.3,
    prev: { left: false, right: false, jump: false, run: false },
    used: new Set(),
    plan: null,
  };
}

/** Humans start on the front row in the middle lanes; rivals line up a couple of kart lengths behind. */
export function newRace(track: Track, humans: string[], rivals: string[], seed: number): Race {
  const rng = mulberry32(seed);
  const racers = [
    ...humans.map((id, i) => newRacer(id, true, i === 0 ? 1 : 2, rng)),
    ...rivals.map((id, i) => {
      const r = newRacer(id, false, i % LANES, rng);
      r.s = -2.5 - Math.floor(i / LANES) * 2.5;
      return r;
    }),
  ];
  return { t: 0, track, racers, order: [], rng };
}

/** A rival's pad this step: it decides once per hurdle whether to dodge it, hop it, or miss. */
export function aiPad(race: Race, r: Racer): Pad {
  const pad: Pad = { left: false, right: false, jump: false, run: false, action: false };
  const ahead = race.track.things.find((t) => t.kind === 'hurdle' && t.lane === r.lane && t.at > r.s && t.at - r.s < 16);
  if (ahead) {
    if (r.plan?.at !== ahead.at) {
      const roll = race.rng();
      r.plan = { at: ahead.at, act: roll < r.skill * 0.5 ? 'dodge' : roll < r.skill ? 'hop' : 'miss' };
    }
    const d = ahead.at - r.s;
    const free = [r.lane - 1, r.lane + 1].filter(
      (l) => l >= 0 && l < LANES && !race.track.things.some((t) => t.kind === 'hurdle' && t.lane === l && Math.abs(t.at - ahead.at) < 8),
    );
    if (r.plan.act === 'dodge' && free.length) {
      if (free[0] < r.lane) pad.left = !r.prev.left;
      else pad.right = !r.prev.right;
    } else if (r.plan.act !== 'miss' && d < 2.5) {
      pad.jump = !r.prev.jump;
    }
  }
  if (r.tokens >= KART.boostCost && race.rng() < 0.01) pad.run = !r.prev.run;
  return pad;
}

/** One fixed step. `pads[i]` drives the i-th human racer. */
export function stepRace(race: Race, pads: readonly Pad[], dt: number): void {
  race.t += dt;
  let human = 0;
  for (const r of race.racers) {
    const pad = r.human ? (pads[human++] ?? { left: false, right: false, jump: false, run: false, action: false }) : aiPad(race, r);
    stepRacer(race, r, pad, dt);
  }
}

function stepRacer(race: Race, r: Racer, pad: Pad, dt: number): void {
  const pressed = {
    left: pad.left && !r.prev.left,
    right: pad.right && !r.prev.right,
    jump: pad.jump && !r.prev.jump,
    run: pad.run && !r.prev.run,
  };
  r.prev = { left: pad.left, right: pad.right, jump: pad.jump, run: pad.run };
  if (r.finished !== null) {
    // Coast past the line.
    r.v = Math.max(0, r.v - KART.accel * dt);
    r.s += r.v * dt;
    return;
  }
  if (pressed.left) r.lane = Math.max(0, r.lane - 1);
  if (pressed.right) r.lane = Math.min(LANES - 1, r.lane + 1);
  const dz = r.lane - r.z;
  r.z += Math.sign(dz) * Math.min(Math.abs(dz), KART.laneSpeed * dt);
  if (pressed.jump && r.hop <= 0) r.hop = KART.hop;
  if (pressed.run && r.tokens >= KART.boostCost && r.boost <= 0) {
    r.tokens -= KART.boostCost;
    r.boost = KART.boost;
  }
  r.hop = Math.max(0, r.hop - dt);
  r.stun = Math.max(0, r.stun - dt);
  r.boost = Math.max(0, r.boost - dt);

  const target = KART.top * r.pace * (r.boost > 0 ? KART.boostSpeed : 1) * (r.stun > 0 ? KART.slow : 1);
  r.v += Math.sign(target - r.v) * Math.min(Math.abs(target - r.v), KART.accel * dt * (r.v > target ? 3 : 1));
  const s0 = r.s;
  r.s += r.v * dt;

  const lane = Math.round(r.z);
  race.track.things.forEach((t, i) => {
    if (t.at <= s0 || t.at > r.s || t.lane !== lane || Math.abs(r.z - lane) > 0.35) return;
    if (t.kind === 'hurdle') {
      if (r.hop <= 0 && r.boost <= 0) {
        r.stun = KART.stun;
        r.v *= KART.slow;
      }
    } else if (!r.used.has(i)) {
      r.used.add(i);
      if (t.kind === 'pad') r.boost = Math.max(r.boost, KART.padBoost);
      else r.tokens++;
    }
  });

  if (r.s >= race.track.length) {
    r.finished = race.t;
    race.order.push(r.id);
  }
}

/** Current place (1-based): finishers by order, then everyone else by distance. */
export function placeOf(race: Race, id: string): number {
  const done = race.order.indexOf(id);
  if (done >= 0) return done + 1;
  const racing = race.racers.filter((r) => r.finished === null).sort((a, b) => b.s - a.s);
  return race.order.length + racing.findIndex((r) => r.id === id) + 1;
}

/** The race is over once every human has crossed the line. */
export const humansDone = (race: Race): boolean => race.racers.every((r) => !r.human || r.finished !== null);

/** Rival karts are friends: the race's preferred rivals, minus anyone a player drives, topped up from the roster. */
export function kartRivals(spec: Pick<KartSpec, 'rivals'>, players: readonly CharacterId[]): CharacterId[] {
  const pool: CharacterId[] = [...spec.rivals, 'gemini', 'llama', 'deepseek', 'mistral', 'grok', 'gpt', 'claude'];
  const out: CharacterId[] = [];
  for (const id of pool) if (!players.includes(id) && !out.includes(id) && out.length < 3) out.push(id);
  return out;
}
