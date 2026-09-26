import * as THREE from 'three';
import { shared } from './shared';
import { cachedGeo } from './toonKit';

/**
 * Shared art helpers for the "scale model" look: soft (mipmapped) canvas textures with a theme-scoped
 * cache, the 2×2 tile atlas layout, planar atlas UVs and the toy-block geometries.
 * Nothing here runs at module load, so importing it never touches the DOM or other modules' state.
 */

export { css, hash01, mixHex, shade } from './palette';

export type Paint = (c: CanvasRenderingContext2D, w: number, h: number) => void;
/** 'theme' textures are dropped whenever the level theme changes (see tileArt.useTheme). */
export type TexScope = 'global' | 'theme';

/** Set once per level by LevelView: 4 on desktop, 1 on touch. */
export const artOptions = { anisotropy: 4 };

/** A new (uncached, unshared) soft canvas texture: sRGB, linear filtering with mipmaps. */
export function paintTexture(w: number, h: number, paint: Paint): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext('2d')!, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = artOptions.anisotropy;
  return tex;
}

const caches: Record<TexScope, Map<string, THREE.CanvasTexture>> = { global: new Map(), theme: new Map() };

/**
 * A cached soft canvas texture, marked shared so level teardown keeps it (a retry neither repaints
 * nor re-uploads). The key must identify everything the painter bakes in, colours included.
 */
export function softTexture(key: string, w: number, h: number, paint: Paint, scope: TexScope = 'global'): THREE.CanvasTexture {
  const cache = caches[scope];
  let tex = cache.get(key);
  if (!tex) {
    tex = shared(paintTexture(w, h, paint));
    cache.set(key, tex);
  }
  return tex;
}

/** Frees every 'theme'-scope texture (the previous level's scene must already be torn down). */
export function evictThemeTextures(): void {
  for (const tex of caches.theme.values()) tex.dispose();
  caches.theme.clear();
}

/** A UV rectangle [u0, v0, u1, v1]. */
export type Rect = readonly [number, number, number, number];

/**
 * The four 64 px cells of a 128 px tile atlas, inset 2 px against mip bleeding. In canvas terms F is
 * the top-left cell, T top-right, S bottom-left and U bottom-right.
 */
export const CELL = {
  F: [0.0156, 0.5156, 0.4844, 0.9844] as Rect,
  T: [0.5156, 0.5156, 0.9844, 0.9844] as Rect,
  S: [0.0156, 0.0156, 0.4844, 0.4844] as Rect,
  U: [0.5156, 0.0156, 0.9844, 0.4844] as Rect,
  FULL: [0, 0, 1, 1] as Rect,
};

export interface AtlasRects {
  front: Rect;
  top: Rect;
  side: Rect;
  bottom: Rect;
}

const TILE_RECTS: AtlasRects = { front: CELL.F, top: CELL.T, side: CELL.S, bottom: CELL.U };

/**
 * Rewrites uv by planar projection over the geometry's bounding box. Each vertex picks its face class
 * from the dominant axis of its normal: ±z front (mirrored on the back so it reads the same), +y top
 * (the front edge at the rect's bottom), −y bottom, ±x sides. Pass one Rect to use it on every face.
 * Mutates and returns `geo`: clone cached geometry first.
 */
export function atlasUV<G extends THREE.BufferGeometry>(geo: G, rects: AtlasRects | Rect = TILE_RECTS): G {
  const r: AtlasRects = Array.isArray(rects) ? { front: rects as Rect, top: rects as Rect, side: rects as Rect, bottom: rects as Rect } : (rects as AtlasRects);
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox!;
  const sx = Math.max(1e-6, max.x - min.x);
  const sy = Math.max(1e-6, max.y - min.y);
  const sz = Math.max(1e-6, max.z - min.z);
  const pos = geo.getAttribute('position');
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const nrm = geo.getAttribute('normal');
  let uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv || uv.count !== pos.count) {
    uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    geo.setAttribute('uv', uv);
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = nrm.getX(i);
    const ny = nrm.getY(i);
    const nz = nrm.getZ(i);
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);
    let rect: Rect;
    let a: number;
    let b: number;
    if (az >= ax && az >= ay) {
      rect = r.front;
      a = (x - min.x) / sx;
      if (nz < 0) a = 1 - a;
      b = (y - min.y) / sy;
    } else if (ay >= ax) {
      rect = ny > 0 ? r.top : r.bottom;
      a = (x - min.x) / sx;
      b = (max.z - z) / sz;
    } else {
      rect = r.side;
      a = nx > 0 ? (max.z - z) / sz : (z - min.z) / sz;
      b = (y - min.y) / sy;
    }
    uv.setXY(i, rect[0] + a * (rect[2] - rect[0]), rect[1] + b * (rect[3] - rect[1]));
  }
  uv.needsUpdate = true;
  return geo;
}

function extrudedBlock(shape: THREE.Shape, bevel: number, bevelSegments: number, curveSegments: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 1.2 - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
    curveSegments,
  });
  g.center();
  return atlasUV(g);
}

/**
 * A 1×1×1.2 toy block with one flat chamfer on every edge (28 triangles), atlas-mapped {F, T, S, U}.
 * Cached and shared.
 */
export function chamferBox(c = 0.06): THREE.BufferGeometry {
  return cachedGeo(`chamferBox:${c}`, () => {
    const h = 0.5 - c;
    const s = new THREE.Shape();
    s.moveTo(-h, -h);
    s.lineTo(h, -h);
    s.lineTo(h, h);
    s.lineTo(-h, h);
    s.lineTo(-h, -h);
    return extrudedBlock(s, c, 1, 1);
  });
}

/** The prompt block: a 1×1×1.2 block with rounded corners and a soft bevel, atlas-mapped. Cached. */
export function roundBlock(): THREE.BufferGeometry {
  return cachedGeo('roundBlock', () => {
    const b = 0.08;
    const h = 0.5 - b;
    const r = 0.12;
    const s = new THREE.Shape();
    s.moveTo(-h + r, -h);
    s.lineTo(h - r, -h);
    s.quadraticCurveTo(h, -h, h, -h + r);
    s.lineTo(h, h - r);
    s.quadraticCurveTo(h, h, h - r, h);
    s.lineTo(-h + r, h);
    s.quadraticCurveTo(-h, h, -h, h - r);
    s.lineTo(-h, -h + r);
    s.quadraticCurveTo(-h, -h, -h + r, -h);
    return extrudedBlock(s, b, 2, 3);
  });
}
