import { describe, expect, it } from 'vitest';
import { HYPES, type HypeId } from '../config/events';
import { LEVELS } from '../config/levels';
import { PATH_IDS, PATHS } from '../config/paths';
import { WORLD_NAMES } from '../config/worlds';
import { buildRecap, type RecapRun } from './recap';
import { buildBothTimeline, buildPathTimeline, parseWhen, pathSpan, yearOf, type PathTimeline, type TimelineEntry } from './storyTimeline';

const none = { bestStars: {} };
const paths = PATH_IDS.map((id) => PATHS[id]);
const timeline = (id: 'gpt' | 'claude', input: Parameters<typeof buildPathTimeline>[2] = none) => buildPathTimeline(PATHS[id], LEVELS, input);
/** Every entry a path tab shows, top to bottom. */
const flat = (t: PathTimeline): TimelineEntry[] => [t.origin, ...t.worlds.flatMap((w) => [...w.entries, ...(w.kart ? [w.kart] : [])])];
const row = (t: PathTimeline, level: string) => flat(t).find((e) => e.level === level && e.kind !== 'hype');
const emptyRun = (): RecapRun => ({ results: {}, hypes: {}, flags: [], perks: [], deaths: 0 });

describe('story timeline dates', () => {
  it('turns a date as written into a yyyymmdd sort key', () => {
    const table: [string, number | null][] = [
      ['Nov 30, 2022', 20221130],
      ['June 2018', 20180600],
      ['Feb 2019', 20190200],
      ['2021', 20210000],
      ['Nov 17–22, 2023', 20231117],
      ['Jun–Nov 2024', 20240600],
      ['Jun 12 – Jul 1, 2026', 20260612],
      ['2018 → 2026', 20180000],
      ['Sept 2025', 20250900],
      ['May 2025', 20250500],
      ['soon', null],
    ];
    for (const [text, at] of table) expect(parseWhen(text), text).toBe(at);
    expect(yearOf(20231117)).toBe(2023);
  });

  it('can parse every date the screen shows', () => {
    const problems: string[] = [];
    for (const id of PATH_IDS) {
      for (const e of flat(timeline(id))) if (parseWhen(e.date) === null) problems.push(`${id} ${e.key}: ${e.date}`);
    }
    expect(problems).toEqual([]);
  });

  it('gives every entry a sourced fact line, never a tip', () => {
    const problems: string[] = [];
    for (const id of PATH_IDS) {
      for (const e of flat(timeline(id))) if (!e.line || e.line.tip || !e.line.src?.length) problems.push(`${id} ${e.key}`);
    }
    expect(problems).toEqual([]);
  });
});

