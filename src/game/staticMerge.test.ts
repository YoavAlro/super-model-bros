import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ROSTER } from '../config/characters';
import type * as Merge from './staticMerge';
import { basic, cachedGeo, inkOutline, toon } from './toonKit';

/**
 * The static merge must never change what is drawn: the same triangles, facing the same way, in
 * the same colours and shading, with every part the engine or an animation holds kept as it was.
 * The builders merge as they go, so `__noMerge` turns the pass off to get each real cast mesh as
 * built, and `lastOpts` is what that builder would have merged it with.
 */
vi.mock('./staticMerge', async (actual) => {
  const real = await actual<typeof Merge>();
  const g = globalThis as { __noMerge?: boolean; __lastOpts?: Merge.MergeOptions };
  return {
    ...real,
    mergeStatic: (root: THREE.Object3D, opts?: Merge.MergeOptions) => {
      g.__lastOpts = opts;
      if (!g.__noMerge) real.mergeStatic(root, opts);
    },
  };
});

let M: typeof Merge;
let E: typeof import('./enemyMeshes');
let C: typeof import('./characterMeshes');
const flags = globalThis as { __noMerge?: boolean; __lastOpts?: Merge.MergeOptions };

beforeAll(async () => {
  // The enemy meshes draw canvas textures: every 2D call is a no-op here.
  const ctx: object = new Proxy({}, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 40 }) : () => ctx), set: () => true });
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  M = await vi.importActual<typeof Merge>('./staticMerge');
  E = await import('./enemyMeshes');
  C = await import('./characterMeshes');
});

/** A drawn triangle: its material kind, and its corners in drawing (winding) order: position, normal, colour. */
interface Tri {
  kind: string;
  corners: number[][];
}

/**
 * What the camera sees: every visible triangle in world space, wound as drawn (a mirrored mesh
 * flips its front face), with each corner's shading normal and colour, and its material kind.
 */
function surfaces(root: THREE.Object3D): Tri[] {
  root.updateMatrixWorld(true);
  const out: Tri[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const c = new THREE.Color();
  const normalMatrix = new THREE.Matrix3();
  root.traverseVisible((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshToonMaterial;
    const g = mesh.geometry;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const col = mat.vertexColors ? g.getAttribute('color') : null;
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    const corner = (i: number) => {
      p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
      c.copy(mat.color);
      if (col) c.multiply(new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)));
      return [...p.toArray(), ...n.toArray(), c.r, c.g, c.b];
    };
    const kind = M.kindOf(mat);
    const count = g.index ? g.index.count : pos.count;
    const at = (k: number) => (g.index ? g.index.getX(k) : k);
    for (let k = 0; k < count; k += 3) {
      const tri = [corner(at(k)), corner(at(k + 1)), corner(at(k + 2))];
      out.push({ kind, corners: mesh.matrixWorld.determinant() < 0 ? [tri[0], tri[2], tri[1]] : tri });
    }
  });
  return out;
}

/** Positions, normals and colours agree to float rounding. */
const TOL = [1e-4, 1e-4, 1e-4, 1e-3, 1e-3, 1e-3, 1e-5, 1e-5, 1e-5];

/** Is it the same triangle, wound the same way (whichever corner comes first)? */
function sameTri(a: Tri, b: Tri): boolean {
  if (a.kind !== b.kind) return false;
  return [0, 1, 2].some((rot) => a.corners.every((ca, i) => ca.every((v, k) => Math.abs(v - b.corners[(i + rot) % 3][k]) <= TOL[k])));
}

