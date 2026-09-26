import * as THREE from 'three';
import { labelSprite, makeSpambot } from './meshes';
import { moveBody, type Body, type Grid } from './physics';

/** Spambot: walks, turns at walls, dies when stomped. */
export class Spambot {
  readonly body: Body;
  readonly mesh: THREE.Group;
  alive = true;
  /** Seconds left of the squashed animation, once stomped. */
  squashed = 0;
  private dir = -1;

  constructor(x: number, y: number, private readonly scene: THREE.Scene, public active = false) {
    this.body = { x: x + 0.05, y, w: 0.9, h: 0.8, vx: 0, vy: 0, onGround: false };
    this.mesh = makeSpambot();
    scene.add(this.mesh);
  }

  step(dt: number, grid: Grid): void {
    if (!this.alive) {
      this.squashed -= dt;
      if (this.squashed <= 0) this.mesh.visible = false;
      return;
    }
    const b = this.body;
    b.vx = this.dir * 2.2;
    b.vy = Math.max(b.vy - 60 * dt, -28);
    const hits = moveBody(b, dt, grid);
    if (hits.some((h) => h.side === 'left' || h.side === 'right')) this.dir *= -1;
    if (b.y < -4) this.remove();
  }

  squash(): void {
    this.alive = false;
    this.squashed = 0.5;
    this.mesh.scale.set(1.2, 0.3, 1.2);
  }

  remove(): void {
    this.alive = false;
    this.squashed = 0;
    this.mesh.visible = false;
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

/** Garbage In: World 1's boss. A giant Spambot that charges, leaps, and spawns junk. */
export class GarbageBoss {
  readonly body: Body;
  readonly mesh: THREE.Group;
  hp = 3;
  alive = true;
  awake = false;
  invulnerable = 0;
  private jumpTimer = 2.5;
  private spawnTimer = 3.5;
  private dir = -1;
  private readonly label: THREE.Sprite;

  constructor(x: number, y: number, private readonly scene: THREE.Scene) {
    this.body = { x, y, w: 2.5, h: 2.2, vx: 0, vy: 0, onGround: false };
    this.mesh = makeSpambot(2.8, 0xa8473f);
    this.label = labelSprite('GARBAGE IN', '#ffd1c9', 'rgba(80,0,0,0.6)');
    this.label.scale.multiplyScalar(0.6);
    scene.add(this.mesh, this.label);
  }

  /** Returns true when it wants to spawn a minion this step. */
  step(dt: number, grid: Grid, targetX: number): { landed: boolean; spawn: boolean } {
    const b = this.body;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (!this.alive) {
      b.vy -= 40 * dt;
      b.y += b.vy * dt;
      return { landed: false, spawn: false };
    }
    const rage = 3 - this.hp;
    const toward = Math.sign(targetX - (b.x + b.w / 2)) || this.dir;
    if (b.onGround) this.dir = toward;
    b.vx = this.dir * (2.4 + rage * 1.2);

    this.jumpTimer -= dt;
    if (this.jumpTimer <= 0 && b.onGround) {
      b.vy = 17 + rage * 2;
      this.jumpTimer = 2.6 - rage * 0.5;
    }
    this.spawnTimer -= dt;
    const spawn = this.spawnTimer <= 0;
    if (spawn) this.spawnTimer = 4.5 - rage;

    const wasAirborne = !b.onGround;
    b.vy = Math.max(b.vy - 45 * dt, -28);
    moveBody(b, dt, grid);
    return { landed: wasAirborne && b.onGround, spawn };
  }

  hit(): void {
    this.hp--;
    this.invulnerable = 1.2;
    if (this.hp <= 0) {
      this.alive = false;
      this.body.vy = 12;
    }
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
