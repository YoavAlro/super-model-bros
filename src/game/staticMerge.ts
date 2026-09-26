import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cachedGeo } from './toonKit';

/**
 * The static-merge pass shared by the enemy, boss and mascot meshes: it folds the parts of a built
 * mesh tree that never move on their own into a few draw calls, so a detailed character costs a
 * handful of draws instead of dozens.
 *
 * Parts merge only within their nearest scope (by default a named object: `legs`, `jaw`, `eye`,
 * `armL`, ...), which keeps its own transform so the engine and the idle animations can still move
 * or hide it. Within a scope, opaque parts of the same material *kind* (lit toon, unlit, one
 * texture; same emissive, sidedness and blending) merge into one mesh even when their colours
 * differ: each part's colour is baked into a vertex colour attribute and drawn with one white,
 * vertex-coloured copy of the kind's material. The star rainbow (`starTint.ts`) repaints those
 * baked colours part by part (the geometry's `userData.tint`).
 *
 * What never merges: named meshes and outline hulls (and their hosts). What never moves to a new
 * material: a part whose material the engine can reach some other way (a named or hidden mesh also
 * uses it, or the player glows it: `userData.glow`); such parts merge only with parts sharing that
 * very material, keeping it. See-through parts (fades, sheets) merge only with look-alikes of the
 * same colour and settings, keeping the first one's material.
 */

type Surface = THREE.Material & {
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  map?: THREE.Texture | null;
  gradientMap?: THREE.Texture | null;
  emissiveMap?: THREE.Texture | null;
  alphaMap?: THREE.Texture | null;
  wireframe?: boolean;
  flatShading?: boolean;
  fog?: boolean;
};

/** Everything about a material that decides how it draws, except its colour. */
export function kindOf(m: THREE.Material): string {
  const a = m as Surface;
  return [
    m.type,
    a.emissive?.getHex(),
    a.emissiveIntensity,
    m.side,
    m.transparent,
    m.opacity,
    m.depthWrite,
    m.depthTest,
    m.polygonOffset,
    m.polygonOffsetFactor,
    m.polygonOffsetUnits,
    m.blending,
    m.alphaTest,
    m.toneMapped,
    a.wireframe,
    a.flatShading,
    a.fog,
    a.map?.uuid,
    a.gradientMap?.uuid,
    a.emissiveMap?.uuid,
    a.alphaMap?.uuid,
  ].join('|');
}

/** The material kind plus its colour and vertex colouring: parts that match look exactly alike. */
const lookOf = (m: THREE.Material) => `${kindOf(m)}|${(m as Surface).color?.getHex()}|${m.vertexColors}`;

/**
 * A colour baked into a merged geometry (one per source material), for the star rainbow: which
 * vertices carry it, the part's own colour, and where that part sat in the merged mesh's space.
 */
export interface TintGroup {
  /** The material's own colour, linear RGB (what `THREE.Color` stores). */
  color: [number, number, number];
  /** The origin of the group's first part, in the merged mesh's space. */
  at: [number, number, number];
  /**
   * Vertex ranges [start, count, own]. `own` is 1 when the part brought its own vertex colours
   * (a gradient on a white material): those are tinted by multiplying, as the material was.
   */
  ranges: [number, number, 0 | 1][];
}

export interface MergeOptions {
  /** The objects that keep their own transform (parts merge only with others in the same one). Default: every named object. */
  scope?: (o: THREE.Object3D) => boolean;
  /**
   * A static copy (a crowd extra or a cameo, never a player): named meshes, outline hulls and their
   * hosts merge too, and the player's glow materials are just colours. Only the scopes still move.
   */
  copy?: boolean;
}

interface Piece {
  geometry: THREE.BufferGeometry;
  /** Where the part sits in the merged mesh's space. */
  rel: THREE.Matrix4;
  /** Bake this colour (times the part's own vertex colours) into a colour attribute. */
  color?: THREE.Color;
  /** Which source material it came from (the tint group). */
  group?: number;
  /** The part's material draws its geometry's own vertex colours. */
  own?: boolean;
}

