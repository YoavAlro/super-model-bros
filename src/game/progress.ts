import { ROSTER, type CharacterId } from '../config/characters';
import type { LevelSpec } from '../config/levelSpec';
import type { PathSpec } from '../config/paths';

/**
 * Pure run/progression rules: which level comes next on a path, what you are called before it,
 * when a world ends, and which characters a save has unlocked. No DOM, no three.js.
 */

export interface LevelResult {
  stars: 1 | 2 | 3;
  /** 0–1 match between your token mix and the target mix. */
  match: number;
  /** 0–100, or null in worlds without the Alignment meter. */
  alignment: number | null;
}

/** Progress kept across runs: what you have beaten and unlocked. */
export interface Progress {
  worldsBeaten: number[];
  /** Best history stars per level id, across runs. */
  bestStars: Record<string, number>;
  unlocked: CharacterId[];
}

export const emptyProgress = (): Progress => ({ worldsBeaten: [], bestStars: {}, unlocked: [] });

/** Index of the first playable step at or after `from` (conditional steps need their flag). Returns steps.length when the path is done. */
export function nextStep(path: PathSpec, from: number, flags: readonly string[]): number {
  let i = from;
  while (i < path.steps.length && path.steps[i].when && !flags.includes(path.steps[i].when!)) i++;
  return i;
}

/** The name tag you wear entering step `index`: the model the previous played level made you. */
export function formBefore(path: PathSpec, index: number, flags: readonly string[], levels: Record<string, LevelSpec>): string {
  for (let i = index - 1; i >= 0; i--) {
    const step = path.steps[i];
    if (step.when && !flags.includes(step.when)) continue;
    return levels[step.level].toward.name;
  }
  return path.startForm;
}

/** True when finishing step `index` completes its world (the next playable step is in a later world, or there is none). */
export function endsWorld(path: PathSpec, index: number, flags: readonly string[], levels: Record<string, LevelSpec>): boolean {
  const world = levels[path.steps[index].level].world;
  const next = nextStep(path, index + 1, flags);
  return next >= path.steps.length || levels[path.steps[next].level].world > world;
}

/** Records a finished level; returns the progress after it. */
export function recordLevel(p: Progress, level: LevelSpec, result: LevelResult, worldDone: boolean): Progress {
  const bestStars = { ...p.bestStars, [level.id]: Math.max(p.bestStars[level.id] ?? 0, result.stars) };
  const worldsBeaten = worldDone && !p.worldsBeaten.includes(level.world) ? [...p.worldsBeaten, level.world] : p.worldsBeaten;
  return { ...p, bestStars, worldsBeaten };
}

/** Characters whose unlock rule now holds but that are not unlocked yet. */
export function checkUnlocks(p: Progress, paths: readonly PathSpec[], levels: Record<string, LevelSpec>): CharacterId[] {
  const out: CharacterId[] = [];
  for (const c of ROSTER) {
    const rule = c.unlockRule;
    if (!rule || p.unlocked.includes(c.id)) continue;
    if (rule.kind === 'beatWorld' && p.worldsBeaten.includes(rule.world)) out.push(c.id);
    if (rule.kind === 'allStars') {
      const onSomePath = paths.some((path) => {
        const ids = path.steps.map((s) => s.level).filter((id) => levels[id].world === rule.world && !path.steps.find((s) => s.level === id)?.when);
        return ids.length > 0 && ids.every((id) => (p.bestStars[id] ?? 0) >= 3);
      });
      if (onSomePath) out.push(c.id);
    }
  }
  return out;
}

export function isUnlocked(p: Progress, id: CharacterId): boolean {
  const spec = ROSTER.find((c) => c.id === id);
  return !!spec && (!spec.unlockRule || p.unlocked.includes(id));
}
