import * as THREE from 'three';
import type { MomentId } from '../config/events';
import type { PuzzleSpec } from '../config/levelSpec';
import { LevelGrid, T, type Mark } from './level';
import type { LevelView } from './LevelView';
import { canvasTexture, labelSprite } from './meshes';
import type { PlayerActor } from './Player';
import { enterInOrder, letterCount, tokenCount } from './puzzleRules';
import { sfx } from './sfx';

/** What a puzzle may do to the level it lives in. Implemented by the Stage. */
export interface PuzzleHost {
  readonly grid: LevelGrid;
  readonly view: LevelView;
  readonly scene: THREE.Scene;
  toast(message: string, kind?: 'info' | 'good' | 'bad'): void;
  happen(id: MomentId): void;
  players(): PlayerActor[];
}

/** A bonus puzzle built from map marks. Solving it opens the level's gates. */
export abstract class Puzzle {
  solved = false;
  constructor(protected readonly host: PuzzleHost) {}

  /** A block was bumped from below; return true if the puzzle handled it. */
  onBump(_tx: number, _ty: number): boolean {
    return false;
  }

  /** A player landed on the tile at (tx, ty). */
  onLand(_p: PlayerActor, _tx: number, _ty: number): void {}

  step(_dt: number): void {}

  /** Where the puzzle's pieces are, for smoke tests. */
  abstract debug(): Record<string, unknown>;

  /** Columns the puzzle spans. While it is unsolved the camera holds so all of it stays on screen. */
  region(): { x0: number; x1: number } | null {
    return null;
  }

  protected solve(message: string): void {
    if (this.solved) return;
    this.solved = true;
    const g = this.host.grid;
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        if (g.get(x, y) !== T.GATE) continue;
        g.set(x, y, T.EMPTY);
        this.host.view.removeTile(x, y);
      }
    }
    sfx.flag();
    this.host.toast(message, 'good');
  }
}

const marksOf = (grid: LevelGrid, ch: string) => grid.marks.filter((m) => m.ch === ch);

function textPlane(text: string, w: number, bg: string, fg = '#1a1030'): THREE.Mesh {
  const tex = canvasTexture(64, (c, s) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, s, s);
    c.fillStyle = fg;
    c.font = `bold ${text.length > 3 ? 18 : 30}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, s / 2, s / 2 + 2);
  });
  tex.magFilter = THREE.LinearFilter;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, 0.94), new THREE.MeshBasicMaterial({ map: tex }));
  return mesh;
}

/**
 * How many R's in "strawberry"? Ten letter blocks. Without thinking you see tokens (str·aw·berry)
 * and can only count the R-tokens: two. Think (hold the power button with the cape) to see letters.
 */
class StrawberryPuzzle extends Puzzle {
  private readonly x0: number;
  private readonly y: number;
  private readonly group: number[] = [];
  private readonly letterPlanes: THREE.Mesh[] = [];
  private readonly tokenPlanes: THREE.Mesh[] = [];
  private readonly counted = new Set<number>();
  private readonly countedTokens = new Set<number>();
  private started = false;

  constructor(host: PuzzleHost, mark: Mark, private readonly spec: Extract<PuzzleSpec, { kind: 'strawberry' }>) {
    super(host);
    this.x0 = mark.x;
    this.y = mark.y - 1;
    spec.tokens.forEach((tok, g) => {
      const start = this.group.length;
      for (let i = 0; i < tok.length; i++) this.group.push(g);
      const plane = textPlane(tok.toLowerCase(), tok.length, '#ffd166');
      plane.scale.x = 1;
      (plane.geometry as THREE.PlaneGeometry).dispose();
      plane.geometry = new THREE.PlaneGeometry(tok.length - 0.06, 0.94);
      plane.position.set(this.x0 + start + tok.length / 2, this.y + 0.5, 0.62);
      host.scene.add(plane);
      this.tokenPlanes.push(plane);
    });
    [...spec.word].forEach((ch, i) => {
      const plane = textPlane(ch, 1, '#fff4d6');
      plane.position.set(this.x0 + i + 0.5, this.y + 0.5, 0.63);
      plane.visible = false;
      host.scene.add(plane);
      this.letterPlanes.push(plane);
    });
  }

  private get thinking(): boolean {
    return this.host.players().some((p) => p.thinking);
  }

  region() {
    return { x0: this.x0, x1: this.x0 + this.spec.word.length };
  }

  debug() {
    return { kind: 'strawberry', solved: this.solved, x0: this.x0, y: this.y, word: this.spec.word, letter: this.spec.letter };
  }

  step(): void {
    const think = this.thinking || this.solved;
    for (const p of this.letterPlanes) p.visible = think;
    for (const p of this.tokenPlanes) p.visible = !think;
  }

  onBump(tx: number, ty: number): boolean {
    const i = tx - this.x0;
    if (ty !== this.y || i < 0 || i >= this.spec.word.length) return false;
    this.host.view.bumpTile(tx, ty);
    sfx.bump();
    if (this.solved) return true;
    if (!this.started) {
      this.started = true;
      this.host.happen('strawberry');
    }
    const L = this.spec.letter;
    if (this.thinking) {
      if (this.spec.word[i] !== L) return this.reset(`That’s not an ${L}. Count again from zero.`);
      this.counted.add(i);
      this.tint(this.letterPlanes[i]);
      const need = letterCount(this.spec.word, L);
      if (this.counted.size >= need) this.solve(`${need}! Letters, not tokens. The gate opens.`);
      else this.host.toast(`${this.counted.size}…`);
    } else {
      const g = this.group[i];
      if (!this.spec.tokens[g].includes(L)) return this.reset(`"${this.spec.tokens[g].toLowerCase()}" has no ${L}. Start over.`);
      this.countedTokens.add(g);
      this.tint(this.tokenPlanes[g]);
      const withL = tokenCount(this.spec.tokens, L);
      if (this.countedTokens.size >= withL) {
        this.host.toast(`${withL} ${L}'s? That is how tokens see it: ${this.spec.tokens.join('·').toLowerCase()}. Think (hold the power button with the cape) to see the letters.`, 'info');
        this.countedTokens.clear();
        for (const p of this.tokenPlanes) this.untint(p);
      }
    }
    return true;
  }

  private reset(message: string): boolean {
    this.counted.clear();
    this.countedTokens.clear();
    for (const p of [...this.letterPlanes, ...this.tokenPlanes]) this.untint(p);
    this.host.toast(message, 'bad');
    return true;
  }

  private tint(p: THREE.Mesh): void {
    (p.material as THREE.MeshBasicMaterial).color.setHex(0x9dffb0);
  }

  private untint(p: THREE.Mesh): void {
    (p.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
  }
}

