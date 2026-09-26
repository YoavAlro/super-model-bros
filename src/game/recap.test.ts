import { describe, expect, it } from 'vitest';
import { HYPES } from '../config/events';
import { LEVELS } from '../config/levels';
import { PATHS } from '../config/paths';
import { RECAP_RANKS } from '../config/recap';
import { buildRecap, playedSteps, rankFor, type RecapRun } from './recap';

const emptyRun = (): RecapRun => ({ results: {}, hypes: {}, flags: [], perks: [], deaths: 0 });

describe('finale recap', () => {
  it('lists the levels the run went through, skipping untriggered storms', () => {
    const claude = PATHS.claude;
    expect(playedSteps(claude, [])).not.toContain('claude-5-4');
    expect(playedSteps(claude, ['shadowBooks'])).toContain('claude-5-4');
    expect(playedSteps(PATHS.gpt, []).length).toBe(PATHS.gpt.steps.length);
  });

  it('compares each level with the real model and date', () => {
    const r = buildRecap(emptyRun(), PATHS.gpt, LEVELS);
    const first = r.levels[0];
    expect(first).toMatchObject({ id: 'gpt-1-1', model: 'GPT-1', stars: 0 });
    expect(first.date).toMatch(/2018/);
    // Storm levels show the storm, not a repeated model name.
    expect(r.levels.find((l) => l.id === 'gpt-3-3')?.model).toBe(LEVELS['gpt-3-3'].name);
    // Even one that changes your form: Jan 27, 2025 is the DeepSeek shock, not o1's release.
    expect(r.levels.find((l) => l.id === 'gpt-5-2')).toMatchObject({ model: 'The DeepSeek Moment', date: 'Jan 27, 2025' });
    expect(r.levels.at(-1)?.model).toBe('GPT-6 Astra');
  });

  it('adds up history stars against the maximum', () => {
    const run = emptyRun();
    run.results = { 'gpt-1-1': { stars: 3 }, 'gpt-1-2': { stars: 2 } };
    const r = buildRecap(run, PATHS.gpt, LEVELS);
    expect(r.stars).toEqual({ got: 5, max: PATHS.gpt.steps.length * 3 });
  });

  it('scores hype calls against history, counting hypes you never grabbed as missed', () => {
    const run = emptyRun();
    run.hypes = { autogpt: { call: 'passing', correct: true }, qstar: { call: 'lasting', correct: false } };
    const r = buildRecap(run, PATHS.gpt, LEVELS);
    const onPath = new Set(PATHS.gpt.steps.flatMap((s) => LEVELS[s.level].hypes ?? []));
    expect(r.calls).toEqual({ right: 1, made: 2, total: onPath.size });
    expect(r.hypes.find((h) => h.id === 'qstar')).toMatchObject({ call: 'lasting', verdict: HYPES.qstar.verdict });
    expect(r.hypes.find((h) => h.id === 'moltbook')?.call).toBeNull();
  });

  it('ranks a perfect run first and an empty one last', () => {
    const perfect = emptyRun();
    for (const id of playedSteps(PATHS.claude, [])) perfect.results[id] = { stars: 3 };
    for (const h of Object.values(HYPES)) perfect.hypes[h.id] = { call: h.verdict, correct: true };
    const best = buildRecap(perfect, PATHS.claude, LEVELS);
    expect(best.score).toBeCloseTo(1);
    expect(best.rank).toBe(RECAP_RANKS[0]);
    expect(buildRecap(emptyRun(), PATHS.claude, LEVELS).rank).toBe(RECAP_RANKS.at(-1));
    expect(rankFor(0.5).title).toBe('Research intern');
  });

  it('lists a Benchmark Kart race after every world but the last', () => {
    const gpt = buildRecap({ ...emptyRun(), karts: { 'kart-mmlu': 1, 'kart-arc': 3 } }, PATHS.gpt, LEVELS);
    expect(gpt.karts.map((k) => k.id)).toEqual(['kart-mmlu', 'kart-humaneval', 'kart-swebench', 'kart-arc', 'kart-hle', 'kart-glue']);
    expect(gpt.karts.find((k) => k.id === 'kart-arc')?.place).toBe(3);
    expect(gpt.karts.find((k) => k.id === 'kart-hle')?.place).toBeNull();
    // The Claude path starts in World 2, so it skips the first race.
    expect(buildRecap(emptyRun(), PATHS.claude, LEVELS).karts.map((k) => k.id)).not.toContain('kart-mmlu');
  });

  it('ends both paths at a World 7 finale with a boss', () => {
    for (const path of Object.values(PATHS)) {
      const last = LEVELS[path.steps.at(-1)!.level];
      expect(last.world, path.id).toBe(7);
      expect(last.boss, path.id).toBe('paperclip');
    }
    expect(LEVELS[PATHS.gpt.steps.at(-1)!.level].toward.name).toBe('GPT-6 Astra');
    expect(LEVELS[PATHS.claude.steps.at(-1)!.level].toward.name).toBe('Claude Opus 5.5');
  });
});
