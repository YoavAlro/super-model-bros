import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DATA_TYPES, type ChipShape, type DataTypeId } from '../config/dataTypes';
import { atlasUV, cachedMat, CELL, easeOutBack, glint, softTexture } from './art';
import { fxTexture } from './fx';
import { css, hash01, mixHex, shade } from './palette';
import { prefs } from './prefs';
import { basic, cachedGeo, INK, inkOutline, RAMP, roundedBox, toon } from './toonKit';

/**
 * Collectibles as toy pieces: data tokens are board-game chips (one silhouette per data type, one
 * draw each), traps are the only round coins, and every power-up is a small toy with a meaning (a
 * gold-star sticker, a checkpoint floppy, a hype balloon). Every mesh's origin is at its feet.
 *
 * The engine only moves items, never recolours them, so materials are cached per kind and shared;
 * idles are played by animateItem from each item's userData.anim. Nothing here runs at module load.
 */

const TAU = Math.PI * 2;
type V2 = [number, number];

// ------------------------------------------------------------------ caches
/** A cached, shared toon material. */
const toonC = (color: number, emissive = 0, intensity?: number) =>
  cachedMat(`toon:${color}:${emissive}:${intensity}`, () => toon(color, emissive, intensity));
const basicC = (color: number) => cachedMat(`basic:${color}`, () => basic(color));

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z = 0): T {
  o.position.set(x, y, z);
  return o;
}

