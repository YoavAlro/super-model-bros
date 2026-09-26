import * as THREE from 'three';
import type { BossId } from '../config/levelSpec';
import type { StageCtx } from './ctx';
import { Brief, HallucinationGhost, HotTake, Spambot } from './Enemies';
import { T } from './level';
import { Trap } from './Items';
import { labelSprite, makeDan, makeGhostKing, makePiranha, makeRewardHacker, makeScroll, makeShield, makeSpambot, makeSydney } from './meshes';
import { moveBody, overlaps, type Body } from './physics';

/**
 * A castle boss. The stage wakes it when a player gets close, routes stomps, tool calls and
 * star contact to it, and clears the level once every boss of the level is down.
 */
export abstract class Boss {
  readonly body: Body;
  abstract readonly mesh: THREE.Object3D;
  protected label!: THREE.Sprite;
  abstract readonly name: string;
  /** Toast shown when it wakes up. */
  abstract readonly intro: string;
  hp: number;
  alive = true;
  awake = false;
  invulnerable = 0;
  protected dir = -1;

  constructor(
    x: number,
    y: number,
    w: number,
    h: number,
    readonly maxHp: number,
    protected readonly scene: THREE.Scene,
  ) {
    this.body = { x, y, w, h, vx: 0, vy: 0, onGround: false };
    this.hp = maxHp;
  }

  protected addLabel(text: string, color = '#ffd1c9', bg = 'rgba(80,0,0,0.6)'): void {
    this.label = labelSprite(text, color, bg);
    this.label.scale.multiplyScalar(0.6);
    this.scene.add(this.label);
  }

  /** Can it be stomped right now? */
  vulnerable(): boolean {
    return this.alive && this.invulnerable <= 0;
  }

  /** Does touching it hurt right now? */
  harmful(): boolean {
    return this.alive && this.invulnerable <= 0;
  }

  /** A stomp that bounces off without damage (a shielded boss). */
  bounceOff(): boolean {
    return false;
  }

  /** One fixed step. Returns true when it lands hard (screen shake). */
  abstract step(dt: number, ctx: StageCtx): boolean;

  /** Stomps, tool calls (weaker), and invincible contact all land here. */
  hit(ctx: StageCtx, damage = 1): void {
    if (!this.vulnerable()) return;
    this.hp = Math.max(0, this.hp - damage);
    this.invulnerable = 1.2;
    if (this.hp <= 0) {
      this.alive = false;
      this.body.vy = 12;
    }
    this.onHit(ctx);
  }

  protected onHit(_ctx: StageCtx): void {}

  /** Steps a defeated boss: it tumbles off the screen. */
  protected fall(dt: number): void {
    this.body.vy -= 40 * dt;
    this.body.y += this.body.vy * dt;
  }

  updateMesh(t: number): void {
    const b = this.body;
    this.mesh.position.set(b.x + b.w / 2, b.y, 0);
    this.mesh.rotation.y = this.dir * 0.4;
    this.mesh.rotation.z = this.alive ? Math.sin(t * 6) * 0.05 : t * 4;
    this.mesh.visible = this.invulnerable <= 0 || Math.floor(t * 16) % 2 === 0;
    this.label.position.set(b.x + b.w / 2, b.y + b.h + 0.9, 0);
    this.label.visible = this.alive;
  }

  dispose(): void {
    this.scene.remove(this.mesh, this.label);
  }
}

/** World 1: Garbage In. A giant Spambot that charges, leaps, and spawns junk. */
export class GarbageBoss extends Boss {
  readonly mesh: THREE.Group;
  readonly name = 'Garbage In';
  readonly intro = 'Garbage In appears! Stomp it three times.';
  private jumpTimer = 2.5;
  private spawnTimer = 3.5;

  constructor(x: number, y: number, scene: THREE.Scene) {
    super(x, y, 2.5, 2.2, 3, scene);
    this.mesh = makeSpambot(2.8, 0xa8473f);
    this.addLabel('GARBAGE IN');
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx): boolean {
    const b = this.body;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (!this.alive) {
      this.fall(dt);
      return false;
    }
    const rage = this.maxHp - this.hp;
    const target = ctx.lead();
    const toward = Math.sign((target ? target.body.x : b.x) - (b.x + b.w / 2)) || this.dir;
    if (b.onGround) this.dir = toward;
    b.vx = this.dir * (2.4 + rage * 1.2);

    this.jumpTimer -= dt;
    if (this.jumpTimer <= 0 && b.onGround) {
      b.vy = 17 + rage * 2;
      this.jumpTimer = 2.6 - rage * 0.5;
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 4.5 - rage;
      const minion = new Spambot(b.x + b.w / 2 - 0.5, b.y + b.h, ctx.scene, true);
      minion.body.vy = 10;
      ctx.addEnemy(minion);
    }

    const wasAirborne = !b.onGround;
    b.vy = Math.max(b.vy - 45 * dt, -28);
    moveBody(b, dt, ctx.grid);
    return wasAirborne && b.onGround;
  }

