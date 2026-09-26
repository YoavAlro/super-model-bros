import { CHARACTERS } from '../config/characters';
import { HYPES, type HypeId } from '../config/events';
import { LEVELS } from '../config/levels';
import { PATH_IDS, PATHS, type PathId } from '../config/paths';
import type { Progress } from '../game/progress';
import { buildBothTimeline, buildPathTimeline, type TimelineEntry } from '../game/storyTimeline';
import type { SaveData } from '../save';
import { el, hex, stars } from './dom';
import { blockHeldKeys, factLineItem, sourcesBox } from './FactCard';

export type TimelineTab = PathId | 'both';

export interface StoryTimelineOptions {
  /** The tab it opens on. */
  tab: TimelineTab;
  progress: Pick<Progress, 'bestStars'>;
  /** Saved runs, for the "you are here" marker. */
  runs: SaveData['runs'];
}

const TABS: { id: TimelineTab; label: string }[] = [...PATH_IDS.map((id) => ({ id, label: PATHS[id].name })), { id: 'both', label: 'Both brothers' }];
const VERDICTS = {
  lasting: { cell: 'lasting shift', css: 'tl-lasting', say: 'History’s verdict: a lasting shift.' },
  passing: { cell: 'passing hype', css: 'tl-passing', say: 'History’s verdict: passing hype.' },
};
/** Rows moved by PageUp / PageDown. */
const PAGE = 6;

interface Row {
  li: HTMLLIElement;
  details: HTMLDetailsElement;
  summary: HTMLElement;
  more: HTMLElement;
}

/**
 * The story timeline: both brothers' stories by world (in play order) and by date, with your best
 * stars and where your saved run is. A modal over the title screen or the pause menu; resolves when it
 * closes, and gives focus back to whatever opened it.
 */
