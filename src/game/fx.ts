import * as THREE from 'three';
import { softTexture } from './art';
import { Pool } from './fxPool';
import { mulberry32 } from './rng';
import { cachedGeo } from './toonKit';

/**
 * Pooled particle FX: five InstancedMeshes (one draw each while alive) sharing one unit quad, plus
 * four "+1" sprites. Owned by LevelView (`view.fx`), updated from LevelView.update. Nothing is
 * allocated per frame, and the FX use their own random stream, never Stage.rng, so gameplay and
 * debug replays are unchanged. The camera always looks down −z, so there is no billboarding.
 */

export type FxKind = 'spark' | 'star' | 'ring' | 'puff' | 'heart';
const KINDS: FxKind[] = ['spark', 'star', 'ring', 'puff', 'heart'];
/** Additive kinds fade by colour; the opaque cut-out kinds (alphaTest) shrink away instead. */
const ADDITIVE: Record<FxKind, boolean> = { spark: true, star: true, ring: true, puff: false, heart: false };
const TAU = Math.PI * 2;
const Z_BURST = 0.9;
const Z_RING = 0.8;
const Z_TRAIL = -0.3;

/** The 32 px FX sprites (white, tinted per particle). Shared, so backdrops and props may reuse them. */
export function fxTexture(kind: FxKind): THREE.Texture {
  return softTexture(`fx:${kind}`, 32, 32, (c) => {
    c.clearRect(0, 0, 32, 32);
    if (kind === 'spark') {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
    } else if (kind === 'star') {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
      c.fillStyle = '#ffffff';
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 5.5 : 14;
        const a = (k / 10) * TAU - Math.PI / 2;
        if (k === 0) c.moveTo(16 + r * Math.cos(a), 16 + r * Math.sin(a));
        else c.lineTo(16 + r * Math.cos(a), 16 + r * Math.sin(a));
      }
      c.closePath();
      c.fill();
    } else if (kind === 'ring') {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.62, 'rgba(255,255,255,0)');
      g.addColorStop(0.82, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
    } else if (kind === 'puff') {
      // A felt pom-pom: soft grey lower rim, highlight upper left (the sun's side).
      const g = c.createRadialGradient(13, 12, 2, 16, 16, 14);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.7, '#f2f2f6');
      g.addColorStop(1, '#bcbcc8');
      c.fillStyle = g;
      c.beginPath();
      c.arc(16, 16, 14, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.95)';
      c.beginPath();
      c.arc(11, 10, 3, 0, TAU);
      c.fill();
    } else {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(16, 28);
      c.bezierCurveTo(1, 18, 3, 4, 16, 10);
      c.bezierCurveTo(29, 4, 31, 18, 16, 28);
      c.fill();
      c.fillStyle = 'rgba(210,210,220,1)';
      c.beginPath();
      c.moveTo(16, 28);
      c.bezierCurveTo(22, 24, 27, 19, 28, 14);
      c.bezierCurveTo(27, 21, 22, 25, 16, 28);
      c.fill();
    }
  });
}

function plusTexture(): THREE.Texture {
  return softTexture('fx:plusOne', 64, 32, (c) => {
    c.clearRect(0, 0, 64, 32);
    c.font = 'bold 26px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 5;
    c.strokeStyle = '#1d1424';
    c.strokeText('+1', 32, 17);
    c.fillStyle = '#46e07a';
    c.fillText('+1', 32, 17);
  });
}

interface PlusOne {
  sprite: THREE.Sprite;
  t: number;
  x: number;
  y: number;
}
const PLUS_LIFE = 0.6;

export class Fx {
  private readonly pools = {} as Record<FxKind, Pool>;
  private readonly meshes = {} as Record<FxKind, THREE.InstancedMesh>;
  private readonly plus: PlusOne[] = [];
  private readonly rng = mulberry32(1);
  private readonly color = new THREE.Color();