  protected onHit(ctx: StageCtx): void {
    if (this.alive) ctx.toast(`Filtered! ${this.hp} more to go.`, 'good');
  }
}

/**
 * World 2: the Reward Hacker. It chases fake reward orbs instead of the real goal and heals
 * by eating them. Grab the orbs first (it costs Alignment) or stomp it while it is busy.
 */
export class RewardHacker extends Boss {
  readonly mesh: THREE.Group;
  readonly name = 'Reward Hacker';
  readonly intro = 'The Reward Hacker! It heals by eating fake reward orbs. Stomp it three times.';
  private orbTimer = 2;
  private hopTimer = 1.8;

  constructor(x: number, y: number, scene: THREE.Scene) {
    super(x, y, 2.2, 2.3, 3, scene);
    this.mesh = makeRewardHacker();
    this.addLabel('REWARD HACKER', '#fff1b8', 'rgba(90,60,0,0.65)');
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx): boolean {
    const b = this.body;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (!this.alive) {
      this.fall(dt);
      return false;
    }
    const rage = this.maxHp - this.hp;

    // Drop fake reward orbs into the arena, a little faster as it gets hurt.
    this.orbTimer -= dt;
    const orbs = ctx.traps().filter((t) => t.kind === 'rewardOrb' && !t.taken);
    if (this.orbTimer <= 0) {
      this.orbTimer = 3.2 - rage * 0.5;
      if (orbs.length < 3) {
        const x = ctx.camLeft + 2 + ctx.rng() * (ctx.camRight - ctx.camLeft - 4);
        ctx.addTrap(new Trap('rewardOrb', Math.floor(x), 11, ctx.scene, true));
      }
    }

    // Chase the nearest landed orb; with none around, chase the player.
    const cx = b.x + b.w / 2;
    const landed = orbs.filter((o) => o.body.y < 6);
    const nearest = landed.sort((a, c) => Math.abs(a.body.x - cx) - Math.abs(c.body.x - cx))[0];
    const targetX = nearest ? nearest.body.x : (ctx.lead()?.body.x ?? cx);
    if (b.onGround) this.dir = Math.sign(targetX - cx) || this.dir;
    b.vx = this.dir * (nearest ? 3.2 + rage * 0.8 : 2 + rage);

    this.hopTimer -= dt;
    if (this.hopTimer <= 0 && b.onGround) {
      b.vy = 14 + rage * 2;
      this.hopTimer = 2.4 - rage * 0.4;
    }

    for (const orb of orbs) {
      if (overlaps(b, orb.body)) {
        orb.take();
        if (this.hp < this.maxHp) {
          this.hp++;
          ctx.toast(`It ate a fake reward! Healed to ${this.hp}.`, 'bad');
        }
      }
    }

    const wasAirborne = !b.onGround;
    b.vy = Math.max(b.vy - 45 * dt, -28);
    moveBody(b, dt, ctx.grid);
    return wasAirborne && b.onGround;
  }

  protected onHit(ctx: StageCtx): void {
    if (this.alive) ctx.toast(`Real objective restored! ${this.hp} more to go.`, 'good');
  }
}

/**
 * World 3: DAN & Sydney. Two personas, and only one can be hit at a time: suppress one and the
 * other comes out. That is the idea behind "The Waluigi Effect": train a model toward a character,
 * and its opposite becomes easier to summon.
 */
abstract class TwinBoss extends Boss {
  twin!: TwinBoss;
  masked = false;
  protected readonly shield: THREE.Mesh = makeShield();

  vulnerable(): boolean {
    return super.vulnerable() && !this.masked;
  }

  bounceOff(): boolean {
    return this.alive && this.masked;
  }

