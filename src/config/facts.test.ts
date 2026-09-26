import { describe, expect, it } from 'vitest';
import { HYPES, MOMENTS } from './events';
import { ALL_LEVELS } from './levels';
import { PATHS } from './paths';
import { SOURCES } from './sources';
import type { FactCard } from './types';

/** Every fact card that ships, with where it lives. */
export function allCards(): { where: string; card: FactCard }[] {
  const cards: { where: string; card: FactCard }[] = [];
  for (const l of ALL_LEVELS) cards.push({ where: `${l.id} intro`, card: l.intro }, { where: `${l.id} outro`, card: l.outro });
  for (const p of Object.values(PATHS)) if (p.prologue) cards.push({ where: `${p.id} prologue`, card: p.prologue });
  for (const h of Object.values(HYPES)) cards.push({ where: `hype ${h.id}`, card: { title: h.name, date: h.when, lines: h.lines } });
  for (const m of Object.values(MOMENTS)) cards.push({ where: `moment ${m.id}`, card: { title: m.name, date: '', lines: [m.fact] } });
  return cards;
}

describe('fact cards', () => {
  const cards = allCards();

  it('cite a known source on every fact line (tips need none)', () => {
    const problems: string[] = [];
    for (const { where, card } of cards) {
      for (const line of card.lines) {
        if (line.tip) continue;
        if (!line.src?.length) problems.push(`${where}: no source for "${line.text}"`);
        for (const id of line.src ?? []) if (!SOURCES[id]) problems.push(`${where}: unknown source "${id}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('use https sources with a title and publisher', () => {
    for (const [id, s] of Object.entries(SOURCES)) {
      expect(s.url, id).toMatch(/^https:\/\//);
      expect(s.title.length, id).toBeGreaterThan(2);
      expect(s.publisher.length, id).toBeGreaterThan(1);
    }
  });

  it('never put words in a real person’s mouth outside a sourced line', () => {
    for (const { where, card } of cards) {
      for (const line of card.lines) if (line.tip) expect(line.text, where).not.toMatch(/[“"].+[”"].*(said|wrote|posted|called)/);
    }
  });
});
