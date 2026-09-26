import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Celestial, ExtraId, Life, Scenery, Strip, Theme } from '../config/themes';
import { softTexture } from './art';
import { edgeY } from './edges';
import { fxTexture } from './fx';
import { css, hash01, hazeHex, mixHex, shade } from './palette';
import { prefs } from './prefs';
import { mulberry32 } from './rng';
import { cachedGeo } from './toonKit';

/**
 * The backdrop diorama: flat, unlit cardboard behind the play plane, hazed toward the horizon, so it
 * never competes with the inked toy pieces you can touch. Built from the theme's strips, scenery,
 * life, celestial and clouds (src/config/themes.ts).
 *
 * Draws: the static cardboard (strips, set pieces, frames, brackets) is ONE merged vertex-coloured
 * mesh; a patterned wall, the celestial (2), each on-screen cloud, torch flames and glows, gears and
 * each life system add one each. Everything moves from update(), never from Stage.rng.
 */

const TAU = Math.PI * 2;
/** Arm length of an orrery's i-th planet. */
const ORRERY_ARM = (i: number) => 2.4 + 1.05 * i;
const fract = (v: number) => v - Math.floor(v);
const wrap = (v: number, lo: number, hi: number) => lo + (((v - lo) % (hi - lo)) + (hi - lo)) % (hi - lo);

/** Where a layer at depth z must reach, so a 21:9 phone never sees its ends. */
const layerX = (z: number, W: number): [number, number] => [-(4 + 0.9 * Math.abs(z)), W + 4 + 0.9 * Math.abs(z)];
/** Half-width of the band around the camera that life at depth z wraps in. */
const lifeSpan = (z: number) => 18 + 0.9 * Math.abs(z);

type ColorOf = number | ((x: number, y: number) => number);

/**
 * Collects cardboard pieces into one mesh: every face gets its (hazed) colour, banded by the way it
 * faces, like painted card lit from above. No normals, no UVs: the cheapest draw there is.
 */
class Cardboard {
  private readonly parts: THREE.BufferGeometry[] = [];
  private readonly c = new THREE.Color();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly n = new THREE.Vector3();

  constructor(private readonly sky: string) {}

  /** `color` is one colour or a function of the local vertex; `m` places the piece. Consumes `geo`. */
  add(geo: THREE.BufferGeometry, color: ColorOf, haze: number, m?: THREE.Matrix4): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g.clearGroups();
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const hex = typeof color === 'number' ? color : color(pos.getX(i), pos.getY(i));
      this.c.setHex(hazeHex(hex, this.sky, haze)).toArray(col, i * 3);
    }
    if (m) g.applyMatrix4(m);
    const p = pos.array as Float32Array;
    for (let f = 0; f + 2 < pos.count; f += 3) {
      const o = f * 3;
      this.a.set(p[o + 3] - p[o], p[o + 4] - p[o + 1], p[o + 5] - p[o + 2]);
      this.b.set(p[o + 6] - p[o], p[o + 7] - p[o + 1], p[o + 8] - p[o + 2]);
      this.n.crossVectors(this.a, this.b).normalize();
      const band = this.n.y > 0.5 ? 1.12 : Math.abs(this.n.x) > 0.5 ? 0.8 : this.n.y < -0.5 ? 0.7 : 1;
      if (band !== 1) for (let k = o; k < o + 9; k++) col[k] *= band;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
  }

  build(): THREE.Mesh | null {
    if (!this.parts.length) return null;
    const geo = mergeGeometries(this.parts)!;
    for (const g of this.parts) g.dispose();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    mesh.name = 'backdrop:static';
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

const place = (x: number, y: number, z: number, rz = 0, ry = 0, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)), new THREE.Vector3(s, s, s));

// ------------------------------------------------------------------ strips
/** Extra samples where a profile has corners or steps, so cut edges stay crisp. */
function keyXs(s: Strip, x0: number, x1: number): number[] {
  const out: number[] = [];
  const P = s.period;
  const seed = Math.abs(s.z) * 7.13;
  const step = (x: number) => out.push(x - 0.002, x + 0.002);
  for (let k = Math.floor(x0 / P) - 1; k * P < x1 + P; k++) {
    const x = k * P;
    if (s.edge === 'crenel') {
      step(x);
      step(x + 0.55 * P);
    } else if (s.edge === 'skyline') {
      step(x);
      step(x + 0.45 * P);
      step(x + 0.55 * P);
    } else if (s.edge === 'roofs') {
      step(x);
      out.push(x + 0.5 * P);
    } else if (s.edge === 'drip') out.push(x + 0.5 * P, x);
    else if (s.edge === 'jagged') out.push(x, x + 0.5 * P);
    else if (s.edge === 'scallop') {
      // Scallop cusps sit at the period boundaries, shifted by the seed.
      const cusp = (k - fract(seed)) * P;
      step(cusp);
    }
  }
  return out.filter((x) => x > x0 && x < x1);
}

function stripGeos(s: Strip, W: number): { body: THREE.BufferGeometry; rim: THREE.BufferGeometry } {
  const [x0, x1] = layerX(s.z, W);
  const seed = Math.abs(s.z) * 7.13;
  const xs: number[] = [];
  for (let x = x0; x < x1; x += 0.5) xs.push(x);
  xs.push(x1, ...keyXs(s, x0, x1));
  xs.sort((a, b) => a - b);
  const sign = s.hang ? -1 : 1;
  const far = s.hang ? 80 : -60;
  const ye = xs.map((x) => s.top + sign * edgeY(s.edge, x, s.amp, s.period, seed));
  const body: number[] = [];
  const rim: number[] = [];
  const quad = (arr: number[], xa: number, ya0: number, ya1: number, xb: number, yb0: number, yb1: number, z: number) => {
    // A quad from column a to column b, y0 → y1 on each, wound to face +z.
    const up = ya1 > ya0;
    if (up) arr.push(xa, ya0, z, xb, yb0, z, xb, yb1, z, xa, ya0, z, xb, yb1, z, xa, ya1, z);
    else arr.push(xa, ya1, z, xb, yb1, z, xb, yb0, z, xa, ya1, z, xb, yb0, z, xa, ya0, z);
  };
  for (let i = 0; i + 1 < xs.length; i++) {
    const [xa, xb] = [xs[i], xs[i + 1]];
    if (xb - xa < 1e-5) continue;
    quad(body, xa, far, ye[i], xb, far, ye[i + 1], s.z);
    quad(rim, xa, ye[i] - sign * 0.18, ye[i], xb, ye[i + 1] - sign * 0.18, ye[i + 1], s.z + 0.02);
  }
  const make = (arr: number[]) => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  return { body: make(body), rim: make(rim) };
}

// ------------------------------------------------------------------ shapes
/** A capsule (fully round top and bottom), centred on (cx, cy). Usable as a shape or a hole. */
function capsule(w: number, h: number, cx: number, cy: number): THREE.Shape {
  const r = w / 2;
  const p = new THREE.Shape();
  const top = cy + h / 2 - r;
  const bot = cy - h / 2 + r;
  p.moveTo(cx + r, bot);
  p.lineTo(cx + r, top);
  p.absarc(cx, top, r, 0, Math.PI, false);
  p.lineTo(cx - r, bot);
  p.absarc(cx, bot, r, Math.PI, TAU, false);
  return p;
}

function rectShape(x0: number, y0: number, x1: number, y1: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(x0, y0);
  s.lineTo(x1, y0);
  s.lineTo(x1, y1);
  s.lineTo(x0, y1);
  s.closePath();
  return s;
}

/** The open-end wrench's head: a disc with a slot cut into its top. */
function wrenchHead(r: number, cx: number, cy: number): THREE.Shape {
  const hw = 0.3 * (r / 0.9);
  const a0 = Math.acos(hw / r);
  const s = new THREE.Shape();
  s.moveTo(cx - hw, cy + Math.sin(a0) * r);
  s.absarc(cx, cy, r, Math.PI - a0, TAU + a0, false);
  s.lineTo(cx + hw, cy + 0.1 * r);
  s.lineTo(cx - hw, cy + 0.1 * r);
  s.closePath();
  return s;
}

const shapeGeo = (shape: THREE.Shape | THREE.Shape[], z: number, segments = 12) => new THREE.ShapeGeometry(shape, segments).translate(0, 0, z);

// ------------------------------------------------------------------ textures
function wallTexture(pattern: 'stone' | 'damask' | 'pegboard', c0: number, c1: number): THREE.Texture {
  const tex = softTexture(`wall:${pattern}:${c0}:${c1}`, 64, 64, (c) => {
    const h = (i: number, j: number) => hash01(i + 11, j + 5);
    if (pattern === 'stone') {
      c.fillStyle = css(shade(c0, 0.7));
      c.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 16 : 0;
        for (let k = -1; k < 3; k++) {
          const x = k * 32 + off;
          c.fillStyle = css(mixHex(c0, c1, 0.25 + 0.6 * h(k + 4, row)));
          c.fillRect(x + 1, row * 16 + 1, 30, 14);
          c.fillStyle = css(shade(c1, 1.12));
          c.fillRect(x + 1, row * 16 + 1, 30, 1.5);
        }
      }
    } else if (pattern === 'damask') {
      c.fillStyle = css(c0);
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = css(c1);
      // A fleur on a half-drop: three petals over a diamond, twice per tile.
      for (const [x, y] of [[16, 18], [48, 50], [48, -14], [16, 82]]) {
        c.beginPath();
        c.ellipse(x, y - 5, 3, 7, 0, 0, TAU);
        c.ellipse(x - 6, y + 1, 5, 2.5, -0.5, 0, TAU);
        c.ellipse(x + 6, y + 1, 5, 2.5, 0.5, 0, TAU);
        c.fill();
        c.beginPath();
        c.moveTo(x, y + 4);
        c.lineTo(x + 3.5, y + 8);
        c.lineTo(x, y + 12);
        c.lineTo(x - 3.5, y + 8);
        c.closePath();
        c.fill();
      }
      c.fillStyle = css(mixHex(c0, c1, 0.5));
      for (const [x, y] of [[48, 18], [16, 50]]) c.fillRect(x - 1, y - 1, 2, 2);
    } else {
      c.fillStyle = css(c0);
      c.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const [x, y] = [8 + 16 * i, 8 + 16 * j];
          c.fillStyle = css(shade(c0, 1.18));
          c.beginPath();
          c.arc(x + 0.8, y + 0.8, 3.4, 0, TAU);
          c.fill();
          c.fillStyle = css(c1);
          c.beginPath();
          c.arc(x, y, 3.2, 0, TAU);
          c.fill();
        }
      }
    }
  }, 'theme');
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.5, 0.5);
  return tex;
}