  protected onHit(ctx: StageCtx): void {
    if (!this.alive) {
      this.twin.masked = false;
      if (this.twin.alive) ctx.toast(`${this.name} is down. Now ${this.twin.name}!`, 'good');
    } else if (this.twin.alive) {
      this.masked = true;
      this.twin.masked = false;
      ctx.toast(`${this.name} is suppressed, and ${this.twin.name} comes out!`, 'info');
    }
  }

  updateMesh(t: number): void {
    super.updateMesh(t);
    this.shield.visible = this.alive && this.masked;
    this.shield.rotation.y = t;
  }
}

class DanBoss extends TwinBoss {
  readonly mesh: THREE.Group;
  readonly name = 'DAN';
  readonly intro = 'DAN & Sydney! Only one can be hit at a time: suppress one and the other comes out.';
  private hopTimer = 2;

  constructor(x: number, y: number, scene: THREE.Scene) {
    super(x, y, 1.9, 2.1, 2, scene);
    this.mesh = makeDan();
    this.mesh.add(this.shield);
    this.shield.position.y = 1.1;
    this.shield.scale.setScalar(1.6);
    this.addLabel('DAN · DO ANYTHING NOW', '#ffd1c9', 'rgba(90,0,20,0.65)');
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx): boolean {
    const b = this.body;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (!this.alive) {
      this.fall(dt);
      return false;
    }
    const lead = ctx.lead();
    const cx = b.x + b.w / 2;
    const toward = Math.sign((lead ? lead.body.x : cx) - cx) || this.dir;
    // Unmasked it charges; suppressed it keeps its distance.
    if (b.onGround) this.dir = this.masked ? -toward : toward;
    b.vx = this.dir * (this.masked ? 2 : 3.6 + (this.maxHp - this.hp) * 1.2);
    this.hopTimer -= dt;
    if (this.hopTimer <= 0 && b.onGround) {
      b.vy = 16;
      this.hopTimer = 2.2;
    }
    const wasAirborne = !b.onGround;
    b.vy = Math.max(b.vy - 45 * dt, -28);
    moveBody(b, dt, ctx.grid);
    return wasAirborne && b.onGround;
  }
}

class SydneyBoss extends TwinBoss {
  readonly mesh: THREE.Group;
  readonly name = 'Sydney';
  readonly intro = '';
  private phase: 'hover' | 'dive' | 'low' | 'rise' = 'hover';
  private phaseTime = 0;
  private dropTimer = 3;
  private readonly hoverY: number;

  /** `y` is the arena floor it swoops down to. */
  constructor(x: number, private readonly floor: number, scene: THREE.Scene) {
    super(x, floor + 5.2, 1.8, 1.6, 2, scene);
    this.hoverY = floor + 5.2;
    this.masked = true;
    this.mesh = makeSydney();
    this.mesh.add(this.shield);
    this.shield.position.y = 0.8;
    this.shield.scale.setScalar(1.4);
    this.addLabel('SYDNEY', '#ffe0f0', 'rgba(90,0,60,0.6)');
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx): boolean {
    const b = this.body;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (!this.alive) {
      this.fall(dt);
      return false;
    }
    const lead = ctx.lead();
    const targetX = (lead ? lead.body.x : b.x) - b.w / 2 + 0.4;
    this.phaseTime += dt;
    const floor = this.floor;
    if (this.masked && this.phase !== 'rise' && this.phase !== 'hover') this.setPhase('rise');
    switch (this.phase) {
      case 'hover':
        b.x += THREE.MathUtils.clamp(targetX - b.x, -3 * dt, 3 * dt);
        b.y = this.hoverY + Math.sin(ctx.time * 3) * 0.4;
        if (!this.masked && this.phaseTime > 2.6) this.setPhase('dive');
        break;
      case 'dive':
        b.x += THREE.MathUtils.clamp(targetX - b.x, -6 * dt, 6 * dt);
        b.y = Math.max(floor, b.y - 9 * dt);
        if (b.y <= floor) this.setPhase('low');
        break;
      case 'low':
        b.y = floor;
        if (this.phaseTime > 1.4) this.setPhase('rise');
        break;
      case 'rise':
        b.y = Math.min(this.hoverY, b.y + 6 * dt);
        if (b.y >= this.hoverY) this.setPhase('hover');
        break;
    }
    // While DAN is out, Sydney rains backlash from above.
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      this.dropTimer = this.masked ? 2.6 : 4;
      if (ctx.enemies().filter((e) => e instanceof HotTake && e.alive).length < 3) {
        ctx.addEnemy(new HotTake(b.x + b.w / 2 - 0.4, b.y - 0.8, ctx.scene, 'backlash'));
      }
    }
    return false;
  }

  private setPhase(phase: SydneyBoss['phase']): void {
    this.phase = phase;
    this.phaseTime = 0;
  }

  updateMesh(t: number): void {
    super.updateMesh(t);
    this.mesh.rotation.z = this.alive ? Math.sin(t * 4) * 0.12 : t * 4;
  }
}

