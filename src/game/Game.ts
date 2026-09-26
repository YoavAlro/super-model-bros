import * as THREE from 'three';
import { CHARACTERS } from '../config/characters';
import { LEVELS, TO_BE_CONTINUED, type LevelSpec } from '../config/levels';
import { THEMES } from '../config/themes';
import { writeSave } from '../save';
import { showFactCard } from '../ui/FactCard';
import { Hud } from '../ui/Hud';
import { dietHint, dietMatch, emptyCounts, historyStars, shares, total, type Counts } from './diet';
import { GarbageBoss, Spambot } from './Enemies';
import { Input } from './Input';
import { Debris, ScaleItem, Token } from './Items';
import { LevelGrid, T } from './level';
import { LevelView } from './LevelView';
import { makeFlag, makeHelper } from './meshes';
import { bumpedTile, overlaps, type Body } from './physics';
import { PlayerActor } from './Player';
import { sfx } from './sfx';

const STEP = 1 / 120;
const START_LIVES = 5;
const FOV = 40;

type State = 'intro' | 'playing' | 'paused' | 'clear' | 'ending';

export interface GameOptions {
  players: 1 | 2;
  startLevel: number;
  onExit: () => void;
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  private readonly timer = new THREE.Timer();
  private readonly input: Input;
  private readonly hud: Hud;
  private readonly overlay: HTMLDivElement;
  private readonly isTouch = Input.isTouchDevice();

  private scene = new THREE.Scene();
  private levelIndex = 0;
  private spec!: LevelSpec;
  private grid!: LevelGrid;
  private view!: LevelView;
  private players: PlayerActor[] = [];
  private enemies: Spambot[] = [];
  private tokens: Token[] = [];
  private items: ScaleItem[] = [];
  private debris: Debris[] = [];
  private boss: GarbageBoss | null = null;
  private helper: THREE.Group | null = null;
  private flag: { group: THREE.Group; x: number; y: number; slide: number } | null = null;

  private state: State = 'intro';
  private lives = START_LIVES;
  private counts: Counts = emptyCounts();
  private accumulator = 0;
  private camX = 0;
  private halfW = 10;
  private halfH = 7.5;
  /** Tiles of dirt shown below the level so touch buttons don't cover the playfield. */
  private bottomPad = 0;
  private shake = 0;
  private clearTimer = 0;
  private respawnTimer = 0;
  private hudTimer = 0;
  private seenScale = false;
  private running = true;

