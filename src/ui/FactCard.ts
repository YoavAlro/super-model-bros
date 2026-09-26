import { DATA_TYPES, type DataTypeId } from '../config/dataTypes';
import type { FactCard, Mix } from '../config/types';
import { el, hex, pct } from './dom';

export interface FactCardOptions {
  card: FactCard;
  color: number;
  /** When set, shows the player's diet against the real training mix. */
  diet?: { mine: Record<DataTypeId, number>; real: Mix };
  button?: string;
}

/** Modal history card. Resolves when the player continues. */
export function showFactCard(parent: HTMLElement, opts: FactCardOptions): Promise<void> {
  return new Promise((resolve) => {
    const backdrop = el('div', 'modal-backdrop');
    const modal = el('div', 'panel modal');
    modal.style.borderColor = hex(opts.color);

    const title = el('h2', undefined, opts.card.title);
    title.style.color = hex(opts.color);
    const list = el('ul');
    for (const line of opts.card.lines) list.append(el('li', undefined, line));
    modal.append(el('div', 'modal-date', opts.card.date), title, list);

    if (opts.diet) {
      const table = el('div', 'diet-compare');
      table.append(el('div', 'diet-compare-title', 'Your diet vs the real training mix'));
      const ids = Object.keys(opts.diet.real) as DataTypeId[];
      for (const id of ids) {
        const row = el('div', undefined, `${DATA_TYPES[id].label}: ${pct(opts.diet.mine[id])} vs ${pct(opts.diet.real[id] ?? 0)}`);
        row.style.color = hex(DATA_TYPES[id].color);
        table.append(row);
      }
      modal.append(table);
    }

    const button = el('button', 'btn primary', opts.button ?? 'Continue');
    button.addEventListener('click', () => {
      backdrop.remove();
      resolve();
    });
    modal.append(button);
    backdrop.append(modal);
    parent.append(backdrop);
    button.focus();
  });
}
