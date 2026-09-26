import { DATA_TYPES, type DataTypeId } from '../config/dataTypes';
import { SOURCES } from '../config/sources';
import type { FactCard, Mix } from '../config/types';
import { sfx } from '../game/sfx';
import { el, hex, pct } from './dom';

export interface CardButton<T> {
  label: string;
  value: T;
  primary?: boolean;
}

export interface FactCardOptions<T = void> {
  card: FactCard;
  color: number;
  /** When set, shows the player's diet against the target mix. */
  diet?: { mine: Record<DataTypeId, number>; real: Mix; kind: 'published' | 'focus' };
  /** One button by default ("Continue"); several make the card a choice. */
  button?: string;
  buttons?: CardButton<T>[];
  /** Extra content shown under the lines. */
  extra?: HTMLElement;
}

/**
 * Modal history card. Fact lines carry numbered source links; tips are marked as tips.
 * Resolves with the chosen button's value when the player continues.
 */
export function showFactCard<T = void>(parent: HTMLElement, opts: FactCardOptions<T>): Promise<T> {
  return new Promise((resolve) => {
    const backdrop = el('div', 'modal-backdrop');
    const modal = el('div', 'panel modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.borderColor = hex(opts.color);

    const title = el('h2', undefined, opts.card.title);
    title.style.color = hex(opts.color);
    modal.setAttribute('aria-label', opts.card.title);
    const list = el('ul');
    const cited: string[] = [];
    for (const line of opts.card.lines) {
      const li = el('li', line.tip ? 'tip' : undefined, line.text);
      for (const id of line.src ?? []) {
        if (!cited.includes(id)) cited.push(id);
        const sup = el('sup');
        const a = el('a', 'cite', `${cited.indexOf(id) + 1}`);
        a.href = SOURCES[id]?.url ?? '#';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = SOURCES[id] ? `${SOURCES[id].title} · ${SOURCES[id].publisher}` : id;
        sup.append(a);
        li.append(sup);
      }
      list.append(li);
    }
    modal.append(el('div', 'modal-date', opts.card.date), title, list);
    if (opts.extra) modal.append(opts.extra);

    if (opts.diet) {
      const table = el('div', 'diet-compare');
      table.append(el('div', 'diet-compare-title', opts.diet.kind === 'published' ? 'Your mix vs the real training mix' : 'Your mix vs the key ingredients'));
      const ids = Object.keys(opts.diet.real) as DataTypeId[];
      for (const id of ids) {
        const row = el('div', undefined, `${DATA_TYPES[id].glyph} ${DATA_TYPES[id].label}: ${pct(opts.diet.mine[id])} vs ${pct(opts.diet.real[id] ?? 0)}`);
        row.style.color = hex(DATA_TYPES[id].color);
        table.append(row);
      }
      modal.append(table);
    }

    if (cited.length) {
      const sources = el('ol', 'sources');
      for (const id of cited) {
        const s = SOURCES[id];
        const li = el('li');
        const a = el('a', undefined, s ? `${s.title}` : id);
        a.href = s?.url ?? '#';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        li.append(a, document.createTextNode(s ? ` · ${s.publisher}` : ''));
        sources.append(li);
      }
      const details = el('details', 'sources-box');
      details.append(el('summary', undefined, `Sources (${cited.length})`), sources);
      modal.append(details);
    }

    const buttons: CardButton<T>[] = opts.buttons ?? [{ label: opts.button ?? 'Continue', value: undefined as T, primary: true }];
    const row = el('div', 'card-buttons');
    const nodes = buttons.map((b) => {
      const node = el('button', b.primary ? 'btn primary' : 'btn', b.label);
      node.addEventListener('click', () => {
        backdrop.remove();
        resolve(b.value);
      });
      row.append(node);
      return node;
    });
    modal.append(row);
    backdrop.append(modal);
    parent.append(backdrop);
    sfx.card();
    // A key still held from gameplay (auto-repeat, or pressed as the card opened) must not skip the card.
    const opened = performance.now();
    backdrop.addEventListener(
      'keydown',
      (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && (e.repeat || performance.now() - opened < 400)) e.preventDefault();
      },
      true,
    );
    // Keyboard: arrows move between buttons; Enter/Space press the focused one.
    backdrop.addEventListener('keydown', (e) => {
      const i = nodes.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nodes[(i + 1) % nodes.length].focus();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nodes[(i - 1 + nodes.length) % nodes.length].focus();
      else return;
      e.preventDefault();
    });
    (nodes.find((_, i) => buttons[i].primary) ?? nodes[0]).focus({ preventScroll: true });
    modal.scrollTop = 0;
  });
}
