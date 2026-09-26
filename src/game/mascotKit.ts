import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cachedGeo, makeEye, type EyeOptions } from './toonKit';

/**
 * Hero-only helpers for the mascots in `characterMeshes.ts`: placing parts, pivots for animated
 * limbs, cached primitives, merged static parts, baked vertex colours and the few 2D outlines the
 * heroes are extruded from. The shared style lives in `toonKit.ts` (not edited here).
 */

export type V3 = readonly [number, number, number];

/** Where a part sits in its parent. */
export interface Put {
  at?: V3;
  rot?: V3;
  scale?: V3 | number;
  name?: string;
  hidden?: boolean;
}

export function place<T extends THREE.Object3D>(o: T, p: Put): T {
  if (p.at) o.position.set(p.at[0], p.at[1], p.at[2]);
  if (p.rot) o.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
  if (typeof p.scale === 'number') o.scale.setScalar(p.scale);
  else if (p.scale) o.scale.set(p.scale[0], p.scale[1], p.scale[2]);
  if (p.name) o.name = p.name;
  if (p.hidden) o.visible = false;
  return o;
}

export const part = (geo: THREE.BufferGeometry, mat: THREE.Material, p: Put = {}): THREE.Mesh => place(new THREE.Mesh(geo, mat), p);

export function group(p: Put, ...kids: THREE.Object3D[]): THREE.Group {
  const g = place(new THREE.Group(), p);
  if (kids.length) g.add(...kids);
  return g;
}

/** A named pivot at `at` (a hip, a scarf knot); the kids keep their places in the parent's space. */
export function pivot(name: string, at: V3, ...kids: THREE.Object3D[]): THREE.Group {
  const g = group({ name, at });
  for (const k of kids) {
    k.position.x -= at[0];
    k.position.y -= at[1];
    k.position.z -= at[2];
    g.add(k);
  }
  return g;
}

/**
 * Wraps a placed part in a named pivot at the point `end` along its own local y axis (a shoulder at
 * the top of an arm, an ear's base), so rotating the pivot swings the part from there.
 */
export function hinge(o: THREE.Object3D, end: number, name: string): THREE.Group {
  const e = new THREE.Vector3(0, end, 0).multiply(o.scale).applyEuler(o.rotation).add(o.position);
  return pivot(name, [e.x, e.y, e.z], o);
}