/** The Naming Maze: land on the labeled pipes in release order. The sealed one was skipped. */
class NamingMazePuzzle extends Puzzle {
  private readonly pipes: { x: number; y: number; label: string; order: number | null; sprite: THREE.Sprite }[] = [];
  private readonly done = new Set<string>();
  private started = false;

  constructor(host: PuzzleHost, spec: Extract<PuzzleSpec, { kind: 'namingMaze' }>) {
    super(host);
    for (const [ch, cfg] of Object.entries(spec.pipes)) {
      for (const m of marksOf(host.grid, ch)) {
        const sprite = labelSprite(cfg.order === null ? `${cfg.label} (sealed)` : cfg.label, '#ffffff', cfg.order === null ? '#5a2a2a' : '#1a3a6a');
        sprite.scale.multiplyScalar(0.45);
        sprite.position.set(m.x + 1, m.y + 1.4, 0.2);
        host.scene.add(sprite);
        this.pipes.push({ x: m.x, y: m.y, label: cfg.label, order: cfg.order, sprite });
      }
    }
  }

  region() {
    const xs = this.pipes.map((p) => p.x);
    return xs.length ? { x0: Math.min(...xs), x1: Math.max(...xs) + 2 } : null;
  }

  debug() {
    return { kind: 'namingMaze', solved: this.solved, pipes: this.pipes.map((p) => ({ x: p.x, y: p.y, label: p.label, order: p.order })) };
  }

  onLand(_p: PlayerActor, tx: number, ty: number): void {
    if (this.solved) return;
    const pipe = this.pipes.find((p) => (tx === p.x || tx === p.x + 1) && ty === p.y - 1);
    if (!pipe) return;
    if (!this.started) {
      this.started = true;
      this.host.happen('namingMaze');
    }
    const result = enterInOrder(this.pipes, this.done, pipe.label);
    if (result === 'sealed') this.host.toast(`${pipe.label} was skipped. This pipe is sealed.`, 'info');
    if (result === 'repeat' || result === 'sealed') return;
    if (result === 'wrong') {
      for (const p of this.pipes) p.sprite.material.color.setHex(0xffffff);
      this.host.toast(`Wrong order! ${pipe.label} didn’t come next. Back to the start.`, 'bad');
      sfx.trap();
      return;
    }
    pipe.sprite.material.color.setHex(0x9dffb0);
    sfx.token();
    if (result === 'solved') this.solve('Release order correct! The gate opens.');
    else this.host.toast(`✓ ${pipe.label}`, 'good');
  }
}