/** Why two sets of triangles differ, or null when every triangle of one has its twin in the other. */
function mismatch(before: Tri[], after: Tri[]): string | null {
  if (before.length !== after.length) return `${before.length} triangles before, ${after.length} after`;
  const cell = (t: Tri) => [0, 1, 2].map((k) => Math.floor(((t.corners[0][k] + t.corners[1][k] + t.corners[2][k]) / 3) * 100));
  const grid = new Map<string, Tri[]>();
  for (const t of after) {
    const key = cell(t).join(',');
    grid.set(key, [...(grid.get(key) ?? []), t]);
  }
  const used = new Set<Tri>();
  for (const t of before) {
    const [x, y, z] = cell(t);
    let twin: Tri | undefined;
    for (let dx = -1; dx <= 1 && !twin; dx++)
      for (let dy = -1; dy <= 1 && !twin; dy++)
        for (let dz = -1; dz <= 1 && !twin; dz++) twin = grid.get(`${x + dx},${y + dy},${z + dz}`)?.find((u) => !used.has(u) && sameTri(t, u));
    if (!twin) return `nothing like ${t.kind} ${JSON.stringify(t.corners.map((c) => c.map((v) => +v.toFixed(4))))}`;
    used.add(twin);
  }
  return null;
}

const draws = (root: THREE.Object3D) => {
  let k = 0;
  root.traverseVisible((o) => (o as THREE.Mesh).isMesh && k++);
  return k;
};

const cube = () => cachedGeo('test:merge:cube', () => new THREE.BoxGeometry(0.2, 0.2, 0.2));
const ball = () => cachedGeo('test:merge:ball', () => new THREE.SphereGeometry(0.1, 6, 4));

function put(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, name = ''): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, 0);
  m.rotation.set(0.3 * x, 0.2 * y, 0.1);
  m.name = name;
  parent.add(m);
  return m;
}

/** A little character: toon and unlit parts of several colours, a named leg group, a mirrored part. */
function doll(): THREE.Group {
  const root = new THREE.Group();
  root.position.set(3, 1, -0.5);
  put(root, cube(), toon(0xd04040), 0, 0.5);
  put(root, ball(), toon(0x3060e0), 0.2, 0.7);
  put(root, ball(), toon(0x40c060), -0.2, 0.7).scale.set(-1, 1, 1);
  put(root, ball(), basic(0xffffff), 0.1, 0.8);
  put(root, cube(), basic(0x1d1424), -0.1, 0.8);
  const inner = new THREE.Group();
  inner.position.set(0, 0.2, 0.1);
  inner.rotation.y = 0.4;
  root.add(inner);
  put(inner, cube(), toon(0xffc000), 0.1, 0);
  const legs = new THREE.Group();
  legs.name = 'legs';
  legs.position.set(0, 0.2, 0);
  root.add(legs);
  put(legs, cube(), toon(0x202020), -0.1, 0);
  put(legs, cube(), toon(0x505050), 0.1, 0);
  return root;
}

