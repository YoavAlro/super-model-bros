import { HYPES, type HypeId, type PerkId } from '../config/events';
import type { LevelSpec } from '../config/levelSpec';
import type { PathSpec } from '../config/paths';
import { RECAP_RANKS, RECAP_WEIGHTS, type RecapRank } from '../config/recap';
import { nextStep } from './progress';

/**
 * Pure finale recap: a finished run compared with real history. For each level, the model it
 * stands for, its real date and your history stars; for each hype on the path, your call and
 * history's verdict. No DOM.
 */

export interface RecapLevel {
  id: string;
  label: string;
  /** The model the level made you (or, for a storm that does not, the storm's name). */
  model: string;
  /** The real date, from the outro card. */
  date: string;
  /** 0 when the level has no result on this run. */
  stars: number;
}

export interface RecapHype {
  id: HypeId;
  name: string;
  when: string;
  verdict: 'lasting' | 'passing';
  /** Your call, or null if you never grabbed it. */
  call: 'lasting' | 'passing' | null;
}

export interface Recap {
  levels: RecapLevel[];
  stars: { got: number; max: number };
  hypes: RecapHype[];
  calls: { right: number; made: number; total: number };
  /** 0–1: history stars and hype calls, weighted. */
  score: number;
  rank: RecapRank;
  perks: PerkId[];
  deaths: number;
}

export interface RecapRun {
  results: Record<string, { stars: number }>;
  hypes: Record<string, { call: 'lasting' | 'passing'; correct: boolean }>;
  flags: string[];
  perks: string[];
  deaths: number;
}

/** The levels this run actually went through, in order (conditional steps only with their flag). */
export function playedSteps(path: PathSpec, flags: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = nextStep(path, 0, flags); i < path.steps.length; i = nextStep(path, i + 1, flags)) out.push(path.steps[i].level);
  return out;
}

export function rankFor(score: number): RecapRank {
  return RECAP_RANKS.find((r) => score >= r.min) ?? RECAP_RANKS[RECAP_RANKS.length - 1];
}

export function buildRecap(run: RecapRun, path: PathSpec, levels: Record<string, LevelSpec>): Recap {
  const ids = playedSteps(path, run.flags);
  const recapLevels: RecapLevel[] = ids.map((id, i) => {
    const l = levels[id];
    // A storm that does not evolve you is listed by its own name.
    const same = i > 0 && levels[ids[i - 1]].toward.name === l.toward.name;
    return { id, label: l.label, model: l.storm && same ? l.name : l.toward.name, date: l.outro.date.split(' · ')[0], stars: run.results[id]?.stars ?? 0 };
  });
  const got = recapLevels.reduce((s, l) => s + l.stars, 0);
  const max = recapLevels.length * 3;

  const hypeIds = [...new Set(ids.flatMap((id) => levels[id].hypes ?? []))];
  const hypes: RecapHype[] = hypeIds.map((id) => ({ id, name: HYPES[id].name, when: HYPES[id].when, verdict: HYPES[id].verdict, call: run.hypes[id]?.call ?? null }));
  const right = hypes.filter((h) => h.call === h.verdict).length;
  const made = hypes.filter((h) => h.call !== null).length;

  const starPart = max ? got / max : 1;
  const callPart = hypes.length ? right / hypes.length : 1;
  const score = RECAP_WEIGHTS.stars * starPart + RECAP_WEIGHTS.calls * callPart;
  return {
    levels: recapLevels,
    stars: { got, max },
    hypes,
    calls: { right, made, total: hypes.length },
    score,
    rank: rankFor(score),
    perks: run.perks as PerkId[],
    deaths: run.deaths,
  };
}