/** Chart Crime: one bar's height lies about its number. Stomp it back down to size. */
class ChartCrimePuzzle extends Puzzle {
  private readonly bars: { x: number; top: number; bottom: number; lies: boolean; fixed: number; sprite: THREE.Sprite }[] = [];
  private started = false;

  constructor(host: PuzzleHost, spec: Extract<PuzzleSpec, { kind: 'chartCrime' }>) {
    super(host);
    const g = host.grid;
    for (const [ch, cfg] of Object.entries(spec.bars)) {
      for (const m of marksOf(g, ch)) {
        const top = m.y - 1;
        let bottom = top;
        while (bottom > 0 && g.get(m.x, bottom - 1) === T.HARD) bottom--;
        const sprite = labelSprite(cfg.label, '#ffffff', cfg.lies ? '#7a3a00' : '#1a3a6a');
        sprite.scale.multiplyScalar(0.5);
        sprite.position.set(m.x + 1, top + 1.6, 0.2);
        host.scene.add(sprite);
        this.bars.push({ x: m.x, top, bottom, lies: !!cfg.lies, fixed: cfg.fixedHeight ?? 1, sprite });
      }
    }
  }

  region() {
    const xs = this.bars.map((b) => b.x);
    return xs.length ? { x0: Math.min(...xs), x1: Math.max(...xs) + 2 } : null;
  }

  debug() {
    return { kind: 'chartCrime', solved: this.solved, bars: this.bars.map((b) => ({ x: b.x, top: b.top, lies: b.lies })) };
  }

  onLand(_p: PlayerActor, tx: number, ty: number): void {
    if (this.solved) return;
    const bar = this.bars.find((b) => (tx === b.x || tx === b.x + 1) && ty === b.top);
    if (!bar) return;
    if (!this.started) {
      this.started = true;
      this.host.happen('chartCrime');
    }
    if (!bar.lies) {
      this.host.toast('This bar matches its number. Find the one whose height lies.', 'info');
      return;
    }
    const g = this.host.grid;
    const keepTop = bar.bottom + bar.fixed - 1;
    for (let y = bar.top; y > keepTop; y--) {
      for (const x of [bar.x, bar.x + 1]) {
        g.set(x, y, T.EMPTY);
        this.host.view.removeTile(x, y);
      }
    }
    bar.top = keepTop;
    bar.sprite.position.y = keepTop + 1.6;
    this.solve('Chart fixed! Now the bars match their numbers.');
  }
}

/** A cave you keep getting lost in: step onto a `7` and you are back at the `8`. */
class CavePuzzle extends Puzzle {
  private readonly traps: Mark[];
  private readonly back: Mark | undefined;
  private loops = 0;

  constructor(host: PuzzleHost) {
    super(host);
    this.traps = marksOf(host.grid, '7');
    this.back = marksOf(host.grid, '8')[0];
  }

  debug() {
    return { kind: 'cave', loops: this.loops, traps: this.traps, back: this.back };
  }

  step(): void {
    if (!this.back) return;
    for (const p of this.host.players()) {
      if (p.clone || p.dead) continue;
      const tx = Math.floor(p.body.x + p.body.w / 2);
      const ty = Math.floor(p.body.y + 0.4);
      if (!this.traps.some((m) => m.x === tx && m.y === ty)) continue;
      p.body.x = this.back.x + 0.1;
      p.body.y = this.back.y;
      p.body.vx = 0;
      p.body.vy = 0;
      this.loops++;
      this.host.happen('claudePokemon');
      this.host.toast(this.loops === 1 ? 'Lost in the cave… you are back where you started.' : `Lost in the cave again (×${this.loops}). Try a different way.`, 'bad');
    }
  }
}

export function createPuzzle(spec: PuzzleSpec | undefined, host: PuzzleHost): Puzzle | null {
  if (!spec) return null;
  switch (spec.kind) {
    case 'strawberry': {
      const mark = marksOf(host.grid, '1')[0];
      return mark ? new StrawberryPuzzle(host, mark, spec) : null;
    }
    case 'namingMaze':
      return new NamingMazePuzzle(host, spec);
    case 'chartCrime':
      return new ChartCrimePuzzle(host, spec);
    case 'cave':
      return new CavePuzzle(host);
  }
}