describe('static merge', () => {
  it('draws one mesh per material kind and scope, and exactly what was there', () => {
    const d = doll();
    const before = surfaces(d);
    expect(draws(d)).toBe(8);
    M.mergeStatic(d);
    expect(mismatch(before, surfaces(d))).toBeNull();
    // Root: one lit and one unlit mesh; the legs keep their group and draw once.
    expect(draws(d)).toBe(3);
    const legs = d.getObjectByName('legs')!;
    expect(legs.children).toHaveLength(1);
    const lit = legs.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshToonMaterial>;
    expect(lit.material.vertexColors).toBe(true);
    expect(lit.material.color.getHex()).toBe(0xffffff);
    expect(lit.material.gradientMap).toBeTruthy();
    // The unnamed inner group was emptied and dropped.
    expect(d.children.filter((o) => o.type === 'Group')).toEqual([legs]);
  });

  it('bakes linear colours, and a part’s own vertex colours times its (white) material', () => {
    const root = new THREE.Group();
    const gradient = ball().clone();
    const cols = new Float32Array(gradient.getAttribute('position').count * 3).map((_, i) => (i % 3) / 3);
    gradient.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const white = toon(0xffffff);
    white.vertexColors = true;
    put(root, gradient, white, 0, 0);
    put(root, cube(), toon(0x808080), 0.3, 0);
    const before = surfaces(root);
    M.mergeStatic(root);
    expect(mismatch(before, surfaces(root))).toBeNull();
    const merged = root.children[0] as THREE.Mesh;
    const tint = merged.geometry.userData.tint as Merge.TintGroup[];
    expect(tint).toHaveLength(2);
    // sRGB 0x80 is 0.2158 in linear light, which is what the vertices carry.
    expect(tint[1].color[0]).toBeCloseTo(new THREE.Color(0x808080).r, 6);
    expect(tint[1].color[0]).toBeCloseTo(0.2158, 3);
    expect(tint.map((t) => t.ranges.map(([, , own]) => own))).toEqual([[1], [0]]);
    const total = tint.flatMap((t) => t.ranges).reduce((s, [, count]) => s + count, 0);
    expect(total).toBe(merged.geometry.getAttribute('position').count);
  });

  it('keeps what the engine or an animation can reach', () => {
    const root = new THREE.Group();
    const bodyMat = toon(0x3a7bd5);
    const body = put(root, cube(), bodyMat, 0, 0.5, 'body');
    inkOutline(body, 0.02);
    const sharesBody = put(root, ball(), bodyMat, 0.3, 0.5);
    const sharesBodyToo = put(root, ball(), bodyMat, -0.3, 0.5);
    const glow = toon(0x806040);
    glow.userData.glow = true;
    put(root, ball(), glow, 0, 0.9);
    const hidden = put(root, cube(), toon(0x00ff00), 0, 1.2);
    hidden.visible = false;
    const hiddenMat = hidden.material as THREE.Material;
    put(root, ball(), hiddenMat, 0.2, 1.2);
    put(root, ball(), toon(0xffffff, 0x604000), 0.4, 1.2);
    const sheet = () => Object.assign(basic(0xf0f0ff, 0.5), { depthWrite: false });
    put(root, ball(), sheet(), 0.1, 0);
    put(root, ball(), sheet(), -0.1, 0);
    put(root, ball(), basic(0xff0000, 0.5), 0.2, 0);
    put(root, ball(), toon(0x123456), 0.5, 0);
    put(root, ball(), toon(0x654321), 0.6, 0);
    const before = surfaces(root);
    M.mergeStatic(root);
    expect(mismatch(before, surfaces(root))).toBeNull();
    // The named body and its outline hull stay as they are.
    expect(root.getObjectByName('body')).toBe(body);
    expect(body.getObjectByName('outline')).toBeDefined();
    // Parts sharing the body's material merge into one mesh that keeps it (the engine tints it).
    expect(sharesBody.parent).toBeNull();
    expect(sharesBodyToo.parent).toBeNull();
    const meshes = root.children.filter((o) => (o as THREE.Mesh).isMesh) as THREE.Mesh[];
    expect(meshes.filter((m) => m.material === bodyMat)).toHaveLength(2);
    // The glow material and the hidden part's material (the engine may show it) are never painted over.
    expect(meshes.some((m) => m.material === glow)).toBe(true);
    expect(meshes.some((m) => m.material === hiddenMat && m.visible)).toBe(true);
    expect(hidden.parent).toBe(root);
    // See-through parts merge only with look-alikes, keeping the first one's material.
    const clear = meshes.filter((m) => (m.material as THREE.Material).transparent);
    expect(clear.map((m) => (m.material as THREE.MeshBasicMaterial).color.getHex()).sort()).toEqual([0xf0f0ff, 0xff0000]);
    // A glowing part is its own kind: the two plain toon parts merge, the emissive one does not.
    const painted = meshes.filter((m) => (m.material as THREE.Material).userData.baked);
    expect(painted).toHaveLength(1);
    expect((painted[0].material as THREE.MeshToonMaterial).emissive.getHex()).toBe(0);
  });

  it('caches merged geometry for cached parts, but gives every copy its own materials', () => {
    const a = doll();
    const b = doll();
    M.mergeStatic(a);
    M.mergeStatic(b);
    const meshes = (o: THREE.Object3D) => {
      const out: THREE.Mesh[] = [];
      o.traverse((m) => (m as THREE.Mesh).isMesh && out.push(m as THREE.Mesh));
      return out;
    };
    const [ma, mb] = [meshes(a), meshes(b)];
    expect(ma.map((m) => m.geometry)).toEqual(mb.map((m) => m.geometry));
    for (const m of ma) expect(m.geometry.userData.shared).toBe(true);
    for (let i = 0; i < ma.length; i++) expect(ma[i].material).not.toBe(mb[i].material);
    // A part with its own (uncached) geometry makes a merged geometry that level teardown frees.
    const c = doll();
    put(c, new THREE.BoxGeometry(0.1, 0.1, 0.1), toon(0x00ffff), 0.5, 0.5);
    M.mergeStatic(c);
    expect(meshes(c).some((m) => !m.geometry.userData.shared)).toBe(true);
  });

  it('flattens a look-alike copy into its scopes, outlines and named parts included', () => {
    const root = new THREE.Group();
    const pose = new THREE.Group();
    pose.name = 'pose';
    root.add(pose);
    const body = put(pose, cube(), toon(0x3a7bd5), 0, 0.5, 'body');
    inkOutline(body, 0.02);
    const tail = new THREE.Group();
    tail.name = 'tail';
    tail.position.set(0, 0.3, -0.3);
    pose.add(tail);
    put(tail, ball(), toon(0xff8000), 0, 0);
    const legL = new THREE.Group();
    legL.name = 'legL';
    pose.add(legL);
    put(legL, cube(), toon(0x202020), 0, 0.1);
    // An eye scope parented to a merged mesh survives, in place.
    const eye = new THREE.Group();
    eye.name = 'eye';
    eye.position.set(0, 0.1, 0.1);
    body.add(eye);
    put(eye, ball(), basic(0xffffff), 0, 0);
    const eyeAt = eye.getWorldPosition(new THREE.Vector3());
    const before = surfaces(root);
    M.mergeStatic(root, { copy: true, scope: (o) => ['pose', 'legL', 'eye'].includes(o.name) });
    expect(mismatch(before, surfaces(root))).toBeNull();
    expect(root.getObjectByName('body')).toBeUndefined();
    expect(root.getObjectByName('tail')).toBeUndefined();
    expect(root.getObjectByName('legL')!.parent).toBe(pose);
    expect(root.getObjectByName('eye')!.getWorldPosition(new THREE.Vector3()).distanceTo(eyeAt)).toBeLessThan(1e-6);
    // Body and tail in one lit mesh, the hull in one unlit one, then the leg and the eye.
    expect(draws(root)).toBe(4);
  });

  it('draws exactly what each real cast mesh was built with: every enemy, boss, mascot and friend', () => {
    /** Builds with the merge off, returning the meshes and the options their builder merges with. */
    const unmerged = <T>(make: () => T): [T, Merge.MergeOptions | undefined] => {
      flags.__noMerge = true;
      try {
        return [make(), flags.__lastOpts];
      } finally {
        flags.__noMerge = false;
      }
    };
    const cases: [string, THREE.Object3D, Merge.MergeOptions | undefined][] = [
      ...unmerged(() => E.enemyGallery())[0].map(({ name, mesh }) => [name, mesh, undefined] as [string, THREE.Object3D, undefined]),
      ...[...ROSTER.map((c) => () => C.makeCharacter(c)), () => C.makeHelper(), () => C.makeGhost4o()].map((make) => {
        const [mesh, opts] = unmerged(make);
        return [mesh.userData.plan as string, mesh, opts] as [string, THREE.Object3D, Merge.MergeOptions | undefined];
      }),
    ];
    for (const [name, mesh, opts] of cases) {
      const before = surfaces(mesh);
      const n = draws(mesh);
      M.mergeStatic(mesh, opts);
      expect(mismatch(before, surfaces(mesh)), name).toBeNull();
      expect(draws(mesh), name).toBeLessThanOrEqual(n);
    }
    // The viral crowd merges person by person (each one moves on its own).
    const [crowd] = unmerged(() => C.makeCrowd(6));
    const before = surfaces(crowd);
    for (const person of crowd.children) M.mergeStatic(person);
    expect(mismatch(before, surfaces(crowd))).toBeNull();
    expect(draws(crowd)).toBe(6);
  });
});