  constructor(scene: THREE.Scene, touch: boolean) {
    const quad = cachedGeo('fx:quad', () => new THREE.PlaneGeometry(1, 1));
    for (const kind of KINDS) {
      const cap = kind === 'ring' ? 16 : touch ? 48 : 64;
      const pool = new Pool(cap);
      const mat = ADDITIVE[kind]
        ? new THREE.MeshBasicMaterial({ map: fxTexture(kind), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
        : new THREE.MeshBasicMaterial({ map: fxTexture(kind), alphaTest: 0.4 });
      const mesh = new THREE.InstancedMesh(quad, mat, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      mesh.name = `fx:${kind}`;
      this.pools[kind] = pool;
      this.meshes[kind] = mesh;
      scene.add(mesh);
    }
    const tex = plusTexture();
    for (let i = 0; i < 4; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sprite.scale.set(0.9, 0.45, 1);
      sprite.visible = false;
      sprite.renderOrder = 4;
      this.plus.push({ sprite, t: PLUS_LIFE, x: 0, y: 0 });
      scene.add(sprite);
    }
  }

  /** n particles flying out of (x, y) in random directions at up to `speed` tiles/s. */
  burst(kind: FxKind, x: number, y: number, n: number, color: number, speed: number, life = 0.5, size = 0.3, gravity = 0): void {
    const pool = this.pools[kind];
    const rng = this.rng;
    this.color.setHex(color);
    for (let k = 0; k < n; k++) {
      const i = pool.spawn();
      if (i < 0) return;
      const a = rng() * TAU;
      const sp = speed * (0.5 + 0.5 * rng());
      pool.x[i] = x;
      pool.y[i] = y;
      pool.z[i] = Z_BURST;
      pool.vx[i] = Math.cos(a) * sp;
      pool.vy[i] = Math.sin(a) * sp;
      pool.life[i] = life * (0.8 + 0.2 * rng());
      pool.rot[i] = rng() * TAU;
      pool.spin[i] = kind === 'star' ? (rng() * 2 - 1) * 8 : 0;
      pool.s0[i] = size;
      pool.s1[i] = kind === 'spark' ? 0.2 * size : kind === 'star' ? 0.5 * size : kind === 'puff' ? 1.6 * size : size;
      pool.drag[i] = kind === 'puff' ? 3 : 0;
      pool.grav[i] = kind === 'heart' && gravity === 0 ? -2 : gravity;
      this.tint(pool, i);
    }
  }

  /** A ring growing (or, with from > to, imploding) from size `from` to `to` over `life` seconds. */
  ring(x: number, y: number, color: number, from: number, to: number, life: number): void {
    const pool = this.pools.ring;
    const i = pool.spawn();
    if (i < 0) return;
    pool.x[i] = x;
    pool.y[i] = y;
    pool.z[i] = Z_RING;
    pool.life[i] = life;
    pool.s0[i] = from;
    pool.s1[i] = to;
    this.color.setHex(color);
    this.tint(pool, i);
  }

  /** One drifting trail particle behind a moving thing (drawn behind the play plane). */
  trail(kind: FxKind, x: number, y: number, color: number): void {
    const pool = this.pools[kind];
    const i = pool.spawn();
    if (i < 0) return;
    pool.x[i] = x + (this.rng() - 0.5) * 0.5;
    pool.y[i] = y + (this.rng() - 0.5) * 0.6;
    pool.z[i] = Z_TRAIL;
    pool.vy[i] = 0.8;
    pool.life[i] = 0.45;
    pool.rot[i] = this.rng() * TAU;
    pool.s0[i] = 0.22;
    pool.s1[i] = kind === 'spark' ? 0.044 : kind === 'star' ? 0.11 : 0.22;
    pool.spin[i] = kind === 'star' ? 4 : 0;
    this.color.setHex(color);
    this.tint(pool, i);
  }

  /** A green "+1" that rises a tile and fades. */
  plusOne(x: number, y: number): void {
    let slot = this.plus[0];
    for (const p of this.plus) if (p.t > slot.t) slot = p;
    slot.t = 0;
    slot.x = x;
    slot.y = y;
    slot.sprite.visible = true;
  }

  update(dt: number): void {
    for (const kind of KINDS) {
      const pool = this.pools[kind];
      const mesh = this.meshes[kind];
      if (!pool.count && !mesh.count) continue;
      pool.step(dt);
      const m = mesh.instanceMatrix.array as Float32Array;
      const col = mesh.instanceColor!.array as Float32Array;
      const additive = ADDITIVE[kind];
      for (let i = 0; i < pool.count; i++) {
        const k = pool.progress(i);
        let s = pool.s0[i] + (pool.s1[i] - pool.s0[i]) * k;
        let f = 1;
        if (additive) f = (1 - k) * (1 - k);
        else s *= 1 - k * k * k;
        const c = Math.cos(pool.rot[i]) * s;
        const sn = Math.sin(pool.rot[i]) * s;
        const o = i * 16;
        m[o] = c;
        m[o + 1] = sn;
        m[o + 2] = 0;
        m[o + 3] = 0;
        m[o + 4] = -sn;
        m[o + 5] = c;
        m[o + 6] = 0;
        m[o + 7] = 0;
        m[o + 8] = 0;
        m[o + 9] = 0;
        m[o + 10] = 1;
        m[o + 11] = 0;
        m[o + 12] = pool.x[i];
        m[o + 13] = pool.y[i];
        m[o + 14] = pool.z[i];
        m[o + 15] = 1;
        col[i * 3] = pool.r[i] * f;
        col[i * 3 + 1] = pool.g[i] * f;
        col[i * 3 + 2] = pool.b[i] * f;
      }
      mesh.count = pool.count;
      mesh.visible = pool.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
    }
    for (const p of this.plus) {
      if (p.t >= PLUS_LIFE) continue;
      p.t = Math.min(PLUS_LIFE, p.t + dt);
      const k = p.t / PLUS_LIFE;
      p.sprite.position.set(p.x, p.y + 1 - (1 - k) * (1 - k), Z_BURST);
      (p.sprite.material as THREE.SpriteMaterial).opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      p.sprite.visible = p.t < PLUS_LIFE;
    }
  }

  /** Shows every FX mesh (or restores normal visibility), so a pre-warm compile covers their shaders. */
  showAll(on: boolean): void {
    for (const kind of KINDS) this.meshes[kind].visible = on || this.meshes[kind].count > 0;
    for (const p of this.plus) p.sprite.visible = on || p.t < PLUS_LIFE;
  }

  private tint(pool: Pool, i: number): void {
    pool.r[i] = this.color.r;
    pool.g[i] = this.color.g;
    pool.b[i] = this.color.b;
  }
}