/** A soft radial glow, white (tinted per material). */
function glowTexture(): THREE.Texture {
  return softTexture('bd:glow', 32, 32, (c) => {
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
  });
}

// ------------------------------------------------------------------ life
interface LifeSystem {
  update(t: number, dt: number, camX: number): void;
}

/** Instanced movers: each instance has a base position that update() turns into a matrix. */
class Movers implements LifeSystem {
  readonly mesh: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly bx: Float32Array;
  private readonly by: Float32Array;
  private readonly span: number;
  private clock = 0;

  constructor(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    readonly n: number,
    readonly z: number,
    rng: () => number,
    yRange: [number, number],
    private readonly move: (i: number, t: number, clock: number, out: { x: number; y: number; rz: number; ry: number; sx: number; sy: number }) => void,
  ) {
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.span = lifeSpan(z);
    this.bx = new Float32Array(n);
    this.by = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.bx[i] = (rng() * 2 - 1) * this.span;
      this.by[i] = yRange[0] + rng() * (yRange[1] - yRange[0]);
    }
  }

  private readonly out = { x: 0, y: 0, rz: 0, ry: 0, sx: 1, sy: 1 };

  update(t: number, dt: number, camX: number): void {
    this.clock += dt;
    const o = this.out;
    for (let i = 0; i < this.n; i++) {
      o.x = this.bx[i];
      o.y = this.by[i];
      o.rz = o.ry = 0;
      o.sx = o.sy = 1;
      this.move(i, t, this.clock, o);
      const x = camX + wrap(o.x - 0.3 * camX, -this.span, this.span);
      this.q.setFromEuler(this.e.set(0, o.ry, o.rz));
      this.mesh.setMatrixAt(i, this.m.compose(this.p.set(x, o.y, this.z), this.q, this.s.set(o.sx, o.sy, 1)));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Additive point sprites (motes, embers, fireflies) wrapped round the camera. */
class Sparks implements LifeSystem {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly bx: Float32Array;
  private readonly by: Float32Array;
  private readonly ph: Float32Array;
  private readonly span: number;

  constructor(
    readonly n: number,
    private readonly z: number,
    color: number,
    size: number,
    rng: () => number,
    private readonly yRange: [number, number],
    private readonly move: (t: number, bx: number, by: number, ph: number, out: THREE.Vector2) => void,
  ) {
    this.pos = new Float32Array(n * 3);
    this.bx = new Float32Array(n);
    this.by = new Float32Array(n);
    this.ph = new Float32Array(n);
    this.span = lifeSpan(z);
    for (let i = 0; i < n; i++) {
      this.bx[i] = (rng() * 2 - 1) * this.span;
      this.by[i] = yRange[0] + rng() * (yRange[1] - yRange[0]);
      this.ph[i] = rng() * TAU;
      this.pos[i * 3 + 2] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size, map: fxTexture('spark'), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.points.frustumCulled = false;
  }

  private readonly v = new THREE.Vector2();

  update(t: number, _dt: number, camX: number): void {
    const [y0, y1] = this.yRange;
    for (let i = 0; i < this.n; i++) {
      this.move(t, this.bx[i], this.by[i], this.ph[i], this.v);
      this.pos[i * 3] = camX + wrap(this.v.x - 0.3 * camX, -this.span, this.span);
      this.pos[i * 3 + 1] = wrap(this.v.y, y0, y1);
      this.pos[i * 3 + 2] = this.z;
    }
    this.points.geometry.getAttribute('position').needsUpdate = true;
  }
}

// ------------------------------------------------------------------ Backdrop
interface Cloud {
  mesh: THREE.Mesh;
  x: number;
}
interface Smoke {
  emitters: { x: number; y: number; z: number }[];
  mesh: THREE.InstancedMesh;
  groups: number;
  per: number;
}

export class Backdrop {
  private readonly rng: () => number;
  private readonly touch: boolean;
  private readonly celestial: { body: THREE.Mesh; halo: THREE.Mesh; c: Celestial } | null = null;
  private readonly clouds: Cloud[] = [];
  private readonly cloudRange: [number, number];
  private torches: { flames: THREE.InstancedMesh; glows: THREE.InstancedMesh; xs: number[]; y: number; z: number } | null = null;
  private gears: { mesh: THREE.InstancedMesh; x: Float32Array; y: Float32Array; z: Float32Array; r: Float32Array; rot: Float32Array; dir: Float32Array } | null =
    null;
  private readonly life: LifeSystem[] = [];
  private smoke: Smoke | null = null;
  private readonly emitters: { x: number; y: number; z: number }[] = [];
  /** The marble run's tubes (for the marbles extra). */
  private readonly tubes: { curve: THREE.CatmullRomCurve3; z: number }[] = [];
  private clock = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly theme: Theme,
    private readonly W: number,
    touch: boolean,
  ) {
    this.touch = touch;
    this.rng = mulberry32(W * 31);
    const card = new Cardboard(theme.skyBottom);
    for (const s of theme.strips) {
      const { body, rim } = stripGeos(s, W);
      if (s.texture) this.addPrinted(body, s);
      else card.add(body, s.color, s.haze);
      card.add(rim, s.rim ?? shade(s.color, 1.18), s.haze);
    }
    for (const sc of theme.scenery) this.buildScenery(sc, card);
    for (const id of theme.extras ?? []) this.buildExtra(id, card);
    const staticMesh = card.build();
    if (staticMesh) scene.add(staticMesh);
    if (theme.celestial) this.celestial = this.buildCelestial(theme.celestial);
    this.cloudRange = layerX(-24, W);
    if (theme.clouds) this.buildClouds();
    for (const l of theme.life) this.buildLife(l);
  }

  /** A strip printed with a pattern (its own textured draw; UVs in world units, one tile per 8). */
  private addPrinted(body: THREE.BufferGeometry, s: Strip): void {
    const pos = body.getAttribute('position');
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / 8;
      uv[i * 2 + 1] = pos.getY(i) / 8;
    }
    body.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const c = hazeHex(s.color, this.theme.skyBottom, s.haze);
    const tex = softTexture(`strip:${s.texture}:${c}`, 64, 64, (g) => {
      if (s.texture === 'patchwork') {
        // Sewn patches in the strip's own colour and two neighbours, with dashed stitching.
        const tones = [c, shade(c, 0.96), shade(c, 1.03), mixHex(c, 0xe8a0a8, 0.16), mixHex(c, 0xc8d8a0, 0.16)];
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            g.fillStyle = css(tones[Math.floor(hash01(i, j + 40) * tones.length)]);
            g.fillRect(i * 16, j * 16, 16, 16);
          }
        }
        g.strokeStyle = css(shade(c, 1.1));
        g.lineWidth = 1;
        g.setLineDash([2, 2]);
        for (let k = 0; k <= 4; k++) {
          g.beginPath();
          g.moveTo(k * 16 + 1.5, 0);
          g.lineTo(k * 16 + 1.5, 64);
          g.moveTo(0, k * 16 + 1.5);
          g.lineTo(64, k * 16 + 1.5);
          g.stroke();
        }
      } else {
        // Newsprint: columns of grey text bars and a headline, printed faintly on the storm cloud.
        g.fillStyle = css(c);
        g.fillRect(0, 0, 64, 64);
        g.fillStyle = css(shade(c, 1.25));
        g.fillRect(4, 4, 40, 5);
        for (let col = 0; col < 3; col++) {
          for (let row = 0; row < 7; row++) {
            const w = 12 + Math.floor(hash01(col, row) * 6);
            g.fillRect(4 + col * 20, 14 + row * 7, w, 2);
          }
        }
      }
    }, 'theme');
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const mesh = new THREE.Mesh(body, new THREE.MeshBasicMaterial({ map: tex }));
    mesh.name = `backdrop:${s.texture}`;
    mesh.matrixAutoUpdate = false;
    this.scene.add(mesh);
  }

  // ---------------------------------------------------------------- scenery
  private copies(sc: Scenery, fn: (x: number, k: number) => void): void {
    const [x0, x1] = layerX(sc.z, this.W);
    for (let k = 0; ; k++) {
      const x = x0 + sc.every * (k + 0.5) + (this.rng() - 0.5) * 0.6 * sc.every;
      if (x > x1) break;
      fn(x, k);
    }
  }

  private buildScenery(sc: Scenery, card: Cardboard): void {
    const r = this.rng;
    const [c0, c1 = c0, c2 = c1] = sc.colors;
    const y0 = sc.y ?? -1;
    const z = sc.z;
    const hz = sc.haze;
    switch (sc.piece) {
      case 'trees':
        // Lollipop cut-outs with a white paper edge and a fold tab at the foot.
        this.copies(sc, (x) => {
          const h = 2.5 + 1.5 * r();
          const cr = 1.6 + 0.8 * r();
          card.add(new THREE.BoxGeometry(0.35, h, 0.2), c1, hz, place(x, y0 + h / 2, z));
          card.add(new THREE.CircleGeometry(cr, 16), c0, hz, place(x, y0 + h, z + 0.12));
          card.add(new THREE.CircleGeometry(cr + 0.15, 16), mixHex(c0, 0xffffff, 0.5), hz, place(x, y0 + h, z + 0.09));
          card.add(new THREE.BoxGeometry(0.8, 0.12, 0.2), shade(c1, 0.8), hz, place(x, y0 + 0.06, z + 0.05));
        });
        break;
      case 'books':
        // Leaning stacks with an open book tented on top.
        this.copies(sc, (x) => {
          const n = 3 + Math.floor(r() * 3);
          let y = y0;
          for (let i = 0; i < n; i++) {
            const w = 2.6 + r();
            const h = 0.7 + 0.3 * r();
            const tilt = (i % 2 ? -1 : 1) * (0.05 + 0.09 * r());
            card.add(new THREE.BoxGeometry(w, h, 1.2), sc.colors[i % sc.colors.length], hz, place(x + (r() - 0.5) * 0.4, y + h / 2, z, tilt));
            // Page edges: a pale band down the fore-edge.
            card.add(new THREE.PlaneGeometry(w * 0.92, h * 0.5), mixHex(0xffffff, sc.colors[i % sc.colors.length], 0.2), hz, place(x, y + h / 2, z + 0.61, tilt));
            y += h * 0.96;
          }
          const tent = mixHex(c0, 0xffffff, 0.7);
          card.add(new THREE.BoxGeometry(1.6, 0.08, 1.2), tent, hz, place(x - 0.62, y + 0.35, z, 0.5));
          card.add(new THREE.BoxGeometry(1.6, 0.08, 1.2), tent, hz, place(x + 0.62, y + 0.35, z, -0.5));
        });
        break;
      case 'prisms':
        // Hex crystal clusters, dark, with lit tips.
        this.copies(sc, (x) => {
          const n = 3 + Math.floor(r() * 3);
          for (let i = 0; i < n; i++) {
            const R = 0.5 + 0.6 * r();
            const H = 2 + 4 * r();
            // A dark body with a lit tip from 0.7H: two frustums, so the colour changes at a crisp line.
            const mid = R - 0.85 * R * 0.7;
            const m = place(x + (r() - 0.5) * 2.4, y0, z + (r() - 0.5) * 0.6, (r() - 0.5) * 0.7);
            card.add(new THREE.CylinderGeometry(mid, R, 0.7 * H, 6).translate(0, 0.35 * H, 0), c0, hz, m);
            card.add(new THREE.CylinderGeometry(0.15 * R, mid, 0.3 * H, 6).translate(0, 0.85 * H, 0), c1, hz, m);
          }
        });
        break;
      case 'towers':
        // Paper-craft towers with cone roofs and arched windows, one in three dark.
        this.copies(sc, (x) => {
          const R = 1.2 + 0.4 * r();
          const H = 8 + 8 * r();
          card.add(new THREE.CylinderGeometry(R, 1.1 * R, H, 10), c0, hz, place(x, y0 + H / 2, z));
          card.add(new THREE.ConeGeometry(1.35 * R, 2.2 * R, 10), c1, hz, place(x, y0 + H + 1.1 * R, z));
          for (const f of [0.55, 0.8]) {
            const lit = r() > 1 / 3;
            const win = new THREE.Shape();
            win.moveTo(-0.25, -0.3);
            win.lineTo(0.25, -0.3);
            win.lineTo(0.25, 0.3);
            win.absarc(0, 0.3, 0.25, 0, Math.PI, false);
            win.lineTo(-0.25, -0.3);
            card.add(new THREE.ShapeGeometry(win, 6), lit ? c2 : shade(c0, 0.6), lit ? Math.min(hz, 0.15) : hz, place(x, y0 + f * H, z + R * 1.05 + 0.02));
          }
        });
        break;
      case 'islands':
        // Floating islands: an upturned cone under a squashed dome.
        this.copies(sc, (x) => {
          const R = 3 + 2 * r();
          const H = 4 + 2 * r();
          const top = y0 + 2 * r();
          card.add(new THREE.ConeGeometry(R, H, 8).rotateX(Math.PI), c0, hz, place(x, top - H / 2, z));
          card.add(new THREE.SphereGeometry(R, 12, 4, 0, TAU, 0, Math.PI / 2).scale(1, 0.35, 1), c1, hz, place(x, top, z));
        });
        break;
      case 'spires':
        // Faceted glass spires with a lit edge line.
        this.copies(sc, (x) => {
          const R = 1 + 0.6 * r();
          const H = 8 + 6 * r();
          card.add(new THREE.ConeGeometry(R, H, 4).rotateY(Math.PI / 4), c0, hz, place(x, y0 + H / 2, z));
          // The lit line runs up the middle of the front face, from its foot to the tip.
          const face = R * Math.SQRT1_2;
          const edge = new THREE.BoxGeometry(0.08, 0.9 * H, 0.08).rotateX(-Math.atan(face / H));
          card.add(edge, c1, Math.min(hz, 0.1), place(x, y0 + 0.45 * H, z + face * 0.55 + 0.05));
        });
        break;
      case 'stacks':
        // Smokestacks; each registers a smoke emitter at its top.
        this.copies(sc, (x) => {
          const H = 10 + 6 * r();
          card.add(new THREE.CylinderGeometry(0.7, 0.9, H, 10), c0, hz, place(x, y0 + H / 2, z));
          for (const f of [0.7, 0.9]) card.add(new THREE.CylinderGeometry(0.76, 0.76, 0.4, 10), c1, hz, place(x, y0 + f * H, z));
          this.emitters.push({ x, y: y0 + H, z });
        });
        break;
      case 'tubes':
        // A marble run: curved tubes, never vertical, never with mouths (they are not gameplay pipes).
        this.copies(sc, (x) => {
          for (let n = 0; n < 2; n++) {
            const pts: THREE.Vector3[] = [];
            let y = 3 + r() * 8;
            for (let i = 0; i < 5; i++) {
              pts.push(new THREE.Vector3(x - 8 + i * 4, y, 0));
              y = Math.min(11, Math.max(3, y + (r() * 2 - 1) * 0.6 * 4));
            }
            const dz = n ? -0.8 : 0;
            const curve = new THREE.CatmullRomCurve3(pts);
            this.tubes.push({ curve, z: z + dz });
            card.add(new THREE.TubeGeometry(curve, 24, 0.35, 6), c0, hz, place(0, 0, z + dz));
            pts.forEach((p, i) => {
              if (i % 2) return;
              card.add(new THREE.TorusGeometry(0.42, 0.08, 4, 12).rotateY(Math.PI / 2), c1, hz, place(p.x, p.y, z + dz));
            });
          }
        });
        break;
      case 'wall':
        this.buildWall(sc, card);
        break;
      case 'torches':
        this.buildTorches(sc, card);
        break;
      case 'gears':
        this.buildGears(sc);
        break;
    }
  }

  /** A cardboard wall across the whole layer, patterned, with capsule windows or pegboard tools. */
  private buildWall(sc: Scenery, card: Cardboard): void {
    const [x0, x1] = layerX(sc.z, this.W);
    const sky = this.theme.skyBottom;
    const [c0, c1 = c0, c2 = c1] = sc.colors;
    const shape = rectShape(x0, -60, x1, 60);
    const hole = sc.hole;
    if (hole && sc.pattern !== 'pegboard') {
      for (let k = Math.ceil((x0 + hole.w - 6) / sc.every); 6 + k * sc.every < x1 - hole.w; k++) {
        const x = 6 + k * sc.every;
        shape.holes.push(capsule(hole.w, hole.h, x, hole.y));
        const frame = capsule(hole.w + 0.3, hole.h + 0.3, x, hole.y);
        frame.holes.push(capsule(hole.w, hole.h, x, hole.y));
        card.add(shapeGeo(frame, 0, 10), c1, sc.haze, place(0, 0, sc.z + 0.01));
      }
    }
    if (sc.pattern === 'pegboard') {
      // Tools hung on the board: filled when home, a painted outline when out being used.
      let k = 0;
      for (let x = Math.ceil(x0 / sc.every) * sc.every; x < x1; x += sc.every, k++) {
        const wrench = k % 2 === 0;
        const home = hash01(x, 91) > 0.4;
        const parts = (inset: number): THREE.Shape[] =>
          wrench
            ? [capsule(0.35 - 2 * inset, 4 - 2 * inset, x, 5.2), wrenchHead(0.9 - inset, x, 7.6)]
            : [capsule(0.35 - 2 * inset, 3.6 - 2 * inset, x, 5.4), rectShape(x - 1.1 + inset, 7 + inset, x + 1.1 - inset, 7.8 - inset)];
        if (home) card.add(shapeGeo(parts(0), 0), c2, sc.haze, place(0, 0, sc.z + 0.02));
        else {
          card.add(shapeGeo(parts(0), 0), c1, sc.haze, place(0, 0, sc.z + 0.02));
          card.add(shapeGeo(parts(0.12), 0), c0, sc.haze, place(0, 0, sc.z + 0.03));
        }
      }
    }
    const tex = wallTexture(sc.pattern ?? 'stone', hazeHex(c0, sky, sc.haze), hazeHex(c1, sky, sc.haze));
    const wall = new THREE.Mesh(new THREE.ShapeGeometry(shape, 10).translate(0, 0, sc.z), new THREE.MeshBasicMaterial({ map: tex }));
    wall.name = 'backdrop:wall';
    wall.matrixAutoUpdate = false;
    this.scene.add(wall);
  }

  private buildTorches(sc: Scenery, card: Cardboard): void {
    const [x0, x1] = layerX(sc.z, this.W);
    const [flame, glow] = sc.colors;
    const y = sc.y ?? 7;
    const xs: number[] = [];
    for (let x = Math.ceil(x0 / sc.every) * sc.every; x < x1; x += sc.every) xs.push(x);
    for (const x of xs) card.add(new THREE.BoxGeometry(0.2, 0.5, 0.3), mixHex(glow, 0x000000, 0.8), 0, place(x, y - 0.3, sc.z));
    const flames = new THREE.InstancedMesh(
      cachedGeo('bd:flame', () => new THREE.ConeGeometry(0.2, 0.55, 6).translate(0, 0.275, 0)),
      new THREE.MeshBasicMaterial({ color: flame }),
      xs.length,
    );
    const glows = new THREE.InstancedMesh(
      cachedGeo('bd:plane:1.6', () => new THREE.PlaneGeometry(1.6, 1.6)),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: glow, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
      xs.length,
    );
    for (const m of [flames, glows]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      this.scene.add(m);
    }
    this.torches = { flames, glows, xs, y, z: sc.z };
  }

  /** Real 12-tooth gears in meshing chains of three, counter-rotating: one instanced draw. */
  private buildGears(sc: Scenery): void {
    const [x0, x1] = layerX(sc.z, this.W);
    const r = this.rng;
    const list: { x: number; y: number; z: number; r: number; dir: number }[] = [];
    let x = x0 + r() * sc.every;
    while (x < x1) {
      let gx = x;
      let prev = 0;
      let up = r() > 0.5;
      for (let i = 0; i < 3; i++) {
        const rad = 1.5 + 2 * r();
        if (i) gx += 0.9 * (prev + rad);
        const y = up ? 7 + r() * 3 : 3 + r() * 3;
        up = !up;
        list.push({ x: gx, y, z: sc.z + (i % 2) * 0.05, r: rad, dir: i % 2 ? -1 : 1 });
        prev = rad;
      }
      x = gx + prev + sc.every * (0.6 + 0.8 * r());
    }
    const geo = cachedGeo('bd:gear', gearGeo);
    const mat = new THREE.MeshBasicMaterial({ color: hazeHex(sc.colors[0], this.theme.skyBottom, sc.haze), vertexColors: true });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.name = 'gear';
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const n = list.length;
    const g = { mesh, x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), r: new Float32Array(n), rot: new Float32Array(n), dir: new Float32Array(n) };
    const c = new THREE.Color();
    list.forEach((it, i) => {
      g.x[i] = it.x;
      g.y[i] = it.y;
      g.z[i] = it.z;
      g.r[i] = it.r;
      g.dir[i] = it.dir;
      // Every other gear half a tooth round, so neighbours mesh.
      g.rot[i] = (i % 2) * (Math.PI / 12);
      const v = 0.9 + 0.2 * hash01(i, 5);
      mesh.setColorAt(i, c.setRGB(v, v, v));
    });
    this.gears = g;
    this.scene.add(mesh);
    this.updateGears(0);
  }

  // -------------------------------------------------------------- celestial
  private buildCelestial(c: Celestial): { body: THREE.Mesh; halo: THREE.Mesh; c: Celestial } {
    const card = new Cardboard(this.theme.skyBottom);
    const r = c.r;
    const disc = () => new THREE.CircleGeometry(r, 32);
    if (c.kind === 'sun') {
      card.add(disc(), c.color, 0);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const tri = new THREE.BufferGeometry().setAttribute(
          'position',
          new THREE.Float32BufferAttribute([-0.09 * r, 0, 0, 0.09 * r, 0, 0, 0, 0.45 * r, 0], 3),
        );
        card.add(tri, c.accent, 0, place(Math.cos(a) * 1.12 * r, Math.sin(a) * 1.12 * r, 0, a - Math.PI / 2));
      }
    } else if (c.kind === 'sunset') {
      card.add(disc(), c.color, 0);
      for (const f of [-0.15, -0.4, -0.62]) card.add(new THREE.PlaneGeometry(2.2 * r, 0.07 * r), parseInt(this.theme.skyMid.slice(1), 16), 0, place(0, f * r, 0.05));
    } else if (c.kind === 'moon') {
      card.add(disc(), c.color, 0);
      for (const [cx, cy, cr] of [[-0.3, 0.25, 0.18], [0.35, -0.1, 0.12], [-0.05, -0.45, 0.1]]) card.add(new THREE.CircleGeometry(cr * r, 16), c.accent, 0, place(cx * r, cy * r, 0.02));
    } else if (c.kind === 'crescent') {
      const s = new THREE.Shape();
      s.absarc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
      s.absarc(-0.6 * r, 0, 1.166 * r, 1.03, -1.03, true);
      card.add(new THREE.ShapeGeometry(s, 24), c.color, 0);
    } else {
      card.add(disc(), c.color, 0);
      card.add(new THREE.CircleGeometry(r * 0.7, 24), shade(c.color, 1.12), 0, place(-0.15 * r, 0.15 * r, 0.01));
      const ring = (a0: number, z: number) => card.add(new THREE.RingGeometry(1.4 * r, 1.9 * r, 32, 1, a0, Math.PI).scale(1, 0.3, 1).rotateZ(0.3), c.accent, 0, place(0, 0, z));
      ring(0, -0.1);
      ring(Math.PI, 0.1);
    }
    const body = card.build()!;
    body.matrixAutoUpdate = true;
    (body.material as THREE.MeshBasicMaterial).fog = false;
    body.name = 'backdrop:celestial';
    const halo = new THREE.Mesh(
      cachedGeo('bd:plane:1', () => new THREE.PlaneGeometry(1, 1)),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: c.accent, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    halo.scale.setScalar(2.6 * r * (c.kind === 'ringed' ? 1.3 : 1));
    for (const m of [body, halo]) {
      m.position.set(c.dx, c.y, -90);
      m.frustumCulled = false;
      this.scene.add(m);
    }
    halo.position.z = -90.2;
    return { body, halo, c };
  }

  // ----------------------------------------------------------------- clouds
  private buildClouds(): void {
    const color = this.theme.cloudColor ?? 0xffffff;
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const variants = [0, 1, 2].map((v) => cloudGeo(v, color, this.theme.skyBottom));
    const [x0, x1] = this.cloudRange;
    let x = x0 + this.rng() * 10;
    let i = 0;
    while (x < x1) {
      const mesh = new THREE.Mesh(variants[i % 3], mat);
      const y = 11 + 3 * this.rng();
      mesh.position.set(x, y + 26, -24 - (i % 2) * 0.3);
      mesh.name = 'backdrop:cloud';
      this.scene.add(mesh);
      this.clouds.push({ mesh, x });
      x += 11 + 14 * this.rng();
      i++;
    }
  }

  // ------------------------------------------------------------------- life
  private buildLife(l: Life): void {
    const r = this.rng;
    const n = Math.max(1, Math.round(l.count * (this.touch ? 0.5 : 1)));
    const sky = this.theme.skyBottom;
    const col = hazeHex(l.color, sky, Math.min(0.35, Math.abs(l.z) / 120));
    const add = (o: THREE.Object3D) => {
      o.name = `backdrop:${l.kind}`;
      this.scene.add(o);
    };
    switch (l.kind) {
      case 'birds': {
        const geo = cachedGeo('bd:bird', () =>
          new THREE.BufferGeometry().setAttribute(
            'position',
            new THREE.Float32BufferAttribute([0, 0, 0, -0.35, 0.16, 0, -0.35, 0.1, 0, 0, 0, 0, 0.35, 0.1, 0, 0.35, 0.16, 0, 0, 0, 0, 0, -0.06, 0, -0.35, 0.1, 0, 0, 0, 0, 0.35, 0.1, 0, 0, -0.06, 0], 3),
          ),
        );
        const mv = new Movers(geo, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }), n, l.z, r, l.y ?? [9, 13], (i, t, clock, o) => {
          o.x -= 1.2 * clock;
          o.y += 0.3 * Math.sin(0.5 * t + i);
          o.sy = 0.4 + 0.6 * Math.abs(Math.sin(7 * t + i));
        });
        add(mv.mesh);
        this.life.push(mv);
        break;
      }
      case 'planes': {
        const geo = cachedGeo(`bd:plane-dart:${col}`, () => {
          const g = new THREE.BufferGeometry().setAttribute(
            'position',
            new THREE.Float32BufferAttribute([0.4, 0, 0, -0.4, 0.14, 0, -0.3, 0, 0, 0.4, 0, 0, -0.3, 0, 0, -0.4, -0.08, 0], 3),
          );
          const a = new THREE.Color(col);
          const b = new THREE.Color(shade(col, 0.8));
          g.setAttribute('color', new THREE.Float32BufferAttribute([...a.toArray(), ...a.toArray(), ...a.toArray(), ...b.toArray(), ...b.toArray(), ...b.toArray()], 3));
          return g;
        });
        const mv = new Movers(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), n, l.z, r, l.y ?? [3, 13], (i, t, clock, o) => {
          o.x += 3 * clock;
          o.y += 1.5 * Math.sin(0.6 * t + i);
          o.rz = 0.3 * Math.cos(0.6 * t + i);
          o.sx = o.sy = 1.3;
        });
        add(mv.mesh);
        this.life.push(mv);
        break;
      }
      case 'lanterns': {
        const rise = (i: number, t: number, clock: number, o: { x: number; y: number; rz: number }) => {
          o.y = wrap(o.y + 0.6 * clock, -2, 18);
          o.x += 0.3 * Math.sin(0.8 * t + i);
          o.rz = 0.08 * Math.sin(1.1 * t + i);
        };
        const box = new Movers(cachedGeo('bd:lantern', () => new THREE.BoxGeometry(0.35, 0.45, 0.35)), new THREE.MeshBasicMaterial({ color: l.color }), n, l.z, mulberry32(this.W + 7), [-2, 18], rise);
        const glow = new Movers(
          cachedGeo('bd:plane:0.9', () => new THREE.PlaneGeometry(0.9, 0.9)),
          new THREE.MeshBasicMaterial({ map: glowTexture(), color: l.color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
          n,
          l.z - 0.2,
          mulberry32(this.W + 7),
          [-2, 18],
          rise,
        );
        add(glow.mesh);
        add(box.mesh);
        this.life.push(box, glow);
        break;
      }
      case 'pages': {
        const tex = softTexture(`bd:page:${l.color}`, 32, 32, (c) => {
          c.fillStyle = css(l.color);
          c.fillRect(0, 0, 32, 32);
          c.fillStyle = 'rgba(80,80,90,0.55)';
          for (const y of [8, 15, 22]) c.fillRect(5, y, 22, 2);
        });
        const mv = new Movers(
          cachedGeo('bd:page', () => new THREE.PlaneGeometry(0.32, 0.42)),
          new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
          n,
          l.z,
          r,
          l.y ?? [2, 14],
          (i, t, clock, o) => {
            o.x += 2.5 * clock;
            o.y += 0.8 * Math.sin(0.9 * t + i * 1.7);
            o.rz = 1.7 * t + i;
            o.ry = 2.3 * t + 2 * i;
            o.sx = o.sy = 1.5;
          },
        );
        add(mv.mesh);
        this.life.push(mv);
        break;
      }
      case 'smoke': {
        if (!this.emitters.length) return;
        const groups = Math.max(1, Math.min(this.emitters.length, 6));
        const per = Math.max(1, Math.floor(n / groups));
        const mesh = new THREE.InstancedMesh(
          cachedGeo('bd:plane:1', () => new THREE.PlaneGeometry(1, 1)),
          new THREE.MeshBasicMaterial({ map: fxTexture('puff'), color: hazeHex(l.color, sky, 0.3), alphaTest: 0.4 }),
          groups * per,
        );
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        add(mesh);
        this.smoke = { emitters: this.emitters, mesh, groups, per };
        break;
      }
      case 'motes':
      case 'embers':
      case 'fireflies': {
        const size = l.kind === 'motes' ? 0.18 : l.kind === 'embers' ? 0.22 : 0.28;
        const yr: [number, number] = l.y ?? (l.kind === 'embers' ? [-1, 14] : [0, 15]);
        const halves = l.kind === 'fireflies' ? 2 : 1;
        for (let h = 0; h < halves; h++) {
          const sp = new Sparks(Math.ceil(n / halves), l.z, l.color, size, r, yr, (t, bx, by, ph, out) => {
            if (l.kind === 'motes') out.set(bx + 0.3 * Math.sin(0.5 * t + ph), by + 0.4 * this.clock);
            else if (l.kind === 'embers') out.set(bx + 0.4 * Math.sin(2.1 * t + ph) + 0.3 * this.clock, by + 1.2 * this.clock);
            else out.set(bx + 1.2 * Math.sin(0.43 * t + ph), by + 0.8 * Math.sin(0.61 * t + 2 * ph));
          });
          if (halves === 2) {
            const mat = sp.points.material as THREE.PointsMaterial;
            const phase = h * Math.PI;
            this.life.push({ update: (t) => (mat.opacity = prefs.reduceMotion ? 0.7 : 0.55 + 0.45 * Math.sin(TAU * 0.8 * t + phase)) });
          }
          add(sp.points);
          this.life.push(sp);
        }
        break;
      }
      case 'stars': {
        const [x0, x1] = layerX(l.z, this.W);
        const [y0, y1] = l.y ?? [-10, 45];
        for (let h = 0; h < 2; h++) {
          const k = Math.ceil(n / 2);
          const pos = new Float32Array(k * 3);
          for (let i = 0; i < k; i++) pos.set([x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), l.z - r() * 3], i * 3);
          const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
          const mat = new THREE.PointsMaterial({ size: 0.35, map: fxTexture('spark'), color: l.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
          const pts = new THREE.Points(geo, mat);
          pts.frustumCulled = false;
          add(pts);
          const phase = h * Math.PI;
          this.life.push({ update: (t) => (mat.opacity = prefs.reduceMotion ? 0.7 : 0.55 + 0.45 * Math.sin(1.4 * t + phase)) });
        }
        break;
      }
      case 'rain': {
        const pos = new Float32Array(n * 6);
        const bx = new Float32Array(n);
        const by = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          bx[i] = r() * 2 - 1;
          by[i] = r() * 16;
        }
        const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
        const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: l.color, transparent: true, opacity: 0.45, depthWrite: false }));
        lines.frustumCulled = false;
        add(lines);
        const span = lifeSpan(l.z);
        this.life.push({
          update: (_t, _dt, camX) => {
            const c = this.clock;
            for (let i = 0; i < n; i++) {
              const x = camX + wrap(bx[i] * span + 5.5 * c - 0.3 * camX, -span, span);
              const y = wrap(by[i] - 22 * c, 0, 16);
              const o = i * 6;
              pos[o] = x;
              pos[o + 1] = y;
              pos[o + 2] = l.z;
              pos[o + 3] = x + 0.15;
              pos[o + 4] = y - 0.6;
              pos[o + 5] = l.z;
            }
            geo.getAttribute('position').needsUpdate = true;
          },
        });
        break;
      }
      case 'shootingStar': {
        const tex = softTexture('bd:streak', 64, 8, (c) => {
          const g = c.createLinearGradient(0, 0, 64, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.85, 'rgba(255,255,255,0.8)');
          g.addColorStop(1, 'rgba(255,255,255,1)');
          c.fillStyle = g;
          c.fillRect(0, 2, 64, 4);
        });
        const mesh = new THREE.Mesh(
          cachedGeo('bd:streak', () => new THREE.PlaneGeometry(4, 0.07 * 3)),
          new THREE.MeshBasicMaterial({ map: tex, color: l.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
        );
        mesh.rotation.z = Math.atan2(-12, -30);
        mesh.visible = false;
        mesh.frustumCulled = false;
        add(mesh);
        const fx = mulberry32(this.W + 3);
        let next = 3 + 4 * fx();
        let age = -1;
        let sx = 0;
        let sy = 0;
        this.life.push({
          update: (t, dt, camX) => {
            if (age < 0 && t > next && !prefs.reduceMotion) {
              age = 0;
              sx = camX + (fx() * 2 - 1) * 10;
              sy = 20 + 8 * fx();
              next = t + 6 + 4 * fx();
            }
            if (age < 0) return;
            age += dt;
            mesh.visible = age < 0.5;
            mesh.position.set(sx - 30 * age, sy - 12 * age, l.z);
            if (age >= 0.5) age = -1;
          },
        });
        break;
      }
    }
  }

  // ----------------------------------------------------------------- extras
  private buildExtra(id: ExtraId, card: Cardboard): void {
    switch (id) {
      case 'lightning':
        return this.buildLightning();
      case 'fairyLights':
        return this.buildFairyLights(card);
      case 'kites':
        return this.buildKites();
      case 'balloons':
        return this.buildBalloons();
      case 'aurora':
        return this.buildAurora();
      case 'orrery':
        return this.buildOrrery(card);
      case 'marbles':
        return this.buildMarbles();
      case 'pennants':
        return this.buildPennants(card);
      case 'moonbeams':
        return this.buildMoonbeams(card);
    }
  }

  /** Storm lightning: now and then one of three jagged bolts far away, with a flash of the sky. */
  private buildLightning(): void {
    const rng = mulberry32(this.W + 11);
    const z = -50;
    const mat = new THREE.MeshBasicMaterial({ color: 0xeef2ff });
    const bolts = [0, 1, 2].map(() => {
      const quads: number[] = [];
      const seg = (x0: number, y0: number, x1: number, y1: number, w: number) => {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * w;
        const ny = (dx / len) * w;
        quads.push(x0 - nx, y0 - ny, z, x1 - nx, y1 - ny, z, x1 + nx, y1 + ny, z, x0 - nx, y0 - ny, z, x1 + nx, y1 + ny, z, x0 + nx, y0 + ny, z);
      };
      const strike = (x: number, y: number, yEnd: number, w: number, branch: boolean) => {
        while (y > yEnd) {
          const nx = x + (rng() - 0.5) * 3;
          const ny = y - 1.5 - 2 * rng();
          seg(x, y, nx, ny, w);
          if (branch && rng() < 0.3) strike(nx, ny, ny - 6 - 4 * rng(), w * 0.55, false);
          x = nx;
          y = ny;
        }
      };
      strike(0, 34, 2, 0.22, true);
      const mesh = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(quads, 3)), mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.name = 'backdrop:lightning';
      this.scene.add(mesh);
      return mesh;
    });
    const flashMat = new THREE.MeshBasicMaterial({ color: 0x8a9ad0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const flash = new THREE.Mesh(cachedGeo('bd:plane:1', () => new THREE.PlaneGeometry(1, 1)), flashMat);
    flash.scale.set(400, 160, 1);
    flash.position.set(0, 20, -56);
    flash.visible = false;
    flash.frustumCulled = false;
    this.scene.add(flash);
    let next = 3 + 4 * rng();
    let age = -1;
    let bolt = bolts[0];
    this.life.push({
      update: (t, dt, camX) => {
        // No strikes under reduced motion, or in a fog storm (the far sky is fogged out).
        if (age < 0 && t > next && !prefs.reduceMotion && !this.scene.fog) {
          age = 0;
          bolt = bolts[Math.floor(rng() * 3)];
          bolt.position.x = camX + (rng() - 0.5) * 50;
          flash.position.x = camX;
          next = t + 5 + 4 * rng();
        }
        if (age < 0) return;
        age += dt;
        // A double flicker, then the sky fades back.
        bolt.visible = age < 0.05 || (age > 0.08 && age < 0.14);
        flashMat.opacity = 0.28 * Math.max(0, 1 - age / 0.35);
        flash.visible = flashMat.opacity > 0;
        if (age > 0.35) {
          age = -1;
          bolt.visible = flash.visible = false;
        }
      },
    });
  }

  /** Caves: fairy-light strands draped under the ceiling, a few bulbs changing every tenth of a second. */
  private buildFairyLights(card: Cardboard): void {
    const z = -9;
    const [x0, x1] = layerX(z, this.W);
    const rng = mulberry32(this.W + 13);
    const pts: [number, number][] = [];
    let ax = x0;
    let ay = 14 + rng() - 0.5;
    while (ax < x1) {
      const bx = ax + 7 + 2 * rng();
      const by = 14 + rng() - 0.5;
      const sag = 1.2 + 0.8 * rng();
      const n = Math.max(2, Math.round((bx - ax) / 0.5));
      let px = ax;
      let py = ay;
      for (let i = 1; i <= n; i++) {
        const f = i / n;
        const x = ax + (bx - ax) * f;
        const y = ay + (by - ay) * f - sag * 4 * f * (1 - f);
        card.add(ribbon(px, py, x, y, 0.035, z), 0x08101e, 0);
        if (i % 2 === 0 && i < n) pts.push([x, y]);
        px = x;
        py = y;
      }
      ax = bx;
      ay = by;
    }
    const palette = [0xffe08a, 0x7ad8ff, 0xff9ad5].map((c) => new THREE.Color(c));
    const bulbs = new THREE.InstancedMesh(cachedGeo('bd:bulb', () => new THREE.SphereGeometry(0.11, 6, 4)), new THREE.MeshBasicMaterial({ color: 0xffffff }), pts.length);
    const glows = new THREE.InstancedMesh(
      cachedGeo('bd:plane:1', () => new THREE.PlaneGeometry(1, 1)),
      new THREE.MeshBasicMaterial({ map: fxTexture('spark'), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
      pts.length,
    );
    pts.forEach(([x, y], i) => {
      bulbs.setMatrixAt(i, this.m.makeTranslation(x, y - 0.12, z + 0.05));
      glows.setMatrixAt(i, this.m.makeScale(0.8, 0.8, 1).setPosition(x, y - 0.12, z + 0.02));
      const c = palette[i % 3];
      bulbs.setColorAt(i, c);
      glows.setColorAt(i, c);
    });
    for (const m of [glows, bulbs]) {
      m.name = 'backdrop:fairyLights';
      this.scene.add(m);
    }
    const dim = new THREE.Color();
    let acc = 0;
    this.life.push({
      update: (_t, dt) => {
        if (prefs.reduceMotion) return;
        acc += dt;
        if (acc < 0.1) return;
        acc = 0;
        for (let k = 0; k < 8; k++) {
          const i = Math.floor(rng() * pts.length);
          dim.copy(palette[Math.floor(rng() * 3)]).multiplyScalar(rng() < 0.3 ? 0.35 : 1);
          bulbs.setColorAt(i, dim);
          glows.setColorAt(i, dim);
        }
        bulbs.instanceColor!.needsUpdate = true;
        glows.instanceColor!.needsUpdate = true;
      },
    });
  }

  /** Hills: three kites with bow tails, their strings running down behind the ground. */
  private buildKites(): void {
    const z = -26;
    const sky = this.theme.skyBottom;
    const geo = cachedGeo('bd:kite', kiteGeo);
    const mv = new Movers(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), 3, z, mulberry32(this.W + 17), [9, 13], (i, t, clock, o) => {
      o.x += 0.4 * clock;
      o.y += 0.7 * Math.sin(0.7 * t + 2 * i);
      o.rz = 0.14 * Math.sin(0.9 * t + 2 * i);
    });
    [0xff7a7a, 0x5ab8f0, 0xffc933].forEach((c, i) => mv.mesh.setColorAt(i, new THREE.Color(hazeHex(c, sky, 0.3))));
    mv.mesh.name = 'backdrop:kites';
    this.scene.add(mv.mesh);
    this.life.push(mv);
  }

  /** Skies: striped paper hot-air balloons bobbing far out over the cloud banks. */
  private buildBalloons(): void {
    const z = -30;
    const sky = this.theme.skyBottom;
    const tex = softTexture('bd:balloon', 32, 32, (c) => {
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? '#ffffff' : '#d8dce6';
        c.fillRect(i * 4, 0, 4, 28);
      }
      c.fillStyle = '#8a5a3a';
      c.fillRect(0, 28, 32, 4);
    });
    const mv = new Movers(
      cachedGeo('bd:balloon', balloonGeo),
      new THREE.MeshBasicMaterial({ map: tex }),
      this.touch ? 3 : 4,
      z,
      mulberry32(this.W + 19),
      [7, 15],
      (i, t, clock, o) => {
        o.x += 0.35 * clock;
        o.y += 0.6 * Math.sin(0.4 * t + 1.7 * i);
        o.ry = 0.3 * t + i;
        o.rz = 0.04 * Math.sin(0.6 * t + i);
      },
    );
    [0xff8a7a, 0x5ab8f0, 0xffc933, 0xb08aff].slice(0, mv.n).forEach((c, i) => mv.mesh.setColorAt(i, new THREE.Color(hazeHex(c, sky, 0.3))));
    mv.mesh.name = 'backdrop:balloons';
    this.scene.add(mv.mesh);
    this.life.push(mv);
  }

  /** Frontier: two aurora ribbons, teal and violet, undulating high in the sky. */
  private buildAurora(): void {
    const z = -80;
    const cols = 24;
    const w = 200;
    for (let r = 0; r < 2; r++) {
      const color = new THREE.Color(r ? 0x6a3cff : 0x1fd1b0).multiplyScalar(r ? 0.22 : 0.16);
      const pos = new Float32Array((cols + 1) * 3 * 3);
      const col = new Float32Array((cols + 1) * 3 * 3);
      const index: number[] = [];
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j < 3; j++) {
          const v = i * 3 + j;
          pos[v * 3] = -w / 2 + (w * i) / cols;
          pos[v * 3 + 2] = z - r;
          const edge = Math.sin((Math.PI * i) / cols);
          if (j === 1) color.toArray(col, v * 3);
          if (j === 1) for (let k = 0; k < 3; k++) col[v * 3 + k] *= edge;
          if (i < cols && j < 2) index.push(v, v + 3, v + 1, v + 1, v + 3, v + 4);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(index);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }),
      );
      mesh.frustumCulled = false;
      mesh.name = 'backdrop:aurora';
      this.scene.add(mesh);
      const base = 26 + 5 * r;
      this.life.push({
        update: (t, _dt, camX) => {
          mesh.position.x = camX * 0.9;
          for (let i = 0; i <= cols; i++) {
            const x = pos[i * 9];
            const wave = 2.5 * Math.sin(0.045 * x + 0.35 * t + 2 * r) + 1.2 * Math.sin(0.11 * x - 0.5 * t);
            pos[i * 9 + 1] = base + wave - 3;
            pos[i * 9 + 4] = base + wave + 0.4 * Math.sin(0.2 * x + t);
            pos[i * 9 + 7] = base + wave + 7 + 1.5 * Math.sin(0.07 * x + 0.8 * t + r);
          }
          geo.getAttribute('position').needsUpdate = true;
        },
      });
    }
  }

  /** Finale: brass orreries, a sun with five arms whose planets turn on their own slow periods. */
  private buildOrrery(card: Cardboard): void {
    const z = -34;
    const hz = 0.5;
    const brass = 0xd9a53a;
    const planetsC = [0xb8c0ff, 0xffd166, 0x7ad8ff, 0xff9ad5, 0x9be04a];
    const centres: [number, number][] = [];
    // Never in the first or last screen: the camera parks there (the boss arena), and an orrery
    // would sit on the ringed planet for the whole fight.
    for (let x = 40; x < this.W - 50; x += 70) centres.push([x, 15]);
    for (const [cx, cy] of centres) {
      card.add(new THREE.CylinderGeometry(0.12, 0.12, cy + 1, 8), brass, hz, place(cx, (cy - 1) / 2, z - 0.2));
      card.add(new THREE.CylinderGeometry(1.1, 1.6, 0.7, 16), shade(brass, 0.8), hz, place(cx, -0.6, z - 0.2));
      card.add(new THREE.CircleGeometry(1.5, 32), 0xffd166, 0.35, place(cx, cy, z));
      card.add(new THREE.CircleGeometry(1.7, 32), brass, hz, place(cx, cy, z - 0.05));
      for (let i = 0; i < 5; i++) {
        const L = ORRERY_ARM(i);
        card.add(new THREE.RingGeometry(L - 0.03, L + 0.03, 64), shade(brass, 0.7), 0.7, place(cx, cy, z - 0.3));
      }
    }
    const n = centres.length * 5;
    const arms = new THREE.InstancedMesh(
      cachedGeo('bd:orrery:arm', () => new THREE.PlaneGeometry(1, 0.08).translate(0.5, 0, 0)),
      new THREE.MeshBasicMaterial({ color: hazeHex(brass, this.theme.skyBottom, hz) }),
      n,
    );
    const planets = new THREE.InstancedMesh(cachedGeo('bd:orrery:planet', () => new THREE.CircleGeometry(1, 16)), new THREE.MeshBasicMaterial(), n);
    for (let k = 0; k < n; k++) planets.setColorAt(k, new THREE.Color(hazeHex(planetsC[k % 5], this.theme.skyBottom, 0.45)));
    for (const m of [arms, planets]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.name = 'backdrop:orrery';
      this.scene.add(m);
    }
    this.life.push({
      update: () => {
        const c = this.clock;
        for (let o = 0; o < centres.length; o++) {
          const [cx, cy] = centres[o];
          for (let i = 0; i < 5; i++) {
            const k = o * 5 + i;
            const L = ORRERY_ARM(i);
            const a = (0.5 / (1 + i)) * c + i * 1.3 + o;
            this.q.setFromEuler(this.e.set(0, 0, a));
            arms.setMatrixAt(k, this.m.compose(this.p.set(cx, cy, z - 0.1), this.q, this.s.set(L, 1, 1)));
            const pr = 0.25 + 0.06 * ((i * 3) % 5);
            planets.setMatrixAt(k, this.m.makeScale(pr, pr, 1).setPosition(cx + Math.cos(a) * L, cy + Math.sin(a) * L, z + 0.05));
          }
        }
        arms.instanceMatrix.needsUpdate = true;
        planets.instanceMatrix.needsUpdate = true;
      },
    });
  }

  /** Pipes: teal marbles (function calls) rolling through the tube run. */
  private buildMarbles(): void {
    if (!this.tubes.length) return;
    const tubes = this.tubes;
    const mesh = new THREE.InstancedMesh(
      cachedGeo('bd:marble', () => new THREE.SphereGeometry(0.24, 10, 6)),
      new THREE.MeshBasicMaterial({ color: hazeHex(0x1fd1b0, this.theme.skyBottom, 0.15) }),
      tubes.length,
    );
    const shine = new THREE.InstancedMesh(cachedGeo('bd:marble:shine', () => new THREE.CircleGeometry(0.07, 8)), new THREE.MeshBasicMaterial({ color: 0xe8fff8 }), tubes.length);
    const lengths = tubes.map((tb) => tb.curve.getLength());
    const p = new THREE.Vector3();
    for (const m of [mesh, shine]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.name = 'backdrop:marbles';
      this.scene.add(m);
    }
    this.life.push({
      update: () => {
        for (let i = 0; i < tubes.length; i++) {
          const tb = tubes[i];
          const u = fract((this.clock * 2) / lengths[i] + i * 0.37);
          tb.curve.getPointAt(u, p);
          mesh.setMatrixAt(i, this.m.makeTranslation(p.x, p.y, tb.z + 0.4));
          shine.setMatrixAt(i, this.m.makeTranslation(p.x - 0.08, p.y + 0.09, tb.z + 0.65));
        }
        mesh.instanceMatrix.needsUpdate = true;
        shine.instanceMatrix.needsUpdate = true;
      },
    });
  }

  /** Castle: felt pennants hanging in pairs from strings between the torches. */
  private buildPennants(card: Cardboard): void {
    const torches = this.theme.scenery.find((s) => s.piece === 'torches');
    if (!torches) return;
    const z = torches.z - 0.25;
    const [x0, x1] = layerX(z, this.W);
    const y = (torches.y ?? 7) + 4;
    const colors = [0x8a2a38, 0xd9a53a, 0x3a6a8a];
    let k = 0;
    for (let ax = Math.ceil(x0 / torches.every) * torches.every; ax + torches.every < x1; ax += torches.every, k++) {
      const bx = ax + torches.every;
      const at = (f: number) => y - 0.8 * 4 * f * (1 - f);
      const n = 12;
      for (let i = 0; i < n; i++) card.add(ribbon(ax + (bx - ax) * (i / n), at(i / n), ax + (bx - ax) * ((i + 1) / n), at((i + 1) / n), 0.03, z), 0x1a0a08, 0);
      for (let i = 1; i < 9; i++) {
        // Pairs: two close together, then a gap.
        const f = (Math.floor((i - 1) / 2) * 2.4 + ((i - 1) % 2) * 0.9 + 1) / 11.5;
        if (f >= 0.95) continue;
        const px = ax + (bx - ax) * f;
        const py = at(f);
        const tri = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.28, 0, 0, 0, -0.75, 0, 0.28, 0, 0], 3));
        card.add(tri, colors[(i + k) % 3], torches.haze + 0.1, place(px, py, z, 0.08 * Math.sin(i + k)));
      }
    }
  }

  /** Ghost house: faint moonbeams through the windows, empty gilt frames and a chalkboard of ∴. */
  private buildMoonbeams(card: Cardboard): void {
    const wall = this.theme.scenery.find((s) => s.piece === 'wall');
    const torches = this.theme.scenery.find((s) => s.piece === 'torches');
    if (!wall?.hole) return;
    const z = wall.z + 0.2;
    const [x0, x1] = layerX(wall.z, this.W);
    const { w, h, y } = wall.hole;
    const beams: number[] = [];
    const uvs: number[] = [];
    for (let k = Math.ceil((x0 + w - 6) / wall.every); 6 + k * wall.every < x1 - w; k++) {
      const x = 6 + k * wall.every;
      const top = y + h / 2 - 0.6;
      const [a, b, c, d] = [[x - w / 2, top], [x + w / 2, top], [x + w / 2 + 3.4, -1], [x - w / 2 + 1.6, -1]];
      beams.push(a[0], a[1], z, d[0], d[1], z, c[0], c[1], z, a[0], a[1], z, c[0], c[1], z, b[0], b[1], z);
      uvs.push(0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1);
    }
    const tex = softTexture('bd:beam', 8, 32, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 8, 32);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(beams, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ map: tex, color: 0xd8d0ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    mesh.name = 'backdrop:moonbeams';
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    if (!torches) return;
    // Above every other torch: an empty gilt frame, and every third of those a chalkboard.
    const gilt = 0xc9a44a;
    let n = 0;
    for (let x = Math.ceil(x0 / torches.every) * torches.every; x < x1; x += 2 * torches.every, n++) {
      const fy = (torches.y ?? 6.5) + 3.3;
      const fz = wall.z + 0.03;
      if (n % 3 === 2) {
        card.add(new THREE.PlaneGeometry(2.4, 1.6), 0x6a4a2a, 0.3, place(x, fy, fz));
        card.add(new THREE.PlaneGeometry(2.1, 1.3), 0x1e3a2e, 0.3, place(x, fy, fz + 0.01));
        for (let g = 0; g < 4; g++) {
          const gx = x - 0.7 + (g % 2) * 1.1 + (g > 1 ? 0.3 : 0);
          const gy = fy + (g > 1 ? -0.3 : 0.3);
          for (const [dx, dy] of [[0, 0.1], [-0.12, -0.08], [0.12, -0.08]]) card.add(new THREE.CircleGeometry(0.05, 6), 0xe8e8e0, 0.3, place(gx + dx, gy + dy, fz + 0.02));
        }
        card.add(ribbon(x - 0.9, fy - 0.55, x + 0.5, fy - 0.45, 0.02, fz + 0.02), 0xe8e8e0, 0.4);
      } else {
        const frame = rectShape(x - 0.8, fy - 0.6, x + 0.8, fy + 0.6);
        const inner = new THREE.Path();
        inner.moveTo(x - 0.6, fy - 0.4);
        inner.lineTo(x - 0.6, fy + 0.4);
        inner.lineTo(x + 0.6, fy + 0.4);
        inner.lineTo(x + 0.6, fy - 0.4);
        inner.closePath();
        frame.holes.push(inner);
        card.add(new THREE.ShapeGeometry(frame), gilt, 0.3, place(0, 0, fz));
      }
    }
  }

  // ----------------------------------------------------------------- update
  update(dt: number, time: number, camX: number): void {
    const speed = prefs.reduceMotion ? 0.3 : 1;
    this.clock += dt * speed;
    const t = time * speed;
    const cel = this.celestial;
    if (cel) {
      const x = camX * 0.95 + cel.c.dx;
      cel.body.position.x = cel.halo.position.x = x;
      if (cel.c.kind === 'sun') cel.body.rotation.z = -0.05 * this.clock;
    }
    const [x0, x1] = this.cloudRange;
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.mesh.position.x = wrap(c.x + 0.2 * this.clock, x0, x1);
      c.mesh.rotation.z = 0.012 * Math.sin(0.7 * t + i);
    }
    this.updateTorches(t);
    this.updateGears(dt * speed);
    this.updateSmoke(camX);
    for (const l of this.life) l.update(t, dt * speed, camX);
  }

  private updateTorches(t: number): void {
    const tr = this.torches;
    if (!tr) return;
    for (let i = 0; i < tr.xs.length; i++) {
      const x = tr.xs[i];
      const sy = 1 + 0.15 * Math.sin(13 * t + i) + 0.08 * Math.sin(29 * t + 2 * i);
      const sx = 1 - 0.05 * Math.sin(13 * t + i);
      tr.flames.setMatrixAt(i, this.m.makeScale(sx, sy, sx).setPosition(x, tr.y, tr.z + 0.2));
      const g = 1 + 0.08 * Math.sin(11 * t + 3 * i);
      tr.glows.setMatrixAt(i, this.m.makeScale(g, g, 1).setPosition(x, tr.y + 0.25, tr.z + 0.1));
    }
    tr.flames.instanceMatrix.needsUpdate = true;
    tr.glows.instanceMatrix.needsUpdate = true;
  }

  private updateGears(dt: number): void {
    const g = this.gears;
    if (!g) return;
    for (let i = 0; i < g.x.length; i++) {
      g.rot[i] += (dt * 0.8 * g.dir[i]) / g.r[i];
      this.q.setFromEuler(this.e.set(0, 0, g.rot[i]));
      g.mesh.setMatrixAt(i, this.m.compose(this.p.set(g.x[i], g.y[i], g.z[i]), this.q, this.s.set(g.r[i], g.r[i], 1)));
    }
    g.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Smoke puffs: each group of puffs serves whichever of its stacks is nearest the camera. */
  private updateSmoke(camX: number): void {
    const sm = this.smoke;
    if (!sm) return;
    const em = sm.emitters;
    // Index of the stack nearest the camera.
    let near = 0;
    for (let i = 1; i < em.length; i++) if (Math.abs(em[i].x - camX) < Math.abs(em[near].x - camX)) near = i;
    for (let gi = 0; gi < sm.groups; gi++) {
      const j = Math.min(em.length - 1, Math.max(0, gi + sm.groups * Math.round((near - gi) / sm.groups)));
      const e = em[j];
      for (let k = 0; k < sm.per; k++) {
        const a = (this.clock + (k / sm.per) * 4 + gi * 0.7) % 4;
        const shrink = a > 3.5 ? (4 - a) / 0.5 : 1;
        const s = (0.8 + 0.6 * a) * shrink;
        sm.mesh.setMatrixAt(gi * sm.per + k, this.m.makeScale(s, s, 1).setPosition(e.x + 0.5 * a, e.y + 1.2 * a, e.z + 0.1 + k * 0.01));
      }
    }
    sm.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** A thin cardboard ribbon from (x0, y0) to (x1, y1), `w` either side of the line, facing +z. */
function ribbon(x0: number, y0: number, x1: number, y1: number, w: number, z: number): THREE.BufferGeometry {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = (-(y1 - y0) / len) * w;
  const ny = ((x1 - x0) / len) * w;
  return new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute([x0 - nx, y0 - ny, z, x1 - nx, y1 - ny, z, x1 + nx, y1 + ny, z, x0 - nx, y0 - ny, z, x1 + nx, y1 + ny, z, x0 + nx, y0 + ny, z], 3),
  );
}

/** A diamond kite with a cross spar, a bow tail and a long string down, vertex-coloured light and dark. */
function kiteGeo(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const tri = (a: number[], b: number[], c: number[], v: number) => {
    pos.push(...a, 0, ...b, 0, ...c, 0);
    col.push(v, v, v, v, v, v, v, v, v);
  };
  const [T, R, B, L, C] = [[0, 0.9], [0.55, 0.25], [0, -0.9], [-0.55, 0.25], [0, 0.25]];
  tri(T, L, C, 1);
  tri(T, C, R, 0.72);
  tri(L, B, C, 0.72);
  tri(C, B, R, 1);
  const quad = (x0: number, y0: number, x1: number, y1: number, w: number, v: number) => {
    const g = ribbon(x0, y0, x1, y1, w, 0).getAttribute('position').array as Float32Array;
    for (let i = 0; i < g.length; i += 3) {
      pos.push(g[i], g[i + 1], 0.01);
      col.push(v, v, v);
    }
  };
  quad(-0.55, 0.25, 0.55, 0.25, 0.02, 0.45);
  quad(0, 0.9, 0, -0.9, 0.02, 0.45);
  // The tail: a wavy line with five little bows.
  let px = 0;
  let py = -0.9;
  for (let i = 1; i <= 5; i++) {
    const x = 0.25 * Math.sin(i * 1.3);
    const y = -0.9 - i * 0.45;
    quad(px, py, x, y, 0.015, 0.45);
    tri([x - 0.14, y + 0.07], [x, y], [x - 0.14, y - 0.07], 1.15);
    tri([x + 0.14, y + 0.07], [x + 0.14, y - 0.07], [x, y], 1.15);
    px = x;
    py = y;
  }
  quad(0, -0.9, 3, -26, 0.012, 0.35);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** A striped paper hot-air balloon with its basket (the texture's bottom rows are the wicker). */
function balloonGeo(): THREE.BufferGeometry {
  const env = new THREE.LatheGeometry(
    [[0.22, 0.75], [0.4, 0.95], [0.78, 1.5], [0.95, 2.1], [0.88, 2.7], [0.58, 3.15], [0.001, 3.32]].map(([x, y]) => new THREE.Vector2(x, y)),
    16,
  );
  const uv = env.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, 0.14 + 0.86 * uv.getY(i));
  const basket = new THREE.BoxGeometry(0.42, 0.34, 0.42).translate(0, 0.17, 0);
  const ropes = [-1, 1].map((s) => new THREE.BoxGeometry(0.02, 0.45, 0.02).translate(s * 0.18, 0.55, 0));
  for (const g of [basket, ...ropes]) {
    const u = g.getAttribute('uv');
    for (let i = 0; i < u.count; i++) u.setXY(i, 0.5, 0.05);
  }
  return mergeGeometries([env.toNonIndexed(), basket.toNonIndexed(), ...ropes.map((r) => r.toNonIndexed())])!;
}

/** A 12-tooth gear with a hub ring round its axle hole, outer radius 1 (scaled per instance). */
function gearGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const step = TAU / 12;
  const root = 0.82;
  for (let t = 0; t < 12; t++) {
    const a = t * step;
    const pts: [number, number][] = [
      [a, root],
      [a + 0.12, root],
      [a + 0.195, 1],
      [a + 0.325, 1],
      [a + 0.4, root],
    ];
    for (const [ang, r] of pts) {
      if (t === 0 && ang === a) s.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
      else s.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.28, 0, TAU, true);
  s.holes.push(hole);
  const body = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false, curveSegments: 12 }).toNonIndexed();
  const hub = new THREE.RingGeometry(0.28, 0.44, 16).translate(0, 0, 0.26).toNonIndexed();
  const spokes = mergeGeometries(
    [0, 1, 2].map((k) => new THREE.PlaneGeometry(0.12, 1.1).rotateZ((k * Math.PI) / 3).translate(0, 0, 0.255).toNonIndexed()),
  )!;
  const parts = [body, hub, spokes].map((g, i) => {
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g.clearGroups();
    const v = i === 0 ? 1 : 1.3;
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(v), 3));
    return g;
  });
  return mergeGeometries(parts)!;
}