/** What the merged geometry does with vertex colours: none, keep the parts' own, or bake each part's colour in. */
type ColorMode = 'drop' | 'keep' | 'bake';

const ATTRS = ['position', 'normal', 'uv'];

/** One geometry from many parts, each moved into the merged mesh's space by its `rel`. */
export function bake(pieces: Piece[], mode: ColorMode): THREE.BufferGeometry {
  const groups: TintGroup[] = [];
  let start = 0;
  const ready = pieces.map(({ geometry, rel, color, group, own: useOwn }) => {
    const g = geometry.clone();
    g.userData = {};
    g.clearGroups();
    g.morphAttributes = {};
    const n = g.attributes.position.count;
    const own = useOwn ? (g.getAttribute('color') as THREE.BufferAttribute | undefined) : undefined;
    const colors = mode === 'drop' ? null : new Float32Array(n * 3);
    if (colors) {
      const c = mode === 'bake' ? color! : null;
      for (let i = 0; i < n; i++) {
        colors[i * 3] = (own ? own.getX(i) : 1) * (c ? c.r : 1);
        colors[i * 3 + 1] = (own ? own.getY(i) : 1) * (c ? c.g : 1);
        colors[i * 3 + 2] = (own ? own.getZ(i) : 1) * (c ? c.b : 1);
      }
    }
    for (const name of Object.keys(g.attributes)) if (!ATTRS.includes(name)) g.deleteAttribute(name);
    if (colors) g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    g.applyMatrix4(rel);
    if (!g.index) g.setIndex(Array.from({ length: n }, (_, i) => i));
    if (rel.determinant() < 0) {
      // A mirrored part: flip each triangle's winding so its faces still point out.
      const idx = g.index!;
      for (let i = 0; i < idx.count; i += 3) {
        const b = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, b);
      }
    }
    if (mode === 'bake') {
      const t = (groups[group!] ??= { color: [color!.r, color!.g, color!.b], at: [rel.elements[12], rel.elements[13], rel.elements[14]], ranges: [] });
      t.ranges.push([start, n, own ? 1 : 0]);
    }
    start += n;
    return g;
  });
  const merged = mergeGeometries(ready, false);
  for (const g of ready) g.dispose();
  if (!merged) throw new Error('mergeStatic: incompatible parts');
  merged.userData = mode === 'bake' ? { tint: groups } : {};
  return merged;
}

/** A white, vertex-coloured copy of a part's material: the one material of a merged kind. */
function painted(m: THREE.Material): THREE.Material {
  const p = m.clone() as Surface;
  p.color!.setRGB(1, 1, 1);
  p.vertexColors = true;
  p.userData = { baked: true };
  return p;
}

const WHITE = new THREE.Color(1, 1, 1);

/**
 * Merges the static parts of a mesh tree into as few meshes as the rules above allow. Run it once a
 * mesh is built and before it is rendered or animated (the dropped parts were never uploaded, and
 * the idle animations record their rest poses on first use). Merged geometry is cached when every
 * part's geometry is; materials stay per-instance.
 */