/** Cached primitives. Keys are shared by every mascot, their forks, cameos and kart drivers. */
export const geo = {
  sphere: (r: number, w = 12, h = 8) => cachedGeo(`char:sphere:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h)),
  capsule: (r: number, len: number, caps = 4, radial = 8) =>
    cachedGeo(`char:capsule:${r}:${len}:${caps}:${radial}`, () => new THREE.CapsuleGeometry(r, len, caps, radial)),
  cylinder: (top: number, bottom: number, h: number, seg = 10) =>
    cachedGeo(`char:cyl:${top}:${bottom}:${h}:${seg}`, () => new THREE.CylinderGeometry(top, bottom, h, seg)),
  torus: (r: number, tube: number, radial: number, tubular: number, arc = Math.PI * 2) =>
    cachedGeo(`char:torus:${r}:${tube}:${radial}:${tubular}:${arc}`, () => new THREE.TorusGeometry(r, tube, radial, tubular, arc)),
  disc: (r: number, seg: number, start = 0, len = Math.PI * 2) =>
    cachedGeo(`char:disc:${r}:${seg}:${start}:${len}`, () => new THREE.CircleGeometry(r, seg, start, len)),
  box: (w: number, h: number, d: number) => cachedGeo(`char:box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cone: (r: number, h: number, seg: number) => cachedGeo(`char:cone:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
};

const matrixOf = (p: Put) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(...(p.at ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
    typeof p.scale === 'number' ? new THREE.Vector3().setScalar(p.scale) : new THREE.Vector3(...(p.scale ?? [1, 1, 1])),
  );

/**
 * One geometry from several copies of same-kind indexed primitives, each moved by its own placement
 * (wool puffs, whale pleats, a dumbbell). Draws as a single mesh.
 */
export function merged(parts: (Put & { g: THREE.BufferGeometry })[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts.map((p) => p.g.clone().applyMatrix4(matrixOf(p))));
  if (!m) throw new Error('mergeGeometries failed: mixed primitive kinds');
  return m;
}

/**
 * Bakes a `color` attribute from each vertex's position, optionally after a placement (so a
 * gradient can follow the part's final height). THREE.Color stores linear values, which is what the
 * attribute needs.
 */
export function bakeColors<T extends THREE.BufferGeometry>(g: T, colorAt: (p: THREE.Vector3, out: THREE.Color) => void, at?: Put): T {
  const pos = g.getAttribute('position');
  const m = at ? matrixOf(at) : null;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (m) v.applyMatrix4(m);
    colorAt(v, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export const solidColor = <T extends THREE.BufferGeometry>(g: T, hex: number): T => bakeColors(g, (_, out) => out.setHex(hex));

const smooth = (e0: number, e1: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return u * u * (3 - 2 * u);
};

/** A smooth (never stepped) blend through colour stops [at, hex], sorted by `at`. */
export function gradient(stops: readonly (readonly [number, number])[]): (x: number, out: THREE.Color) => THREE.Color {
  const cols = stops.map(([, hex]) => new THREE.Color(hex));
  return (x, out) => {
    if (x <= stops[0][0]) return out.copy(cols[0]);
    for (let i = 1; i < stops.length; i++) {
      if (x <= stops[i][0]) return out.copy(cols[i - 1]).lerp(cols[i], smooth(stops[i - 1][0], stops[i][0], x));
    }
    return out.copy(cols[cols.length - 1]);
  };
}

/**
 * A pair of glossy eyes at (±x, y, z), each a group named 'eye' (blinks scale them), inside a group
 * named 'eyes'. The left eye (-x) comes first.
 */
export function eyePair(r: number, x: number, y: number, z: number, opts: (s: 1 | -1) => EyeOptions): THREE.Group {
  const g = group({ name: 'eyes' });
  for (const s of [-1, 1] as const) g.add(place(makeEye(r, { side: s > 0 ? -1 : 1, ...opts(s) }), { at: [s * x, y, z], name: 'eye' }));
  return g;
}

/** The z of a point on an ellipsoid's front at (x, y), for sitting eyes, blush and freckles on it. */
export function frontZ(x: number, y: number, c: V3, r: V3): number {
  const u = 1 - ((x - c[0]) / r[0]) ** 2 - ((y - c[1]) / r[1]) ** 2;
  return c[2] + r[2] * Math.sqrt(Math.max(0, u));
}

// ---------------------------------------------------------------- 2D outlines

/** GPT's speech bubble: a rounded square (0.62 × 0.52, corner r 0.2). Its pointer is `pointerShape`. */
export function bubbleShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.11, -0.26);
  s.lineTo(0.11, -0.26);
  s.absarc(0.11, -0.06, 0.2, -Math.PI / 2, 0, false);
  s.lineTo(0.31, 0.06);
  s.absarc(0.11, 0.06, 0.2, 0, Math.PI / 2, false);
  s.lineTo(-0.11, 0.26);
  s.absarc(-0.11, 0.06, 0.2, Math.PI / 2, Math.PI, false);
  s.lineTo(-0.31, -0.06);
  s.absarc(-0.11, -0.06, 0.2, Math.PI, 1.5 * Math.PI, false);
  return s;
}

/**
 * The bubble's pointer, in the bubble's own frame: its root is buried in the lower-right corner and
 * its tip juts down and out to (0.37, -0.41), so it can wag from the corner without a gap showing.
 */
export function pointerShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.02, -0.17);
  s.lineTo(0.37, -0.41);
  s.lineTo(0.24, -0.08);
  s.lineTo(0.02, -0.17);
  return s;
}

/** A five-point star (never the four-point sparkle), `outer` to its points, centred on the origin. */
export function starShape(outer: number, inner = outer * 0.45): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i) s.lineTo(r * Math.cos(a), r * Math.sin(a));
    else s.moveTo(r * Math.cos(a), r * Math.sin(a));
  }
  return s;
}

/**
 * A tube along `curve` whose radius tapers from `r0` to `r1`, closed with a round cap at the tip and
 * painted along its length (`colorAt(u)`, u = 0 at the root, 1 at the tip). Ready for a vertex-coloured material.
 */
export function taperedTube(curve: THREE.Curve<THREE.Vector3>, segments: number, r0: number, r1: number, radial: number, colorAt: (u: number, out: THREE.Color) => void): THREE.BufferGeometry {
  const tube = new THREE.TubeGeometry(curve, segments, 1, radial);
  const pos = tube.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const u = Math.floor(i / (radial + 1)) / segments;
    curve.getPointAt(u, c);
    v.fromBufferAttribute(pos, i).sub(c).multiplyScalar(r0 + (r1 - r0) * u).add(c);
    pos.setXYZ(i, v.x, v.y, v.z);
    colorAt(u, col);
    colors.set([col.r, col.g, col.b], i * 3);
  }
  tube.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  tube.computeVertexNormals();
  const end = curve.getPointAt(1);
  colorAt(1, col);
  const cap = solidColor(new THREE.SphereGeometry(r1, radial, 6).translate(end.x, end.y, end.z), col.getHex());
  return merged([{ g: tube }, { g: cap }]);
}

/** The eyelid cap of a `makeEye` eye (its only lit mesh), found by material rather than child order. */
export function lidOf(eye: THREE.Object3D): THREE.Mesh | undefined {
  return eye.children.find((o) => (o as THREE.Mesh).material instanceof THREE.MeshToonMaterial) as THREE.Mesh | undefined;
}

/** The pupil of a `makeEye` eye with a coloured iris: the smaller of its two dark discs in front. */
export function pupilOf(eye: THREE.Object3D): THREE.Mesh | undefined {
  const dark = eye.children.filter((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    return m instanceof THREE.MeshBasicMaterial && m.color.getHex() !== 0xffffff;
  }) as THREE.Mesh[];
  return dark.length === 2 ? dark.sort((a, b) => a.position.z - b.position.z)[1] : undefined;
}

/** The same bubble without its tail and with a three-scallop ghost hem. */
export function ghostShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.3, -0.26);
  s.lineTo(0.3, 0.06);
  s.absarc(0.1, 0.06, 0.2, 0, Math.PI / 2, false);
  s.lineTo(-0.1, 0.26);
  s.absarc(-0.1, 0.06, 0.2, Math.PI / 2, Math.PI, false);
  s.lineTo(-0.3, -0.26);
  for (const cx of [-0.2, 0, 0.2]) s.absarc(cx, -0.26, 0.1, Math.PI, 2 * Math.PI, false);
  return s;
}

/** A cat ear: base `w` on y = 0, apex at (0, h), the tip softened by a curve. */
export function earShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w * 0.12, h * 0.86);
  s.quadraticCurveTo(0, h * 1.06, w * 0.12, h * 0.86);
  s.lineTo(w / 2, 0);
  s.lineTo(-w / 2, 0);
  return s;
}

/** A point-down triangle, `w` wide along y = 0 with its point at (0, -h). */
export function pennant(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, -h);
  s.lineTo(-w / 2, 0);
  return s;
}