describe('story timeline, one path', () => {
  it('lists every step once, in play order, grouped by ascending worlds', () => {
    for (const id of PATH_IDS) {
      const t = timeline(id);
      const rows = t.worlds.flatMap((w) => w.entries).filter((e) => e.kind === 'model' || e.kind === 'storm');
      expect(rows.map((e) => e.level), id).toEqual(PATHS[id].steps.map((s) => s.level));
      const worlds = t.worlds.map((w) => w.world);
      worlds.slice(1).forEach((w, i) => expect(w, id).toBeGreaterThan(worlds[i]));
      for (const w of t.worlds) expect(w.name, `${id} world ${w.world}`).toBe(WORLD_NAMES[w.world]);
    }
    const gpt = timeline('gpt');
    expect(gpt.origin).toMatchObject({ kind: 'origin', name: 'Transformer', date: 'Jun 2017' });
    expect(gpt.worlds[0].world).toBe(1);
    const claude = timeline('claude');
    expect(claude.origin).toMatchObject({ kind: 'origin', name: 'Anthropic', date: '2021' });
    expect(claude.worlds[0].world).toBe(2);
    expect(gpt.from).toBe('Jun 2017');
    expect(gpt.to).toBe('Sep 3, 2026');
  });

  it('lists a storm level as the storm, and a castle that borrows storm gates as its model', () => {
    const gpt = timeline('gpt');
    expect(row(gpt, 'gpt-3-3')).toMatchObject({ kind: 'storm', name: 'Five Days in November', date: 'Nov 17–22, 2023' });
    expect(row(gpt, 'gpt-3-3')?.becomes).toBeUndefined();
    expect(row(gpt, 'gpt-5-2')).toMatchObject({ kind: 'storm', name: 'The DeepSeek Moment', becomes: 'o1' });
    const claude = timeline('claude');
    expect(row(claude, 'claude-5-1')).toMatchObject({ kind: 'storm', name: 'The DeepSeek Moment' });
    expect(row(claude, 'claude-5-1')?.becomes).toBeUndefined();
    expect(row(gpt, 'gpt-7-2')).toMatchObject({ kind: 'model', name: 'GPT-6 Astra', date: 'Sep 3, 2026' });
    // The rule and the content agree: a storm row's name is its level's name.
    for (const t of [gpt, claude]) for (const e of flat(t).filter((x) => x.kind === 'storm')) expect(e.name, e.key).toBe(LEVELS[e.level!].name);
  });

  it('sums a level up with its outro, or its intro when the level says so', () => {
    const gpt = timeline('gpt');
    expect(row(gpt, 'gpt-1-1')?.line).toBe(LEVELS['gpt-1-1'].outro.lines[0]);
    expect(LEVELS['gpt-4-2'].headline).toBe('intro');
    expect(row(gpt, 'gpt-4-2')).toMatchObject({ line: LEVELS['gpt-4-2'].intro.lines[0], date: 'Nov 2023' });
  });

  it('puts each hype right under its level, once per path, matching the recap', () => {
    for (const id of PATH_IDS) {
      const entries = timeline(id).worlds.flatMap((w) => w.entries);
      entries.forEach((e, i) => {
        if (e.kind !== 'hype') return;
        const before = entries[i - 1];
        expect(before.level, `${id} ${e.key}`).toBe(e.level);
        expect(LEVELS[e.level!].hypes, e.key).toContain(e.key.slice(5));
      });
      const hypes = entries.filter((e) => e.kind === 'hype').map((e) => e.key.slice(5));
      expect(new Set(hypes).size, id).toBe(hypes.length);
      expect(new Set(hypes), id).toEqual(new Set(buildRecap(emptyRun(), PATHS[id], LEVELS).hypes.map((h) => h.id)));
    }
  });

  it('keeps hype verdicts hidden until a level carrying the hype is cleared, on either path', () => {
    const verdicts = (t: PathTimeline) => Object.fromEntries(flat(t).filter((e) => e.kind === 'hype').map((e) => [e.key.slice(5), e.verdict]));
    for (const id of PATH_IDS) expect(Object.values(verdicts(timeline(id))).every((v) => v === null), id).toBe(true);
    const input = { bestStars: { 'claude-3-2': 1 } };
    expect(verdicts(timeline('gpt', input)).autogpt).toBe('passing');
    expect(verdicts(timeline('claude', input)).autogpt).toBe(HYPES.autogpt.verdict);
    expect(verdicts(timeline('gpt', input)).qstar).toBeNull();
  });

  it('counts progress over the steps every run plays', () => {
    const gpt = timeline('gpt', { bestStars: { 'gpt-1-1': 3, 'gpt-1-2': 2 } });
    expect(gpt.progress).toEqual({ cleared: 2, total: 21, stars: 5, maxStars: 63 });
    expect(row(gpt, 'gpt-1-3')?.stars).toBe(0);
    expect(row(gpt, 'gpt-1-1')?.stars).toBe(3);
    const claude = timeline('claude', { bestStars: { 'claude-5-4': 3 } });
    expect(claude.progress).toMatchObject({ total: 19, stars: 0, maxStars: 57 });
    expect(row(claude, 'claude-5-4')).toMatchObject({ stars: 3, optional: true, note: 'Only on runs that take Shadow library tokens' });
  });

  it('marks the saved run’s next level, skipping conditional steps the run cannot play', () => {
    const here = (t: PathTimeline) => flat(t).filter((e) => e.here).map((e) => e.level);
    expect(here(timeline('gpt', { bestStars: {}, run: { step: 3, flags: [] } }))).toEqual(['gpt-2-1']);
    const settlement = PATHS.claude.steps.findIndex((s) => s.level === 'claude-5-4');
    expect(here(timeline('claude', { bestStars: {}, run: { step: settlement, flags: [] } }))).toEqual(['claude-5-5']);
    expect(here(timeline('claude', { bestStars: {}, run: { step: settlement, flags: ['shadowBooks'] } }))).toEqual(['claude-5-4']);
    expect(here(timeline('gpt', { bestStars: {}, run: null }))).toEqual([]);
    expect(here(timeline('gpt', { bestStars: {}, run: { step: PATHS.gpt.steps.length, flags: [] } }))).toEqual([]);
  });

  it('adds a Benchmark Kart race after every world but the last', () => {
    const gpt = timeline('gpt');
    expect(gpt.worlds.map((w) => w.kart?.key.slice(5) ?? null)).toEqual(['kart-mmlu', 'kart-humaneval', 'kart-swebench', 'kart-arc', 'kart-hle', 'kart-glue', null]);
    expect(gpt.worlds[0].kart).toMatchObject({ kind: 'kart', name: 'MMLU Motorway', date: 'Sep 2020' });
    const claude = timeline('claude').worlds.map((w) => w.kart?.key.slice(5));
    expect(claude[0]).toBe('kart-humaneval');
    expect(claude).not.toContain('kart-mmlu');
  });

  it('spans each world’s years over its model and storm rows', () => {
    const gpt = timeline('gpt').worlds;
    expect(gpt[0].years).toBe('2018–2020');
    expect(gpt.find((w) => w.world === 7)?.years).toBe('2026');
    expect(timeline('claude').worlds.find((w) => w.world === 6)?.years).toBe('2025–2026');
  });

  it('sums a path up for the title screen from config', () => {
    expect(pathSpan(PATHS.gpt, LEVELS)).toBe('Transformer (2017) → GPT-6 Astra (2026)');
    expect(pathSpan(PATHS.claude, LEVELS)).toBe('Anthropic (2021) → Claude Opus 5.5 (2026)');
  });
});

