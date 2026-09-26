import * as THREE from 'three';
import type { StageCtx } from './ctx';
import { makeBrief, makeGhost, makeHotTake, makeJailbreaker, makeLawyer, makePiranha, makeSpambot, makeTimeline } from './meshes';
import { moveBody, overlaps, type Body } from './physics';
import { CloudRide } from './Platforms';
import type { PlayerActor } from './Player';

/**
 * Base enemy. Enemies wake up when they scroll into view. By default a stomp or a tool call
 * kills them and touching them from the side hurts; subclasses override what differs.
 */
export abstract class Enemy {
  /** A short name for debugging and tests (class names do not survive minification). */
  abstract readonly kind: string;
  readonly body: Body;
  abstract readonly mesh: THREE.Object3D;
  alive = true;
  active = false;
  /** A stomp from above counts (instead of hurting the player). */
  stompable = true;
  /** Touching it hurts. */
  harmful = true;
  /** Tool calls and invincible players defeat it. */
  shootable = true;
  /** Seconds of squashed animation left once defeated. */
  protected fade = 0;
  protected dir = -1;

  constructor(x: number, y: number, w: number, h: number, protected readonly scene: THREE.Scene) {
    this.body = { x: x + (1 - w) / 2, y, w, h, vx: 0, vy: 0, onGround: false };
  }

  abstract step(dt: number, ctx: StageCtx): void;

  /** Called for every step while defeated; hides the mesh when the fade ends. */
  protected stepDead(dt: number): void {
    this.fade -= dt;
    if (this.fade <= 0) this.mesh.visible = false;
  }

  onStomp(_ctx: StageCtx, _p: PlayerActor): void {
    this.defeat(true);
  }

  /** A player touched it without stomping (and without a star). Return 'hurt' to hurt them. */
  onTouch(_ctx: StageCtx, _p: PlayerActor): 'hurt' | 'none' {
    return this.harmful ? 'hurt' : 'none';
  }

  onShot(_ctx: StageCtx): void {
    this.defeat(false);
  }

  defeat(squash: boolean): void {
    this.alive = false;
    this.fade = squash ? 0.5 : 0.35;
    if (squash) this.mesh.scale.set(1.2, 0.3, 1.2);
    else this.mesh.rotation.z = Math.PI;
  }

  remove(): void {
    this.alive = false;
    this.fade = 0;
    this.mesh.visible = false;
  }

  /** Walks, turns at walls, and falls; removes itself in pits. */
  protected walk(dt: number, speed: number, ctx: StageCtx, turnAtLedges = false): void {
    const b = this.body;
    b.vx = this.dir * speed;
    b.vy = Math.max(b.vy - 60 * dt, -28);
    if (turnAtLedges && b.onGround) {
      const aheadX = this.dir > 0 ? b.x + b.w + 0.05 : b.x - 0.05;
      if (!ctx.grid.isSolid(Math.floor(aheadX), Math.floor(b.y) - 1) && !ctx.grid.isOneWay(Math.floor(aheadX), Math.floor(b.y) - 1)) this.dir *= -1;
    }
    const hits = moveBody(b, dt, ctx.grid);
    if (hits.some((h) => h.side === 'left' || h.side === 'right')) this.dir *= -1;
    if (b.y < -4) this.remove();
  }

  updateMesh(t: number): void {
    const b = this.body;
    this.mesh.position.set(b.x + b.w / 2, b.y, 0);
    if (this.alive) this.mesh.rotation.z = Math.sin(t * 10) * 0.08;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
  }
}

/** Spambot: junk web text. Walks, turns at walls, dies when stomped. */
export class Spambot extends Enemy {
  readonly kind = 'spambot';
  readonly mesh: THREE.Group;

  constructor(x: number, y: number, scene: THREE.Scene, active = false) {
    super(x, y, 0.9, 0.8, scene);
    this.active = active;
    this.mesh = makeSpambot();
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx): void {
    if (!this.alive) return this.stepDead(dt);
    this.walk(dt, 2.2, ctx);
  }
}

/** A hot take dropped by the Timeline: spiky (no stomping), walks toward you once it lands. */
export class HotTake extends Enemy {
  readonly kind = 'hotTake';
  readonly mesh: THREE.Group;
  stompable = false;
  private landed = false;