  constructor(private readonly root: HTMLElement, private readonly opts: GameOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isTouch ? 1.5 : 2));
    root.append(this.renderer.domElement);

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    root.append(this.overlay);
    this.input = new Input(opts.players, this.overlay, this.isTouch);
    this.hud = new Hud(this.overlay, this.isTouch, () => this.input.requestPause());

    window.addEventListener('resize', this.resize);
    this.resize();
  }

  /** Test hook, enabled with ?debug in the URL: lets smoke tests teleport and inspect state. */
  private exposeDebug(): void {
    if (!new URLSearchParams(location.search).has('debug')) return;
    window.__smb = {
      state: () => this.state,
      level: () => this.spec.id,
      bossHp: () => this.boss?.hp ?? null,
      boss: () => (this.boss ? { x: this.boss.body.x, y: this.boss.body.y, w: this.boss.body.w, h: this.boss.body.h } : null),
      teleport: (x: number, y: number) => {
        const b = this.players[0].body;
        b.x = x;
        b.y = y;
        b.vx = 0;
        b.vy = 0;
        this.camX = Math.max(this.camX, Math.min(x, this.grid.width - this.halfW));
      },
      invincible: () => (this.players[0].invulnerable = 999),
    };
  }

  start(): void {
    this.exposeDebug();
    void this.loadLevel(this.opts.startLevel);
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  private async loadLevel(index: number, retry = false): Promise<void> {
    this.levelIndex = index;
    this.spec = LEVELS[index];
    this.buildLevel();
    this.state = 'intro';
    if (!retry) {
      const lines = [...this.spec.intro.lines];
      if (this.opts.players === 2 && this.spec.world === 1) {
        lines.push('Co-op note: Claude did not exist until 2021. In co-op you get to bring your brother early.');
      }
      await showFactCard(this.root, {
        card: { ...this.spec.intro, lines },
        color: CHARACTERS.gpt.color,
        button: 'Start',
      });
    }
    this.state = 'playing';
  }

  private buildLevel(): void {
    for (const p of this.players) p.dispose();
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-4, 10, 8);
    this.scene.add(sun);

    const spec = this.spec;
    this.grid = new LevelGrid(spec.map);
    this.view = new LevelView(this.grid, THEMES[spec.theme], this.scene);
    this.counts = emptyCounts();
    this.enemies = [];
    this.tokens = [];
    this.items = [];
    this.debris = [];
    this.boss = null;
    this.helper = null;
    this.flag = null;
    this.accumulator = 0;
    this.shake = 0;
    this.clearTimer = 0;
    this.respawnTimer = 0;

    const spawn = this.grid.spawnOf('spawn') ?? { x: 2, y: 2 };
    const ids = this.opts.players === 2 ? (['gpt', 'claude'] as const) : (['gpt'] as const);
    this.players = ids.map((id, i) => {
      const form = id === 'gpt' ? spec.formBefore : 'Claude';
      return new PlayerActor(CHARACTERS[id], form, spawn.x + i * 1.2, spawn.y, this.scene);
    });

    for (const s of this.grid.spawns) {
      if (s.kind === 'spambot') this.enemies.push(new Spambot(s.x, s.y, this.scene));
      else if (s.kind === 'token' && s.token) this.tokens.push(new Token(s.token, s.x, s.y, this.scene));
      else if (s.kind === 'boss') this.boss = new GarbageBoss(s.x, s.y, this.scene);
      else if (s.kind === 'helper') {
        this.helper = makeHelper();
        this.helper.position.set(s.x + 0.5, s.y, 0);
        this.helper.visible = false;
        this.scene.add(this.helper);
      } else if (s.kind === 'flag') {
        const group = makeFlag(`${spec.toward.name} · ${spec.outro.date.split(' · ')[0]}`);
        group.position.set(s.x + 0.5, s.y - 1, 0);
        this.scene.add(group);
        this.flag = { group, x: s.x + 0.5, y: s.y, slide: 0 };
      }
    }
    this.camX = this.halfW;
  }

  private frame(time: number): void {
    if (!this.running) return;
    this.timer.update(time);
    const dt = Math.min(this.timer.getDelta(), 0.1);
    const t = this.timer.getElapsed();

    if (this.input.consumePause()) this.togglePause();
    // Portrait phones show a "rotate your phone" overlay; hold the game until it turns.
    const portraitTouch = this.isTouch && window.innerHeight > window.innerWidth;
    if (!portraitTouch && (this.state === 'playing' || this.state === 'clear')) {
      this.input.update();
      this.accumulator += dt;
      while (this.accumulator >= STEP) {
        this.simulate(STEP);
        this.accumulator -= STEP;
      }
    }

    this.view.update(dt);
    for (const p of this.players) p.updateMesh(t, dt);
    for (const e of this.enemies) e.updateMesh(t);
    for (const tok of this.tokens) tok.updateMesh(t);
    for (const item of this.items) item.updateMesh(t);
    this.boss?.updateMesh(t);
    if (this.helper?.visible) this.helper.position.y = this.grid.spawnOf('helper')!.y + Math.abs(Math.sin(t * 5)) * 0.3;
    this.placeCamera(dt);
    this.renderer.render(this.scene, this.camera);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.hud.update({
        level: this.spec,
        players: this.players.map((p, i) => ({
          name: p.spec.name,
          form: i === 0 ? this.formName() : 'Claude',
          color: p.spec.color,
        })),
        lives: this.lives,
        tokens: total(this.counts),
        counts: this.counts,
        match: dietMatch(this.counts, this.spec.recipe),
        hint: dietHint(this.counts, this.spec.recipe, this.spec.toward.name),
      });
    }
  }

  private formName(): string {
    return this.state === 'ending' ? this.spec.toward.name : this.spec.formBefore;
  }

  private simulate(dt: number): void {
    const camLeft = this.camX - this.halfW;
    const camRight = this.camX + this.halfW;

    this.players.forEach((p, i) => {
      const pad = this.input.pads[i];
      const hits = p.step(dt, pad, this.grid);
      const bumped = bumpedTile(p.body, hits);
      if (bumped) this.hitBlock(bumped.tx, bumped.ty, p);
      if (!p.dead) {
        // Players can't leave the screen; the camera only scrolls forward.
        if (p.body.x < camLeft) {
          p.body.x = camLeft;
          p.body.vx = Math.max(0, p.body.vx);
        }
        if (this.players.length > 1 && p.body.x + p.body.w > camRight) {
          p.body.x = camRight - p.body.w;
          p.body.vx = Math.min(0, p.body.vx);
        }
        if (p.body.y < -3) this.killPlayer(p);
      }
    });

    for (const e of this.enemies) {
      if (!e.active && e.body.x < camRight + 2) e.active = true;
      if (e.active) e.step(dt, this.grid);
    }
    this.stepBoss(dt);
    this.stepPickups(dt);
    this.collidePlayers();
    this.stepFlag(dt);
    this.stepDeaths(dt);
    this.debris = this.debris.filter((d) => d.step(dt));
    this.shake = Math.max(0, this.shake - dt);
  }

  private hitBlock(tx: number, ty: number, p: PlayerActor): void {
    const tile = this.grid.get(tx, ty);
    if (tile === T.QUESTION) {
      this.grid.set(tx, ty, T.USED);
      this.view.activate(tx, ty);
      const content = this.grid.contents.get(this.grid.index(tx, ty));
      if (content === 'scale') this.items.push(new ScaleItem(tx, ty + 1, this.scene));
      else this.tokens.push(new Token(this.spec.blockToken, tx, ty + 1, this.scene, true));
      sfx.bump();
    } else if (tile === T.BRICK) {
      if (p.big) {
        this.grid.set(tx, ty, T.EMPTY);
        this.view.removeTile(tx, ty);
        this.debris.push(new Debris(tx, ty, THEMES[this.spec.theme].brick, this.scene));
        sfx.stomp();
      } else {
        this.view.bumpTile(tx, ty);
        sfx.bump();
      }
    }
  }

  private stepBoss(dt: number): void {
    const boss = this.boss;
    if (!boss) return;
    const lead = this.leadPlayer();
    if (!boss.awake && lead && lead.body.x > boss.body.x - 16) {
      boss.awake = true;
      this.hud.toast('Garbage In appears! Stomp it three times.', 'bad');
      sfx.boss();
    }
    if (!boss.awake) return;
    const { landed, spawn } = boss.step(dt, this.grid, lead ? lead.body.x : boss.body.x);
    if (landed) {
      this.shake = 0.35;
      sfx.boss();
    }
    if (spawn && boss.alive && this.enemies.filter((e) => e.alive).length < 4) {
      const minion = new Spambot(boss.body.x + boss.body.w / 2 - 0.5, boss.body.y + boss.body.h, this.scene, true);
      minion.body.vy = 10;
      this.enemies.push(minion);
    }
  }

  private stepPickups(dt: number): void {
    for (const tok of this.tokens) {
      if (tok.taken) continue;
      const collect = tok.pop ? tok.step(dt) : this.players.some((p) => !p.dead && overlaps(p.body, tok.body));
      if (collect) {
        tok.take();
        this.counts[tok.type]++;
        sfx.token();
      }
    }
    for (const item of this.items) {
      item.step(dt, this.grid);
      if (item.taken || item.emerging) continue;
      const p = this.players.find((pl) => !pl.dead && overlaps(pl.body, item.body));
      if (p) {
        item.take();
        p.grow();
        if (!this.seenScale) {
          this.seenScale = true;
          this.hud.toast('Scale! More parameters: you grew. Big models can break bricks.', 'good');
        }
      }
    }
  }

  private collidePlayers(): void {
    for (const p of this.players) {
      if (p.dead || p.finished) continue;
      const pad = this.input.pads[this.players.indexOf(p)];
      for (const e of this.enemies) {
        if (!e.alive || !overlaps(p.body, e.body)) continue;
        if (isStomp(p, e.body)) {
          e.squash();
          p.bounce(pad.jump);
          sfx.stomp();
        } else if (!p.hurt()) {
          this.killPlayer(p);
        }
      }
      const boss = this.boss;
      if (boss?.alive && boss.awake && overlaps(p.body, boss.body)) {
        if (isStomp(p, boss.body) && boss.invulnerable <= 0) {
          boss.hit();
          p.bounce(true);
          sfx.stomp();
          if (!boss.alive) this.onBossDefeated();
          else this.hud.toast(`Filtered! ${boss.hp} more to go.`, 'good');
        } else if (boss.invulnerable <= 0 && !p.hurt()) {
          this.killPlayer(p);
        }
      }
    }
  }

  private onBossDefeated(): void {
    sfx.flag();
    for (const e of this.enemies) if (e.alive) e.squash();
    if (this.helper) this.helper.visible = true;
    this.hud.toast('Thank you! But AGI is in another castle!', 'good', 5000);
    this.beginClear();
  }

  private stepFlag(dt: number): void {
    const flag = this.flag;
    if (!flag) return;
    if (this.state === 'playing') {
      const reached = this.players.find((p) => !p.dead && p.body.x + p.body.w > flag.x - 0.1);
      if (reached) {
        sfx.flag();
        for (const p of this.players) p.body.x = Math.min(p.body.x, flag.x - p.body.w);
        this.beginClear();
      }
    }
    if (this.state === 'clear') {
      flag.slide = Math.min(1, flag.slide + dt * 1.2);
      const sprite = flag.group.getObjectByName('flag');
      if (sprite) sprite.position.y = 8.4 - flag.slide * 6.5;
    }
  }

  private beginClear(): void {
    this.state = 'clear';
    this.clearTimer = 2.2;
    for (const p of this.players) p.finished = true;
    this.players[0].setForm(this.spec.toward.name);
  }

  private killPlayer(p: PlayerActor): void {
    if (p.dead || this.state !== 'playing') return;
    p.kill();
    this.lives--;
    this.respawnTimer = 2.2;
  }

  private stepDeaths(dt: number): void {
    if (this.state === 'clear') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) void this.completeLevel();
      return;
    }
    if (this.respawnTimer <= 0) return;
    this.respawnTimer -= dt;
    if (this.respawnTimer > 0) return;

    const alive = this.players.filter((p) => !p.dead);
    if (this.lives <= 0) {
      void this.gameOver();
    } else if (alive.length === 0) {
      void this.loadLevel(this.levelIndex, true);
    } else {
      // Co-op: the fallen brother drops back in next to the survivor.
      const buddy = alive[0];
      for (const p of this.players.filter((pl) => pl.dead)) {
        p.dead = false;
        p.body.x = buddy.body.x;
        p.body.y = buddy.body.y + 3;
        p.body.vx = 0;
        p.body.vy = 0;
        p.invulnerable = 2;
      }
    }
  }

  private async completeLevel(): Promise<void> {
    this.state = 'ending';
    const match = dietMatch(this.counts, this.spec.recipe);
    const stars = historyStars(match);
    const next = this.levelIndex + 1;
    writeSave({ levelIndex: Math.min(next, LEVELS.length - 1), players: this.opts.players });

    const card = {
      ...this.spec.outro,
      lines: [
        `History stars: ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}. Your token mix matched the real training data ${Math.round(match * 100)}%.`,
        ...this.spec.outro.lines,
      ],
    };
    const diet = total(this.counts) > 0 ? { mine: shares(this.counts), real: this.spec.recipe } : undefined;
    await showFactCard(this.root, { card, color: CHARACTERS.gpt.color, diet, button: next < LEVELS.length ? 'Next level' : 'Continue' });

    if (next < LEVELS.length) {
      await this.loadLevel(next);
    } else {
      await showFactCard(this.root, { card: TO_BE_CONTINUED, color: CHARACTERS.claude.color, button: 'Back to title' });
      this.exit();
    }
  }

  private async gameOver(): Promise<void> {
    this.state = 'ending';
    await showFactCard(this.root, {
      card: {
        title: 'Game over',
        date: `World ${this.spec.id}`,
        lines: ['Training runs fail all the time. Labs restart from a checkpoint, and so can you: Continue from the title screen.'],
      },
      color: 0xff4d6d,
      button: 'Back to title',
    });
    this.exit();
  }

  private togglePause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.showPause(
        () => this.togglePause(),
        () => this.exit(),
      );
    } else if (this.state === 'paused') {
      this.hud.hidePause();
      this.state = 'playing';
    }
  }

  private exit(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    this.input.dispose();
    this.renderer.dispose();
    this.root.replaceChildren();
    this.opts.onExit();
  }

  private leadPlayer(): PlayerActor | undefined {
    return this.players.filter((p) => !p.dead).sort((a, b) => b.body.x - a.body.x)[0];
  }

  private placeCamera(dt: number): void {
    const alive = this.players.filter((p) => !p.dead);
    if (alive.length && this.state !== 'intro') {
      const center = alive.reduce((s, p) => s + p.body.x + p.body.w / 2, 0) / alive.length;
      const target = THREE.MathUtils.clamp(center + 1.5, this.halfW, this.grid.width - this.halfW);
      if (target > this.camX) this.camX += (target - this.camX) * Math.min(1, dt * 6);
    }
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const camY = this.halfH - 0.4 - this.bottomPad;
    const dist = this.halfH / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.camera.position.set(this.camX + shakeX, camY + shakeY, dist);
    this.camera.lookAt(this.camX + shakeX, camY + shakeY, 0);
  }

  private readonly resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    // Show about 15 tiles of height; on narrow screens zoom out a little to keep some width.
    this.bottomPad = this.isTouch ? 2.6 : 0;
    this.halfH = Math.max(7.6 + this.bottomPad / 2, 5.5 / aspect);
    this.halfW = this.halfH * aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.grid) this.camX = THREE.MathUtils.clamp(this.camX, this.halfW, this.grid.width - this.halfW);
  };
}

declare global {
  interface Window {
    __smb?: Record<string, (...args: number[]) => unknown>;
  }
}

/** A stomp: falling, and the feet were above the enemy's middle before this step. */
function isStomp(p: PlayerActor, enemy: Body): boolean {
  return p.body.vy < 0 && p.prevBottom >= enemy.y + enemy.h * 0.5;
}

