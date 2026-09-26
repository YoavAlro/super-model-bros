import * as THREE from 'three';
import { CHARACTERS, type CharacterId } from '../config/characters';
import { HYPES, MOMENTS, STORMS, type HypeSpec, type MomentId, type StormSpec } from '../config/events';
import type { LevelSpec, PowerId } from '../config/levelSpec';
import type { PathSpec } from '../config/paths';
import { THEMES } from '../config/themes';
import { tip } from '../config/types';
import type { Settings } from '../save';
import { showFactCard } from '../ui/FactCard';
import type { Hud } from '../ui/Hud';
import { createBosses, type Boss } from './Bosses';
import type { StageCtx } from './ctx';
import { dietHint, dietMatch, emptyCounts, historyStars, total, type Counts } from './diet';
import { Enemy, Jailbreaker, Spambot, Timeline } from './Enemies';
import type { Input } from './Input';
import { Debris, FunctionCall, Heart, PowerItem, Token, Trap, type ItemKind } from './Items';
import { LevelGrid, T } from './level';
import { LevelView } from './LevelView';
import { HANGOVER_SPEED, bankReset, codeRedPar, judgeHype, tiboDue, type HypeCallValue } from './hype';
import { makeAura, makeBridge, makeBuiltBlock, makeCrowd, makeEmDash, makeFlag, makeFogWall, makeGhost4o, makeHelper, makeParticles } from './meshes';
import type { Pad } from './pad';
import { bumpedTile, forTilesUnder, overlaps, type Body } from './physics';
import { emptyPad } from './pad';
import { MovingPlatform, StaticPlatform, type Platform } from './Platforms';
import { PlayerActor } from './Player';
import { mulberry32 } from './rng';
import { sfx } from './sfx';
import { stormDay } from './storm';

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
  /** Where mid-level cards (hype verdicts) are shown. */
  root: HTMLElement;
  /** Banked Tibo resets carried in from earlier levels. */
  resets?: number;
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
  /** Heart tokens collected (storms). */
  hearts: number;
  /** True when a storm was ended early by its hearts. */
  endedEarly: boolean;
  /** Hype calls made in this level. */
  hypes: { id: string; call: HypeCallValue; correct: boolean }[];
  /** Perks earned from lasting hypes. */
  perks: string[];
  /** Moments that happened, for the outro card. */
  moments: MomentId[];
  /** Banked Tibo resets. */
  resets: number;
}

type State = 'intro' | 'playing' | 'paused' | 'card' | 'clear' | 'done';

interface ActiveHype {
  spec: HypeSpec;
  owner: PlayerActor;
  left: number;
  fuel: number;
  built: StaticPlatform[];
  aura: THREE.Object3D | null;
}

/** Runs one level: builds it from its spec, simulates in fixed steps, and resolves when it ends. */
export class Stage implements StageCtx {
  scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  grid!: LevelGrid;
  private view!: LevelView;
  private playersList: PlayerActor[] = [];
  private enemyList: Enemy[] = [];
  private tokens: Token[] = [];
  private items: PowerItem[] = [];
  private trapList: Trap[] = [];
  private hearts: Heart[] = [];
  private platforms: Platform[] = [];
  private riding = new Map<PlayerActor, Platform>();
  private shots: { shot: FunctionCall; owner: PlayerActor }[] = [];
  private debris: Debris[] = [];
  private bosses: Boss[] = [];
  private helper: THREE.Group | null = null;
  private flag: { group: THREE.Group; x: number; y: number; slide: number } | null = null;
  private crowd: THREE.Group | null = null;
  private readonly trail: { x: number; y: number }[] = [];

  private readonly storm: StormSpec | null;
  private day = -1;
  private heartCount = 0;
  private endedEarly = false;
  private fogX = 0;
  private fogWall: THREE.Group | null = null;
  private rainTimer = 0;
  private toggleTimer = 0;