export function showStoryTimeline(parent: HTMLElement, opts: StoryTimelineOptions): Promise<void> {
  return new Promise((resolve) => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backdrop = el('div', 'modal-backdrop tl-backdrop');
    // Focusable, so a click on an empty spot keeps focus (and keys) inside the modal.
    backdrop.tabIndex = -1;
    const modal = el('div', 'panel modal timeline');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'tl-title');

    const head = el('div', 'tl-head');
    const top = el('div', 'tl-top');
    const title = el('h2', undefined, 'Story timeline');
    title.id = 'tl-title';
    const span = el('span', 'modal-date tl-span');
    top.append(title, span);
    const tablist = el('div', 'tl-tabs');
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', 'Story');
    const tabButtons = TABS.map((t) => {
      const b = el('button', 'btn toggle', t.label);
      b.id = `tl-tab-${t.id}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'tl-list');
      b.addEventListener('click', () => show(t.id, 'tab'));
      tablist.append(b);
      return b;
    });
    const summary = el('div', 'tl-summary');
    const close = el('button', 'btn tl-close', '✕');
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => finish());
    head.append(top, tablist, summary, close);

    const list = el('ol', 'tl-list');
    list.id = 'tl-list';
    list.setAttribute('role', 'tabpanel');
    modal.append(head, list);
    backdrop.append(modal);
    parent.append(backdrop);

    let tab = opts.tab;
    let rows: Row[] = [];
    let current = 0;

    /** Renders a tab and centres its "you are here" row (or its first row); `focus` says what gets focus. */
    function show(next: TimelineTab, focus: 'row' | 'tab'): void {
      tab = next;
      tabButtons.forEach((b, i) => {
        const on = TABS[i].id === tab;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', String(on));
      });
      list.setAttribute('aria-labelledby', `tl-tab-${tab}`);
      modal.style.setProperty('--tl-color', tab === 'both' ? 'var(--accent)' : hex(CHARACTERS[PATHS[tab].hero].color));
      rows = [];
      list.replaceChildren();
      if (tab === 'both') renderBoth();
      else renderPath(tab);
      const here = rows.findIndex((r) => r.li.classList.contains('here'));
      setCurrent(Math.max(0, here));
      const row = rows[current];
      list.scrollTop = row ? row.summary.offsetTop + row.summary.offsetHeight / 2 - list.clientHeight / 2 : 0;
      if (focus === 'row') row?.summary.focus({ preventScroll: true });
      else tabButtons[TABS.findIndex((t) => t.id === tab)].focus({ preventScroll: true });
    }

    function renderPath(id: PathId): void {
      const run = opts.runs[id];
      const t = buildPathTimeline(PATHS[id], LEVELS, { bestStars: opts.progress.bestStars, run: run ? { step: run.step, flags: run.flags } : null });
      span.textContent = `${t.from} → ${t.to}`;
      const p = t.progress;
      summary.textContent = `★ ${p.stars} of ${p.maxStars} · ${p.cleared} of ${p.total} cleared`;
      list.append(item(t.origin, false));
      for (const w of t.worlds) {
        const ol = group(`World ${w.world} · ${w.name} · ${w.years}`);
        for (const e of w.entries) ol.append(item(e, false));
        if (w.kart) ol.append(item(w.kart, false));
      }
    }

    function renderBoth(): void {
      const years = buildBothTimeline(
        PATH_IDS.map((id) => PATHS[id]),
        LEVELS,
        opts.progress.bestStars,
      );
      const all = years.flatMap((y) => y.entries);
      span.textContent = `${all[0]?.date ?? ''} → ${all.at(-1)?.date ?? ''}`;
      summary.textContent = '';
      for (const y of years) {
        const ol = group(`${y.year}`);
        for (const e of y.entries) ol.append(item(e, true));
      }
    }

    /** A world or year: a sticky header (never focusable) over its own rows, so the next header pushes it away. */
    function group(text: string): HTMLOListElement {
      const li = el('li', 'tl-group');
      const ol = el('ol', 'tl-rows');
      li.append(el('div', 'tl-world', text), ol);
      list.append(li);
      return ol;
    }

    function item(e: TimelineEntry, both: boolean): HTMLLIElement {
      const li = el('li', `tl-item kind-${e.kind}`);
      li.dataset.key = e.key;
      if (e.level) li.dataset.level = e.level;
      const details = el('details');
      const sum = el('summary');
      const grid = el('div', 'tl-row');

      const label = el('span', 'tl-label recap-label');
      if (both) label.append(dots(e.paths));
      else label.textContent = e.kind === 'origin' ? 'Start' : e.kind === 'kart' ? '🏁' : e.label;

      const name = el('span', 'tl-name');
      if (e.kind === 'hype') {
        const dot = el('span', 'tl-dot');
        dot.style.background = hex(HYPES[e.key.slice('hype:'.length) as HypeId].color);
        name.append(dot);
      }
      name.append(el('span', 'tl-name-text', e.kind === 'kart' ? `Benchmark Kart · ${e.name}` : e.name));
      if (e.optional) name.append(el('span', 'tl-tag', 'optional'));
      if (e.here) {
        li.classList.add('here');
        sum.setAttribute('aria-current', 'step');
        name.append(el('span', 'tl-tag tl-here-tag', '▶ You are here'));
      }

      const date = el('span', 'tl-date recap-date', e.date);
      const line = el('span', 'tl-line', e.line?.text ?? '');
      grid.append(label, name, date, stat(e, both), line);
      sum.append(grid);

      const more = el('div', 'tl-more');
      const cited: string[] = [];
      if (e.line) {
        const facts = el('ul', 'tl-fact');
        facts.append(factLineItem(e.line, cited));
        more.append(facts);
      }
      const extra = extraLine(e, both);
      if (extra) more.append(el('p', 'tl-extra', extra));
      if (cited.length) more.append(sourcesBox(cited));
      // Links in a closed row stay out of the tab order.
      const inner = () => [...more.querySelectorAll<HTMLElement>('a, summary')];
      for (const n of inner()) n.tabIndex = -1;
      details.addEventListener('toggle', () => {
        for (const n of inner()) n.tabIndex = details.open ? 0 : -1;
        if (details.open) revealOpened(li, sum);
      });

      details.append(sum, more);
      li.append(details);
      sum.tabIndex = -1;
      rows.push({ li, details, summary: sum, more });
      return li;
    }

    function stat(e: TimelineEntry, both: boolean): HTMLElement {
      const cell = el('span', 'tl-stat');
      if (e.kind === 'hype') {
        const v = e.verdict ? VERDICTS[e.verdict] : null;
        cell.textContent = v ? v.cell : 'hype or shift?';
        cell.classList.add(v ? v.css : 'tl-unknown');
      } else if (!both && (e.kind === 'model' || e.kind === 'storm')) {
        const n = e.stars ?? 0;
        cell.textContent = stars(n);
        cell.classList.add(n ? 'recap-stars' : 'tl-none');
        cell.setAttribute('role', 'img');
        cell.setAttribute('aria-label', n ? `${n} of 3 history stars` : 'not cleared yet');
      }
      return cell;
    }

    function extraLine(e: TimelineEntry, both: boolean): string | null {
      if (e.note) return e.note;
      if (e.becomes) return `→ You come out of this storm as ${e.becomes}.`;
      if (e.kind !== 'hype') return null;
      if (e.verdict) return VERDICTS[e.verdict].say;
      const where = both || !e.level ? 'a level that holds it' : `World ${LEVELS[e.level].label}`;
      return `Hype or shift? Clear ${where} to see history’s verdict.`;
    }

    function dots(paths: PathId[]): HTMLElement {
      const box = el('span', 'tl-dots');
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', paths.map((id) => PATHS[id].name).join(' and '));
      for (const id of paths) {
        const dot = el('span', 'tl-dot');
        dot.style.background = hex(CHARACTERS[PATHS[id].hero].color);
        box.append(dot);
      }
      return box;
    }

    /** Roving tabindex: only the current row's summary is in the tab order. */
    function setCurrent(i: number): void {
      rows[current]?.summary.setAttribute('tabindex', '-1');
      current = Math.max(0, Math.min(rows.length - 1, i));
      rows[current]?.summary.setAttribute('tabindex', '0');
    }

    /** Scrolls the list (never the page behind) just enough to show a row below the sticky header. */
    function keepVisible(node: HTMLElement): void {
      const sticky = list.querySelector<HTMLElement>('.tl-world')?.offsetHeight ?? 0;
      const topEdge = node.offsetTop - sticky;
      const bottomEdge = node.offsetTop + node.offsetHeight;
      if (topEdge < list.scrollTop) list.scrollTop = topEdge;
      else if (bottomEdge > list.scrollTop + list.clientHeight) list.scrollTop = bottomEdge - list.clientHeight;
    }

    /** An opened row near the bottom scrolls up to show its body, keeping its summary in view. */
    function revealOpened(li: HTMLElement, sum: HTMLElement): void {
      const sticky = list.querySelector<HTMLElement>('.tl-world')?.offsetHeight ?? 0;
      const bottomEdge = li.offsetTop + li.offsetHeight;
      if (bottomEdge > list.scrollTop + list.clientHeight) list.scrollTop = Math.min(bottomEdge - list.clientHeight, sum.offsetTop - sticky);
    }

    function focusRow(i: number): void {
      setCurrent(i);
      const row = rows[current];
      if (!row) return;
      row.summary.focus({ preventScroll: true });
      keepVisible(row.summary);
    }

    /** Tab order: the tabs, close, the current row, then the links of that row if it is open. */
    function tabOrder(): HTMLElement[] {
      const row = rows[current];
      const order: HTMLElement[] = [...tabButtons, close];
      if (!row) return order;
      order.push(row.summary);
      if (row.details.open) {
        for (const n of row.more.querySelectorAll<HTMLElement>('a, summary')) {
          const box = n.closest('details');
          if (box === row.details || box?.open || n.tagName === 'SUMMARY') order.push(n);
        }
      }
      return order;
    }

    const inList = () => list.contains(document.activeElement);
    list.addEventListener('focusin', (e) => {
      const i = rows.findIndex((r) => r.li.contains(e.target as Node));
      if (i >= 0 && i !== current) setCurrent(i);
    });

    blockHeldKeys(backdrop);
    backdrop.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const move = (delta: number) => focusRow(inList() ? current + delta : current);
      const code = e.code;
      if (e.key === 'Escape' || e.key === 'Backspace') finish();
      else if (e.key === 'ArrowDown' || code === 'KeyS') move(1);
      else if (e.key === 'ArrowUp' || code === 'KeyW') move(-1);
      else if (e.key === 'PageDown') move(PAGE);
      else if (e.key === 'PageUp') move(-PAGE);
      else if (e.key === 'Home') focusRow(0);
      else if (e.key === 'End') focusRow(rows.length - 1);
      else if (e.key === 'ArrowRight' || code === 'KeyD' || e.key === 'ArrowLeft' || code === 'KeyA') {
        const step = e.key === 'ArrowRight' || code === 'KeyD' ? 1 : -1;
        const i = TABS.findIndex((t) => t.id === tab);
        const onTab = tabButtons.includes(document.activeElement as HTMLButtonElement);
        show(TABS[(i + step + TABS.length) % TABS.length].id, onTab ? 'tab' : 'row');
      } else if (e.key === 'Tab') {
        const order = tabOrder();
        const at = order.indexOf(document.activeElement as HTMLElement);
        const next = at < 0 ? (e.shiftKey ? order.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + order.length) % order.length;
        order[next].focus({ preventScroll: true });
        if (list.contains(order[next])) keepVisible(order[next]);
      } else return;
      e.preventDefault();
    });

    let done = false;
    function finish(): void {
      if (done) return;
      done = true;
      backdrop.remove();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      resolve();
    }

    show(tab, 'row');
  });
}