/** A scalloped cardboard cloud on a thread: flat bottom, bumps on top, origin at the thread's top. */
function cloudGeo(variant: number, color: number, sky: string): THREE.BufferGeometry {
  const bumps = [5, 6, 7][variant];
  const w = [4, 5.5, 7][variant];
  const h = [1.6, 2, 2.4][variant];
  // Round puffs over a shallow flat base: the middle ones tallest, the end ones lower.
  const puffs = Array.from({ length: bumps }, (_, k) => {
    const t = (k + 0.5) / bumps;
    const arch = Math.sin(Math.PI * t);
    const r = (w / bumps) * (0.72 + 0.5 * arch) * (1 + 0.12 * (hash01(k, variant) - 0.5));
    return { cx: -w / 2 + w * t, cy: Math.max(0.3 * r, h - r - 0.4 * h * (1 - arch)), r };
  });
  const top = (x: number) => {
    let y = 0;
    for (const p of puffs) {
      const d = p.r * p.r - (x - p.cx) ** 2;
      if (d > 0) y = Math.max(y, p.cy + Math.sqrt(d));
    }
    return y;
  };
  const xa = puffs[0].cx - puffs[0].r * 0.97;
  const xb = puffs[bumps - 1].cx + puffs[bumps - 1].r * 0.97;
  const s = new THREE.Shape();
  s.moveTo(xa, 0);
  s.lineTo(xb, 0);
  const N = 64;
  for (let i = N; i >= 0; i--) {
    const x = xa + ((xb - xa) * i) / N;
    s.lineTo(x, Math.max(0, top(x)));
  }
  s.closePath();
  const card = new Cardboard(sky);
  const belly = 0x9ab0d8;
  card.add(new THREE.ShapeGeometry(s).translate(0, -26 - h / 2, 0), (_x, y) => (y + 26 + h / 2 < 0.3 * h ? mixHex(color, belly, 0.25) : color), 0.35);
  card.add(new THREE.BoxGeometry(0.04, 26, 0.01).translate(0, -13, -0.02), shade(color, 0.7), 0.5);
  const mesh = card.build()!;
  const geo = mesh.geometry;
  (mesh.material as THREE.Material).dispose();
  return geo;
}