describe('story timeline, both brothers', () => {
  const years = buildBothTimeline(paths, LEVELS, {});
  const all = years.flatMap((y) => y.entries);

  it('sorts all history by date, grouped by ascending year', () => {
    all.slice(1).forEach((e, i) => expect(e.at, e.key).toBeGreaterThanOrEqual(all[i].at));
    years.slice(1).forEach((y, i) => expect(y.year).toBeGreaterThan(years[i].year));
    for (const y of years) for (const e of y.entries) expect(yearOf(e.at), e.key).toBe(y.year);
    expect(all[0].key).toBe('origin:gpt');
    expect(all.at(-1)).toMatchObject({ kind: 'model', name: 'Claude Opus 5.5' });
  });

  it('shows shared history once, with both brothers, and no karts', () => {
    expect(all.some((e) => e.kind === 'kart')).toBe(false);
    expect(all.filter((e) => e.key === 'storm:deepseek')).toEqual([expect.objectContaining({ paths: ['gpt', 'claude'] })]);
    const shared: HypeId[] = ['autogpt', 'gadgets', 'reasoning', 'vibeCoding', 'moltbook'];
    for (const id of shared) expect(all.filter((e) => e.key === `hype:${id}`).map((e) => e.paths), id).toEqual([['gpt', 'claude']]);
    expect(new Set(all.map((e) => e.key)).size).toBe(all.length);
  });

  it('never puts a hype ahead of its own level when they share a month, on either path', () => {
    const month = (at: number) => Math.floor(at / 100);
    const at = (key: string) => {
      const i = all.findIndex((e) => e.key === key);
      expect(i, key).toBeGreaterThanOrEqual(0);
      return i;
    };
    let checked = 0;
    for (const id of PATH_IDS) {
      const t = timeline(id);
      for (const h of flat(t).filter((e) => e.kind === 'hype')) {
        const level = row(t, h.level!)!;
        if (month(parseWhen(h.date)!) !== month(level.at)) continue;
        checked++;
        expect(at(h.key), `${id} ${h.key} after ${level.key}`).toBeGreaterThan(at(level.key));
      }
    }
    expect(checked).toBeGreaterThanOrEqual(3);
    const after = (hype: string, key: string) => at(hype) - at(key);
    expect(after('hype:qstar', 'storm:boardCrisis')).toBeGreaterThan(0);
    expect(after('hype:reasoning', 'model:gpt-5-1')).toBeGreaterThan(0);
    expect(after('hype:agentTeams', 'model:claude-6-2')).toBeGreaterThan(0);
  });

  it('puts same-day releases side by side, GPT first', () => {
    const i = all.findIndex((e) => e.key === 'model:gpt-3-2');
    expect(all[i]).toMatchObject({ name: 'GPT-4', date: 'Mar 14, 2023' });
    expect(all[i + 1]).toMatchObject({ key: 'model:claude-2-2', name: 'Claude', date: 'Mar 14, 2023' });
  });

  it('is history, not a run', () => {
    for (const e of all) {
      for (const field of ['stars', 'here', 'becomes', 'note', 'optional'] as const) expect(e[field], `${e.key} ${field}`).toBeUndefined();
    }
    const revealed = buildBothTimeline(paths, LEVELS, { 'gpt-3-2': 2 }).flatMap((y) => y.entries);
    expect(revealed.find((e) => e.key === 'hype:autogpt')?.verdict).toBe('passing');
  });
});
