import * as THREE from 'three';
import type { DataTypeId } from '../config/dataTypes';
import { cachedMat, easeOutBack } from './art';
import { animateItem, makeFunctionCall, makeHeart, makePowerItem, makeToken, makeTrap } from './meshes';
import { moveBody, type Body, type Grid } from './physics';
import { prefs } from './prefs';
import { cachedGeo, roundedBox, toon } from './toonKit';

const TAU = Math.PI * 2;
const fract = (v: number) => v - Math.floor(v);
/** How long a collected token takes to leave (purely visual: it is collected at once). */
const TOKEN_OUTRO = 0.25;
/** A 0.09 s half-sine bump starting at `start` (0 outside it): one heartbeat. */
const pulse = (p: number, start: number) => (p >= start && p < start + 0.09 ? Math.sin((Math.PI * (p - start)) / 0.09) : 0);

/** A floating data token. `pop` tokens burst out of blocks and collect themselves. */
export class Token {
  readonly body: Body;
  readonly mesh: THREE.Group;
  taken = false;
  private popTime = 0;
  /** When the outro started (the first frame drawn after the token was taken), or −1. */
  private outroAt = -1;

  constructor(
    readonly type: DataTypeId,
    x: number,
    y: number,
    private readonly scene: THREE.Scene,
    readonly pop = false,
  ) {
    this.body = { x: x + 0.2, y: y + 0.2, w: 0.6, h: 0.6, vx: 0, vy: pop ? 14 : 0, onGround: false };
    this.mesh = makeToken(type);
    this.mesh.position.set(x + 0.5, y, 0);
    scene.add(this.mesh);
  }

  /** Returns true once a popped token has finished its arc (it is then collected). */
  step(dt: number): boolean {
    if (!this.pop || this.taken) return false;
    this.popTime += dt;
    this.body.vy -= 45 * dt;
    this.body.y += this.body.vy * dt;
    return this.popTime > 0.45;
  }

  /** Collected at once; updateMesh then plays a short outro (a hop, a spin and a pop) and hides it. */
  take(): void {
    this.taken = true;
  }

  updateMesh(t: number): void {
    const m = this.mesh;
    if (this.taken) {
      if (!m.visible) return;
      if (this.outroAt < 0) this.outroAt = t;
      const k = Math.min(1, (t - this.outroAt) / TOKEN_OUTRO);
      m.position.set(this.body.x + 0.3, this.body.y - 0.2 + 0.9 * (1 - (1 - k) * (1 - k)), 0);
      m.rotation.y = 2 * TAU * k;
      m.scale.setScalar(k < 0.35 ? 1 + k : 1.35 * (1 - (k - 0.35) / 0.65));
      if (k >= 1) m.visible = false;
      return;
    }
    const x = this.body.x;
    m.position.set(x + 0.3, this.body.y - 0.2 + (this.pop ? 0 : Math.sin(t * 3 + x) * 0.06), 0);
    if (this.pop) {
      m.rotation.y = t * 18;
      return;
    }
    // The stadium wave: now and then a row of chips flips over, left to right.
    const ph = fract(0.42 * t - 0.06 * x);
    if (ph < 0.16 && !prefs.reduceMotion) m.rotation.y = TAU * easeOutBack(ph / 0.16);
    else m.rotation.y = 0.25 * (prefs.reduceMotion ? 0.3 : 1) * Math.min(1, Math.max(0, (ph - 0.16) / 0.1)) * Math.sin(2 * t + x);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
  }
}

/** Things question blocks release besides tokens. */
/** `frozen` is a power-up iced over by an access suspension: take it now, and it thaws later. */
export type ItemKind = 'scale' | 'rlhf' | 'viral' | 'tool' | 'cape' | 'fork' | 'mega' | 'oneup' | 'hype' | 'moment' | 'frozen';

const MOTION: Record<ItemKind, 'slide' | 'bounce' | 'stay'> = {
  scale: 'slide',
  oneup: 'slide',
  fork: 'slide',
  mega: 'slide',
  rlhf: 'bounce',
  viral: 'bounce',
  tool: 'stay',
  cape: 'stay',
  hype: 'stay',
  moment: 'stay',
  frozen: 'stay',
};

