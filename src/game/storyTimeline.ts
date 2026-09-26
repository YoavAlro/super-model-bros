import { HYPES, STORMS, type HypeId } from '../config/events';
import { KARTS } from '../config/karts';
import type { LevelSpec } from '../config/levelSpec';
import type { PathId, PathSpec } from '../config/paths';
import type { FactLine } from '../config/types';
import { WORLD_NAMES } from '../config/worlds';
import { formBefore, nextStep } from './progress';
import { isStormRow } from './recap';

/**
 * Pure story timeline: both paths as history, by world (in play order) and by date, with the player's
 * best stars and a "you are here" marker. No DOM. The view is `src/ui/StoryTimeline.ts`.
 */

export type EntryKind = 'origin' | 'model' | 'storm' | 'hype' | 'kart';

export interface TimelineEntry {
  kind: EntryKind;
  /** 'origin:gpt' | 'model:<levelId>' | 'storm:<stormId>' | 'hype:<hypeId>' | 'kart:<kartId>' */
  key: string;
  /** The level label ('3-3') on model and storm rows, else ''. */
  label: string;
  name: string;
  /** Exactly as written in config. */
  date: string;
  /** Sort key from `parseWhen(date)`, 0 if it does not parse. */
  at: number;
  /** The first sourced fact line (the content tests forbid null). */
  line: FactLine | null;
  paths: PathId[];
  /** Model and storm rows: their level. Hypes: the level whose `$` block holds it. */
  level?: string;
  /** A storm row whose level changes your form (gpt-5-2 → 'o1'). */
  becomes?: string;
  /** `PathStep.note`. */
  note?: string;
  /** The step is conditional (`PathStep.when`): it is real history, but only some runs play it. */
  optional?: boolean;
  /** Path tabs only: the best history stars for the level, 0 if not cleared. */
  stars?: number;
  /** Hypes: history's verdict, or null until a level carrying the hype is cleared. */
  verdict?: 'lasting' | 'passing' | null;
  /** The saved run's next level (during play, the current one). */
  here?: boolean;
}

export interface TimelineWorld {
  world: number;
  name: string;
  /** '2018–2020', or '2026' when the world's rows share a year. */
  years: string;
  /** The world's model and storm rows, each followed by its hypes. */
  entries: TimelineEntry[];
  /** The Benchmark Kart race after this world (none after the path's last). */
  kart: TimelineEntry | null;
}

export interface PathTimeline {
  path: PathId;
  origin: TimelineEntry;
  worlds: TimelineWorld[];
  from: string;
  to: string;
  /** Over the steps every run plays (conditional steps are left out). */
  progress: { cleared: number; total: number; stars: number; maxStars: number };
}

export interface TimelineInput {
  bestStars: Record<string, number>;
  run?: { step: number; flags: readonly string[] } | null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s+(\d{1,2})\b)?/i;

/**
 * A sort key, yyyymmdd, for a date as the content writes it, with 00 for a missing month or day:
 * 'Nov 30, 2022' → 20221130, 'June 2018' → 20180600, '2021' → 20210000. The year is the first 4-digit
 * number, the month the first month word, and the day a number right after it. A range sorts by its
 * start ('Nov 17–22, 2023' → 20231117, 'Jun–Nov 2024' → 20240600), so a range that crosses a year must
 * write both years ('2018 → 2026'). Returns null when there is no year.
 */
export function parseWhen(text: string): number | null {
  const year = /\b(\d{4})\b/.exec(text);
  if (!year) return null;
  const month = MONTH_RE.exec(text);
  const m = month ? MONTHS[month[1].slice(0, 3).toLowerCase()] : 0;
  const d = month?.[2] ? Number(month[2]) : 0;
  return Number(year[1]) * 10000 + m * 100 + d;
}

export const yearOf = (at: number) => Math.floor(at / 10000);

const firstFact = (lines: readonly FactLine[]): FactLine | null => lines.find((l) => !l.tip && !!l.src?.length) ?? null;
const firstSegment = (date: string) => date.split(' · ')[0];
const lastSegment = (date: string) => date.split(' · ').at(-1) ?? date;

function entry(kind: EntryKind, key: string, name: string, date: string, line: FactLine | null, path: PathId, extra: Partial<TimelineEntry> = {}): TimelineEntry {
  return { kind, key, label: '', name, date, at: parseWhen(date) ?? 0, line, paths: [path], ...extra };
}

function originEntry(path: PathSpec): TimelineEntry {
  return entry('origin', `origin:${path.id}`, path.origin.name, path.origin.date, path.origin.line, path.id);
}

/** The model or storm row for step `i`, without progress. */
function stepEntry(path: PathSpec, i: number, levels: Record<string, LevelSpec>): TimelineEntry {
  const step = path.steps[i];
  const l = levels[step.level];
  const extra: Partial<TimelineEntry> = { label: l.label, level: l.id };
  if (step.note) extra.note = step.note;
  if (step.when) extra.optional = true;
  if (isStormRow(l)) {
    const form = formBefore(path, i, [], levels);
    if (l.toward.name !== form) extra.becomes = l.toward.name;
    return entry('storm', `storm:${l.storm}`, STORMS[l.storm!].name, firstSegment(l.intro.date), firstFact(l.intro.lines) ?? firstFact(l.outro.lines), path.id, extra);
  }
  const headline = l.headline ?? 'outro';
  const line = firstFact(l[headline].lines) ?? firstFact(l[headline === 'intro' ? 'outro' : 'intro'].lines);
  return entry('model', `model:${l.id}`, l.toward.name, firstSegment(l.outro.date), line, path.id, extra);
}

