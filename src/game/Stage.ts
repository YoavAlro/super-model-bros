import * as THREE from 'three';
import { CHARACTERS, type CharacterId } from '../config/characters';
import type { LevelSpec, PowerId } from '../config/levelSpec';
import type { PathSpec } from '../config/paths';
import { THEMES } from '../config/themes';
import type { Settings } from '../save';
import type { Hud } from '../ui/Hud';
import { createBosses, type Boss } from './Bosses';
import type { StageCtx } from './ctx';
import { dietHint, dietMatch, emptyCounts, historyStars, total, type Counts } from './diet';
import { Enemy, Spambot } from './Enemies';
import type { Input } from './Input';
import { Debris, FunctionCall, PowerItem, Token, Trap, type ItemKind } from './Items';
import { LevelGrid, T } from './level';
import { LevelView } from './LevelView';
import { makeFlag, makeHelper } from './meshes';
import type { Pad } from './pad';
import { bumpedTile, forTilesUnder, overlaps, type Body } from './physics';
import { PlayerActor } from './Player';
import { mulberry32 } from './rng';
import { sfx } from './sfx';

export const STEP = 1 / 120;
const FOV = 40;
const ALIGN_START = 50;

export interface StageOptions {
  spec: LevelSpec;
  path: PathSpec;
  /** The hero's name tag entering the level. */
  form: string;
  chars: CharacterId[];
  lives: number;
  perks: string[];
  flags: string[];
  settings: Settings;
}

export interface StageResult {
  outcome: 'clear' | 'gameover' | 'quit';
  lives: number;
  counts: Counts;
  match: number;
  stars: 1 | 2 | 3;
  alignment: number | null;
  deaths: number;
  flags: string[];
}

type State = 'intro' | 'playing' | 'paused' | 'clear' | 'done';

/** Runs one level: builds it from its spec, simulates in fixed steps, and resolves when it ends. */
export class Stage implements StageCtx {
  scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  grid!: LevelGrid;
  private view!: LevelView;
  private playersList: PlayerActor[] = [];
  private enemies: Enemy[] = [];
  private tokens: Token[] = [];
  private items: PowerItem[] = [];
  private trapList: Trap[] = [];
  private shots: { shot: FunctionCall; owner: PlayerActor }[] = [];
  private debris: Debris[] = [];
  private bosses: Boss[] = [];
  private helper: THREE.Group | null = null;
  private flag: { group: THREE.Group; x: number; y: number; slide: number } | null = null;

  private state: State = 'intro';
  lives: number;
  private counts: Counts = emptyCounts();
  private alignment: number | null;
  private deaths = 0;
  private readonly newFlags = new Set<string>();
  private accumulator = 0;
  time = 0;
  private camX = 0;
  private halfW = 10;
  private halfH = 7.5;
  private bottomPad = 0;
  private shakeTime = 0;
  private clearTimer = 0;
  private respawnTimer = 0;
  private hudTimer = 0;
  private readonly seen = new Set<string>();
  private random: () => number;
  private resolve!: (r: StageResult) => void;
  readonly done: Promise<StageResult>;

  constructor(
    private readonly opts: StageOptions,
    private readonly input: Input,
    private readonly hud: Hud,
    private readonly isTouch: boolean,
  ) {
    this.lives = opts.lives;
    this.alignment = opts.spec.world >= 2 ? ALIGN_START : null;
    this.random = mulberry32(hashString(opts.spec.id));
    this.done = new Promise((r) => (this.resolve = r));
    this.build();
  }

  get spec(): LevelSpec {
    return this.opts.spec;
  }