/** A power-up: rises out of its block, then slides, bounces, or waits on top of it. */
export class PowerItem {
  readonly body: Body;
  readonly mesh: THREE.Group;
  taken = false;
  private rise = 0.6;
  private dir = 1;
  /** A little squash after bouncing off a wall (visual only). */
  private squash = 0;

  constructor(
    readonly kind: ItemKind,
    x: number,
    y: number,
    private readonly scene: THREE.Scene,
    /** For hype and moment items: which one. */
    readonly ref?: string,
    color?: number,
    /** False for items that fall from the sky instead of rising out of a block. */
    emerge = true,
  ) {
    this.body = { x: x + 0.1, y, w: 0.8, h: 0.8, vx: 0, vy: 0, onGround: false };
    this.mesh = makePowerItem(kind, color);
    if (!emerge) this.rise = 0;
    scene.add(this.mesh);
  }

  step(dt: number, grid: Grid): void {
    if (this.taken) return;
    const b = this.body;
    if (this.rise > 0) {
      this.rise -= dt;
      b.y += dt * 1.7;
      return;
    }
    const motion = MOTION[this.kind];
    if (motion === 'stay') return;
    b.vx = this.dir * (motion === 'bounce' ? 4 : 3);
    b.vy = Math.max(b.vy - 50 * dt, -20);
    const hits = moveBody(b, dt, grid);
    this.squash = Math.max(0, this.squash - dt * 0.5);
    if (hits.some((h) => h.side === 'left' || h.side === 'right')) {
      this.dir *= -1;
      this.squash = 0.08;
    }
    if (motion === 'bounce' && b.onGround) b.vy = 13;
    if (b.y < -4) this.take();
  }

  get emerging(): boolean {
    return this.rise > 0;
  }

  take(): void {
    this.taken = true;
    this.mesh.visible = false;
  }

  updateMesh(t: number): void {
    const b = this.body;
    this.mesh.position.set(b.x + 0.4, b.y, 0);
    animateItem(this.mesh, t, b.vx, b.vy, this.rise > 0 ? 1 - this.rise / 0.6 : 1);
    if (this.squash > 0) this.mesh.scale.x *= 1 - this.squash * 1.9;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
  }
}

/** Looks like a treat, costs you something: reward orbs (drain Alignment) and praise coins (undo a power-up). */
export type TrapKind = 'rewardOrb' | 'praise';

export class Trap {
  readonly body: Body;
  readonly mesh: THREE.Group;
  taken = false;
  /** Falls to the ground when true (orbs dropped by the Reward Hacker). */
  private falling: boolean;

  constructor(
    readonly kind: TrapKind,
    x: number,
    y: number,
    private readonly scene: THREE.Scene,
    falling = false,
  ) {
    this.body = { x: x + 0.2, y: y + 0.2, w: 0.6, h: 0.6, vx: 0, vy: 0, onGround: false };
    this.falling = falling;
    this.mesh = makeTrap(kind);
    scene.add(this.mesh);
  }

  step(dt: number, grid: Grid): void {
    if (this.taken || !this.falling) return;
    const b = this.body;
    b.vy = Math.max(b.vy - 30 * dt, -12);
    moveBody(b, dt, grid);
    if (b.onGround) this.falling = false;
    if (b.y < -4) this.take();
  }

  take(): void {
    this.taken = true;
    this.mesh.visible = false;
  }

  updateMesh(t: number): void {
    if (this.taken) return;
    const bob = this.falling ? 0 : Math.sin(t * 3 + this.body.x) * 0.06;
    this.mesh.position.set(this.body.x + 0.3, this.body.y - 0.2 + bob, 0);
    this.mesh.rotation.y = Math.sin(t * 2 + this.body.x) * 0.6;
    const s = 1 + Math.sin(t * 8 + this.body.x) * 0.06 * (prefs.reduceMotion ? 0.3 : 1);
    this.mesh.scale.setScalar(s);
    animateItem(this.mesh, t);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
  }
}

/** A heart token: the people. Some storms end early when you gather enough of them. */
export class Heart {
  readonly body: Body;
  readonly mesh: THREE.Group;
  taken = false;