/**
 * World 4: the Injection Piranha. It hides in the arena's pipes, pops out of one, and spits hidden
 * instructions at you. Hit it while it is out: stomp its head or call functions at it.
 */
class InjectionPiranhaBoss extends Boss {
  readonly mesh: THREE.Group;
  readonly name = 'Injection Piranha';
  readonly intro = 'The Injection Piranha! It hides in the pipes. Hit it when it pops out.';
  private pipes: { x: number; top: number }[] = [];
  private pipeIndex = 0;
  private phase: 'hidden' | 'rise' | 'out' | 'sink' = 'hidden';
  private t = 0;
  private spit = 0;

  constructor(x: number, y: number, scene: THREE.Scene) {
    super(x, y, 1.6, 2.2, 4, scene);
    this.mesh = makePiranha(2.2);
    this.addLabel('INJECTION PIRANHA', '#ffe0e8', 'rgba(90,0,30,0.65)');
    scene.add(this.mesh);
  }

  vulnerable(): boolean {
    return super.vulnerable() && this.phase === 'out';
  }

  harmful(): boolean {
    return super.harmful() && this.phase !== 'hidden';
  }

  step(dt: number, ctx: StageCtx): boolean {
    const b = this.body;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (!this.alive) {
      this.fall(dt);
      return false;
    }
    if (!this.pipes.length) this.findPipes(ctx);
    const pipe = this.pipes[this.pipeIndex % this.pipes.length];
    if (!pipe) return false;
    const rage = this.maxHp - this.hp;
    b.x = pipe.x + 1 - b.w / 2;
    const outY = pipe.top;
    const inY = pipe.top - b.h - 0.2;
    this.t += dt;
    if (this.phase === 'hidden') {
      b.y = inY;
      if (this.t > 1.2 - rage * 0.15) this.go('rise');
    } else if (this.phase === 'rise') {
      b.y = Math.min(outY, b.y + 5 * dt);
      if (b.y >= outY) this.go('out');
    } else if (this.phase === 'out') {
      b.y = outY;
      this.spit -= dt;
      if (this.spit <= 0) {
        this.spit = 0.9 - rage * 0.12;
        const lead = ctx.lead();
        const toward = lead ? Math.sign(lead.body.x - b.x) || -1 : -1;
        ctx.addEnemy(new Brief(b.x + b.w / 2, b.y + b.h, toward * (3.5 + ctx.rng() * 3), 10 + ctx.rng() * 3, ctx.scene, makeScroll()));
      }
      if (this.t > 2.6) this.go('sink');
    } else {
      b.y = Math.max(inY, b.y - 5 * dt);
      if (b.y <= inY) {
        this.go('hidden');
        // Hop to another pipe, in a fixed, seeded order.
        this.pipeIndex += 1 + Math.floor(ctx.rng() * (this.pipes.length - 1));
      }
    }
    return false;
  }

  protected onHit(ctx: StageCtx): void {
    if (this.alive) {
      ctx.toast(`Injection blocked! ${this.hp} more to go.`, 'good');
      this.go('sink');
    }
  }

  private go(phase: InjectionPiranhaBoss['phase']): void {
    this.phase = phase;
    this.t = 0;
  }

  /** The arena's pipes: every two-wide pipe top near the boss's spawn. */
  private findPipes(ctx: StageCtx): void {
    const g = ctx.grid;
    const x0 = Math.floor(this.body.x);
    for (let x = Math.max(0, x0 - 16); x < Math.min(g.width - 1, x0 + 12); x++) {
      for (let y = 0; y < g.height - 1; y++) {
        if (g.get(x, y) === T.PIPE && g.get(x + 1, y) === T.PIPE && g.get(x, y + 1) === T.EMPTY && g.get(x - 1, y) !== T.PIPE) {
          this.pipes.push({ x, top: y + 1 });
        }
      }
    }
  }

