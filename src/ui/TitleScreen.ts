import { ROSTER } from '../config/characters';
import { LEVELS } from '../config/levels';
import { Input } from '../game/Input';
import { clearSave, loadSave, type SaveData } from '../save';
import { el, hex } from './dom';

/** Title, player count, character roster, and the disclaimer. */
export function showTitleScreen(parent: HTMLElement, onStart: (save: SaveData) => void): void {
  const screen = el('div', 'title-screen');
  const inner = el('div', 'title-inner');
  const logo = el('h1', 'logo');
  logo.append(el('span', 'logo-small', 'SUPER'), el('span', undefined, 'MODEL BROS.'));
  inner.append(
    logo,
    el('p', 'tagline', 'Run through the real history of AI: from a blank Transformer to the frontier.'),
  );

  const start = (save: SaveData) => {
    screen.remove();
    onStart(save);
  };
  const buttons = el('div', 'title-buttons');
  const solo = el('button', 'btn primary', '1 Player · GPT');
  solo.addEventListener('click', () => {
    clearSave();
    start({ levelIndex: 0, players: 1 });
  });
  buttons.append(solo);
  if (!Input.isTouchDevice()) {
    const duo = el('button', 'btn primary', '2 Players · GPT + Claude (one keyboard)');
    duo.addEventListener('click', () => {
      clearSave();
      start({ levelIndex: 0, players: 2 });
    });
    buttons.append(duo);
  }
  const saved = loadSave();
  if (saved && saved.levelIndex > 0) {
    const cont = el('button', 'btn', `Continue · World ${LEVELS[saved.levelIndex].id}`);
    cont.addEventListener('click', () => start(saved));
    buttons.append(cont);
  }
  inner.append(buttons);

  const roster = el('div', 'roster');
  for (const c of ROSTER) {
    const card = el('div', `roster-card${c.unlock ? ' locked' : ''}`);
    const swatch = el('div', 'swatch');
    swatch.style.background = hex(c.color);
    card.append(swatch, el('strong', undefined, c.name), el('span', 'roster-lab', c.lab));
    card.append(el('span', 'roster-trait', c.unlock ? `🔒 ${c.unlock}` : c.trait));
    roster.append(card);
  }
  inner.append(el('h3', 'roster-title', 'Characters'), roster);

  inner.append(
    el(
      'p',
      'controls',
      Input.isTouchDevice()
        ? 'Touch: ◀ ▶ to move, A to jump, B to run. Turn your phone sideways for the best view.'
        : 'Solo: A/D or ←/→ move · Space/W/↑ jump · Shift run. Co-op: GPT uses A/D/W + Left Shift, Claude uses the arrows + Right Shift.',
    ),
    el(
      'p',
      'disclaimer',
      'A fan-made, educational parody. Not affiliated with or endorsed by Nintendo, OpenAI, Anthropic, Google, Meta, DeepSeek, Mistral AI, xAI, or any other organization named. Model names, dates, and training data are presented as historical facts.',
    ),
  );
  screen.append(inner);
  parent.append(screen);
}