/** A hype is revealed once any level carrying it (on either path) has been cleared. */
function verdictFor(id: HypeId, levels: Record<string, LevelSpec>, bestStars: Record<string, number>): 'lasting' | 'passing' | null {
  const met = Object.values(levels).some((l) => l.hypes?.includes(id) && (bestStars[l.id] ?? 0) >= 1);
  return met ? HYPES[id].verdict : null;
}

export function buildPathTimeline(path: PathSpec, levels: Record<string, LevelSpec>, input: TimelineInput): PathTimeline {
  const { bestStars, run } = input;
  const hereIndex = run ? nextStep(path, run.step, run.flags) : -1;
  const worlds: TimelineWorld[] = [];
  const seenHypes = new Set<HypeId>();
  const progress = { cleared: 0, total: 0, stars: 0, maxStars: 0 };
  let last: TimelineEntry | null = null;

  for (let i = 0; i < path.steps.length; i++) {
    const step = path.steps[i];
    const l = levels[step.level];
    const row = stepEntry(path, i, levels);
    const stars = bestStars[l.id] ?? 0;
    row.stars = stars;
    if (i === hereIndex) row.here = true;
    if (!step.when) {
      progress.total++;
      progress.stars += stars;
      if (stars >= 1) progress.cleared++;
    }
    if (worlds.at(-1)?.world !== l.world) worlds.push({ world: l.world, name: WORLD_NAMES[l.world] ?? '', years: '', entries: [], kart: null });
    const world = worlds.at(-1)!;
    world.entries.push(row);
    for (const id of l.hypes ?? []) {
      if (seenHypes.has(id)) continue;
      seenHypes.add(id);
      const h = HYPES[id];
      world.entries.push(entry('hype', `hype:${id}`, h.name, h.when, firstFact(h.lines), path.id, { level: l.id, verdict: verdictFor(id, levels, bestStars) }));
    }
    last = row;
  }
  progress.maxStars = progress.total * 3;

  worlds.forEach((w, i) => {
    const years = w.entries.filter((e) => e.kind !== 'hype').map((e) => yearOf(e.at));
    const lo = Math.min(...years);
    const hi = Math.max(...years);
    w.years = lo === hi ? `${lo}` : `${lo}–${hi}`;
    // A race runs after every world on the path except the last (the recap's rule).
    const k = i < worlds.length - 1 ? KARTS.find((kart) => kart.afterWorld === w.world) : undefined;
    if (k) w.kart = entry('kart', `kart:${k.id}`, k.name, lastSegment(k.intro.date), firstFact(k.intro.lines), path.id);
  });

  const origin = originEntry(path);
  return { path: path.id, origin, worlds, from: origin.date, to: last?.date ?? origin.date, progress };
}

const KIND_RANK: Record<EntryKind, number> = { origin: 0, model: 1, storm: 2, hype: 3, kart: 4 };
/** What a path tab adds about a run; the Both view is history only. */
const RUN_FIELDS = ['stars', 'here', 'becomes', 'note', 'optional'] as const;

/**
 * Both paths as one history, strictly by date and grouped by year. Entries both paths share (the
 * DeepSeek storm, several hypes) appear once, with both path ids. Karts are left out (they are races
 * between worlds, not events), and so is everything about a run (stars, the marker, form changes).
 */
export function buildBothTimeline(
  paths: readonly PathSpec[],
  levels: Record<string, LevelSpec>,
  bestStars: Record<string, number>,
): { year: number; entries: TimelineEntry[] }[] {
  const merged = new Map<string, { entry: TimelineEntry; pathRank: number; index: number }>();
  paths.forEach((path, pathRank) => {
    const t = buildPathTimeline(path, levels, { bestStars, run: null });
    for (const e of [t.origin, ...t.worlds.flatMap((w) => w.entries)]) {
      const seen = merged.get(e.key);
      if (seen) {
        if (!seen.entry.paths.includes(path.id)) seen.entry.paths.push(path.id);
        continue;
      }
      const history: TimelineEntry = { ...e, paths: [...e.paths] };
      for (const run of RUN_FIELDS) delete history[run];
      merged.set(e.key, { entry: history, pathRank, index: merged.size });
    }
  });
  const sorted = [...merged.values()].sort(
    (a, b) => a.entry.at - b.entry.at || KIND_RANK[a.entry.kind] - KIND_RANK[b.entry.kind] || a.pathRank - b.pathRank || a.index - b.index,
  );
  const years: { year: number; entries: TimelineEntry[] }[] = [];
  for (const { entry: e } of sorted) {
    const year = yearOf(e.at);
    if (years.at(-1)?.year !== year) years.push({ year, entries: [] });
    years.at(-1)!.entries.push(e);
  }
  return years;
}

/** The title screen's one-line summary of a path: 'Transformer (2017) → GPT-6 Astra (2026)'. */
export function pathSpan(path: PathSpec, levels: Record<string, LevelSpec>): string {
  const start = originEntry(path);
  const end = stepEntry(path, path.steps.length - 1, levels);
  return `${start.name} (${yearOf(start.at)}) → ${end.name} (${yearOf(end.at)})`;
}