  private hype: ActiveHype | null = null;
  private readonly hypeCalls: StageResult['hypes'] = [];
  private readonly perksEarned: string[] = [];
  private hangover = 0;
  private readonly happened = new Set<MomentId>();
  private emDashes: StaticPlatform[] = [];
  private goldenGate = 0;
  private bridges: StaticPlatform[] = [];
  private ghost: THREE.Group | null = null;
  private ghostKept = false;
  private codeRed = false;
  private tiboGiven = false;
  private resets = 0;
  private safetyNetUsed = false;
  private confetti: THREE.Points | null = null;
  private snow: THREE.Points | null = null;
  private yawn = 0;

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
    this.storm = opts.spec.storm ? STORMS[opts.spec.storm] : null;
    this.resets = opts.resets ?? 0;
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
    this.enemyList.push(e);
  }
  enemies(): Enemy[] {
    return this.enemyList;
  }
  addPlatform(p: Platform): void {
    this.platforms.push(p);
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
    this.enemyList = [];
    this.tokens = [];
    this.items = [];
    this.trapList = [];
    this.hearts = [];
    this.platforms = [];
    this.riding.clear();
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
    this.day = -1;
    this.heartCount = 0;
    this.rainTimer = 1;
    this.toggleTimer = 0;
    this.trail.length = 0;
    this.hype = null;
    this.hangover = 0;
    this.emDashes = [];
    this.goldenGate = 0;
    this.bridges = [];
    this.ghost = null;
    this.ghostKept = false;
    this.safetyNetUsed = false;
    this.confetti = null;
    this.snow = null;
    this.yawn = 0;
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

    const mood = spec.timeline ?? 'hype';
    for (const s of this.grid.spawns) {
      if (s.kind === 'spambot') this.enemyList.push(new Spambot(s.x, s.y, this.scene));
      else if (s.kind === 'jailbreaker') this.enemyList.push(new Jailbreaker(s.x, s.y, this.scene));
      else if (s.kind === 'timeline') this.enemyList.push(new Timeline(s.x, s.y, this.scene, mood));
      else if (s.kind === 'token' && s.token) this.tokens.push(new Token(s.token, s.x, s.y, this.scene));
      else if (s.kind === 'rewardOrb') this.trapList.push(new Trap('rewardOrb', s.x, s.y, this.scene));
      else if (s.kind === 'praise') this.trapList.push(new Trap('praise', s.x, s.y, this.scene));
      else if (s.kind === 'heart') this.hearts.push(new Heart(s.x, s.y, this.scene));
      else if (s.kind === 'platform') this.platforms.push(new MovingPlatform(s.x, s.y, this.scene, theme.platform));
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

    if (this.storm?.fog) {
      this.fogX = this.storm.fog.start;
      this.fogWall = makeFogWall();
      this.scene.add(this.fogWall);
      this.scene.fog = new THREE.Fog(0xc8ccd8, 18, 42);
    }
    this.crowd = makeCrowd(10);
    this.crowd.visible = false;
    this.scene.add(this.crowd);

    // Level-wide Moments.
    const moments = spec.moments ?? [];
    if (moments.includes('keep4o')) {
      this.ghost = makeGhost4o();
      this.ghost.position.set(spawn.x - 1, spawn.y + 0.5, -0.3);
      this.scene.add(this.ghost);
      this.ghostKept = true;
    }
    this.codeRed = moments.includes('codeRed');
    if (this.codeRed) {
      const alarm = new THREE.PointLight(0xff2030, 30, 60);
      alarm.name = 'alarm';
      this.scene.add(alarm);
    }
    if (spec.zones?.some((z) => z.moment === 'winterLaziness')) {
      this.snow = makeParticles(260, [0xffffff, 0xdfeaff], 0.18);
      this.scene.add(this.snow);
    }
    this.grid.conveyorSign = 1;
    this.view.setConveyorSign(1);
    this.view.setPhase(0);
    this.resize();
    this.camX = this.halfW;
  }

  /** Starts the simulation (the level is drawn behind its intro card until then). */
  begin(): void {
    if (this.state === 'intro') this.state = 'playing';
    this.input.clear();
    const moments = this.spec.moments ?? [];
    if (moments.includes('emDashFixed')) this.happen('emDashFixed');
    if (moments.includes('keep4o')) this.happen('keep4o');
    if (moments.includes('codeRed')) this.happen('codeRed');
  }

  /** A Moment happened: toast it once, and remember it for the outro card. */
  private happen(id: MomentId, toast = true): void {
    if (this.happened.has(id)) return;
    this.happened.add(id);
    if (toast) this.hud.toast(MOMENTS[id].toast, 'info', 3600);
  }

  /** Living players who are not clones. */
  private heroes(): PlayerActor[] {
    return this.playersList.filter((p) => !p.dead && !p.clone);
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
    for (const e of this.enemyList) e.updateMesh(t);
    for (const tok of this.tokens) tok.updateMesh(t);
    for (const item of this.items) item.updateMesh(t);
    for (const trap of this.trapList) trap.updateMesh(t);
    for (const h of this.hearts) h.updateMesh(t);
    for (const pl of this.platforms) pl.updateMesh(t);
    for (const s of this.shots) s.shot.updateMesh(t);
    for (const b of this.bosses) b.updateMesh(t);
    if (this.helper?.visible) this.helper.position.y = this.grid.spawnOf('helper')!.y + Math.abs(Math.sin(t * 5)) * 0.3;
    this.updateCrowd(t);
    this.animateParticles(t);
    if (this.fogWall) this.fogWall.position.x = this.fogX;
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
    if (this.storm?.autoscroll && this.state === 'playing') {
      this.camX = Math.min(this.camX + this.storm.autoscroll * dt, this.grid.width - this.halfW);
    }
    const camLeft = this.camLeft;
    const camRight = this.camRight;

    // Platforms move first and carry whoever stands on them.
    for (const pl of this.platforms) {
      if (!pl.alive) continue;
      const rider = [...this.riding].find(([, on]) => on === pl)?.[0];
      pl.step(dt, this, rider ? this.padOf(rider) : null);
      for (const [p, on] of this.riding) {
        if (on !== pl) continue;
        if (pl.steerable) {
          p.body.x = pl.body.x + pl.body.w / 2 - p.body.w / 2;
          p.body.vx = 0;
        } else {
          p.body.x += pl.dx;
        }
        p.body.y += pl.dy;
      }
    }
    this.riding.clear();

    for (const p of this.playersList) {
      const pad = this.padOf(p);
      const ev = p.step(dt, pad, this.grid);
      if (ev) {
        const bumped = bumpedTile(p.body, ev.hits);
        if (bumped) this.hitBlock(bumped.tx, bumped.ty, p);
        if (ev.landed) this.springOffPipe(p);
        if (ev.jumped && !p.clone) this.dropEmDash(p);
      }
      if (p.dead) continue;
      this.landOnPlatforms(p);
      if (!p.clone) this.catchWithSafetyNet(p);
      // Players can't leave the screen; the camera only scrolls forward.
      if (p.body.x < camLeft) {
        p.body.x = camLeft;
        p.body.vx = Math.max(0, p.body.vx);
        // An auto-scrolling edge that pushes you into a wall crushes you.
        if (this.storm?.autoscroll && this.overlapsSolid(p.body)) this.killPlayer(p);
      }
      if ((this.playersList.length > 1 || this.storm?.autoscroll) && p.body.x + p.body.w > camRight) {
        p.body.x = camRight - p.body.w;
        p.body.vx = Math.min(0, p.body.vx);
      }
      if (p.body.y < -3) this.killPlayer(p);
      else this.touchHazards(p);
      this.usePower(p, pad);
      p.speedScale = this.speedScaleFor(p, dt);
    }
    this.updateSight();
    this.stepHype(dt);
    this.stepMoments(dt);

    for (const e of this.enemyList) {
      if (!e.active && e.body.x < camRight + 2) e.active = true;
      if (e.active) e.step(dt, this);
    }
    this.stepBosses(dt);
    this.stepPickups(dt);
    this.stepShots(dt);
    this.collidePlayers();
    this.stepSetPieces(dt);
    this.stepStorm(dt);
    this.stepFlag(dt);
    this.stepDeaths(dt);
    this.debris = this.debris.filter((d) => d.step(dt));
    this.shakeTime = Math.max(0, this.shakeTime - dt);
  }

  private padOf(p: PlayerActor): Pad {
    const pad = this.input.pads[p.padIndex] ?? this.input.pads[0];
    return p.brain ? p.brain(p, pad) : pad;
  }

  /** Fog, Winter Laziness and hype hangovers all slow you down. */
  private speedScaleFor(p: PlayerActor, dt: number): number {
    let scale = 1;
    if (this.storm?.fog && p.body.x < this.fogX) scale *= this.storm.fog.slow;
    if (!p.clone && this.hangover > 0) scale *= HANGOVER_SPEED;
    const lazy = this.spec.zones?.find((z) => z.moment === 'winterLaziness' && p.body.x >= z.from && p.body.x <= z.to);
    if (lazy && !p.clone) {
      this.happen('winterLaziness');
      scale *= 0.5;
      // Every few seconds you stop for a yawn.
      this.yawn += dt;
      if (this.yawn % 4 > 3.3) scale = 0;
    }
    return scale;
  }

  /** MCP: pipes launch you (during the power-up, or for good with the perk). */
  private springOffPipe(p: PlayerActor): void {
    const springy = p.perks.has('springPipes') || this.hype?.spec.effect === 'springPipes';
    if (!springy) return;
    const b = p.body;
    if (this.grid.get(Math.floor(b.x + b.w / 2), Math.floor(b.y - 0.05)) !== T.PIPE) return;
    b.vy = 27;
    sfx.jump();
  }

  /** The em dash habit: jumps leave a short-lived "—" platform behind you. */
  private dropEmDash(p: PlayerActor): void {
    if (!this.spec.moments?.includes('emDash')) return;
    this.emDashes = this.emDashes.filter((d) => d.alive);
    if (this.emDashes.length >= 3) return;
    const b = p.body;
    const w = 1.6;
    const x = b.x + b.w / 2 - w / 2 - p.mover.facing * 1.2;
    const dash = new StaticPlatform(x, b.y - 0.35, w, 0.35, this.scene, makeEmDash(w), 2.4);
    this.emDashes.push(dash);
    this.platforms.push(dash);
    this.happen('emDash');
  }

  /** Artifacts' safety net: once per level, a fall into a pit builds a platform under you. */
  private catchWithSafetyNet(p: PlayerActor): void {
    if (this.safetyNetUsed || !p.perks.has('safetyNet')) return;
    const b = p.body;
    if (b.vy >= 0 || b.y > 1.2 || b.y < -1) return;
    this.safetyNetUsed = true;
    const w = 2.4;
    this.platforms.push(new StaticPlatform(b.x + b.w / 2 - w / 2, b.y - 0.5, w, 0.4, this.scene, makeBuiltBlock(w, 0xd97757), 5));
    this.hud.toast('Artifacts safety net! You built a platform.', 'good');
  }

  private landOnPlatforms(p: PlayerActor): void {
    const b = p.body;
    if (b.vy > 0) return;
    for (const pl of this.platforms) {
      if (!pl.alive) continue;
      const top = pl.top;
      const across = b.x + b.w > pl.body.x + 0.05 && b.x < pl.body.x + pl.body.w - 0.05;
      if (across && p.prevBottom >= top - 0.06 && b.y <= top + 0.02) {
        b.y = top;
        b.vy = 0;
        b.onGround = true;
        this.riding.set(p, pl);
        return;
      }
    }
  }

  private overlapsSolid(b: Body): boolean {
    let solid = false;
    forTilesUnder(b, -0.05, (tx, ty) => {
      if (this.grid.isSolid(tx, ty)) solid = true;
    });
    return solid;
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
    const hype = this.hype;
    if (hype?.spec.effect === 'build' && p === hype.owner && p.power !== 'tool') {
      hype.built = hype.built.filter((b) => b.alive);
      if (hype.built.length >= 3) hype.built.shift()!.alive = false;
      const b = p.body;
      const w = 2;
      const x = b.onGround ? b.x + b.w / 2 - w / 2 + p.mover.facing * 1.6 : b.x + b.w / 2 - w / 2;
      const y = b.onGround ? b.y + 1.6 : b.y - 0.45;
      const block = new StaticPlatform(x, y, w, 0.4, this.scene, makeBuiltBlock(w, 0xd97757));
      hype.built.push(block);
      this.platforms.push(block);
      p.cooldown = 0.25;
      sfx.bump();
      return;
    }
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
      const spec = this.spec;
      if (content === 'scale') this.items.push(new PowerItem('scale', tx, ty + 1, this.scene));
      else if (content === 'power') this.items.push(new PowerItem(this.powerItem(), tx, ty + 1, this.scene));
      else if (content === 'oneup') this.items.push(new PowerItem('oneup', tx, ty + 1, this.scene));
      else if (content === 'hype' && spec.hype) this.items.push(new PowerItem('hype', tx, ty + 1, this.scene, spec.hype, HYPES[spec.hype].color));
      else if (content === 'moment' && spec.moment) this.items.push(new PowerItem('moment', tx, ty + 1, this.scene, spec.moment, 0xc0362c));
      else if (spec.oneUp === 'tibo' && tiboDue(this.deaths, this.tiboGiven)) {
        // Die a lot, and a Tibo Reset shows up.
        this.tiboGiven = true;
        this.items.push(new PowerItem('oneup', tx, ty + 1, this.scene));
      } else this.tokens.push(new Token(this.spec.blockToken, tx, ty + 1, this.scene, true));
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
    for (const e of this.enemyList) if (e.alive && e.active && e.shootable && overlaps(e.body, above)) e.onShot(this);
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
      const p = this.heroes().find((pl) => overlaps(pl.body, item.body));
      if (p) {
        item.take();
        this.applyRefItem(item, p);
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
      } else if (trap.kind === 'praise') {
        p.losePowerUp();
        this.happen('glazing');
      }
    }
    for (const heart of this.hearts) {
      if (heart.taken || !this.players().some((p) => overlaps(p.body, heart.body))) continue;
      heart.take();
      this.heartCount++;
      sfx.token();
      const need = this.storm?.hearts;
      if (need && this.heartCount >= need && this.state === 'playing') {
        this.endedEarly = true;
        this.hud.toast(this.storm!.heartsDone ?? 'The storm ends early!', 'good', 4000);
        sfx.flag();
        this.beginClear();
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
        this.once('viral', 'Viral star! You are invincible, and a crowd of new users follows you.', 'good');
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
        if (this.spec.oneUp === 'tibo') {
          this.resets = bankReset(this.resets);
          this.happen('tiboReset');
        } else {
          this.hud.toast('Checkpoint! +1 life. Labs save checkpoints so a crashed training run can resume.', 'good');
        }
        break;
      default:
        sfx.powerup();
    }
  }

  private applyRefItem(item: PowerItem, p: PlayerActor): void {
    if (item.kind === 'hype' && item.ref) this.startHype(HYPES[item.ref as keyof typeof HYPES], p);
    else if (item.kind === 'moment' && item.ref === 'goldenGate') this.startGoldenGate(p);
    else this.applyItem(item.kind, p);
  }

  private stepShots(dt: number): void {
    for (const s of this.shots) {
      const shot = s.shot;
      shot.step(dt, this.grid);
      if (!shot.alive) continue;
      for (const e of this.enemyList) {
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
      const pad = this.padOf(p);
      for (const e of this.enemyList) {
        if (!e.alive || !e.active || !overlaps(p.body, e.body)) continue;
        if (p.invincible) {
          if (e.shootable) {
            e.onShot(this);
            sfx.stomp();
          }
        } else if (e.stompable && isStomp(p, e.body)) {
          e.onStomp(this, p);
          p.bounce(pad.jump);
          sfx.stomp();
        } else if (e.onTouch(this, p) === 'hurt' && !p.hurt()) {
          this.killPlayer(p);
        }
      }
      for (const boss of this.bosses) {
        if (!boss.alive || !boss.awake || !overlaps(p.body, boss.body)) continue;
        const stomp = isStomp(p, boss.body);
        if ((p.invincible || stomp) && boss.vulnerable()) {
          boss.hit(this);
          p.bounce(true);
          sfx.stomp();
          if (this.bosses.every((b) => !b.alive)) this.onBossesDefeated();
        } else if (stomp && boss.bounceOff()) {
          p.bounce(true);
          sfx.bump();
          this.once(`shield-${boss.name}`, `${boss.name} is shielded right now. Hit the other one!`);
        } else if (boss.harmful() && !p.invincible) {
          if (!p.hurt()) this.killPlayer(p);
          else p.body.vx = Math.sign(p.body.x - boss.body.x) * 10;
        }
      }
    }
  }

  private onBossesDefeated(): void {
    sfx.flag();
    for (const e of this.enemyList) if (e.alive) e.defeat(true);
    for (const t of this.trapList) t.take();
    if (this.helper) this.helper.visible = true;
    this.hud.toast('Thank you! But AGI is in another castle!', 'good', 5000);
    this.beginClear();
  }

  // ----------------------------------------------------------- hype power-ups
  private startHype(spec: HypeSpec, owner: PlayerActor): void {
    if (this.hype) this.clearHype();
    const h: ActiveHype = { spec, owner, left: spec.seconds, fuel: 2.6, built: [], aura: null };
    this.hype = h;
    this.hud.toast(spec.grab, 'good', 3600);
    sfx.star();
    const clone = (tag: string, brain: (self: PlayerActor, pad: Pad) => Pad, i: number) => {
      const c = new PlayerActor(owner.spec, '', owner.body.x - 1 - i * 0.9, owner.body.y + 0.2, this.scene, owner.padIndex, true, tag);
      c.hypeClone = true;
      c.brain = brain;
      c.ability = owner.ability;
      this.playersList.push(c);
    };
    if (spec.effect === 'dumbClones') {
      // Autonomous loops: run forward, jump when stuck, never look where they are going.
      const dumb = (self: PlayerActor): Pad => {
        const b = self.body;
        const stuck = b.onGround && Math.abs(b.vx) < 1;
        return { ...emptyPad(), right: true, run: true, jump: stuck && Math.floor(this.time * 3) % 2 === 0 };
      };
      for (let i = 0; i < 2; i++) clone('agent', dumb, i);
    } else if (spec.effect === 'postingForks') {
      for (let i = 0; i < 2; i++) clone('posting…', () => emptyPad(), i);
    } else if (spec.effect === 'helperForks') {
      for (let i = 0; i < 2; i++) clone('fork', (_self, pad) => pad, i);
    } else if (spec.effect === 'nothing') {
      h.aura = makeAura('Q* ?', '#e8d8ff');
      this.scene.add(h.aura);
    } else if (spec.effect === 'spectacle') {
      this.confetti = makeParticles(220, [0xffd166, 0xef476f, 0x06d6a0, 0x118ab2, 0xffffff], 0.22);
      this.scene.add(this.confetti);
    }
  }

  private stepHype(dt: number): void {
    this.hangover = Math.max(0, this.hangover - dt);
    const h = this.hype;
    if (!h) return;
    h.left -= dt;
    const o = h.owner;
    const e = h.spec.effect;
    o.boost = e === 'glide' ? { glide: 0.35 } : e === 'doubleJump' ? { airJumps: 1 } : e === 'speed' ? { speed: 1.45 } : {};
    if (e === 'jetpack') {
      const pad = this.padOf(o);
      if (pad.jump && !o.body.onGround && h.fuel > 0) {
        o.body.vy = Math.min(o.body.vy + 85 * dt, 9);
        h.fuel = Math.max(0, h.fuel - dt);
        if (h.fuel === 0) this.once('battery', 'Battery empty. The gadget is a paperweight now.', 'bad');
      }
    } else if (e === 'magnet') {
      const cx = o.body.x + o.body.w / 2;
      const cy = o.body.y + o.body.h / 2;
      for (const tok of this.tokens) {
        if (tok.taken || tok.pop) continue;
        const dx = cx - (tok.body.x + 0.3);
        const dy = cy - (tok.body.y + 0.3);
        const d = Math.hypot(dx, dy);
        if (d > 7 || d < 0.01) continue;
        tok.body.x += (dx / d) * 14 * dt;
        tok.body.y += (dy / d) * 14 * dt;
      }
    }
    if (h.aura) h.aura.position.set(o.body.x + o.body.w / 2, o.body.y + o.body.h + 1.3, 0);
    if (h.left <= 0 || o.dead) this.endHype();
  }

  /** Removes a hype's clones, boosts and visuals. */
  private clearHype(): void {
    const h = this.hype;
    if (!h) return;
    this.hype = null;
    h.owner.boost = {};
    for (const c of this.playersList.filter((p) => p.hypeClone)) c.dispose();
    this.playersList = this.playersList.filter((p) => !p.hypeClone);
    for (const [p] of this.riding) if (p.hypeClone) this.riding.delete(p);
    if (h.aura) this.scene.remove(h.aura);
    if (this.confetti) {
      this.scene.remove(this.confetti);
      this.confetti = null;
    }
    if (h.spec.effect === 'speed') this.hud.toast('The GPU overheated! The trend fades, but the new users stay.', 'bad');
  }

  /** The power ran out: the player calls it, then history gives its verdict. */
  private endHype(): void {
    const h = this.hype;
    if (!h) return;
    this.clearHype();
    if (this.state !== 'playing') return;
    this.state = 'card';
    void this.askHype(h.spec).then(() => {
      if (this.state === 'card') this.state = 'playing';
      this.input.clear();
    });
  }

  private async askHype(spec: HypeSpec): Promise<void> {
    const root = this.opts.root;
    const call = await showFactCard<HypeCallValue>(root, {
      card: {
        title: 'Hype or shift?',
        date: `${spec.name} · ${spec.when}`,
        lines: [tip('The power-up ran out. Was it a passing hype, or a lasting shift? Make your call.')],
      },
      color: spec.color,
      buttons: [
        { label: 'Passing hype', value: 'passing' },
        { label: 'Lasting shift', value: 'lasting' },
      ],
    });
    const out = judgeHype(spec, call);
    this.hypeCalls.push({ id: spec.id, call, correct: out.correct });
    if (out.perk) {
      if (!this.perksEarned.includes(out.perk)) this.perksEarned.push(out.perk);
      for (const p of this.playersList) p.perks.add(out.perk);
    }
    this.hangover = out.hangover;
    await showFactCard(root, {
      card: {
        title: out.correct ? 'You called it!' : 'History disagrees',
        date: `${spec.name} · ${spec.when} · ${spec.verdict === 'lasting' ? 'a lasting shift' : 'a passing hype'}`,
        lines: [...spec.lines, tip(out.perk ? (spec.perkText ?? 'You keep an upgrade.') : 'Hangover: you move slower for a few seconds.')],
      },
      color: spec.color,
      button: 'Continue',
    });
  }

  // ------------------------------------------------------------------ Moments
  private startGoldenGate(p: PlayerActor): void {
    this.goldenGate = 30;
    this.happen('goldenGate');
    sfx.star();
    if (p.spec.id === 'claude') p.setForm('Golden Gate Claude');
    // Every gap in the ground gets a bridge.
    for (const b of this.bridges) b.alive = false;
    this.bridges = [];
    const g = this.grid;
    let start = -1;
    for (let x = 1; x < g.width; x++) {
      const solid = g.isSolid(x, 1);
      if (!solid && start < 0 && g.isSolid(x - 1, 1)) start = x;
      if (solid && start >= 0) {
        const len = x - start;
        if (len <= 16) {
          const bridge = new StaticPlatform(start, 1.6, len, 0.4, this.scene, makeBridge(len), 30);
          this.bridges.push(bridge);
          this.platforms.push(bridge);
        }
        start = -1;
      }
    }
  }

  private stepMoments(dt: number): void {
    if (this.goldenGate > 0) {
      this.goldenGate -= dt;
      if (this.goldenGate <= 0) {
        for (const b of this.bridges) b.alive = false;
        const hero = this.playersList.find((p) => p.spec.id === 'claude' && !p.clone);
        if (hero && hero.form === 'Golden Gate Claude') hero.setForm(this.opts.form);
        this.hud.toast('The feature is dialed back down. The bridges are gone.', 'info');
      }
    }
    if (this.ghost && this.ghostKept) {
      const hero = this.heroes()[0];
      if (hero) {
        const tx = hero.body.x + hero.body.w / 2 - hero.mover.facing * 1.3;
        const ty = hero.body.y + 0.8 + Math.sin(this.time * 3) * 0.2;
        this.ghost.position.x += (tx - this.ghost.position.x) * Math.min(1, dt * 4);
        this.ghost.position.y += (ty - this.ghost.position.y) * Math.min(1, dt * 4);
      }
    }
    if (this.codeRed) {
      const alarm = this.scene.getObjectByName('alarm') as THREE.PointLight | undefined;
      if (alarm) {
        alarm.position.set(this.camX, 12, 6);
        alarm.intensity = 20 + Math.sin(this.time * 6) * 18;
      }
    }
  }

  private animateParticles(t: number): void {
    const zone = this.spec.zones?.find((z) => z.moment === 'winterLaziness');
    if (this.snow && zone) {
      const pos = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      const base = this.snow.userData.base as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = zone.from + base[i * 3] * (zone.to - zone.from);
        const y = 16 - (((base[i * 3 + 1] * 16 + t * (1.2 + base[i * 3 + 2])) % 16) + 16) % 16;
        pos.setXYZ(i, x + Math.sin(t + i) * 0.3, y, -1 + base[i * 3 + 2] * 2);
      }
      pos.needsUpdate = true;
    }
    if (this.confetti && this.hype) {
      const pos = this.confetti.geometry.attributes.position as THREE.BufferAttribute;
      const base = this.confetti.userData.base as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = this.camX - this.halfW + base[i * 3] * this.halfW * 2;
        const y = 15 - ((base[i * 3 + 1] * 15 + t * (2 + base[i * 3 + 2] * 2)) % 15);
        pos.setXYZ(i, x + Math.sin(t * 2 + i) * 0.4, y, 1 + base[i * 3 + 2]);
      }
      pos.needsUpdate = true;
    }
  }

  // ------------------------------------------------------ set pieces, storms
  private stepSetPieces(dt: number): void {
    for (const piece of this.spec.setPieces ?? []) {
      if (piece.kind === 'starRain') {
        if (this.camX < piece.from || this.camX > piece.to) continue;
        this.rainTimer -= dt;
        if (this.rainTimer > 0) continue;
        this.rainTimer = piece.every;
        const x = Math.floor(this.camLeft + 2 + this.rng() * (this.camRight - this.camLeft - 4));
        this.items.push(new PowerItem('viral', x, this.grid.height - 1, this.scene, undefined, undefined, false));
        this.once('rain', 'Viral star rain! Screenshots of the new chatbot are everywhere.', 'good');
      } else if (piece.kind === 'toggles') {
        this.toggleTimer += dt;
        if (this.toggleTimer >= piece.period) {
          this.toggleTimer = 0;
          const phase = this.grid.solidity.phase === 0 ? 1 : 0;
          // Never swap a block into a player standing where it would appear.
          if (this.players().some((p) => this.overlapsToggle(p.body, phase))) continue;
          this.grid.solidity.phase = phase;
          this.view.setPhase(phase);
          if (piece.toast) this.once('toggles', piece.toast);
        }
      }
    }
  }

  private overlapsToggle(b: Body, phase: 0 | 1): boolean {
    let hit = false;
    forTilesUnder(b, -0.02, (tx, ty) => {
      const t = this.grid.get(tx, ty);
      if ((phase === 0 && t === T.TOGGLE_A) || (phase === 1 && t === T.TOGGLE_B)) hit = true;
    });
    return hit;
  }

  private stepStorm(dt: number): void {
    const storm = this.storm;
    if (!storm || this.state !== 'playing') return;
    if (storm.days) {
      const day = stormDay(this.camX - this.halfW, this.grid.width - 2 * this.halfW, storm.days.length);
      if (day !== this.day) {
        this.day = day;
        this.hud.toast(storm.days[day], 'info', 2600);
        if (storm.flipConveyors && day > 0) {
          this.grid.conveyorSign = day % 2 === 0 ? 1 : -1;
          this.view.setConveyorSign(this.grid.conveyorSign);
          this.shake(0.25);
        }
      }
    }
    if (storm.fog) {
      this.fogX += storm.fog.speed * dt;
      const lag = this.players().filter((p) => p.body.x < this.fogX);
      if (lag.length) this.once('fog', 'The fog slows you down. Keep moving!', 'bad');
    }
  }

  private stepFlag(dt: number): void {
    const flag = this.flag;
    if (!flag) return;
    if (this.state === 'playing') {
      const reached = this.heroes().find((p) => p.body.x + p.body.w > flag.x - 0.1);
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
    this.clearHype();
    if (this.ghost && this.ghostKept) {
      this.lives++;
      this.hud.toast('You kept GPT-4o all the way! +1 life.', 'good', 3500);
    }
    if (this.codeRed && this.flag) {
      const par = codeRedPar(this.grid.width);
      if (this.time <= par) {
        this.lives++;
        this.hud.toast(`Code red cleared in ${Math.round(this.time)}s, under par (${par}s)! +1 life.`, 'good', 3500);
      }
    }
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
    this.riding.delete(p);
    if (p.clone) return;
    if (this.ghost && this.ghostKept) {
      this.ghostKept = false;
      this.ghost.visible = false;
      this.hud.toast('GPT-4o drifted away… users will ask for it back.', 'bad');
    }
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
      hearts: this.heartCount,
      endedEarly: this.endedEarly,
      hypes: [...this.hypeCalls],
      perks: [...this.perksEarned],
      moments: [...this.happened],
      resets: this.resets,
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
    if (!this.storm?.autoscroll && (alive.length || bossFight)) {
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

  /** New users trail the player while a viral star lasts. */
  private updateCrowd(t: number): void {
    const crowd = this.crowd;
    if (!crowd) return;
    const star = this.playersList.find((p) => !p.dead && p.starKind === 'viral');
    crowd.visible = !!star;
    if (!star) {
      this.trail.length = 0;
      return;
    }
    this.trail.unshift({ x: star.body.x + star.body.w / 2, y: star.body.y });
    if (this.trail.length > 90) this.trail.length = 90;
    crowd.children.forEach((c, i) => {
      const at = this.trail[Math.min(this.trail.length - 1, (i + 1) * 8)];
      c.position.set(at.x - star.mover.facing * 0.3, at.y + Math.abs(Math.sin(t * 9 + i)) * 0.25, -0.4 - (i % 3) * 0.2);
    });
  }

  // --------------------------------------------------------------------- HUD
  private updateHud(): void {
    const spec = this.spec;
    const hero = this.playersList.find((p) => !p.clone);
    const status: string[] = [];
    if (this.storm?.days && this.day >= 0) status.push(this.storm.days[this.day]);
    if (this.storm?.hearts) status.push(`♥ people ${this.heartCount}/${this.storm.hearts}`);
    if (this.hype) status.push(`Hype: ${this.hype.spec.name} ${Math.ceil(this.hype.left)}s${this.hype.spec.effect === 'jetpack' ? ` · battery ${Math.round((this.hype.fuel / 2.6) * 100)}%` : ''}`);
    else if (this.hangover > 0) status.push('Hype hangover…');
    if (this.goldenGate > 0) status.push(`Golden Gate ${Math.ceil(this.goldenGate)}s`);
    if (this.codeRed) status.push(`Code red ${Math.floor(this.time)}s · par ${codeRedPar(this.grid.width)}s`);
    if (this.resets > 0) status.push(`⟲ resets ×${this.resets}`);
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
      status: status.join(' · ') || null,
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
      hearts: () => this.heartCount,
      bossHp: () => (this.bosses.length ? this.bosses.reduce((s, b) => s + b.hp, 0) : null),
      bosses: () => this.bosses.map((b) => ({ name: b.name, hp: b.hp, x: b.body.x, y: b.body.y, w: b.body.w, h: b.body.h, vulnerable: b.vulnerable() })),
      boss: () => {
        const b = this.bosses.find((bb) => bb.alive) ?? this.bosses[0];
        return b ? { x: b.body.x, y: b.body.y, w: b.body.w, h: b.body.h } : null;
      },
      flag: () => (this.flag ? { x: this.flag.x, y: this.flag.y } : null),
      autoscroll: () => !!this.storm?.autoscroll,
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
        if (this.storm?.autoscroll) this.camX = THREE.MathUtils.clamp(x + 2, this.halfW, this.grid.width - this.halfW);
        else this.camX = Math.max(this.camX, Math.min(x, this.grid.width - this.halfW));
      },
      invincible: () => (this.playersList[0].invulnerable = 999),
      give: (kind: ItemKind) => this.applyItem(kind, this.playersList[0]),
      startHype: (id: string) => this.startHype(HYPES[id as keyof typeof HYPES], this.playersList[0]),
      goldenGate: () => this.startGoldenGate(this.playersList[0]),
      praise: () => {
        const b = this.playersList[0].body;
        this.trapList.push(new Trap('praise', Math.floor(b.x), Math.floor(b.y), this.scene));
      },
      items: () => this.items.filter((i) => !i.taken).map((i) => ({ kind: i.kind, x: i.body.x, y: i.body.y })),
      traps: () => this.trapList.filter((t) => !t.taken).map((t) => ({ kind: t.kind, x: t.body.x, y: t.body.y })),
      enemies: () => this.enemyList.filter((e) => e.alive).map((e) => ({ kind: e.kind, x: e.body.x, y: e.body.y, w: e.body.w, h: e.body.h, active: e.active })),
      star: () => this.playersList[0].star,
      hype: () => (this.hype ? { id: this.hype.spec.id, left: this.hype.left } : null),
      endHype: () => {
        if (this.hype) this.hype.left = 0;
      },
      perks: () => [...this.playersList[0].perks],
      moments: () => [...this.happened],
      clones: () => this.playersList.filter((p) => p.clone && !p.dead).length,
      bridges: () => this.bridges.filter((b) => b.alive).length,
      platforms: () => this.platforms.filter((p) => p.alive).map((p) => ({ x: p.body.x, y: p.body.y, w: p.body.w, top: p.top })),
      riding: () => this.riding.has(this.playersList[0]),
      phase: () => this.grid.solidity.phase,
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