  // ------------------------------------------------------------------ StageCtx
  rng(): number {
    return this.random();
  }
  players(): PlayerActor[] {
    return this.playersList.filter((p) => !p.dead);
  }
  lead(): PlayerActor | undefined {
    return this.players().sort((a, b) => b.body.x - a.body.x)[0];
  }
  get camLeft(): number {
    return this.camX - this.halfW;
  }
  get camRight(): number {
    return this.camX + this.halfW;
  }
  toast(message: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    this.hud.toast(message, kind);
  }
  shake(amount: number): void {
    if (!this.opts.settings.reduceMotion) this.shakeTime = Math.max(this.shakeTime, amount);
  }
  addEnemy(e: Enemy): void {
    this.enemies.push(e);
  }
  addTrap(t: Trap): void {
    this.trapList.push(t);
  }
  traps(): Trap[] {
    return this.trapList;
  }

  // ------------------------------------------------------------------- setup
  private build(): void {
    this.disposeScene();
    this.scene = new THREE.Scene();
    const spec = this.spec;
    const theme = THEMES[spec.theme];
    const light = theme.light ?? 1;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2 * light));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6 * light);
    sun.position.set(-4, 10, 8);
    this.scene.add(sun);

    this.grid = new LevelGrid(spec.map);
    this.view = new LevelView(this.grid, theme, this.scene);
    this.counts = emptyCounts();
    this.enemies = [];
    this.tokens = [];
    this.items = [];
    this.trapList = [];
    this.shots = [];
    this.debris = [];
    this.bosses = [];
    this.helper = null;
    this.flag = null;
    this.accumulator = 0;
    this.shakeTime = 0;
    this.clearTimer = 0;
    this.respawnTimer = 0;
    this.time = 0;
    this.random = mulberry32(hashString(spec.id) + this.deaths);
    if (this.alignment !== null) this.alignment = ALIGN_START;

    const spawn = this.grid.spawnOf('spawn') ?? { x: 2, y: 2 };
    this.playersList = this.opts.chars.map((id, i) => {
      const spec = CHARACTERS[id];
      const tag = id === this.opts.path.hero ? this.opts.form : spec.name;
      const p = new PlayerActor(spec, tag, spawn.x + i * 1.2, spawn.y, this.scene, i);
      p.ability = this.spec.ability;
      for (const perk of this.opts.perks) p.perks.add(perk);
      return p;
    });
    this.updateSight();

    for (const s of this.grid.spawns) {
      if (s.kind === 'spambot') this.enemies.push(new Spambot(s.x, s.y, this.scene));
      else if (s.kind === 'token' && s.token) this.tokens.push(new Token(s.token, s.x, s.y, this.scene));
      else if (s.kind === 'rewardOrb') this.trapList.push(new Trap('rewardOrb', s.x, s.y, this.scene));
      else if (s.kind === 'boss' && spec.boss) this.bosses.push(...createBosses(spec.boss, s.x, s.y, this.scene));
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
    this.resize();
    this.camX = this.halfW;
  }

  /** Starts the simulation (the level is drawn behind its intro card until then). */
  begin(): void {
    if (this.state === 'intro') this.state = 'playing';
    this.input.clear();
  }

  // -------------------------------------------------------------- frame loop
  frame(dt: number, t: number, renderer: THREE.WebGLRenderer): void {
    if (this.input.consumePause() && this.state !== 'intro') this.togglePause();
    // Portrait phones show a "rotate your phone" overlay; hold the game until it turns.
    const portraitTouch = this.isTouch && window.innerHeight > window.innerWidth;
    if (!portraitTouch && (this.state === 'playing' || this.state === 'clear')) {
      this.input.update();
      // Assist mode runs the whole simulation a little slower.
      this.accumulator += dt * (this.opts.settings.assist ? 0.8 : 1);
      while (this.accumulator >= STEP) {
        this.simulate(STEP);
        this.accumulator -= STEP;
      }
    }

    this.view.update(dt);
    for (const p of this.playersList) p.updateMesh(t, dt);
    for (const e of this.enemies) e.updateMesh(t);
    for (const tok of this.tokens) tok.updateMesh(t);
    for (const item of this.items) item.updateMesh(t);
    for (const trap of this.trapList) trap.updateMesh(t);
    for (const s of this.shots) s.shot.updateMesh(t);
    for (const b of this.bosses) b.updateMesh(t);
    if (this.helper?.visible) this.helper.position.y = this.grid.spawnOf('helper')!.y + Math.abs(Math.sin(t * 5)) * 0.3;
    this.placeCamera(dt);
    renderer.render(this.scene, this.camera);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.updateHud();
    }
  }

  private simulate(dt: number): void {
    this.time += dt;
    const camLeft = this.camLeft;
    const camRight = this.camRight;

    for (const p of this.playersList) {
      const pad = this.input.pads[p.padIndex] ?? this.input.pads[0];
      const ev = p.step(dt, pad, this.grid);
      if (ev) {
        const bumped = bumpedTile(p.body, ev.hits);
        if (bumped) this.hitBlock(bumped.tx, bumped.ty, p);
      }
      if (!p.dead) {
        // Players can't leave the screen; the camera only scrolls forward.
        if (p.body.x < camLeft) {
          p.body.x = camLeft;
          p.body.vx = Math.max(0, p.body.vx);
        }
        if (this.playersList.length > 1 && p.body.x + p.body.w > camRight) {
          p.body.x = camRight - p.body.w;
          p.body.vx = Math.min(0, p.body.vx);
        }
        if (p.body.y < -3) this.killPlayer(p);
        else this.touchHazards(p);
        this.usePower(p, pad);
      }
    }
    this.updateSight();

    for (const e of this.enemies) {
      if (!e.active && e.body.x < camRight + 2) e.active = true;
      if (e.active) e.step(dt, this);
    }
    this.stepBosses(dt);
    this.stepPickups(dt);
    this.stepShots(dt);
    this.collidePlayers();
    this.stepFlag(dt);
    this.stepDeaths(dt);
    this.debris = this.debris.filter((d) => d.step(dt));
    this.shakeTime = Math.max(0, this.shakeTime - dt);
  }

  /** Hidden blocks exist for anyone with vision, and for everyone while someone thinks. */
  private updateSight(): void {
    const sees = this.playersList.some(
      (p) => !p.dead && (p.thinking || p.spec.traitKind === 'seeHidden' || !!p.ability?.vision),
    );
    if (sees !== this.grid.solidity.hiddenSolid) {
      this.grid.solidity.hiddenSolid = sees;
      this.view?.setHiddenVisible(sees);
    }
  }

  private usePower(p: PlayerActor, _pad: Pad): void {
    if (!p.actionPressed || p.cooldown > 0) return;
    if (p.power === 'tool') {
      if (this.shots.filter((s) => s.owner === p && s.shot.alive).length >= 2) return;
      const b = p.body;
      const dir = p.mover.facing;
      this.shots.push({ shot: new FunctionCall(b.x + (dir > 0 ? b.w : -0.4), b.y + b.h * 0.55, dir, this.scene), owner: p });
      p.cooldown = 0.22;
      sfx.shoot();
    }
  }

  private touchHazards(p: PlayerActor): void {
    let lava = false;
    let spikes = false;
    forTilesUnder(p.body, 0.02, (tx, ty) => {
      const tile = this.grid.get(tx, ty);
      if (tile === T.LAVA) lava = true;
      else if (tile === T.SPIKES) spikes = true;
    });
    if (lava) this.killPlayer(p);
    else if (spikes && !p.hurt()) this.killPlayer(p);
    else if (spikes) p.body.vy = 12;
  }

  private hitBlock(tx: number, ty: number, p: PlayerActor): void {
    const tile = this.grid.get(tx, ty);
    if (tile === T.QUESTION) {
      this.grid.set(tx, ty, T.USED);
      this.view.activate(tx, ty);
      const content = this.grid.contents.get(this.grid.index(tx, ty));
      if (content === 'scale') this.items.push(new PowerItem('scale', tx, ty + 1, this.scene));
      else if (content === 'power') this.items.push(new PowerItem(this.powerItem(), tx, ty + 1, this.scene));
      else if (content === 'oneup') this.items.push(new PowerItem('oneup', tx, ty + 1, this.scene));
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
    // Bumping a block from below knocks off whatever stands on it.
    const above = { x: tx, y: ty + 1, w: 1, h: 0.6, vx: 0, vy: 0, onGround: false };
    for (const e of this.enemies) if (e.alive && e.active && e.shootable && overlaps(e.body, above)) e.onShot(this);
  }

  private powerItem(): ItemKind {
    const power: PowerId = this.spec.power ?? 'rlhf';
    return power;
  }

  private stepBosses(dt: number): void {
    if (!this.bosses.length) return;
    const lead = this.lead();
    for (const boss of this.bosses) {
      if (!boss.awake && lead && lead.body.x > boss.body.x - 16) {
        boss.awake = true;
        if (boss === this.bosses[0]) {
          this.hud.toast(boss.intro, 'bad');
          sfx.boss();
        }
      }
      if (!boss.awake) continue;
      if (boss.step(dt, this)) {
        this.shake(0.35);
        sfx.boss();
      }
      // The arena is the screen: bosses never leave it.
      if (boss.alive) {
        const b = boss.body;
        b.x = THREE.MathUtils.clamp(b.x, this.camLeft + 0.2, this.camRight - b.w - 0.2);
      }
    }
  }

  private stepPickups(dt: number): void {
    for (const tok of this.tokens) {
      if (tok.taken) continue;
      const collect = tok.pop ? tok.step(dt) : this.players().some((p) => overlaps(p.body, tok.body));
      if (collect) {
        tok.take();
        this.counts[tok.type]++;
        if (tok.type === 'feedback' && this.alignment !== null) this.alignment = Math.min(100, this.alignment + 1);
        if (tok.type === 'shadow') this.newFlags.add('shadowBooks');
        sfx.token();
      }
    }
    for (const item of this.items) {
      item.step(dt, this.grid);
      if (item.taken || item.emerging) continue;
      const p = this.players().find((pl) => overlaps(pl.body, item.body));
      if (p) {
        item.take();
        this.applyItem(item.kind, p);
      }
    }
    for (const trap of this.trapList) {
      trap.step(dt, this.grid);
      if (trap.taken) continue;
      const p = this.players().find((pl) => overlaps(pl.body, trap.body));
      if (!p) continue;
      trap.take();
      sfx.trap();
      if (trap.kind === 'rewardOrb') {
        if (this.alignment !== null) this.alignment = Math.max(0, this.alignment - 15);
        this.once('orb', 'A fake reward! It looked like progress, but Alignment dropped.', 'bad');
      }
    }
  }

  private applyItem(kind: ItemKind, p: PlayerActor): void {
    switch (kind) {
      case 'scale':
        p.grow();
        sfx.powerup();
        this.once('scale', 'Scale! More parameters: you grew. Big models can break bricks.', 'good');
        break;
      case 'rlhf':
        p.giveStar('rlhf', 8);
        if (this.alignment !== null) this.alignment = Math.min(100, this.alignment + 20);
        sfx.star();
        this.once('rlhf', 'RLHF star! Human feedback makes you invincible and raises Alignment.', 'good');
        break;
      case 'viral':
        p.giveStar('viral', 10);
        sfx.star();
        break;
      case 'tool':
        p.givePower('tool');
        sfx.powerup();
        this.once('tool', `Tool flower! Press ${this.isTouch ? '✦' : 'S / ↓'} to call functions.`, 'good');
        break;
      case 'cape':
        p.givePower('cape');
        sfx.powerup();
        this.once('cape', `Reasoning cape! Hold jump to glide. Hold ${this.isTouch ? '✦' : 'S / ↓'} to think and see hidden paths.`, 'good');
        break;
      case 'oneup':
        this.lives++;
        sfx.oneup();
        this.hud.toast('Tibo Reset! +1 life.', 'good');
        break;
      default:
        sfx.powerup();
    }
  }

  private stepShots(dt: number): void {
    for (const s of this.shots) {
      const shot = s.shot;
      shot.step(dt, this.grid);
      if (!shot.alive) continue;
      for (const e of this.enemies) {
        if (e.alive && e.active && e.shootable && overlaps(e.body, shot.body)) {
          e.onShot(this);
          shot.pop();
          sfx.stomp();
          break;
        }
      }
      if (!shot.alive) continue;
      for (const boss of this.bosses) {
        if (boss.awake && boss.alive && overlaps(boss.body, shot.body)) {
          shot.pop();
          if (boss.vulnerable()) {
            boss.hit(this);
            sfx.stomp();
            if (this.bosses.every((b) => !b.alive)) this.onBossesDefeated();
          }
          break;
        }
      }
    }
    this.shots = this.shots.filter((s) => {
      if (!s.shot.alive) s.shot.dispose();
      return s.shot.alive;
    });
  }

  private collidePlayers(): void {
    for (const p of this.playersList) {
      if (p.dead || p.finished) continue;
      const pad = this.input.pads[p.padIndex] ?? this.input.pads[0];
      for (const e of this.enemies) {
        if (!e.alive || !e.active || !overlaps(p.body, e.body)) continue;
        if (p.invincible) {
          if (e.shootable) {
            e.defeat(false);
            sfx.stomp();
          }
        } else if (e.stompable && isStomp(p, e.body)) {
          e.onStomp(this);
          p.bounce(pad.jump);
          sfx.stomp();
        } else if (e.harmful && !p.hurt()) {
          this.killPlayer(p);
        }
      }
      for (const boss of this.bosses) {
        if (!boss.alive || !boss.awake || !overlaps(p.body, boss.body)) continue;
        if ((p.invincible || isStomp(p, boss.body)) && boss.vulnerable()) {
          boss.hit(this);
          p.bounce(true);
          sfx.stomp();
          if (this.bosses.every((b) => !b.alive)) this.onBossesDefeated();
        } else if (boss.harmful() && !p.invincible) {
          if (!p.hurt()) this.killPlayer(p);
          else p.body.vx = Math.sign(p.body.x - boss.body.x) * 10;
        }
      }
    }
  }

  private onBossesDefeated(): void {
    sfx.flag();
    for (const e of this.enemies) if (e.alive) e.defeat(true);
    for (const t of this.trapList) t.take();
    if (this.helper) this.helper.visible = true;
    this.hud.toast('Thank you! But AGI is in another castle!', 'good', 5000);
    this.beginClear();
  }

  private stepFlag(dt: number): void {
    const flag = this.flag;
    if (!flag) return;
    if (this.state === 'playing') {
      const reached = this.players().find((p) => p.body.x + p.body.w > flag.x - 0.1);
      if (reached) {
        sfx.flag();
        for (const p of this.playersList) p.body.x = Math.min(p.body.x, flag.x - p.body.w);
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
    if (this.state !== 'playing') return;
    this.state = 'clear';
    this.clearTimer = 2.2;
    for (const p of this.playersList) {
      p.finished = true;
      if (p.spec.id === this.opts.path.hero) p.setForm(this.spec.toward.name);
    }
  }

  private killPlayer(p: PlayerActor): void {
    if (p.dead || this.state !== 'playing') return;
    p.kill();
    if (p.clone) return;
    this.lives--;
    this.deaths++;
    this.respawnTimer = 2.2;
  }

  private stepDeaths(dt: number): void {
    if (this.state === 'clear') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this.finish('clear');
      return;
    }
    if (this.respawnTimer <= 0) return;
    this.respawnTimer -= dt;
    if (this.respawnTimer > 0) return;

    const alive = this.playersList.filter((p) => !p.dead && !p.clone);
    if (this.lives <= 0) {
      this.finish('gameover');
    } else if (alive.length === 0) {
      this.build();
    } else {
      // Co-op: the fallen brother drops back in next to the survivor.
      const buddy = alive[0];
      for (const p of this.playersList.filter((pl) => pl.dead && !pl.clone)) p.revive(buddy.body.x, buddy.body.y + 3);
    }
  }

  private finish(outcome: StageResult['outcome']): void {
    if (this.state === 'done') return;
    this.state = 'done';
    const match = dietMatch(this.counts, this.spec.recipe);
    this.resolve({
      outcome,
      lives: this.lives,
      counts: { ...this.counts },
      match,
      stars: historyStars(match),
      alignment: this.alignment,
      deaths: this.deaths,
      flags: [...this.newFlags],
    });
  }

  quit(): void {
    this.finish('quit');
  }

  private togglePause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.showPause(
        () => this.togglePause(),
        () => {
          this.hud.hidePause();
          this.quit();
        },
      );
    } else if (this.state === 'paused') {
      this.hud.hidePause();
      this.input.clear();
      this.state = 'playing';
    }
  }

  /** A toast shown once per level. */
  private once(key: string, message: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.hud.toast(message, kind);
  }

  // ------------------------------------------------------------------ camera
  private placeCamera(dt: number): void {
    const alive = this.playersList.filter((p) => !p.dead && !p.clone);
    // During a boss fight the camera scrolls to the end of the level and holds the arena.
    const bossFight = this.bosses.some((b) => b.awake && b.alive);
    if (alive.length || bossFight) {
      const center = alive.reduce((s, p) => s + p.body.x + p.body.w / 2, 0) / Math.max(1, alive.length);
      const target = THREE.MathUtils.clamp(bossFight ? this.grid.width : center + 1.5, this.halfW, this.grid.width - this.halfW);
      if (target > this.camX) this.camX += (target - this.camX) * Math.min(1, dt * 6);
    }
    const shake = this.shakeTime;
    const shakeX = shake > 0 ? Math.sin(this.time * 90) * shake * 0.5 : 0;
    const shakeY = shake > 0 ? Math.cos(this.time * 77) * shake * 0.5 : 0;
    const camY = this.halfH - 0.4 - this.bottomPad;
    const dist = this.halfH / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.camera.position.set(this.camX + shakeX, camY + shakeY, dist);
    this.camera.lookAt(this.camX + shakeX, camY + shakeY, 0);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    // Show about 15 tiles of height; on narrow screens zoom out a little to keep some width.
    this.bottomPad = this.isTouch ? 2.6 : 0;
    this.halfH = Math.max(7.6 + this.bottomPad / 2, 5.5 / aspect);
    this.halfW = this.halfH * aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    if (this.grid) this.camX = THREE.MathUtils.clamp(this.camX, this.halfW, Math.max(this.halfW, this.grid.width - this.halfW));
  }

  // --------------------------------------------------------------------- HUD
  private updateHud(): void {
    const spec = this.spec;
    const hero = this.playersList.find((p) => !p.clone);
    this.hud.update({
      level: spec,
      players: this.playersList
        .filter((p) => !p.clone)
        .map((p) => ({ name: p.spec.name, form: p.form, color: p.spec.color })),
      lives: this.lives,
      tokens: total(this.counts),
      counts: this.counts,
      offered: this.grid.tokenTypes(spec.blockToken),
      match: dietMatch(this.counts, spec.recipe),
      hint: dietHint(this.counts, spec.recipe, spec.toward.name),
      alignment: this.alignment,
      bosses: this.bosses.filter((b) => b.awake).map((b) => ({ name: b.name, hp: b.hp, max: b.maxHp })),
    });
    this.input.setPowerLabel(hero?.power === 'tool' ? 'fn' : hero?.power === 'cape' ? '∴' : null);
  }

  // ------------------------------------------------------------------- debug
  /** Test hooks for smoke tests (enabled with ?debug). */
  debug() {
    return {
      state: () => this.state,
      level: () => this.spec.id,
      lives: () => this.lives,
      alignment: () => this.alignment,
      counts: () => ({ ...this.counts }),
      bossHp: () => (this.bosses.length ? this.bosses.reduce((s, b) => s + b.hp, 0) : null),
      bosses: () => this.bosses.map((b) => ({ name: b.name, hp: b.hp, x: b.body.x, y: b.body.y, w: b.body.w, h: b.body.h, vulnerable: b.vulnerable() })),
      boss: () => {
        const b = this.bosses.find((bb) => bb.alive) ?? this.bosses[0];
        return b ? { x: b.body.x, y: b.body.y, w: b.body.w, h: b.body.h } : null;
      },
      flag: () => (this.flag ? { x: this.flag.x, y: this.flag.y } : null),
      player: () => {
        const b = this.playersList[0].body;
        return { x: b.x, y: b.y, big: this.playersList[0].big, power: this.playersList[0].power };
      },
      teleport: (x: number, y: number) => {
        const b = this.playersList[0].body;
        b.x = x;
        b.y = y;
        b.vx = 0;
        b.vy = 0;
        this.camX = Math.max(this.camX, Math.min(x, this.grid.width - this.halfW));
      },
      invincible: () => (this.playersList[0].invulnerable = 999),
      /** Drops player 1 onto the first boss that can be stomped right now. */
      stomp: () => {
        const b = this.bosses.find((bb) => bb.alive && bb.awake && bb.vulnerable()) ?? this.bosses.find((bb) => bb.alive);
        if (!b) return false;
        const p = this.playersList[0].body;
        if (!b.awake) {
          p.x = b.body.x - 8;
          p.y = b.body.y + 1;
        } else {
          p.x = b.body.x + b.body.w / 2 - p.w / 2;
          p.y = b.body.y + b.body.h + 1.2;
        }
        p.vx = 0;
        p.vy = -2;
        this.camX = Math.max(this.camX, Math.min(p.x, this.grid.width - this.halfW));
        return true;
      },
      give: (kind: ItemKind) => this.applyItem(kind, this.playersList[0]),
      items: () => this.items.filter((i) => !i.taken).map((i) => ({ kind: i.kind, x: i.body.x, y: i.body.y })),
      traps: () => this.trapList.filter((t) => !t.taken).map((t) => ({ kind: t.kind, x: t.body.x, y: t.body.y })),
      star: () => this.playersList[0].star,
    };
  }

  // ----------------------------------------------------------------- cleanup
  private disposeScene(): void {
    for (const p of this.playersList) p.dispose();
    disposeObject(this.scene);
  }

  dispose(): void {
    this.disposeScene();
  }
}

/** A stomp: falling, and the feet were above the enemy's middle before this step. */
function isStomp(p: PlayerActor, enemy: Body): boolean {
  return p.body.vy < 0 && p.prevBottom >= enemy.y + enemy.h * 0.5;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Frees every geometry, material and texture under a scene, except the ones shared across levels. */
export function disposeObject(root: THREE.Object3D): void {
  const seen = new Set<unknown>();
  const free = (thing: { dispose(): void; userData?: Record<string, unknown> } | null | undefined) => {
    if (!thing || seen.has(thing) || thing.userData?.shared) return;
    seen.add(thing);
    thing.dispose();
  };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) free(mesh.geometry);
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      if (m.userData.shared) continue;
      for (const value of Object.values(m)) if (value instanceof THREE.Texture) free(value);
      free(m);
    }
  });
  const bg = (root as THREE.Scene).background;
  if (bg instanceof THREE.Texture) free(bg);
}