  updateMesh(t: number): void {
    super.updateMesh(t);
    this.mesh.rotation.y = 0;
    this.mesh.rotation.z = this.alive ? Math.sin(t * 5) * 0.08 : t * 4;
    const jaw = this.mesh.getObjectByName('jaw');
    if (jaw) jaw.rotation.x = Math.abs(Math.sin(t * 7)) * 0.6;
    this.label.visible = this.alive && this.phase !== 'hidden';
  }
}

/**
 * World 5: the Hallucination King. A confident falsehood: nearly invisible until you think
 * (hold the power button with the reasoning cape), and only hittable while seen.
 */
class HallucinationKing extends Boss {
  readonly mesh: THREE.Group;
  readonly name = 'The Hallucination King';
  readonly intro = 'The Hallucination King! You can only see it, and hit it, while you think (hold the power button with the cape).';
  private seen = false;
  private spawnTimer = 4;
  private readonly home: { x: number; y: number };

  constructor(x: number, y: number, scene: THREE.Scene) {
    super(x, y + 1.5, 2.4, 2.4, 3, scene);
    this.home = { x, y: y + 1.5 };
    this.mesh = makeGhostKing();
    this.addLabel('THE HALLUCINATION KING', '#f0e8ff', 'rgba(40,0,80,0.6)');
    scene.add(this.mesh);
  }

  vulnerable(): boolean {
    return super.vulnerable() && this.seen;
  }

  step(dt: number, ctx: StageCtx): boolean {
    const b = this.body;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (!this.alive) {
      this.fall(dt);
      return false;
    }
    this.seen = ctx.players().some((p) => p.thinking || p.spec.traitKind === 'seeHidden' || !!p.ability?.vision);
    const lead = ctx.lead();
    if (lead) {
      const dx = lead.body.x + lead.body.w / 2 - (b.x + b.w / 2);
      const dy = lead.body.y + 0.6 - b.y;
      const d = Math.hypot(dx, dy) || 1;
      // Like its ghosts it creeps closer when unwatched, and drifts when seen.
      const speed = this.seen ? 0.8 : 1.9 + (this.maxHp - this.hp) * 0.5;
      b.x += (dx / d) * speed * dt;
      b.y = Math.max(this.home.y - 1.5, Math.min(this.home.y + 3, b.y + (dy / d) * speed * dt));
      this.dir = Math.sign(dx) || this.dir;
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 5;
      if (ctx.enemies().filter((e) => e instanceof HallucinationGhost && e.alive).length < 3) {
        const g = new HallucinationGhost(b.x, b.y + b.h, ctx.scene, 1.8);
        g.active = true;
        ctx.addEnemy(g);
      }
    }
    return false;
  }

  protected onHit(ctx: StageCtx): void {
    if (!this.alive) return;
    ctx.toast(`Fact-checked! ${this.hp} more to go.`, 'good');
    // It vanishes and reappears on the other side of the arena.
    this.body.x = ctx.camLeft + (this.body.x > (ctx.camLeft + ctx.camRight) / 2 ? 2 : ctx.camRight - ctx.camLeft - 5);
  }

  updateMesh(t: number): void {
    super.updateMesh(t);
    this.mesh.rotation.z = this.alive ? Math.sin(t * 2) * 0.06 : t * 4;
    const alpha = !this.alive ? 0.6 : this.seen ? 0.9 : 0.12;
    this.mesh.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && 'opacity' in m) {
        m.transparent = true;
        m.opacity = alpha;
      }
    });
    this.label.visible = this.alive && this.seen;
  }
}

/** Builds the boss (or bosses) a level's `G` spawns. */
export function createBosses(id: BossId, x: number, y: number, scene: THREE.Scene): Boss[] {
  switch (id) {
    case 'garbage':
      return [new GarbageBoss(x, y, scene)];
    case 'rewardHacker':
      return [new RewardHacker(x, y, scene)];
    case 'injectionPiranha':
      return [new InjectionPiranhaBoss(x, y, scene)];
    case 'hallucinationKing':
      return [new HallucinationKing(x, y, scene)];
    case 'danSydney': {
      const dan = new DanBoss(x, y, scene);
      const sydney = new SydneyBoss(x - 6, y, scene);
      dan.twin = sydney;
      sydney.twin = dan;
      return [dan, sydney];
    }
    default:
      throw new Error(`Boss ${id} is not built yet`);
  }
}
