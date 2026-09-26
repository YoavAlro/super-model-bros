import * as THREE from 'three';
import { INK, cachedGeo, makeEye, toon, type EyeOptions } from './toonKit';

/**
 * Helpers for the enemy and boss meshes, on top of the shared toon kit: cached primitive
 * geometry, placement, cached canvas textures and a few 2D shapes. The static-merge pass that keeps
 * a detailed enemy's draw calls low lives in `staticMerge.ts`, shared with the mascots.
 */

const TAU = Math.PI * 2;

/** Cached primitives. Same arguments, same geometry: level teardown never frees them. */
export const geo = {
  sphere: (r: number, w = 12, h = 8, phiStart = 0, phiLen = TAU, thetaStart = 0, thetaLen = Math.PI) =>
    cachedGeo(`sphere:${r}:${w}:${h}:${phiStart}:${phiLen}:${thetaStart}:${thetaLen}`, () =>
      new THREE.SphereGeometry(r, w, h, phiStart, phiLen, thetaStart, thetaLen),
    ),
  box: (w: number, h: number, d: number) => cachedGeo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rTop: number, rBottom: number, h: number, seg = 12, open = false, thetaStart = 0, thetaLen = TAU) =>
    cachedGeo(`cyl:${rTop}:${rBottom}:${h}:${seg}:${open}:${thetaStart}:${thetaLen}`, () =>
      new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open, thetaStart, thetaLen),
    ),
  cone: (r: number, h: number, seg = 8, open = false) =>
    cachedGeo(`cone:${r}:${h}:${seg}:${open}`, () => new THREE.ConeGeometry(r, h, seg, 1, open)),
  torus: (r: number, tube: number, radial = 8, tubular = 16, arc = TAU) =>
    cachedGeo(`torus:${r}:${tube}:${radial}:${tubular}:${arc}`, () => new THREE.TorusGeometry(r, tube, radial, tubular, arc)),
  capsule: (r: number, len: number, capSeg = 4, radial = 8) =>
    cachedGeo(`capsule:${r}:${len}:${capSeg}:${radial}`, () => new THREE.CapsuleGeometry(r, len, capSeg, radial)),
  plane: (w: number, h: number) => cachedGeo(`plane:${w}:${h}`, () => new THREE.PlaneGeometry(w, h)),
  circle: (r: number, seg = 16, thetaStart = 0, thetaLen = TAU) =>
    cachedGeo(`circle:${r}:${seg}:${thetaStart}:${thetaLen}`, () => new THREE.CircleGeometry(r, seg, thetaStart, thetaLen)),
  ico: (r: number, detail = 0) => cachedGeo(`ico:${r}:${detail}`, () => new THREE.IcosahedronGeometry(r, detail)),
  oct: (r: number) => cachedGeo(`oct:${r}`, () => new THREE.OctahedronGeometry(r)),
};

/** A flat shape extruded along +z, cached under `key`. `center` recentres the result on its origin. */
export function extruded(key: string, make: () => THREE.Shape, opts: THREE.ExtrudeGeometryOptions, center = false): THREE.BufferGeometry {
  return cachedGeo(`extrude:${key}`, () => {
    const g = new THREE.ExtrudeGeometry(make(), { curveSegments: 8, ...opts });
    if (center) g.center();
    return g;
  });
}

/** A closed polygon shape. */
export function polygon(points: [number, number][]): THREE.Shape {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

/** Points around a circle, alternating between radii: stars, bursts and gears. */
export function radialPoints(n: number, radius: (i: number) => number, start = Math.PI / 2): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = start + (i / n) * TAU;
    return [Math.cos(a) * radius(i), Math.sin(a) * radius(i)];
  });
}

/** Adds a mesh to `parent` at (x, y, z) and returns it. */
export function add(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** Adds any object to `parent` at (x, y, z) and returns it. */
export function place<T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, x = 0, y = 0, z = 0): T {
  obj.position.set(x, y, z);
  parent.add(obj);
  return obj;
}

/** A new toon material with a texture (a white or pale `color` shows the texture as drawn). */
export function toonMap(color: number, map: THREE.Texture): THREE.MeshToonMaterial {
  const m = toon(color);
  m.map = map;
  return m;
}

/** A new two-sided toon material, for open shells (bells, bands, hoppers). */
export function toon2(color: number, emissive = 0, intensity?: number): THREE.MeshToonMaterial {
  const m = toon(color, emissive, intensity);
  m.side = THREE.DoubleSide;
  return m;
}

