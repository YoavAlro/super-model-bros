import * as THREE from 'three';
import type { StageCtx } from './ctx';
import { makeCloud, makeMovingPlatform } from './meshes';
import type { Pad } from './pad';
import type { Body } from './physics';
import { blinkVisible } from './prefs';

/**
 * A platform that is an actor, not a tile: it moves, and players standing on it move with it.
 * Like one-way tiles, you land on it from above and jump through it from below.
 */
export abstract class Platform {
  readonly body: Body;
  abstract readonly mesh: THREE.Object3D;
  alive = true;
  /** Riders steer it with left/right and stay centered on it (clouds), instead of walking on it. */
  steerable = false;
  /** How far it moved this step; riders are carried by the same amount. */
  dx = 0;
  dy = 0;

  constructor(x: number, y: number, w: number, h: number, protected readonly scene: THREE.Scene) {
    this.body = { x, y, w, h, vx: 0, vy: 0, onGround: false };
  }

  get top(): number {
    return this.body.y + this.body.h;
  }

  /** `rider` is the pad of a player standing on it, if any. */
  abstract step(dt: number, ctx: StageCtx, rider: Pad | null): void;

  updateMesh(_t: number): void {
    this.mesh.position.set(this.body.x + this.body.w / 2, this.body.y, 0);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
  }
}

/** `~` in a map: a platform gliding back and forth over a few tiles. */
export class MovingPlatform extends Platform {
  readonly mesh: THREE.Group;
  private t = 0;
  private readonly x0: number;

  constructor(x: number, y: number, scene: THREE.Scene, color: number, private readonly range = 4, private readonly period = 4) {
    super(x - 0.5, y - 0.4, 3, 0.4, scene);
    this.x0 = this.body.x;
    this.mesh = makeMovingPlatform(color);
    scene.add(this.mesh);
  }

  step(dt: number): void {
    this.t += dt;
    const nx = this.x0 + (Math.sin((this.t / this.period) * Math.PI * 2) * 0.5 + 0.5) * this.range;
    this.dx = nx - this.body.x;
    this.dy = 0;
    this.body.x = nx;
  }
}

/** A beaten Timeline cloud (or Grok's): it follows its rider's left/right for a while, then evaporates. */
export class CloudRide extends Platform {
  readonly mesh: THREE.Group;
  steerable = true;
  private life: number;

  constructor(x: number, y: number, scene: THREE.Scene, life = 10, private readonly speed = 9) {
    super(x, y, 2, 0.5, scene);
    this.life = life;
    this.mesh = makeCloud(0xffffff);
    scene.add(this.mesh);
  }

  step(dt: number, ctx: StageCtx, rider: Pad | null): void {
    this.life -= dt;
    const dir = rider ? (rider.right ? 1 : 0) - (rider.left ? 1 : 0) : 0;
    const vx = dir * this.speed;
    const nx = Math.min(Math.max(this.body.x + vx * dt, ctx.camLeft), ctx.camRight - this.body.w);
    // Blocked by walls: stop instead of passing through.
    const probe = vx > 0 ? nx + this.body.w : nx;
    const blocked = vx !== 0 && ctx.grid.isSolid(Math.floor(probe), Math.floor(this.body.y + 0.25));
    this.dx = blocked ? 0 : nx - this.body.x;
    this.dy = 0;
    this.body.x += this.dx;
    if (this.life <= 0) {
      this.alive = false;
      this.mesh.visible = false;
    }
  }

  updateMesh(t: number): void {
    super.updateMesh(t);
    this.mesh.visible = this.alive && (this.life > 2 || blinkVisible(t, 10));
  }
}

/** A platform that stays put: built blocks, em dashes, Golden Gate bridges. Optionally temporary. */
export class StaticPlatform extends Platform {
  constructor(
    x: number,
    y: number,
    w: number,
    h: number,
    scene: THREE.Scene,
    readonly mesh: THREE.Object3D,
    private life = Infinity,
  ) {
    super(x, y, w, h, scene);
    scene.add(mesh);
  }

  step(dt: number): void {
    this.dx = 0;
    this.dy = 0;
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      this.mesh.visible = false;
    }
  }

  updateMesh(t: number): void {
    super.updateMesh(t);
    this.mesh.visible = this.alive && (this.life > 1 || blinkVisible(t, 10));
  }
}

/** A platform riding on a body's head (Llama's open-weights copy): stand on it to climb higher. */
export class HeadPlatform extends Platform {
  readonly mesh = new THREE.Group();

  constructor(private readonly target: Body, scene: THREE.Scene) {
    super(target.x - 0.1, target.y + target.h - 0.15, target.w + 0.2, 0.15, scene);
    scene.add(this.mesh);
  }

  step(): void {
    const nx = this.target.x - 0.1;
    const ny = this.target.y + this.target.h - 0.15;
    this.dx = nx - this.body.x;
    this.dy = ny - this.body.y;
    this.body.x = nx;
    this.body.y = ny;
  }
}
