import * as THREE from 'three';
import type { BossId } from '../config/levelSpec';
import type { StageCtx } from './ctx';
import { HotTake, Spambot } from './Enemies';
import { Trap } from './Items';
import { labelSprite, makeDan, makeRewardHacker, makeShield, makeSpambot, makeSydney } from './meshes';
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

/** Builds the boss (or bosses) a level's `G` spawns. */
export function createBosses(id: BossId, x: number, y: number, scene: THREE.Scene): Boss[] {
  switch (id) {
    case 'garbage':
      return [new GarbageBoss(x, y, scene)];
    case 'rewardHacker':
      return [new RewardHacker(x, y, scene)];
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
