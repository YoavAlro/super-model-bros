import { CHARACTERS, ROSTER, type CharacterId } from '../config/characters';
import { LEVELS } from '../config/levels';
import { PATHS, type PathId } from '../config/paths';
import { Input } from '../game/Input';
import { isUnlocked } from '../game/progress';
import { writeSave, type SaveData } from '../save';
import { el, hex } from './dom';
import { applySettings, settingsPanel } from './Settings';

export interface StartChoice {
  path: PathId;
  players: 1 | 2;
  /** Player 1's character (co-op adds the path's partner as player 2). */
  lead: CharacterId;
  /** Continue the saved run on this path instead of starting over. */
  resume: boolean;
}

/** Title, path choice, character roster, and the disclaimer. */
export function showTitleScreen(parent: HTMLElement, save: SaveData, onStart: (choice: StartChoice) => void): void {
  const screen = el('div', 'title-screen');
  const inner = el('div', 'title-inner');
  const logo = el('h1', 'logo');
  logo.append(el('span', 'logo-small', 'SUPER'), el('span', undefined, 'MODEL BROS.'));
  inner.append(logo, el('p', 'tagline', 'Run through the real history of AI: from a blank Transformer to the frontier.'));

  let lead: CharacterId | null = null;
  const start = (choice: Omit<StartChoice, 'lead'>) => {
    screen.remove();
    onStart({ ...choice, lead: lead ?? PATHS[choice.path].hero });
  };

  const menu = el('div', 'title-menu');
  const touch = Input.isTouchDevice();
  for (const id of ['gpt', 'claude'] as PathId[]) {
    const path = PATHS[id];
    const col = el('div', 'path-col');
    const hero = CHARACTERS[path.hero];
    const head = el('div', 'path-head', path.name);
    head.style.color = hex(hero.color);
    const sub = el('div', 'path-sub', id === 'gpt' ? 'Transformer (2017) → GPT-6 Astra (2026)' : 'Anthropic (2021) → Claude Opus 5.5 (2026)');
    col.append(head, sub);
    const run = save.runs[id];
    if (run && run.step > 0 && run.step < path.steps.length) {
      const label = LEVELS[path.steps[run.step].level]?.label ?? '';
      const cont = el('button', 'btn primary', `Continue · World ${label}${run.players === 2 ? ' · co-op' : ''}`);
      cont.addEventListener('click', () => start({ path: id, players: run.players, resume: true }));
      col.append(cont);
    }
    const solo = el('button', run && run.step > 0 ? 'btn' : 'btn primary', `New game · 1 player`);
    solo.addEventListener('click', () => start({ path: id, players: 1, resume: false }));
    col.append(solo);
    if (!touch) {
      const duo = el('button', 'btn', `2 players · one keyboard`);
      duo.addEventListener('click', () => start({ path: id, players: 2, resume: false }));
      col.append(duo);
    }
    menu.append(col);
  }
  inner.append(menu);

  const roster = el('div', 'roster');
  const cards = new Map<CharacterId, HTMLElement>();
  const refresh = () => {
    for (const [id, card] of cards) card.classList.toggle('selected', id === lead);
  };
  for (const c of ROSTER) {
    const open = isUnlocked(save.progress, c.id);
    const card = el('button', `roster-card${open ? '' : ' locked'}`);
    card.disabled = !open;
    const swatch = el('div', 'swatch');
    swatch.style.background = hex(c.color);
    card.append(swatch, el('strong', undefined, c.name), el('span', 'roster-lab', c.lab));
    card.append(el('span', 'roster-trait', open ? c.trait : `🔒 ${c.unlock}`));
    card.setAttribute('aria-pressed', 'false');
    card.addEventListener('click', () => {
      lead = lead === c.id ? null : c.id;
      refresh();
      for (const [id, node] of cards) node.setAttribute('aria-pressed', String(id === lead));
    });
    cards.set(c.id, card);
    roster.append(card);
  }
  inner.append(
    el('h3', 'roster-title', 'Characters'),
    el('p', 'roster-help', 'Pick a character to play either path as them, or leave it to the path’s own brother.'),
    roster,
  );

  const settings = el('div', 'title-settings');
  settings.append(settingsPanel(save.settings, () => writeSave(save)));
  inner.append(el('h3', 'roster-title', 'Settings'), settings);
  applySettings(save.settings);

  inner.append(
    el(
      'p',
      'controls',
      touch
        ? 'Touch: ◀ ▶ to move, A to jump, B to run, ✦ for your power. Turn your phone sideways for the best view.'
        : 'Solo: A/D or ←/→ move · Space/W/↑ jump · Shift run · S/↓ power. Co-op: player 1 uses A/D/W, Left Shift and S; player 2 uses the arrows, Right Shift and ↓.',
    ),
    el(
      'p',
      'disclaimer',
      'A fan-made, educational parody. Not affiliated with or endorsed by Nintendo, OpenAI, Anthropic, Google, Meta, DeepSeek, Mistral AI, xAI, or any other organization named. Model names, dates, and training data are presented as historical facts, with sources on every card.',
    ),
  );
  screen.append(inner);
  parent.append(screen);
  (screen.querySelector('.btn.primary') as HTMLButtonElement | null)?.focus();
}
