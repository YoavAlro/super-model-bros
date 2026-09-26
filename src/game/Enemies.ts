import * as THREE from 'three';
import type { StageCtx } from './ctx';
import { makeSpambot } from './meshes';
import { moveBody, type Body } from './physics';

/**
 * Base enemy. Enemies wake up when they scroll into view. By default a stomp or a tool call
 * kills them and touching them from the side hurts; subclasses override what differs.
 */
export abstract class Enemy {
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

  onStomp(_ctx: StageCtx): void {
    this.defeat(true);
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
