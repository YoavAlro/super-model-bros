import * as THREE from 'three';
import { DATA_TYPES, type DataTypeId } from '../config/dataTypes';
import { makeScaleCrystal, makeToken } from './meshes';
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
    this.mesh = makeToken(DATA_TYPES[type].color);
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
    this.mesh.rotation.y = t * (this.pop ? 18 : 3);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
  }
}

/** The Scale power-up: rises out of its block, then slides along the ground. */
export class ScaleItem {
  readonly body: Body;
  readonly mesh: THREE.Group;
  taken = false;
  private rise = 0.6;
  private dir = 1;

  constructor(x: number, y: number, private readonly scene: THREE.Scene) {
    this.body = { x: x + 0.1, y, w: 0.8, h: 0.8, vx: 0, vy: 0, onGround: false };
    this.mesh = makeScaleCrystal();
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
    b.vx = this.dir * 3;
    b.vy = Math.max(b.vy - 50 * dt, -20);
    const hits = moveBody(b, dt, grid);
    if (hits.some((h) => h.side === 'left' || h.side === 'right')) this.dir *= -1;
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
      this.pieces.push({ mesh, v: new THREE.Vector3(dx * 4, 9 + dy * 4, (Math.random() - 0.5) * 4) });
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
  }
}
