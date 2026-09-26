import { describe, expect, it } from 'vitest';
import { KARTS } from '../config/karts';
import { humansDone, KART, kartRivals, LANES, makeTrack, newRace, placeOf, stepRace, type Race, type Track } from './kart';
import type { Pad } from './pad';

const STEP = 1 / 120;
const idle = (): Pad => ({ left: false, right: false, jump: false, run: false, action: false });
const empty = (length = 200): Track => ({ length, things: [] });

/** Runs a race to the end (or a time limit), feeding `drive(race, t)` as player 1's pad. */
function run(race: Race, drive: (race: Race, t: number) => Pad = () => idle(), seconds = 120): Race {
  for (let t = 0; t < seconds && !race.racers.every((r) => r.finished !== null); t += STEP) stepRace(race, [drive(race, t)], STEP);
  return race;
}

describe('Benchmark Kart', () => {
  it('builds seeded tracks that never block all three lanes at once', () => {
    const a = makeTrack(600, { hurdles: 30, pads: 6, tokens: 20 }, 7);
    const b = makeTrack(600, { hurdles: 30, pads: 6, tokens: 20 }, 7);
    expect(a).toEqual(b);
    expect(a.things.filter((t) => t.kind === 'hurdle')).toHaveLength(30);
    const hurdles = a.things.filter((t) => t.kind === 'hurdle');
    for (let i = 2; i < hurdles.length; i++) expect(hurdles[i].at - hurdles[i - 2].at).toBeGreaterThanOrEqual(6);
    for (const t of a.things) {
      expect(t.lane).toBeGreaterThanOrEqual(0);
      expect(t.lane).toBeLessThan(LANES);
    }
  });

  it('accelerates to top speed and crosses the line', () => {
    const race = run(newRace(empty(), ['gpt'], [], 1));
    const me = race.racers[0];
    expect(me.finished).not.toBeNull();
    expect(me.finished!).toBeGreaterThan(200 / KART.top);
    expect(humansDone(race)).toBe(true);
  });

  it('switches lanes one at a time, and stays on the road', () => {
    const race = newRace(empty(), ['gpt'], [], 1);
    const me = race.racers[0];
    expect(me.lane).toBe(1);
    stepRace(race, [{ ...idle(), left: true }], STEP);
    stepRace(race, [{ ...idle(), left: true }], STEP); // held, not pressed again
    expect(me.lane).toBe(0);
    stepRace(race, [idle()], STEP);
    stepRace(race, [{ ...idle(), left: true }], STEP);
    expect(me.lane).toBe(0);
    for (let i = 0; i < 60; i++) stepRace(race, [idle()], STEP);
    expect(me.z).toBeCloseTo(0);
  });

  it('stuns you at a hurdle unless you hop it', () => {
    const track: Track = { length: 200, things: [{ kind: 'hurdle', at: 40, lane: 1 }] };
    const crash = run(newRace(track, ['gpt'], [], 1), () => idle(), 4);
    const hop = run(
      newRace(track, ['gpt'], [], 1),
      (race) => ({ ...idle(), jump: race.racers[0].s > 40 - 4 && race.racers[0].s < 40 - 3 }),
      4,
    );
    expect(crash.racers[0].s).toBeLessThan(hop.racers[0].s);
  });

  it('collects tokens and spends three on a boost', () => {
    const track: Track = { length: 400, things: [30, 40, 50].map((at) => ({ kind: 'token' as const, at, lane: 1 })) };
    const race = newRace(track, ['gpt'], [], 1);
    run(race, () => idle(), 4);
    const me = race.racers[0];
    expect(me.tokens).toBe(3);
    stepRace(race, [{ ...idle(), run: true }], STEP);
    expect(me.tokens).toBe(0);
    expect(me.boost).toBeGreaterThan(0);
  });

  it('is deterministic: the same inputs give the same race', () => {
    const track = makeTrack(500, { hurdles: 16, pads: 5, tokens: 16 }, 3);
    const a = run(newRace(track, ['gpt'], ['gemini', 'llama', 'grok'], 9));
    const b = run(newRace(track, ['gpt'], ['gemini', 'llama', 'grok'], 9));
    expect(a.order).toEqual(b.order);
    expect(a.racers.map((r) => r.finished)).toEqual(b.racers.map((r) => r.finished));
  });

  it('lets rivals finish every race, and ranks racers by finish then distance', () => {
    for (const spec of KARTS) {
      const track = makeTrack(spec.length, spec, 5);
      const race = run(newRace(track, ['claude'], kartRivals(spec, ['claude']), 5), () => idle(), 200);
      expect(race.order, spec.id).toHaveLength(4);
      expect(new Set(race.order.map((id) => placeOf(race, id)))).toEqual(new Set([1, 2, 3, 4]));
    }
  });

  it('never races a player against themselves', () => {
    for (const spec of KARTS) {
      const rivals = kartRivals(spec, ['gemini', 'claude']);
      expect(rivals).toHaveLength(3);
      expect(rivals).not.toContain('gemini');
      expect(rivals).not.toContain('claude');
    }
  });
});