/** inkOutline with one shared ink material (items are cached, so their hulls are too). */
function outline(m: THREE.Mesh, t: number): void {
  const hull = inkOutline(m, t);
  (hull.material as THREE.Material).dispose();
  hull.material = cachedMat('ink:hull', () => new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
}

const smooth = (k: number) => {
  const x = Math.min(1, Math.max(0, k));
  return x * x * (3 - 2 * x);
};

// ------------------------------------------------------------------ shapes
function roundRect(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Shape {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

function polyShape(pts: V2[]): THREE.Shape {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/** A polygon whose corners are softened: each corner becomes a quadratic curve `k` along its edges. */
function softPoly(pts: V2[], k: number): THREE.Shape {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[i];
    const [ax, ay] = pts[(i + n - 1) % n];
    const [bx, by] = pts[(i + 1) % n];
    const la = Math.hypot(ax - px, ay - py);
    const lb = Math.hypot(bx - px, by - py);
    const A: V2 = [px + ((ax - px) / la) * k, py + ((ay - py) / la) * k];
    const B: V2 = [px + ((bx - px) / lb) * k, py + ((by - py) / lb) * k];
    if (i === 0) s.moveTo(A[0], A[1]);
    else s.lineTo(A[0], A[1]);
    s.quadraticCurveTo(px, py, B[0], B[1]);
  }
  s.closePath();
  return s;
}

const ring = (n: number, r: number, a0: number): V2[] =>
  Array.from({ length: n }, (_, i) => [Math.cos(a0 + (i / n) * TAU) * r, Math.sin(a0 + (i / n) * TAU) * r] as V2);

/** A five-point star outline with rounded outer tips (the gold-star sticker). */
function starShape(outer: number, inner: number, round = 0.22): THREE.Shape {
  const pts: V2[] = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  if (round <= 0) return polyShape(pts);
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const P = pts[i];
    if (i % 2) {
      s.lineTo(P[0], P[1]);
      continue;
    }
    const prev = pts[(i + 9) % 10];
    const next = pts[(i + 1) % 10];
    const A: V2 = [P[0] + round * (prev[0] - P[0]), P[1] + round * (prev[1] - P[1])];
    const B: V2 = [P[0] + round * (next[0] - P[0]), P[1] + round * (next[1] - P[1])];
    if (i === 0) s.moveTo(A[0], A[1]);
    else s.lineTo(A[0], A[1]);
    s.quadraticCurveTo(P[0], P[1], B[0], B[1]);
  }
  s.closePath();
  return s;
}

/** A leaf or petal: base at the origin, tip at (0, len). */
function teardrop(len: number, wid: number): THREE.Shape {
  const w = wid / 2;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(w * 1.5, len * 0.2, w * 1.1, len * 0.8, 0, len);
  s.bezierCurveTo(-w * 1.1, len * 0.8, -w * 1.5, len * 0.2, 0, 0);
  return s;
}

type ChipId = ChipShape | 'disc';

/** Token silhouettes, each centred on the origin and about 0.62 across. Data has corners. */
function chipShape(id: ChipId): THREE.Shape {
  switch (id) {
    case 'book':
      return roundRect(0.46, 0.6, 0.05);
    case 'octagon':
      return polyShape(ring(8, 0.31, Math.PI / 8));
    case 'page':
      return polyShape([[-0.27, -0.27], [0.27, -0.27], [0.27, 0.13], [0.13, 0.27], [-0.27, 0.27]]);
    case 'hex':
      return polyShape(ring(6, 0.32, 0));
    case 'bubble': {
      // A speech bubble: rounded body, tail off the bottom-left.
      const [w, h, r, cy] = [0.58, 0.44, 0.12, 0.04];
      const x0 = -w / 2;
      const x1 = w / 2;
      const y0 = cy - h / 2;
      const y1 = cy + h / 2;
      const s = new THREE.Shape();
      s.moveTo(-0.04, y0);
      s.lineTo(x1 - r, y0);
      s.quadraticCurveTo(x1, y0, x1, y0 + r);
      s.lineTo(x1, y1 - r);
      s.quadraticCurveTo(x1, y1, x1 - r, y1);
      s.lineTo(x0 + r, y1);
      s.quadraticCurveTo(x0, y1, x0, y1 - r);
      s.lineTo(x0, y0 + r);
      s.quadraticCurveTo(x0, y0, x0 + r, y0);
      s.lineTo(-0.24, -0.31);
      s.closePath();
      return s;
    }
    case 'shield': {
      const s = new THREE.Shape();
      s.moveTo(-0.27, 0.24);
      s.quadraticCurveTo(-0.27, 0.28, -0.23, 0.28);
      s.lineTo(0.23, 0.28);
      s.quadraticCurveTo(0.27, 0.28, 0.27, 0.24);
      s.lineTo(0.27, -0.02);
      s.quadraticCurveTo(0.25, -0.2, 0, -0.32);
      s.quadraticCurveTo(-0.25, -0.2, -0.27, -0.02);
      s.closePath();
      return s;
    }
    case 'photo':
      return roundRect(0.56, 0.56, 0.04);
    case 'triangle': {
      // Equilateral, circumradius 0.36, shifted so its box is centred.
      const R = 0.36;
      const pts = [90, 210, 330].map((d) => [Math.cos((d * Math.PI) / 180) * R, Math.sin((d * Math.PI) / 180) * R - 0.09] as V2);
      return softPoly(pts, 0.06);
    }
    case 'gear': {
      const pts: V2[] = [];
      for (let t = 0; t < 8; t++) {
        const a = (t / 8) * TAU;
        const step = TAU / 8;
        for (const [f, r] of [[0, 0.25], [0.22, 0.31], [0.5, 0.31], [0.72, 0.25]] as V2[]) {
          pts.push([Math.cos(a + f * step) * r, Math.sin(a + f * step) * r]);
        }
      }
      return polyShape(pts);
    }
    case 'arrow': {
      const s = polyShape([[-0.28, 0.24], [0.1, 0.24], [0.3, 0], [0.1, -0.24], [-0.28, -0.24]]);
      const hole = new THREE.Path();
      hole.absarc(-0.18, 0, 0.05, 0, TAU, true);
      s.holes.push(hole);
      return s;
    }
    case 'diamond':
      return softPoly([[0, 0.32], [-0.25, 0], [0, -0.32], [0.25, 0]], 0.05);
    case 'torn': {
      // A disc with three bites out of it: the shadow library.
      const pts = ring(24, 0.3, 0).map(([x, y]) => {
        const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
        const bitten = [40, 160, 290].some((b) => Math.abs(((deg - b + 540) % 360) - 180) < 12.5);
        const f = bitten ? (0.3 - 0.07) / 0.3 : 1;
        return [x * f, y * f] as V2;
      });
      return polyShape(pts);
    }
    case 'disc':
      return polyShape(ring(24, 0.3, 0));
  }
}

/** Where each chip's glyph sits (the visual centre of its silhouette). */
const GLYPH_AT: Partial<Record<ChipId, V2>> = { bubble: [0, 0.04], triangle: [0, -0.05], shield: [0, 0.03], arrow: [0.03, 0], page: [-0.01, -0.01] };

/**
 * Face UVs: the front and back caps are projected over a 0.64 square (the back mirrored, so a chip
 * that flips round still reads); everything else (sides, bevel) samples the rim swatch in the corner.
 */
function chipUV(g: THREE.BufferGeometry): void {
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const nz = nrm.getZ(i);
    if (Math.abs(nz) > 0.85) {
      const x = pos.getX(i);
      uv.setXY(i, nz > 0 ? x / 0.64 + 0.5 : 0.5 - x / 0.64, pos.getY(i) / 0.64 + 0.5);
    } else uv.setXY(i, 0.953, 0.047);
  }
  uv.needsUpdate = true;
}

function chipGeo(id: ChipId): THREE.BufferGeometry {
  return cachedGeo(`chip:${id}`, () => {
    const g = new THREE.ExtrudeGeometry(chipShape(id), {
      depth: 0.07,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 8,
    });
    // Centre in depth only: the face texture is painted in the shape's own x/y.
    g.translate(0, 0, -0.035);
    chipUV(g);
    g.clearGroups();
    return g;
  });
}

/** Traces a shape outline onto a 64 px face canvas, scaled by s about the chip's centre. */
function tracePath(c: CanvasRenderingContext2D, pts: THREE.Vector2[], s = 1): void {
  c.beginPath();
  pts.forEach((p, i) => {
    const x = ((p.x * s) / 0.64 + 0.5) * 64;
    const y = (0.5 - (p.y * s) / 0.64) * 64;
    if (i) c.lineTo(x, y);
    else c.moveTo(x, y);
  });
  c.closePath();
}

interface FaceOpts {
  glyph: string;
  ink: string;
  extra?: (c: CanvasRenderingContext2D, pts: THREE.Vector2[]) => void;
}

/**
 * A chip's 64 px face: rim colour everywhere, the silhouette, a lighter sticker inset, the glyph, a
 * glint. The rim (the chip's bevel and sides) is its colour pushed well toward ink, so every chip is
 * outlined like the other toy pieces and stands off a backdrop of its own hue.
 */
function chipFace(key: string, id: ChipId, color: number, o: FaceOpts): THREE.Texture {
  return softTexture(`chip:${key}`, 64, 64, (c) => {
    const pts = chipShape(id).getPoints(8);
    c.fillStyle = css(mixHex(shade(color, 0.55), INK, 0.45));
    c.fillRect(0, 0, 64, 64);
    tracePath(c, pts);
    c.fillStyle = css(color);
    c.fill();
    tracePath(c, pts, 0.78);
    c.fillStyle = css(shade(color, 1.18));
    c.fill();
    if (o.extra) {
      c.save();
      tracePath(c, pts);
      c.clip();
      o.extra(c, pts);
      c.restore();
    }
    const [gx, gy] = GLYPH_AT[id] ?? [0, 0];
    c.fillStyle = o.ink;
    c.font = `bold ${o.glyph.length > 1 ? 22 : 28}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(o.glyph, (gx / 0.64 + 0.5) * 64, (0.5 - gy / 0.64) * 64 + 2);
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(18, 16, 9, (200 * Math.PI) / 180, (290 * Math.PI) / 180);
    c.stroke();
  });
}

const chipExtras: Partial<Record<ChipId, (color: number) => FaceOpts['extra']>> = {
  // The book's spine.
  book: (color) => (c) => {
    c.fillStyle = css(shade(color, 0.8));
    c.fillRect(0, 0, ((-0.23 + 0.18 * 0.46) / 0.64 + 0.5) * 64, 64);
    c.fillStyle = css(shade(color, 1.1));
    c.fillRect(((-0.23 + 0.18 * 0.46) / 0.64 + 0.5) * 64, 0, 1.5, 64);
  },
  // The dog-eared corner folded down.
  page: (color) => (c) => {
    const px = (x: number) => (x / 0.64 + 0.5) * 64;
    const py = (y: number) => (0.5 - y / 0.64) * 64;
    c.fillStyle = css(shade(color, 1.25));
    c.strokeStyle = css(shade(color, 0.7));
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(px(0.13), py(0.27));
    c.lineTo(px(0.13), py(0.13));
    c.lineTo(px(0.27), py(0.13));
    c.closePath();
    c.fill();
    c.stroke();
  },
  // A white print border.
  photo: () => (c, pts) => {
    tracePath(c, pts, 0.86);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 5;
    c.stroke();
  },
  // A grommet round the tag's hole.
  arrow: (color) => (c) => {
    c.strokeStyle = css(shade(color, 0.75));
    c.lineWidth = 3;
    c.beginPath();
    c.arc((-0.18 / 0.64 + 0.5) * 64, 32, 5.5, 0, TAU);
    c.stroke();
  },
};

/** "Board-game chip": one extruded silhouette per data type, one mesh, one material, one draw. */
export function makeToken(type: DataTypeId): THREE.Group {
  const t = DATA_TYPES[type];
  const mat = cachedMat(`chip:${type}`, () => {
    const tex = chipFace(type, t.chip, t.color, {
      glyph: t.glyph,
      ink: type === 'shadow' ? '#eef1ff' : '#1d1424',
      extra: chipExtras[t.chip]?.(t.color),
    });
    return new THREE.MeshToonMaterial({ color: 0xffffff, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22, gradientMap: RAMP });
  });
  const g = new THREE.Group();
  g.add(mesh(chipGeo(t.chip), mat, 0, 0.5, 0));
  return g;
}

/** A four-point twinkle, white on transparent (tinted per material). */
function twinkleTexture(): THREE.Texture {
  return softTexture('item:twinkle', 32, 32, (c) => {
    c.clearRect(0, 0, 32, 32);
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 9);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = '#ffffff';
    c.beginPath();
    for (let k = 0; k < 8; k++) {
      const r = k % 2 ? 2.2 : 15;
      const a = (k / 8) * TAU - Math.PI / 2;
      if (k) c.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r);
      else c.moveTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
  });
}

function trapChip(kind: 'rewardOrb' | 'praise'): THREE.Mesh {
  const orb = kind === 'rewardOrb';
  const color = orb ? 0xffc21a : 0xff9ad5;
  const mat = cachedMat(`trap:${kind}`, () => {
    const tex = chipFace(`trap:${kind}`, 'disc', color, {
      glyph: orb ? '+1' : '★',
      ink: orb ? '#5a2a00' : '#5a0034',
      extra: orb
        ? undefined
        : (c) => {
            // Glitter: sugar on top.
            c.fillStyle = '#ffffff';
            for (let i = 0; i < 14; i++) {
              const a = hash01(i, 3) * TAU;
              const r = 6 + hash01(i, 7) * 22;
              c.fillRect(32 + Math.cos(a) * r, 32 + Math.sin(a) * r, 1.4, 1.4);
            }
          },
    });
    return new THREE.MeshToonMaterial({
      color: 0xffffff,
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      // The fake reward is too shiny.
      emissiveIntensity: orb ? 0.55 : 0.3,
      gradientMap: RAMP,
    });
  });
  return mesh(chipGeo('disc'), mat, 0, 0.5, 0);
}

/** The reward orb's fishhook: shank, eye, bend and barb in one silver piece. */
function hookGeo(): THREE.BufferGeometry {
  return cachedGeo('trap:hook', () => {
    const shank = new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6).translate(0, 0.77, 0);
    const eye = new THREE.TorusGeometry(0.04, 0.012, 6, 12).translate(0, 0.95, 0);
    const bend = new THREE.TorusGeometry(0.09, 0.018, 6, 12, 1.2 * Math.PI).rotateZ(Math.PI).translate(0.09, 0.62, 0);
    const end = 0.2 * Math.PI;
    const barb = new THREE.ConeGeometry(0.03, 0.07, 5).translate(0.09 + 0.09 * Math.cos(end), 0.62 + 0.09 * Math.sin(end) + 0.03, 0);
    return mergeGeometries([shank, eye, bend, barb])!;
  });
}

/** Looks like a treat, costs you something. The only round coins in the game are traps. */
export function makeTrap(kind: 'rewardOrb' | 'praise'): THREE.Group {
  const g = new THREE.Group();
  g.add(trapChip(kind));
  const parts: Record<string, THREE.Object3D> = {};
  if (kind === 'rewardOrb') {
    g.add(mesh(hookGeo(), toonC(0xc8ccd6), 0.12, 0, 0.1));
    const tw = cachedMat('trap:twinkle', () =>
      new THREE.MeshBasicMaterial({ map: twinkleTexture(), color: 0xfff0a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const quad = cachedGeo('item:quad:0.22', () => new THREE.PlaneGeometry(0.22, 0.22));
    parts.a = mesh(quad, tw, -0.22, 0.78, 0.1);
    parts.b = mesh(quad, tw, 0.24, 0.3, 0.1);
    g.add(parts.a, parts.b);
  } else {
    // Sweet-wrapper twists on both sides, their points into the chip.
    const twist = cachedGeo('trap:twist', () => new THREE.ConeGeometry(0.13, 0.2, 5).scale(1, 1, 0.5));
    const mat = toonC(0xffc6e6);
    const l = mesh(twist, mat, -0.36, 0.5, 0);
    l.rotation.z = -Math.PI / 2;
    const r = mesh(twist, mat, 0.36, 0.5, 0);
    r.rotation.z = Math.PI / 2;
    g.add(l, r);
    parts.l = l;
    parts.r = r;
  }
  g.userData.anim = { kind: kind === 'rewardOrb' ? 'orb' : 'praise', idle: kind === 'rewardOrb' ? 'orb' : 'praise', parts, base: 0 } satisfies ItemAnim;
  return g;
}

// ------------------------------------------------------------ power items
type Idle = 'slide' | 'bounce' | 'stay' | 'orb' | 'praise';
interface ItemAnim {
  kind: string;
  idle: Idle;
  parts: Record<string, THREE.Object3D>;
  /** Resting z tilt. */
  base: number;
}

function anim(g: THREE.Group, kind: string, idle: Idle, parts: Record<string, THREE.Object3D> = {}, base = 0): THREE.Group {
  g.userData.anim = { kind, idle, parts, base } satisfies ItemAnim;
  return g;
}

const pillowStar = () =>
  cachedGeo('star:pillow', () => {
    const g = new THREE.ExtrudeGeometry(starShape(0.42, 0.2), {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.09,
      bevelSize: 0.06,
      bevelSegments: 3,
      curveSegments: 6,
    });
    g.center();
    return g;
  });

const miniStar = (outer: number, inner: number) => cachedGeo(`star:mini:${outer}:${inner}`, () => new THREE.ShapeGeometry(starShape(outer, inner, 0)));

/** A little canvas texture for a label or a face, cached by key. */
function labelTexture(key: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): THREE.Texture {
  return softTexture(`item:${key}`, w, h, paint);
}

function scaleGeode(): THREE.Group {
  const g = new THREE.Group();
  const shell = mesh(
    cachedGeo('geode:shell', () => new THREE.SphereGeometry(0.3, 10, 5, 0, TAU, Math.PI / 2, Math.PI / 2)),
    cachedMat('geode:shell', () => new THREE.MeshToonMaterial({ color: 0x6b5a4e, gradientMap: RAMP, side: THREE.DoubleSide })),
    0,
    0.3,
  );
  const rim = mesh(cachedGeo('geode:rim', () => new THREE.TorusGeometry(0.3, 0.035, 6, 20).rotateX(Math.PI / 2)), toonC(0x9a8878), 0, 0.3);
  const crystals = mesh(
    cachedGeo('geode:crystals', () =>
      faceted([
        new THREE.CylinderGeometry(0.02, 0.11, 0.62, 6).translate(0, 0.2, 0),
        new THREE.CylinderGeometry(0.02, 0.09, 0.42, 6).rotateZ(0.42).translate(-0.12, 0.12, 0.03),
        new THREE.CylinderGeometry(0.02, 0.09, 0.42, 6).rotateZ(-0.42).translate(0.12, 0.12, 0.03),
      ])!,
    ),
    cachedMat('geode:crystal', () => new THREE.MeshToonMaterial({ color: 0x3ff2d0, emissive: 0x19c2a2, emissiveIntensity: 0.6, gradientMap: RAMP })),
    0,
    0.3,
  );
  g.add(shell, rim, crystals, at(glint(0.03, 0.1), -0.03, 0.62, 0.1));
  return anim(g, 'scale', 'slide');
}

function megaMushroom(): THREE.Group {
  const g = new THREE.Group();
  const stem = mesh(
    cachedGeo('mega:stem', () => new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.1, 0.17], [0.13, 0.34], [0, 0.34]].map(([x, y]) => new THREE.Vector2(x, y)), 12)),
    toonC(0xf0d9b0),
  );
  const band = mesh(cachedGeo('mega:band', () => new THREE.TorusGeometry(0.105, 0.022, 6, 16).rotateX(Math.PI / 2)), toonC(0x8a5cff), 0, 0.2);
  const cap = mesh(
    cachedGeo('mega:cap', () =>
      new THREE.LatheGeometry([[0, 0], [0.36, -0.02], [0.4, 0.02], [0.34, 0.15], [0.2, 0.24], [0, 0.26]].map(([x, y]) => new THREE.Vector2(x, y)), 16),
    ),
    toonC(0xffc933, 0xffc933, 0.3),
    0,
    0.32,
  );
  outline(cap, 0.025);
  const leds = new THREE.InstancedMesh(cachedGeo('mega:led', () => new THREE.SphereGeometry(0.04, 6, 4)), basicC(0xffffff), 7);
  const m = new THREE.Matrix4();
  const c = new THREE.Color(0xd07aff);
  leds.setMatrixAt(0, m.makeTranslation(0, 0.58, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    leds.setMatrixAt(i + 1, m.makeTranslation(Math.sin(a) * 0.24, 0.52, Math.cos(a) * 0.24));
  }
  for (let i = 0; i < 7; i++) leds.setColorAt(i, c);
  g.add(stem, band, cap, leds, at(glint(0.05, 0.09), -0.16, 0.52, 0.28));
  return anim(g, 'mega', 'slide', { cap, leds });
}

function goldStar(kind: 'rlhf' | 'viral'): THREE.Group {
  const g = new THREE.Group();
  const rlhf = kind === 'rlhf';
  // Viral's emissive hue is cycled each frame: one shared material, so every copy shimmers in sync.
  // Viral is tinted off pure white (white is for glints, and in the skies white means solid cloud).
  const star = mesh(pillowStar(), rlhf ? toonC(0xffc933, 0xffa000, 0.35) : toonC(0xeef6ff, 0x66ccff, 0.45), 0, 0.45);
  const parts: Record<string, THREE.Object3D> = { star };
  // Both stars are inked, so the pale share star still reads against pale skies.
  outline(star, 0.025);
  if (rlhf) {
    // The foil face of the sticker.
    const foil = mesh(cachedGeo('star:foil', () => new THREE.ShapeGeometry(starShape(0.42 * 0.55, 0.2 * 0.55))), basicC(0xfff2a0), 0, 0, 0.14);
    star.add(foil);
    star.add(at(glint(0.05, 0.08), -0.12, 0.17, 0.15));
  } else {
    star.add(at(glint(0.05, 0.08), -0.12, 0.17, 0.15));
    const followers = new THREE.InstancedMesh(miniStar(0.1, 0.045), basicC(0xffffff), 6);
    const c = new THREE.Color();
    for (let i = 0; i < 6; i++) followers.setColorAt(i, c.setHSL(i / 6, 0.9, 0.6));
    followers.rotation.x = (20 * Math.PI) / 180;
    followers.frustumCulled = false;
    g.add(followers);
    parts.followers = followers;
  }
  g.add(star);
  return anim(g, kind, 'bounce', parts, rlhf ? 0.17 : 0);
}

function toolFlower(): THREE.Group {
  const g = new THREE.Group();
  const pot = mesh(
    cachedGeo('tool:pot', () =>
      new THREE.LatheGeometry([[0, 0], [0.14, 0], [0.2, 0.22], [0.22, 0.22], [0.22, 0.25], [0, 0.25]].map(([x, y]) => new THREE.Vector2(x, y)), 12),
    ),
    toonC(0xc8643c),
  );
  const soil = mesh(cachedGeo('tool:soil', () => new THREE.CircleGeometry(0.19, 12).rotateX(-Math.PI / 2)), toonC(0x5a3a2a), 0, 0.235);
  const stem = mesh(
    cachedGeo('tool:stem', () => {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.23, 0), new THREE.Vector3(0.04, 0.35, 0), new THREE.Vector3(-0.03, 0.47, 0), new THREE.Vector3(0, 0.58, 0)]);
      return new THREE.TubeGeometry(curve, 12, 0.025, 5);
    }),
    toonC(0x2fae4a),
  );
  const leafMat = cachedMat('tool:leaf', () => new THREE.MeshToonMaterial({ color: 0x3fbf5a, gradientMap: RAMP, side: THREE.DoubleSide }));
  const leaf = mesh(cachedGeo('leaf:0.16', () => new THREE.ShapeGeometry(teardrop(0.16, 0.08))), leafMat, 0.02, 0.36, 0.02);
  leaf.rotation.z = -0.6;
  const petals = new THREE.Group();
  petals.position.set(0, 0.62, 0.02);
  const petalGeo = cachedGeo('tool:petals', () =>
    mergeGeometries(
      Array.from({ length: 5 }, (_, k) => new THREE.ShapeGeometry(teardrop(0.18, 0.11)).translate(0, 0.05, 0).rotateZ((k * TAU) / 5)),
    )!,
  );
  const petalMat = cachedMat('tool:petal', () =>
    new THREE.MeshToonMaterial({ color: 0x1fd1b0, emissive: 0x0a8a74, emissiveIntensity: 0.35, gradientMap: RAMP, side: THREE.DoubleSide }),
  );
  const buttonMat = cachedMat('tool:button', () =>
    new THREE.MeshBasicMaterial({
      map: labelTexture('fn', 32, 32, (c) => {
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, 32, 32);
        c.fillStyle = css(INK);
        c.font = 'bold 16px system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('fn', 16, 17);
      }),
    }),
  );
  const button = mesh(
    cachedGeo('tool:button', () => atlasUV(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 16).rotateX(Math.PI / 2), CELL.FULL)),
    buttonMat,
    0,
    0,
    0.02,
  );
  petals.add(mesh(petalGeo, petalMat), button);
  g.add(pot, soil, stem, leaf, petals);
  return anim(g, 'tool', 'stay', { petals });
}

function reasoningCape(): THREE.Group {
  const g = new THREE.Group();
  const geo = cachedGeo('cape:cloth', () => new THREE.CylinderGeometry(0.2, 0.42, 0.62, 12, 3, true, 0.3 * Math.PI, 1.4 * Math.PI));
  const outer = mesh(geo, cachedMat('cape:outer', () => new THREE.MeshToonMaterial({ color: 0x6a3cff, emissive: 0x3a1080, emissiveIntensity: 0.35, gradientMap: RAMP })));
  const lining = mesh(
    geo,
    cachedMat('cape:lining', () =>
      new THREE.MeshToonMaterial({
        color: 0xcdb8ff,
        gradientMap: RAMP,
        side: THREE.BackSide,
        map: labelTexture('cape:lining', 32, 32, (c) => {
          c.fillStyle = '#cdb8ff';
          c.fillRect(0, 0, 32, 32);
          c.fillStyle = '#ffffff';
          // Six ∴ triads: reasoning written into the lining.
          for (let i = 0; i < 6; i++) {
            const x = 5 + (i % 3) * 11;
            const y = 8 + Math.floor(i / 3) * 16;
            for (const [dx, dy] of [[0, -2.5], [-2.5, 2], [2.5, 2]]) {
              c.beginPath();
              c.arc(x + dx, y + dy, 1.4, 0, TAU);
              c.fill();
            }
          }
        }),
      }),
    ),
  );
  const cloth = new THREE.Group();
  cloth.position.y = 0.4;
  cloth.add(outer, lining);
  const gold = toonC(0xffc933, 0xa06a00, 0.3);
  const collar = mesh(cachedGeo('cape:collar', () => new THREE.TorusGeometry(0.2, 0.03, 6, 16, Math.PI).rotateX(-Math.PI / 2)), gold, 0, 0.71);
  const clasp = mesh(
    cachedGeo('cape:clasp', () =>
      mergeGeometries([[0, 0.03], [-0.03, -0.02], [0.03, -0.02]].map(([x, y]) => new THREE.SphereGeometry(0.03, 8, 6).translate(x, y, 0)))!,
    ),
    gold,
    0,
    0.72,
    0.22,
  );
  g.add(cloth, collar, clasp);
  return anim(g, 'cape', 'stay', { cloth });
}

/** Merges parts into one faceted geometry (one normal per face, like a cut crystal). */
function faceted(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts)!.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

function tube(pts: [number, number][], r: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  return new THREE.TubeGeometry(curve, 6, r, 5);
}

function forkCherries(): THREE.Group {
  const g = new THREE.Group();
  const cherries = mesh(
    cachedGeo('fork:cherries', () =>
      mergeGeometries([-0.16, 0.16].map((x) => new THREE.SphereGeometry(0.16, 14, 10).translate(x, 0.18, 0)))!,
    ),
    toonC(0xd8283e, 0x600010, 0.35),
  );
  const stems = mesh(
    cachedGeo('fork:stems', () =>
      mergeGeometries([
        tube([[0, 0.72], [0, 0.61], [0, 0.5]], 0.022),
        tube([[0, 0.5], [-0.1, 0.43], [-0.16, 0.33]], 0.022),
        tube([[0, 0.5], [0.1, 0.43], [0.16, 0.33]], 0.022),
      ])!,
    ),
    toonC(0x3a8a3a),
  );
  const beads = mesh(
    cachedGeo('fork:beads', () => mergeGeometries([0.72, 0.5].map((y) => new THREE.SphereGeometry(0.045, 8, 6).translate(0, y, 0)))!),
    toonC(0x9be04a),
  );
  const leaf = mesh(
    cachedGeo('leaf:0.16', () => new THREE.ShapeGeometry(teardrop(0.16, 0.08))),
    cachedMat('tool:leaf', () => new THREE.MeshToonMaterial({ color: 0x3fbf5a, gradientMap: RAMP, side: THREE.DoubleSide })),
    0.06,
    0.74,
    0.01,
  );
  leaf.rotation.z = -0.8;
  g.add(cherries, stems, beads, leaf, at(glint(0.04, 0.06), -0.21, 0.25, 0.15), at(glint(0.04, 0.06), 0.11, 0.25, 0.15));
  return anim(g, 'fork', 'slide');
}

function frozenFork(): THREE.Group {
  const g = new THREE.Group();
  const inside = forkCherries();
  inside.position.y = 0.04;
  const ice = mesh(
    cachedGeo('frozen:ice', () => atlasUV(roundedBox(0.8, 0.8, 0.8, 0.12, 0.06).clone(), CELL.FULL)),
    cachedMat('frozen:ice', () =>
      new THREE.MeshToonMaterial({
        color: 0xcfefff,
        emissive: 0x3a7aa0,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        gradientMap: RAMP,
        map: labelTexture('frost', 64, 64, (c) => {
          c.fillStyle = 'rgba(235,248,255,0.75)';
          c.fillRect(0, 0, 64, 64);
          // Rime in the corners.
          c.fillStyle = '#ffffff';
          for (const [x, y] of [[0, 0], [64, 0], [0, 64], [64, 64]]) {
            const g2 = c.createRadialGradient(x, y, 0, x, y, 20);
            g2.addColorStop(0, 'rgba(255,255,255,1)');
            g2.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g2;
            c.fillRect(0, 0, 64, 64);
          }
          c.strokeStyle = 'rgba(255,255,255,0.95)';
          c.lineWidth = 1.5;
          for (const [x, y, r] of [[20, 40, 3], [44, 22, 2.2], [48, 46, 1.8]]) {
            c.beginPath();
            c.arc(x, y, r, 0, TAU);
            c.stroke();
          }
          c.strokeStyle = 'rgba(255,255,255,0.6)';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(8, 30);
          c.lineTo(18, 26);
          c.lineTo(24, 32);
          c.moveTo(40, 58);
          c.lineTo(46, 50);
          c.lineTo(56, 52);
          c.stroke();
        }),
      }),
    ),
    0,
    0.42,
  );
  ice.renderOrder = 1;
  const tag = mesh(
    cachedGeo('item:plane:0.3x0.15', () => new THREE.PlaneGeometry(0.3, 0.15)),
    cachedMat('frozen:tag', () =>
      new THREE.MeshToonMaterial({
        gradientMap: RAMP,
        side: THREE.DoubleSide,
        map: labelTexture('onhold', 64, 32, (c) => {
          c.fillStyle = '#fff4d6';
          c.fillRect(0, 0, 64, 32);
          c.strokeStyle = 'rgba(29,20,36,0.6)';
          c.lineWidth = 2;
          c.strokeRect(1, 1, 62, 30);
          c.fillStyle = css(INK);
          c.font = 'bold 13px system-ui, sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText('ON HOLD', 35, 17);
          c.beginPath();
          c.arc(7, 16, 2.5, 0, TAU);
          c.fill();
        }),
      }),
    ),
    0.36,
    0.72,
    0.42,
  );
  tag.rotation.z = -0.3;
  const string = mesh(cachedGeo('frozen:string', () => new THREE.BoxGeometry(0.01, 0.14, 0.01)), basicC(0xfff4d6), 0.27, 0.8, 0.41);
  string.rotation.z = 0.7;
  g.add(inside, ice, tag, string);
  return anim(g, 'frozen', 'stay');
}

function checkpointFloppy(): THREE.Group {
  const g = new THREE.Group();
  const disk = new THREE.Group();
  disk.position.y = 0.45;
  const body = mesh(
    cachedGeo('oneup:disk', () => {
      const h = 0.31;
      const geo = new THREE.ExtrudeGeometry(polyShape([[-h, -h], [h, -h], [h, h - 0.08], [h - 0.08, h], [-h, h]]), {
        depth: 0.06,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 1,
      });
      geo.translate(0, 0, -0.03);
      return geo;
    }),
    toonC(0x2fae4a),
  );
  outline(body, 0.02);
  const shutter = mesh(cachedGeo('oneup:shutter', () => new THREE.BoxGeometry(0.3, 0.2, 0.09)), toonC(0xc8ccd6), 0.04, 0.2);
  const label = mesh(
    cachedGeo('item:plane:0.44x0.26', () => new THREE.PlaneGeometry(0.44, 0.26)),
    cachedMat('oneup:label', () =>
      new THREE.MeshToonMaterial({
        gradientMap: RAMP,
        map: labelTexture('floppy', 64, 32, (c) => {
          c.fillStyle = '#fff4d6';
          c.fillRect(0, 0, 64, 32);
          c.fillStyle = 'rgba(29,20,36,0.25)';
          c.fillRect(6, 22, 52, 1.5);
          c.fillRect(6, 27, 52, 1.5);
          c.fillStyle = css(INK);
          c.font = 'bold 20px system-ui, sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText('+1', 32, 11);
        }),
      }),
    ),
    0,
    -0.12,
    0.046,
  );
  disk.add(body, shutter, label);
  g.add(disk);
  return anim(g, 'oneup', 'slide', { shutter });
}

function hypeBalloon(color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = toonC(color, color, 0.25);
  const balloon = mesh(cachedGeo('hype:balloon', () => new THREE.SphereGeometry(0.3, 16, 12).scale(1, 1.15, 1)), mat, 0, 0.5);
  outline(balloon, 0.02);
  const knot = mesh(cachedGeo('hype:knot', () => new THREE.ConeGeometry(0.05, 0.07, 6).rotateX(Math.PI)), mat, 0, 0.14);
  const string = mesh(
    cachedGeo('hype:string', () => {
      const pts = Array.from({ length: 25 }, (_, i) => {
        const k = i / 24;
        const a = k * 3 * TAU;
        return new THREE.Vector3(Math.cos(a) * 0.03, 0.12 * (1 - k), Math.sin(a) * 0.03);
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 4);
    }),
    basicC(0xffffff),
  );
  g.add(balloon, knot, string, at(glint(0.05, 0.14), -0.12, 0.62, 0.3));
  return anim(g, 'hype', 'stay');
}

function snapshot(color: number): THREE.Group {
  const g = new THREE.Group();
  const frame = mesh(roundedBox(0.62, 0.74, 0.04, 0.03, 0.01), toonC(0xfdf8ee), 0, 0.45);
  outline(frame, 0.02);
  const picture = mesh(
    cachedGeo('item:plane:0.5', () => new THREE.PlaneGeometry(0.5, 0.5)),
    cachedMat(`moment:${color}`, () =>
      new THREE.MeshBasicMaterial({
        map: labelTexture(`sunburst:${color}`, 64, 64, (c) => {
          const dark = css(shade(color, 0.8));
          for (let i = 0; i < 12; i++) {
            c.fillStyle = i % 2 ? dark : css(color);
            c.beginPath();
            c.moveTo(32, 32);
            c.arc(32, 32, 48, (i / 12) * TAU, ((i + 1) / 12) * TAU);
            c.closePath();
            c.fill();
          }
          c.fillStyle = '#ffffff';
          c.beginPath();
          c.arc(32, 32, 8, 0, TAU);
          c.fill();
        }),
      }),
    ),
    0,
    0.5,
    0.025,
  );
  const tape = mesh(
    cachedGeo('item:plane:0.3x0.09', () => new THREE.PlaneGeometry(0.3, 0.09)),
    cachedMat('moment:tape', () => new THREE.MeshBasicMaterial({ color: 0xfff8d0, transparent: true, opacity: 0.6, depthWrite: false })),
    0,
    0.81,
    0.03,
  );
  tape.rotation.z = 0.14;
  g.add(frame, picture, tape);
  return anim(g, 'moment', 'stay');
}

/** Power-up meshes by kind. `color` tints hype and moment items. Every one fits a 0.8 box. */
export function makePowerItem(kind: string, color = 0xff4fd8): THREE.Group {
  switch (kind) {
    case 'scale':
      return scaleGeode();
    case 'mega':
      return megaMushroom();
    case 'rlhf':
    case 'viral':
      return goldStar(kind);
    case 'tool':
      return toolFlower();
    case 'cape':
      return reasoningCape();
    case 'fork':
      return forkCherries();
    case 'frozen':
      return frozenFork();
    case 'oneup':
      return checkpointFloppy();
    case 'hype':
      return hypeBalloon(color);
    case 'moment':
      return snapshot(color);
  }
  const g = new THREE.Group();
  const orb = mesh(cachedGeo('item:orb', () => new THREE.IcosahedronGeometry(0.34, 1)), toonC(color, color, 0.5), 0, 0.45);
  const halo = mesh(
    cachedGeo('item:halo', () => new THREE.TorusGeometry(0.46, 0.04, 6, 24)),
    cachedMat('item:halo', () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })),
    0,
    0.45,
  );
  g.add(orb, halo);
  return anim(g, kind, 'stay');
}

/** The Scale power-up: the parameter geode. */
export function makeScaleCrystal(): THREE.Group {
  return makePowerItem('scale');
}

/** "Callable": a white core between two teal brackets that tumble as it flies. */
export function makeFunctionCall(): THREE.Group {
  const g = new THREE.Group();
  const core = mesh(cachedGeo('fn:core', () => new THREE.SphereGeometry(0.13, 12, 8)), basicC(0xffffff), 0, 0.22);
  outline(core, 0.02);
  const brackets = mesh(
    cachedGeo('fn:brackets', () =>
      mergeGeometries([
        new THREE.TorusGeometry(0.19, 0.055, 6, 12, 0.8 * Math.PI).rotateZ(Math.PI / 2 + 0.1 * Math.PI).translate(-0.05, 0, 0),
        new THREE.TorusGeometry(0.19, 0.055, 6, 12, 0.8 * Math.PI).rotateZ(-Math.PI / 2 + 0.1 * Math.PI).translate(0.05, 0, 0),
      ])!,
    ),
    toonC(0x1fd1b0, 0x1fd1b0, 0.5),
    0,
    0.22,
  );
  const halo = mesh(
    cachedGeo('item:quad:0.6', () => new THREE.PlaneGeometry(0.6, 0.6)),
    cachedMat('fn:halo', () =>
      new THREE.MeshBasicMaterial({ map: fxTexture('spark'), color: 0x1fd1b0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    ),
    0,
    0.22,
    -0.05,
  );
  g.add(halo, brackets, core);
  return g;
}

const heartShape = () => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.35);
  s.bezierCurveTo(-0.5, 0, -0.35, 0.4, 0, 0.18);
  s.bezierCurveTo(0.35, 0.4, 0.5, 0, 0, -0.35);
  return s;
};

/** "Felt heart": a puffy extruded heart with a new toon material per call (enemies tint theirs). */
export function makeHeartMesh(color: number): THREE.Mesh {
  const geo = cachedGeo('heart:puffy', () =>
    new THREE.ExtrudeGeometry(heartShape(), {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.05,
      bevelSegments: 3,
      curveSegments: 10,
    }).translate(0, 0, -0.03),
  );
  return new THREE.Mesh(geo, toon(color, color, 0.25));
}

/** A heart token ("nothing without its people"). Its lub-dub is played by Heart.updateMesh. */
export function makeHeart(): THREE.Group {
  const g = new THREE.Group();
  const heart = makeHeartMesh(0xff4d7a);
  heart.position.y = 0.5;
  outline(heart, 0.025);
  g.add(heart, at(glint(0.05, 0.08), -0.13, 0.62, 0.14));
  return g;
}

// ------------------------------------------------------------------ idles
const LED_OFF = new THREE.Color(0xd07aff);
const LED_ON = new THREE.Color(0xffffff);
const followerM = new THREE.Matrix4();
const followerQ = new THREE.Quaternion();
const followerE = new THREE.Euler();
const followerP = new THREE.Vector3();
const followerS = new THREE.Vector3(1, 1, 1);

/**
 * Plays the idle declared in g.userData.anim (after the engine has positioned the item). `emerge`
 * (0..1) grows an item out of its block. Allocates nothing.
 */
export function animateItem(g: THREE.Object3D, t: number, vx = 0, vy = 0, emerge = 1): void {
  const a = g.userData.anim as ItemAnim | undefined;
  if (!a) return;
  const m = prefs.reduceMotion ? 0.3 : 1;
  const p = a.parts;
  if (a.idle === 'orb') {
    p.a.scale.setScalar(0.6 + 0.4 * Math.abs(Math.sin(5 * t)));
    p.b.scale.setScalar(0.6 + 0.4 * Math.abs(Math.cos(5 * t)));
    return;
  }
  if (a.idle === 'praise') {
    p.l.rotation.x = 0.3 * m * Math.sin(9 * t);
    p.r.rotation.x = -0.3 * m * Math.sin(9 * t);
    return;
  }
  let sx = 1;
  let sy = 1;
  if (emerge < 1) {
    const s = 0.6 + 0.4 * easeOutBack(emerge);
    sx = s;
    sy = s * (1 + 0.15 * (1 - emerge));
  }
  g.rotation.set(0, 0, a.base);
  if (a.idle === 'slide') {
    g.rotation.z = a.base - Math.sign(vx) * 0.14 * m;
    g.rotation.y = 0.35 * m * Math.sin(1.5 * t);
    if (a.kind === 'mega') {
      const w = 0.05 * m * Math.sin(14 * t);
      p.cap.scale.set(1 + w, 1 - w, 1);
      const leds = p.leds as THREE.InstancedMesh;
      const on = Math.floor(8 * t) % 7;
      for (let i = 0; i < 7; i++) leds.setColorAt(i, i === on ? LED_ON : LED_OFF);
      leds.instanceColor!.needsUpdate = true;
    } else if (a.kind === 'fork') g.rotation.z += 0.12 * m * Math.sin(2.6 * t);
    else if (a.kind === 'oneup') {
      // The shutter slides open, holds, and closes again: saving a checkpoint.
      const k = t % 1.5;
      p.shutter.position.x = prefs.reduceMotion ? 0.04 : 0.04 - 0.1 * (smooth(k / 0.3) - smooth((k - 0.9) / 0.3));
    }
  } else if (a.idle === 'bounce') {
    g.rotation.z = a.base + 0.35 * m * Math.sin(2.2 * t);
    const k = 1 + Math.min(0.15, Math.max(-0.18, vy * 0.012)) * m;
    sy *= k;
    sx /= Math.sqrt(k);
    if (a.kind === 'viral') {
      const star = p.star as THREE.Mesh;
      (star.material as THREE.MeshToonMaterial).emissive.setHSL((0.5 * t) % 1, 0.9, 0.55);
      const f = p.followers as THREE.InstancedMesh;
      for (let i = 0; i < 6; i++) {
        const ang = 2 * t * m + (i * Math.PI) / 3;
        followerP.set(0.55 * Math.cos(ang), 0.45 + 0.19 * Math.sin(ang), 0.52 * Math.sin(ang));
        followerQ.setFromEuler(followerE.set(0, 0, 3 * t * m));
        f.setMatrixAt(i, followerM.compose(followerP, followerQ, followerS));
      }
      f.instanceMatrix.needsUpdate = true;
    }
  } else {
    if (a.kind === 'tool') {
      p.petals.scale.setScalar(1 + 0.08 * m * Math.sin(4 * t));
      g.rotation.y = 0.35 * m * Math.sin(1.2 * t);
    } else if (a.kind === 'cape') {
      g.rotation.y = 0.3 * m * Math.sin(1.3 * t);
      p.cloth.rotation.z = 0.06 * m * Math.sin(5 * t);
    } else if (a.kind === 'hype') g.rotation.z = 0.12 * m * Math.sin(10 * t);
    else if (a.kind === 'moment') {
      g.rotation.z = 0.1 * m * Math.sin(3 * t);
      g.rotation.y = 0.25 * m * Math.sin(1.7 * t);
    } else if (a.kind === 'frozen' && t % 2 < 0.12 && !prefs.reduceMotion) g.position.x += 0.02 * Math.sin(90 * t);
  }
  g.scale.set(sx, sy, sx);
}

/** Every collectible, for the `?debug&gallery=items` lineup. */
export function itemGallery(): { name: string; mesh: THREE.Object3D }[] {
  const tokens = (Object.keys(DATA_TYPES) as DataTypeId[]).map((id) => ({ name: DATA_TYPES[id].label, mesh: makeToken(id) as THREE.Object3D }));
  const powers = ['scale', 'mega', 'rlhf', 'viral', 'tool', 'cape', 'fork', 'frozen', 'oneup', 'hype', 'moment'].map((k) => ({
    name: k,
    mesh: makePowerItem(k, k === 'moment' ? 0xc0362c : 0xff4fd8) as THREE.Object3D,
  }));
  const all = [
    ...tokens,
    { name: 'reward orb', mesh: makeTrap('rewardOrb') as THREE.Object3D },
    { name: 'praise', mesh: makeTrap('praise') as THREE.Object3D },
    ...powers,
    { name: 'function call', mesh: makeFunctionCall() as THREE.Object3D },
    { name: 'heart', mesh: makeHeart() as THREE.Object3D },
  ];
  return all.map(({ name, mesh: inner }) => {
    const holder = new THREE.Group().add(inner);
    holder.userData.inner = inner;
    return { name, mesh: holder };
  });
}
