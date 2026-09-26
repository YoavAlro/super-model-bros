import { DATA_TYPES, type DataTypeId } from '../config/dataTypes';
import type { LevelSpec } from '../config/levelSpec';
import type { Counts } from '../game/diet';
import { shares } from '../game/diet';
import { el, hex, pct } from './dom';

export interface HudState {
  level: LevelSpec;
  players: { name: string; form: string; color: number }[];
  lives: number;
  tokens: number;
  counts: Counts;
  /** Token types this level offers. */
  offered: Set<DataTypeId>;
  match: number;
  hint: string | null;
  /** 0–100, or null before World 2. */
  alignment: number | null;
  bosses: { name: string; hp: number; max: number }[];
  /** A storm's status line: the day, hearts gathered. */
  status: string | null;
}

/** Top bar (players, lives, tokens, world) + training panel + boss bar + toasts + pause menu. */
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
  private readonly align = el('div', 'hud-align');
  private readonly alignFill = el('div', 'align-fill');
  private readonly alignValue = el('span', 'align-value');
  private readonly bossBar = el('div', 'hud-boss');
  private readonly status = el('div', 'hud-status');
  private readonly toasts = el('div', 'toasts');
  private readonly hint: HTMLDivElement | null = null;
  private pause: HTMLDivElement | null = null;
  /** Opens the story timeline over the pause menu (set by Campaign); resolves when it closes. */
  onTimeline: (() => Promise<void>) | null = null;
  private barsFor = '';
  private bossKey = '';
  private rows: { id: DataTypeId; fill: HTMLDivElement; value: HTMLSpanElement }[] = [];
  private readonly recent = new Map<string, number>();
  /** The training panel stays hidden until a level fills it in. */
  private hasLevel = false;
  private trainingShown = true;

  constructor(parent: HTMLElement, isTouch: boolean, onPause: () => void) {
    const bar = el('div', 'hud-bar');
    bar.append(this.players, this.lives, this.tokens, this.world);
    if (isTouch) {
      const pauseBtn = el('button', 'hud-pause', 'II');
      pauseBtn.setAttribute('aria-label', 'Pause');
      pauseBtn.addEventListener('click', onPause);
      bar.append(pauseBtn);
    }
    const track = el('div', 'align-track');
    track.append(this.alignFill);
    this.align.append(el('span', 'align-label', 'Alignment'), track, this.alignValue);
    this.training.append(this.toward, this.bars, this.match, this.align, this.status);
    this.training.style.display = 'none';
    this.root.append(bar, this.training, this.bossBar, this.toasts);
    if (isTouch) this.root.append(el('div', 'rotate-hint', 'Turn your phone sideways to play ↻'));
    else {
      this.hint = el('div', 'hud-hint', 'Move A/D or ←/→ · Jump Space/W/↑ · Run Shift · Power S/↓ · Pause Esc');
      this.root.append(this.hint);
    }
    parent.append(this.root);
  }

  /** The level panels (training mix, boss bar) hide during a Benchmark Kart race. */
  showTraining(visible: boolean): void {
    this.trainingShown = visible;
    this.training.style.display = visible && this.hasLevel ? '' : 'none';
    this.bossBar.style.display = visible ? '' : 'none';
  }

  /** Swaps the bottom controls hint (co-op uses different keys). */
  setHint(text: string): void {
    if (this.hint) this.hint.textContent = text;
  }

  /** Shows a different controls hint for a while; returns a function that puts the old one back. */
  pushHint(text: string): () => void {
    const before = this.hint?.textContent ?? '';
    this.setHint(text);
    return () => this.setHint(before);
  }

  update(s: HudState): void {
    if (!this.hasLevel) {
      this.hasLevel = true;
      this.showTraining(this.trainingShown);
    }
    this.players.replaceChildren(
      ...s.players.map((p) => {
        const chip = el('span', 'player-chip', p.name === p.form ? p.name : `${p.name} · ${p.form}`);
        chip.style.borderColor = hex(p.color);
        return chip;
      }),
    );
    this.lives.textContent = `♥ ×${s.lives}`;
    this.tokens.textContent = `◉ ${String(s.tokens).padStart(3, '0')}`;
    this.world.textContent = `WORLD ${s.level.label}`;

    this.toward.textContent = `Training toward ${s.level.toward.name}`;
    this.renderBars(s);
    const what = s.level.recipeKind === 'published' ? 'History match' : 'Ingredient match';
    this.match.textContent = `${what} ${pct(s.match)}${s.hint ? ` · ${s.hint}` : ''}`;
    this.match.classList.toggle('good', s.match >= 0.65);

    this.align.style.display = s.alignment === null ? 'none' : '';
    if (s.alignment !== null) {
      this.alignFill.style.width = `${s.alignment}%`;
      this.alignFill.classList.toggle('low', s.alignment < 40);
      this.alignValue.textContent = `${Math.round(s.alignment)}%`;
    }

    this.status.style.display = s.status ? '' : 'none';
    if (s.status) this.status.textContent = s.status;

    const key = s.bosses.map((b) => `${b.name}${b.hp}`).join('|');
    if (key !== this.bossKey) {
      this.bossKey = key;
      this.bossBar.replaceChildren(
        ...s.bosses.map((b) => {
          const row = el('div', 'boss-row');
          row.append(el('span', 'boss-name', b.name), el('span', 'boss-hp', '♥'.repeat(b.hp) + '♡'.repeat(Math.max(0, b.max - b.hp))));
          return row;
        }),
      );
    }
  }

  toast(message: string, kind: 'info' | 'good' | 'bad' = 'info', ms = 3000): void {
    const now = performance.now();
    if ((this.recent.get(message) ?? -Infinity) > now - 4000) return;
    this.recent.set(message, now);
    const node = el('div', `toast ${kind}`, message);
    node.setAttribute('role', 'status');
    this.toasts.append(node);
    while (this.toasts.children.length > 3) this.toasts.firstChild?.remove();
    setTimeout(() => node.classList.add('fade'), ms);
    setTimeout(() => node.remove(), ms + 600);
  }

  showPause(onResume: () => void, onQuit: () => void, extra?: HTMLElement): void {
    this.hidePause();
    const backdrop = el('div', 'modal-backdrop');
    const panel = el('div', 'panel modal pause');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Paused');
    const resume = el('button', 'btn primary', 'Resume');
    const quit = el('button', 'btn', 'Quit to title');
    resume.addEventListener('click', onResume);
    quit.addEventListener('click', onQuit);
    panel.append(el('h2', undefined, 'Paused'), resume);
    if (extra) panel.append(extra);
    const open = this.onTimeline;
    if (open) {
      // One shared last row, so the pause panel grows no taller on a phone.
      const row = el('div', 'pause-row');
      const story = el('button', 'btn', 'Story timeline');
      story.addEventListener('click', () => {
        story.focus({ preventScroll: true });
        void open();
      });
      row.append(story, quit);
      panel.append(row);
    } else panel.append(quit);
    backdrop.append(panel);
    this.root.append(backdrop);
    this.pause = backdrop;
    resume.focus();
  }

  hidePause(): void {
    this.pause?.remove();
    this.pause = null;
  }

  dispose(): void {
    this.root.remove();
  }

  private renderBars(s: HudState): void {
    const level = s.level;
    if (this.barsFor !== level.id) {
      this.barsFor = level.id;
      const present = new Set<DataTypeId>([...(Object.keys(level.recipe) as DataTypeId[]), ...s.offered]);
      this.bars.replaceChildren();
      this.rows = [...present].map((id) => {
        const type = DATA_TYPES[id];
        const row = el('div', 'bar-row');
        const label = el('span', 'bar-label', `${type.glyph} ${type.label}`);
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
    const mix = shares(s.counts);
    for (const row of this.rows) {
      row.fill.style.width = pct(mix[row.id]);
      row.value.textContent = `${pct(mix[row.id])} / ${pct(level.recipe[row.id] ?? 0)}`;
    }
  }
}