/**
 * How far in front of an ellipsoid's centre its surface is at (x, y): place a face part at
 * `cz + surfaceZ(...) + lift` to sit it just proud of a round body.
 */
export function surfaceZ(x: number, y: number, cx: number, cy: number, rx: number, ry: number, rz: number): number {
  const k = 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2;
  return rz * Math.sqrt(Math.max(0, k));
}

/**
 * A toon-kit eye. `lidMaterial` swaps the eyelid's material, so the lid can match a body that has
 * an emissive floor (the kit's lid is a plain toon of `lidColor`); `lidTilt` overrides how far the
 * lid comes down (the kit's rotation.x for that lid shape).
 */
export function eye(r: number, opts: EyeOptions & { lidMaterial?: THREE.Material; lidTilt?: number } = {}): THREE.Group {
  const e = makeEye(r, opts);
  const lid = e.children.find((c) => (c as THREE.Mesh).material instanceof THREE.MeshToonMaterial) as THREE.Mesh | undefined;
  if (lid && opts.lidMaterial) lid.material = opts.lidMaterial;
  if (lid && opts.lidTilt !== undefined) {
    lid.rotation.x = opts.lidTilt;
    // The kit's cap is only just deeper than the sclera. Tilted back past the kit's shallowest lid
    // (angry, 0.45) its upper face swings into the sclera, which then shows through its facets as a
    // white sawtooth; a deeper cap keeps clear of it.
    if (opts.lidTilt < 0.45) lid.scale.z = 0.85;
  }
  return e;
}

/** The eye's big highlight (the kit's 0.2r glint), so a design can swap it for another shape. */
export function eyeGlint(e: THREE.Group, r: number): THREE.Mesh | undefined {
  return e.children.find((c) => {
    const p = ((c as THREE.Mesh).geometry as THREE.SphereGeometry | undefined)?.parameters;
    return p !== undefined && Math.abs(p.radius - 0.2 * r) < 1e-6;
  }) as THREE.Mesh | undefined;
}

/**
 * Side for makeEye from the eye's x: the eye at negative x is the character's right (+1).
 */
export const sideOf = (x: number): 1 | -1 => (x < 0 ? 1 : -1);

const textures = new Map<string, THREE.CanvasTexture>();

/**
 * A cached canvas texture of any size up to 128 px, marked shared so level teardown never frees
 * it (materials that use it stay per-instance). Linear filtering by default; `nearest` keeps LED
 * pixels crisp.
 */
export function sharedTexture(
  key: string,
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D, w: number, h: number) => void,
  nearest = false,
): THREE.CanvasTexture {
  let t = textures.get(key);
  if (!t) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext('2d')!, w, h);
    t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.userData.shared = true;
    textures.set(key, t);
  }
  return t;
}

/** Diagonal yellow and ink hazard stripes, repeating `repeat` times across a face. */
export function hazardTexture(repeat: number): THREE.CanvasTexture {
  const t = sharedTexture(`hazard:${repeat}`, 64, 64, (c, s) => {
    c.fillStyle = '#ffc83a';
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#1b1426';
    for (let k = -2; k < 3; k++) {
      c.beginPath();
      c.moveTo(k * 32, s);
      c.lineTo(k * 32 + 16, s);
      c.lineTo(k * 32 + 16 + s, 0);
      c.lineTo(k * 32 + s, 0);
      c.closePath();
      c.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, 1);
  return t;
}

/** Faint lines of text on white, for junk mail and scrolls. `ink` sets the line colour. */
export function linesTexture(key: string, size: number, lines: number, ink = 'rgba(40,30,50,0.55)'): THREE.CanvasTexture {
  return sharedTexture(`lines:${key}`, size, size, (c, s) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, s, s);
    c.fillStyle = ink;
    const step = s / (lines + 1);
    for (let i = 1; i <= lines; i++) {
      const w = s * (i % 3 === 0 ? 0.5 : 0.78);
      c.fillRect(s * 0.12, i * step - s * 0.03, w, Math.max(2, s * 0.06));
    }
  });
}

/** Inverted-hull outline on the sides only (x and z), for parts whose top and bottom must stay exact. */
export function sideOutline(mesh: THREE.Mesh, t: number): THREE.Mesh {
  const g = mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const size = g.boundingBox!.getSize(new THREE.Vector3());
  const hull = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  hull.name = 'outline';
  hull.scale.set(1 + (2 * t) / size.x, 1, 1 + (2 * t) / size.z);
  mesh.add(hull);
  return hull;
}
