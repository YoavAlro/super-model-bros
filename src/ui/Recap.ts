import type { Recap } from '../game/recap';
import { el } from './dom';

const stars = (n: number) => (n ? '★'.repeat(n) + '☆'.repeat(3 - n) : '—');

/** The finale recap table, shown inside the last fact card: your run next to real history. */
export function recapTable(recap: Recap): HTMLElement {
  const box = el('div', 'recap');
  box.append(el('div', 'diet-compare-title', 'Your run vs the real timeline'));
  const levels = el('div', 'recap-grid');
  for (const l of recap.levels) {
    levels.append(el('span', 'recap-label', l.label), el('span', undefined, l.model), el('span', 'recap-date', l.date), el('span', 'recap-stars', stars(l.stars)));
  }
  box.append(levels);
  if (recap.hypes.length) {
    box.append(el('div', 'diet-compare-title', 'Hype or shift? Your calls vs history'));
    const hypes = el('div', 'recap-grid');
    for (const h of recap.hypes) {
      const mark = h.call === null ? '·' : h.call === h.verdict ? '✓' : '✗';
      const cell = el('span', h.call === null ? 'recap-date' : h.call === h.verdict ? 'recap-right' : 'recap-wrong', mark);
      hypes.append(cell, el('span', undefined, `${h.name} · ${h.when}`), el('span', 'recap-date', h.call ? `you: ${h.call}` : 'not grabbed'), el('span', 'recap-stars', h.verdict));
    }
    box.append(hypes);
  }
  if (recap.karts.length) {
    box.append(el('div', 'diet-compare-title', 'Benchmark Kart'));
    const karts = el('div', 'recap-grid');
    for (const k of recap.karts) {
      const place = k.place === null ? 'skipped' : ['1st', '2nd', '3rd', '4th'][k.place - 1] ?? `${k.place}th`;
      karts.append(el('span', 'recap-label', k.place === 1 ? '🏁' : '·'), el('span', undefined, k.name), el('span', 'recap-date', ''), el('span', 'recap-stars', place));
    }
    box.append(karts);
  }
  return box;
}
