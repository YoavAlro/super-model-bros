import * as THREE from 'three';
import type { DataTypeId } from '../config/dataTypes';
import { makeFunctionCall, makePowerItem, makeToken, makeTrap } from './meshes';
import { moveBody, type Body, type Grid } from './physics';

/** A floating data token. `pop` tokens burst out of blocks and collect themselves. */
export class Token {
  readonly body: Body;
  readonly mesh: THREE.Group;
  taken = false;
  private popTime = 0;

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

  take(): void {
    this.taken = true;
    this.mesh.visible = false;
  }

  updateMesh(t: number): void {
    if (this.taken) return;
    this.mesh.position.set(this.body.x + 0.3, this.body.y - 0.2 + (this.pop ? 0 : Math.sin(t * 3 + this.body.x) * 0.06), 0);
    this.mesh.rotation.y = this.pop ? t * 18 : Math.sin(t * 2 + this.body.x) * 0.6;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
  }
}

/** Things question blocks release besides tokens. */
export type ItemKind = 'scale' | 'rlhf' | 'viral' | 'tool' | 'cape' | 'fork' | 'mega' | 'oneup' | 'hype' | 'moment';

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
};

/** A power-up: rises out of its block, then slides, bounces, or waits on top of it. */
export class PowerItem {
  readonly body: Body;
  readonly mesh: THREE.Group;
  taken = false;
  private rise = 0.6;
  private dir = 1;

  constructor(
    readonly kind: ItemKind,
    x: number,
    y: number,
    private readonly scene: THREE.Scene,
    /** For hype and moment items: which one. */
    readonly ref?: string,
    color?: number,
  ) {
    this.body = { x: x + 0.1, y, w: 0.8, h: 0.8, vx: 0, vy: 0, onGround: false };
    this.mesh = makePowerItem(kind, color);
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
    if (hits.some((h) => h.side === 'left' || h.side === 'right')) this.dir *= -1;
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
    this.mesh.position.set(this.body.x + 0.4, this.body.y, 0);
    this.mesh.rotation.y = t * 2;
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
    const s = 1 + Math.sin(t * 8 + this.body.x) * 0.06;
    this.mesh.scale.setScalar(s);
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

/** Brick fragments flying off after a big player breaks a brick. */
export class Debris {
  private readonly pieces: { mesh: THREE.Mesh; v: THREE.Vector3 }[] = [];
  private life = 1.2;

  constructor(x: number, y: number, color: number, private readonly scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const mat = new THREE.MeshLambertMaterial({ color });
    for (const [dx, dy] of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + 0.5 + dx * 0.2, y + 0.5 + dy * 0.2, 0);
      scene.add(mesh);
      this.pieces.push({ mesh, v: new THREE.Vector3(dx * 4, 9 + dy * 4, (dx + dy) * 1.5) });
    }
  }

  /** Returns false once finished. */
  step(dt: number): boolean {
    this.life -= dt;
    for (const p of this.pieces) {
      p.v.y -= 40 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += dt * 10;
    }
    if (this.life <= 0) this.dispose();
    return this.life > 0;
  }

  dispose(): void {
    for (const p of this.pieces) this.scene.remove(p.mesh);
    this.pieces[0]?.mesh.geometry.dispose();
    (this.pieces[0]?.mesh.material as THREE.Material | undefined)?.dispose();
  }
}
