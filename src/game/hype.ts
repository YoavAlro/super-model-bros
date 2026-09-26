import type { HypeSpec, PerkId } from '../config/events';

/**
 * Pure rules for hype power-ups and recurring Moments. When a hype power-up runs out, the player
 * calls it "passing hype" or "lasting shift"; history's verdict decides what the run keeps.
 */

export type HypeCallValue = 'lasting' | 'passing';

export interface HypeOutcome {
  correct: boolean;
  /** A lasting hype's upgrade, kept for the rest of the run. */
  perk?: PerkId;
  /** Seconds of slowdown after a passing hype. */
  hangover: number;
}

export const HANGOVER_SECONDS = 4;
export const HANGOVER_SPEED = 0.6;

/** The verdict depends on history, not on the call: the call only decides whether you were right. */
export function judgeHype(spec: HypeSpec, call: HypeCallValue): HypeOutcome {
  return {
    correct: call === spec.verdict,
    perk: spec.verdict === 'lasting' ? spec.perk : undefined,
    hangover: spec.verdict === 'passing' ? HANGOVER_SECONDS : 0,
  };
}

/** How many hype calls matched history. */
export function hypeScore(calls: Record<string, { correct: boolean }>): { right: number; total: number } {
  const all = Object.values(calls);
  return { right: all.filter((c) => c.correct).length, total: all.length };
}

/** Adds a perk to a run's perks without duplicates. */
export function addPerk(perks: readonly string[], perk: PerkId | undefined): string[] {
  return perk && !perks.includes(perk) ? [...perks, perk] : [...perks];
}

/** The Tibo Reset shows up more often after you die a lot: from the third death in a level, the next token block gives one. */
export const TIBO_DEATHS = 3;
export function tiboDue(deathsThisLevel: number, alreadyGiven: boolean): boolean {
  return !alreadyGiven && deathsThisLevel >= TIBO_DEATHS;
}

/** Banked resets cap at three. */
export const MAX_BANKED_RESETS = 3;
export function bankReset(banked: number): number {
  return Math.min(MAX_BANKED_RESETS, banked + 1);
}

/** Code Red's par time for a speed-run bonus: a brisk run speed over the level's length. */
export function codeRedPar(levelWidth: number): number {
  return Math.round(levelWidth / 6);
}