  constructor(x: number, y: number, scene: THREE.Scene, mood: 'hype' | 'backlash') {
    super(x, y, 0.8, 0.8, scene);
    this.active = true;
    this.mesh = makeHotTake(mood);
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx): void {
    if (!this.alive) return this.stepDead(dt);
    if (!this.landed && this.body.onGround) {
      this.landed = true;
      const lead = ctx.lead();
      this.dir = lead && lead.body.x > this.body.x ? 1 : -1;
    }
    if (this.landed) this.walk(dt, 2.6, ctx);
    else {
      this.body.vy = Math.max(this.body.vy - 40 * dt, -14);
      moveBody(this.body, dt, ctx.grid);
      if (this.body.y < -4) this.remove();
    }
  }

  updateMesh(t: number): void {
    super.updateMesh(t);
    if (this.alive) this.mesh.rotation.y = t * 3;
  }
}

/**
 * The Timeline: a cloud of hot takes that hovers over you and drops them. Stomp it (or hit it
 * with a star or a tool call) and the cloud is yours to ride for a while.
 */
export class Timeline extends Enemy {
  readonly kind = 'timeline';
  readonly mesh: THREE.Group;
  harmful = false;
  private dropTimer = 2.5;
  private readonly baseY: number;

  constructor(x: number, y: number, scene: THREE.Scene, private readonly mood: 'hype' | 'backlash') {
    super(x, y, 2, 1, scene);
    this.baseY = Math.max(7.8, y);
    this.body.y = this.baseY;
    this.mesh = makeTimeline(mood);
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx): void {
    if (!this.alive) return this.stepDead(dt);
    const b = this.body;
    const lead = ctx.lead();
    const target = THREE.MathUtils.clamp((lead ? lead.body.x : b.x) + 1.5, ctx.camLeft + 1, ctx.camRight - 3);
    b.x += THREE.MathUtils.clamp(target - b.x, -6 * dt, 6 * dt);
    b.y = this.baseY + Math.sin(ctx.time * 2.2) * 0.35;
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      this.dropTimer = 3.2;
      const takes = ctx.enemies().filter((e) => e instanceof HotTake && e.alive).length;
      if (takes < 3) ctx.addEnemy(new HotTake(b.x + 0.6, b.y - 0.6, ctx.scene, this.mood));
    }
  }

  onStomp(ctx: StageCtx): void {
    this.beaten(ctx);
  }

  onShot(ctx: StageCtx): void {
    this.beaten(ctx);
  }

  defeat(squash: boolean): void {
    super.defeat(squash);
    this.mesh.visible = false;
    this.fade = 0;
  }

  private beaten(ctx: StageCtx): void {
    this.defeat(false);
    ctx.addPlatform(new CloudRide(this.body.x, this.body.y, ctx.scene, 12));
    ctx.toast('You beat the Timeline! Hop on the cloud and ride it.', 'good');
  }

  updateMesh(t: number): void {
    this.mesh.position.set(this.body.x + this.body.w / 2, this.body.y, 0);
    this.mesh.rotation.z = Math.sin(t * 2) * 0.05;
  }
}

/**
 * Jailbreaker: a jailbreak prompt on legs. Stomp it into its shell, then kick the shell:
 * a sliding shell knocks out other enemies, and it can hit you on the rebound.
 */
export class Jailbreaker extends Enemy {
  readonly kind = 'jailbreaker';
  readonly mesh: THREE.Group;
  private mode: 'walk' | 'shell' | 'slide' = 'walk';
  private shellTime = 0;
  private grace = 0;

  constructor(x: number, y: number, scene: THREE.Scene) {
    super(x, y, 0.85, 1.1, scene);
    this.mesh = makeJailbreaker();
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx): void {
    if (!this.alive) return this.stepDead(dt);
    this.grace = Math.max(0, this.grace - dt);
    // Walking, or a sliding shell past its kick grace, hurts on touch; a resting shell gets kicked.
    this.harmful = this.mode === 'walk' || (this.mode === 'slide' && this.grace <= 0);
    const b = this.body;
    if (this.mode === 'walk') {
      this.walk(dt, 2, ctx, true);
    } else if (this.mode === 'shell') {
      b.vx = 0;
      b.vy = Math.max(b.vy - 60 * dt, -28);
      moveBody(b, dt, ctx.grid);
      this.shellTime += dt;
      if (this.shellTime > 6) this.setMode('walk');
    } else {
      this.walk(dt, 12, ctx);
      for (const e of ctx.enemies()) {
        if (e !== this && e.alive && e.active && e.shootable && overlaps(e.body, b)) e.onShot(ctx);
      }
    }
  }

