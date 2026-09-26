import { DATA_TYPES, type DataTypeId } from '../config/dataTypes';
import type { LevelSpec } from '../config/levels';
import type { Counts } from '../game/diet';
import { shares } from '../game/diet';
import { el, hex, pct } from './dom';

export interface HudState {
  level: LevelSpec;
  players: { name: string; form: string; color: number }[];
  lives: number;
  tokens: number;
  counts: Counts;
  match: number;
  hint: string | null;
}

/** Top bar (players, lives, tokens, world) + training panel + toasts + pause menu. */
export class Hud {
  readonly root = el('div', 'hud');
  private readonly players = el('div', 'hud-players');
  private readonly lives = el('div', 'hud-stat');
  private readonly tokens = el('div', 'hud-stat');
  private readonly world = el('div', 'hud-world');
  private readonly training = el('div', 'hud-training');
  private readonly toward = el('div', 'training-title');
  private readonly bars = el('div', 'training-bars');
  private readonly match = el('div', 'training-match');
  private readonly toasts = el('div', 'toasts');
  private pause: HTMLDivElement | null = null;
  private barsFor = '';
  private rows: { id: DataTypeId; fill: HTMLDivElement; value: HTMLSpanElement }[] = [];
  private readonly recent = new Map<string, number>();

  constructor(parent: HTMLElement, isTouch: boolean, onPause: () => void) {
    const bar = el('div', 'hud-bar');
    bar.append(this.players, this.lives, this.tokens, this.world);
    if (isTouch) {
      const pauseBtn = el('button', 'hud-pause', 'II');
      pauseBtn.addEventListener('click', onPause);
      bar.append(pauseBtn);
    }
    this.training.append(this.toward, this.bars, this.match);
    this.root.append(bar, this.training, this.toasts);
    if (isTouch) this.root.append(el('div', 'rotate-hint', 'Turn your phone sideways to play ↻'));
    if (!isTouch) this.root.append(el('div', 'hud-hint', 'Move A/D or ←/→ · Jump Space/W/↑ · Run Shift · Pause Esc'));
    parent.append(this.root);
  }

  update(s: HudState): void {
    this.players.replaceChildren(
      ...s.players.map((p) => {
        const chip = el('span', 'player-chip', p.name === p.form ? p.name : `${p.name} · ${p.form}`);
        chip.style.borderColor = hex(p.color);
        return chip;
      }),
    );
    this.lives.textContent = `♥ ×${s.lives}`;
    this.tokens.textContent = `◉ ${String(s.tokens).padStart(3, '0')}`;
    this.world.textContent = `WORLD ${s.level.id}`;

    this.toward.textContent = `Training toward ${s.level.toward.name}`;
    this.renderBars(s.level, s.counts);
    this.match.textContent = `History match ${pct(s.match)}${s.hint ? ` · ${s.hint}` : ''}`;
    this.match.classList.toggle('good', s.match >= 0.65);
  }

  toast(message: string, kind: 'info' | 'good' | 'bad' = 'info', ms = 3000): void {
    const now = performance.now();
    if ((this.recent.get(message) ?? -Infinity) > now - 4000) return;
    this.recent.set(message, now);
    const node = el('div', `toast ${kind}`, message);
    this.toasts.append(node);
    while (this.toasts.children.length > 3) this.toasts.firstChild?.remove();
    setTimeout(() => node.classList.add('fade'), ms);
    setTimeout(() => node.remove(), ms + 600);
  }

  showPause(onResume: () => void, onQuit: () => void): void {
    this.hidePause();
    const backdrop = el('div', 'modal-backdrop');
    const panel = el('div', 'panel modal pause');
    const resume = el('button', 'btn primary', 'Resume');
    const quit = el('button', 'btn', 'Quit to title');
    resume.addEventListener('click', onResume);
    quit.addEventListener('click', onQuit);
    panel.append(el('h2', undefined, 'Paused'), resume, quit);
    backdrop.append(panel);
    this.root.append(backdrop);
    this.pause = backdrop;
  }

  hidePause(): void {
    this.pause?.remove();
    this.pause = null;
  }

  private renderBars(level: LevelSpec, counts: Counts): void {
    if (this.barsFor !== level.id) {
      this.barsFor = level.id;
      const present = new Set<DataTypeId>(Object.keys(level.recipe) as DataTypeId[]);
      for (const row of level.map) for (const [ch, id] of [['o', 'books'], ['w', 'web'], ['k', 'wiki']] as const) if (row.includes(ch)) present.add(id);
      this.bars.replaceChildren();
      this.rows = [...present].map((id) => {
        const type = DATA_TYPES[id];
        const row = el('div', 'bar-row');
        const label = el('span', 'bar-label', type.label);
        label.style.color = hex(type.color);
        const track = el('div', 'bar-track');
        const fill = el('div', 'bar-fill');
        fill.style.background = hex(type.color);
        const marker = el('div', 'bar-marker');
        marker.style.left = pct(level.recipe[id] ?? 0);
        track.append(fill, marker);
        const value = el('span', 'bar-value');
        row.append(label, track, value);
        this.bars.append(row);
        return { id, fill, value };
      });
    }
    const mix = shares(counts);
    for (const row of this.rows) {
      row.fill.style.width = pct(mix[row.id]);
      row.value.textContent = `${pct(mix[row.id])} / ${pct(level.recipe[row.id] ?? 0)}`;
    }
  }
}