export function mergeStatic(root: THREE.Object3D, opts: MergeOptions = {}): void {
  const isScope = opts.scope ?? ((o: THREE.Object3D) => o.name !== '');
  const copy = !!opts.copy;
  root.updateMatrixWorld(true);
  const scopes = new Map<THREE.Object3D, THREE.Mesh[]>();
  /** Materials the engine can reach through a mesh that stays as it is. */
  const kept = new Set<THREE.Material>();
  const keepAll = (o: THREE.Object3D) =>
    o.traverse((d) => {
      const m = (d as THREE.Mesh).material;
      if (m) for (const x of Array.isArray(m) ? m : [m]) kept.add(x);
    });
  const visit = (o: THREE.Object3D, scope: THREE.Object3D) => {
    for (const c of o.children) {
      if (!c.visible) {
        keepAll(c);
        continue;
      }
      const mesh = c as THREE.Mesh;
      const leaf = mesh.isMesh && !Array.isArray(mesh.material) && !isScope(c) && (copy || c.children.length === 0);
      if (leaf) scopes.set(scope, [...(scopes.get(scope) ?? []), mesh]);
      else if (mesh.isMesh) for (const x of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) kept.add(x);
      visit(c, isScope(c) ? c : scope);
    }
  };
  visit(root, root);

  const paintable = (m: Surface) =>
    !m.transparent && m.color instanceof THREE.Color && !kept.has(m) && (copy || !m.userData.glow) && (!m.vertexColors || m.color.equals(WHITE));
  const removed = new Set<THREE.Mesh>();
  const inv = new THREE.Matrix4();
  for (const [scope, meshes] of scopes) {
    inv.copy(scope.matrixWorld).invert();
    const buckets = new Map<string, THREE.Mesh[]>();
    for (const m of meshes) {
      const mat = m.material as Surface;
      // Kind: any colour, painted. Look: see-through, alike to the colour (the old rule). Same: this very material.
      const key = paintable(mat) ? `kind:${kindOf(mat)}` : mat.transparent && !kept.has(mat) && !mat.userData.glow ? `look:${lookOf(mat)}` : `same:${mat.uuid}`;
      buckets.set(key, [...(buckets.get(key) ?? []), m]);
    }
    for (const [key, members] of buckets) {
      if (members.length < 2) continue;
      const first = members[0].material as THREE.Material;
      const bakeColors = key.startsWith('kind:') && members.some((m) => m.material !== first);
      const mode: ColorMode = bakeColors ? 'bake' : first.vertexColors ? 'keep' : 'drop';
      // The merged mesh sits where its first part did, so the star rainbow finds it at that height.
      const rel0 = new THREE.Matrix4().multiplyMatrices(inv, members[0].matrixWorld);
      const t0 = new THREE.Vector3().setFromMatrixPosition(rel0);
      const shift = new THREE.Matrix4().makeTranslation(-t0.x, -t0.y, -t0.z);
      const sources = new Map<THREE.Material, number>();
      const pieces: Piece[] = members.map((m) => {
        const mat = m.material as Surface;
        const group = sources.get(mat) ?? sources.size;
        sources.set(mat, group);
        return { geometry: m.geometry, rel: new THREE.Matrix4().multiplyMatrices(shift, inv).multiply(m.matrixWorld), color: mat.color, group, own: mat.vertexColors };
      });
      const cacheable = pieces.every((p) => p.geometry.userData.shared);
      const id = pieces
        .map((p) => `${p.geometry.uuid}@${p.rel.elements.map((v) => Math.round(v * 1e4)).join(',')}${mode === 'bake' ? `#${p.color!.toArray().map((v) => Math.round(v * 1e6)).join(',')}~${p.group}${p.own ? '*' : ''}` : ''}`)
        .join('|');
      const geometry = cacheable ? cachedGeo(`merged:${mode}:${id}`, () => bake(pieces, mode)) : bake(pieces, mode);
      const merged = new THREE.Mesh(geometry, bakeColors ? painted(first) : first);
      merged.position.copy(t0);
      scope.add(merged);
      for (const m of members) removed.add(m);
    }
  }
  // A merged part's children that stay (a copy's scopes) move up to its nearest remaining ancestor,
  // keeping their place in the world; only then do the merged parts go.
  for (const m of removed) {
    let up = m.parent;
    while (up && removed.has(up as THREE.Mesh)) up = up.parent;
    for (const k of [...m.children]) if (!removed.has(k as THREE.Mesh)) up?.attach(k);
  }
  for (const m of removed) m.removeFromParent();
  prune(root, isScope);
}

/** Drops the groups that merging left empty (scopes stay: the engine or an animation holds them). */
function prune(o: THREE.Object3D, isScope: (o: THREE.Object3D) => boolean): void {
  for (const c of [...o.children]) {
    prune(c, isScope);
    if (c.type === 'Group' && c.children.length === 0 && !isScope(c)) c.removeFromParent();
  }
}