  onStomp(_ctx: StageCtx, p: PlayerActor): void {
    if (this.mode === 'shell') this.kick(p);
    else this.setMode('shell');
  }

  onTouch(_ctx: StageCtx, p: PlayerActor): 'hurt' | 'none' {
    if (this.mode === 'shell') {
      this.kick(p);
      return 'none';
    }
    return this.harmful ? 'hurt' : 'none';
  }

  private kick(p: PlayerActor): void {
    this.dir = this.body.x + this.body.w / 2 >= p.body.x + p.body.w / 2 ? 1 : -1;
    this.setMode('slide');
    this.grace = 0.3;
  }

  private setMode(mode: 'walk' | 'shell' | 'slide'): void {
    this.mode = mode;
    this.shellTime = 0;
    this.body.h = mode === 'walk' ? 1.1 : 0.7;
    const legs = this.mesh.getObjectByName('legs');
    if (legs) legs.visible = mode === 'walk';
  }

  updateMesh(t: number): void {
    const b = this.body;
    this.mesh.position.set(b.x + b.w / 2, b.y, 0);
    this.mesh.rotation.y = this.mode === 'slide' ? t * 20 : this.dir > 0 ? 0.6 : -0.6;
    this.mesh.rotation.z = this.mode === 'walk' ? Math.sin(t * 10) * 0.08 : 0;
  }
}

/**
 * Injection piranha: a prompt injection hiding in a tool pipe. It rises out of its pipe and sinks
 * back, but never while someone stands right beside it. Spiky (no stomping); tool calls stop it.
 */
export class InjectionPiranha extends Enemy {
  readonly kind = 'piranha';
  readonly mesh: THREE.Group;
  stompable = false;
  private readonly baseY: number;
  private phase: 'hidden' | 'rise' | 'out' | 'sink' = 'hidden';
  private t = 0;

  /** (x, y) is the tile just above the pipe's top; the pipe is two tiles wide starting at x. */
  constructor(x: number, y: number, scene: THREE.Scene, delay = 0) {
    super(x + 0.5, y, 0.8, 1.2, scene);
    this.baseY = y;
    this.body.y = y - 1.3;
    this.t = -delay;
    this.mesh = makePiranha();
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx): void {
    if (!this.alive) return this.stepDead(dt);
    this.t += dt;
    const b = this.body;
    const cx = b.x + b.w / 2;
    const near = ctx.players().some((p) => Math.abs(p.body.x + p.body.w / 2 - cx) < 1.6 && p.body.y < this.baseY + 2);
    if (this.phase === 'hidden' && this.t > 1.8 && !near) this.go('rise');
    else if (this.phase === 'rise') {
      b.y = Math.min(this.baseY, b.y + 2.6 * dt);
      if (b.y >= this.baseY) this.go('out');
    } else if (this.phase === 'out' && this.t > 1.6) this.go('sink');
    else if (this.phase === 'sink') {
      b.y = Math.max(this.baseY - 1.3, b.y - 2.6 * dt);
      if (b.y <= this.baseY - 1.3) this.go('hidden');
    }
    // Inside the pipe it can't touch anyone.
    this.harmful = b.y > this.baseY - 1.1;
    this.shootable = this.harmful;
  }

  private go(phase: InjectionPiranha['phase']): void {
    this.phase = phase;
    this.t = 0;
  }

  updateMesh(t: number): void {
    const b = this.body;
    this.mesh.position.set(b.x + b.w / 2, b.y, 0);
    this.mesh.rotation.z = this.alive ? Math.sin(t * 6) * 0.1 : Math.PI;
    const jaw = this.mesh.getObjectByName('jaw');
    if (jaw) jaw.rotation.x = Math.abs(Math.sin(t * 8)) * 0.5;
  }
}

/**
 * Hallucination ghost: creeps closer only while you look away (hallucinations appear when you stop
 * checking). Face it and it freezes; think with the cape and every ghost stops. No stomping.
 */
export class HallucinationGhost extends Enemy {
  readonly kind = 'ghost';
  readonly mesh: THREE.Group;
  stompable = false;
  private shy = false;