  constructor(x: number, y: number, private readonly scene: THREE.Scene) {
    this.body = { x: x + 0.2, y: y + 0.2, w: 0.6, h: 0.6, vx: 0, vy: 0, onGround: false };
    this.mesh = makeHeart();
    scene.add(this.mesh);
  }

  take(): void {
    this.taken = true;
    this.mesh.visible = false;
  }

  updateMesh(t: number): void {
    if (this.taken) return;
    this.mesh.position.set(this.body.x + 0.3, this.body.y - 0.2 + Math.sin(t * 4 + this.body.x) * 0.08, 0);
    this.mesh.rotation.y = Math.sin(t * 2 + this.body.x);
    // Lub-dub: two beats, then a rest.
    const p = t % 1.1;
    this.mesh.scale.setScalar(1 + (0.14 * pulse(p, 0) + 0.08 * pulse(p, 0.18)) * (prefs.reduceMotion ? 0.3 : 1));
  }

  dispose(): void {
    this.scene.remove(this.mesh);
  }
}

/** A function call: the tool flower's shot. Bounces along the ground and breaks on walls. */
export class FunctionCall {
  readonly body: Body;
  readonly mesh: THREE.Group;
  alive = true;
  private life = 1.6;

  constructor(x: number, y: number, dir: number, private readonly scene: THREE.Scene) {
    this.body = { x, y, w: 0.45, h: 0.45, vx: dir * 13, vy: -2, onGround: false };
    this.mesh = makeFunctionCall();
    scene.add(this.mesh);
  }

  step(dt: number, grid: Grid): void {
    if (!this.alive) return;
    const b = this.body;
    b.vy = Math.max(b.vy - 50 * dt, -16);
    const vx = b.vx;
    const hits = moveBody(b, dt, grid);
    if (hits.some((h) => h.side === 'left' || h.side === 'right')) this.pop();
    if (b.onGround) {
      b.vy = 8;
      b.vx = vx;
    }
    this.life -= dt;
    if (this.life <= 0 || b.y < -2) this.pop();
  }

  pop(): void {
    this.alive = false;
    this.mesh.visible = false;
  }

  updateMesh(t: number): void {
    this.mesh.position.set(this.body.x + 0.22, this.body.y, 0);
    this.mesh.rotation.z = -t * 14 * Math.sign(this.body.vx || 1);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
  }
}

/** Toy-brick shards flying off after a big player breaks a brick: four pills and two crumbs. */
export class Debris {
  private readonly pieces: { mesh: THREE.Mesh; v: THREE.Vector3; spin: number }[] = [];
  private life = 1.2;

  constructor(x: number, y: number, color: number, private readonly scene: THREE.Scene) {
    const mat = cachedMat(`debris:${color}`, () => toon(color));
    const pill = roundedBox(0.34, 0.18, 0.3, 0.06, 0.03);
    const crumb = cachedGeo('debris:crumb', () => new THREE.BoxGeometry(0.12, 0.12, 0.12));
    const add = (geo: THREE.BufferGeometry, px: number, py: number, v: THREE.Vector3) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, 0);
      mesh.rotation.z = (v.x > 0 ? -1 : 1) * 0.3;
      scene.add(mesh);
      this.pieces.push({ mesh, v, spin: Math.sign(v.x) || 1 });
    };
    for (const [dx, dy] of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
      add(pill, x + 0.5 + dx * 0.2, y + 0.5 + dy * 0.2, new THREE.Vector3(dx * 4, 9 + dy * 4, (dx + dy) * 1.5));
    }
    for (const dx of [-1, 1]) add(crumb, x + 0.5 + dx * 0.5, y + 0.6, new THREE.Vector3(dx * 2, 11, 0));
  }

  /** Returns false once finished. */
  step(dt: number): boolean {
    this.life -= dt;
    const s = this.life < 0.25 ? Math.max(0, this.life / 0.25) : 1;
    for (const p of this.pieces) {
      p.v.y -= 40 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += dt * 10;
      p.mesh.rotation.z += dt * 6 * p.spin;
      p.mesh.scale.setScalar(s);
    }
    if (this.life <= 0) this.dispose();
    return this.life > 0;
  }

  /** Geometry and materials are shared, so only the meshes go. */
  dispose(): void {
    for (const p of this.pieces) this.scene.remove(p.mesh);
  }
}