  constructor(x: number, y: number, scene: THREE.Scene, private readonly speed = 2.2, big = false) {
    super(x, y + 0.1, big ? 1.4 : 0.9, big ? 1.4 : 0.9, scene);
    this.mesh = makeGhost(big);
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx): void {
    if (!this.alive) return this.stepDead(dt);
    const b = this.body;
    const target = ctx.players().filter((p) => !p.clone).sort((p, q) => dist(p.body, b) - dist(q.body, b))[0];
    this.shy = true;
    if (!target) return;
    const thinking = ctx.players().some((p) => p.thinking);
    const dx = target.body.x + target.body.w / 2 - (b.x + b.w / 2);
    const dy = target.body.y + target.body.h / 2 - (b.y + b.h / 2);
    const facingIt = Math.sign(dx) === -target.mover.facing || Math.abs(dx) < 0.3;
    this.shy = thinking || facingIt;
    if (this.shy) return;
    const d = Math.hypot(dx, dy) || 1;
    b.x += (dx / d) * this.speed * dt;
    b.y += (dy / d) * this.speed * dt;
    this.dir = Math.sign(dx) || this.dir;
  }

  updateMesh(t: number): void {
    const b = this.body;
    this.mesh.position.set(b.x + b.w / 2, b.y + Math.sin(t * 3 + b.x) * 0.08, 0);
    this.mesh.rotation.y = this.dir > 0 ? 0.5 : -0.5;
    const body = this.mesh.getObjectByName('ghostBody') as THREE.Mesh | undefined;
    const mat = body?.material as THREE.MeshLambertMaterial | undefined;
    if (mat) mat.opacity = this.alive ? (this.shy ? 0.35 : 0.85) : 0.2;
    const hands = this.mesh.getObjectByName('hands');
    if (hands) hands.visible = this.shy;
  }
}

const dist = (a: Body, b: Body) => Math.hypot(a.x - b.x, a.y - b.y);

/** A legal brief, thrown in an arc. */
export class Brief extends Enemy {
  readonly kind = 'brief';
  readonly mesh: THREE.Object3D;
  stompable = false;
  private life = 3;

  /** A thrown projectile: a legal brief by default, or any mesh (hidden instructions). */
  constructor(x: number, y: number, vx: number, vy: number, scene: THREE.Scene, mesh: THREE.Object3D = makeBrief()) {
    super(x, y, 0.5, 0.4, scene);
    this.active = true;
    this.body.vx = vx;
    this.body.vy = vy;
    this.mesh = mesh;
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx): void {
    if (!this.alive) return this.stepDead(dt);
    const b = this.body;
    b.vy -= 30 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || b.y < -2 || ctx.grid.isSolid(Math.floor(b.x + b.w / 2), Math.floor(b.y + b.h / 2))) this.remove();
  }

  updateMesh(t: number): void {
    super.updateMesh(t);
    this.mesh.rotation.z = t * 8;
  }
}

/** A copyright claim: a briefcase that paces, hops, and throws briefs at you. Stomp it. */
export class Lawyer extends Enemy {
  readonly kind = 'lawyer';
  readonly mesh: THREE.Group;
  private throwTimer = 1.5;
  private hopTimer = 1;
  private readonly x0: number;

  constructor(x: number, y: number, scene: THREE.Scene) {
    super(x, y, 0.9, 1.1, scene);
    this.x0 = this.body.x;
    this.mesh = makeLawyer();
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx): void {
    if (!this.alive) return this.stepDead(dt);
    const b = this.body;
    if (Math.abs(b.x - this.x0) > 1.6) this.dir = b.x > this.x0 ? -1 : 1;
    b.vx = this.dir * 1.4;
    b.vy = Math.max(b.vy - 60 * dt, -28);
    this.hopTimer -= dt;
    if (this.hopTimer <= 0 && b.onGround) {
      b.vy = 11;
      this.hopTimer = 1.6 + ctx.rng();
    }
    const hits = moveBody(b, dt, ctx.grid);
    if (hits.some((h) => h.side === 'left' || h.side === 'right')) this.dir *= -1;
    if (b.y < -4) this.remove();
    this.throwTimer -= dt;
    const lead = ctx.lead();
    if (this.throwTimer <= 0 && lead && Math.abs(lead.body.x - b.x) < 12) {
      this.throwTimer = 2.2;
      const toward = Math.sign(lead.body.x - b.x) || -1;
      ctx.addEnemy(new Brief(b.x + b.w / 2 - 0.25, b.y + b.h, toward * 4.5, 11, ctx.scene));
    }
  }
}
