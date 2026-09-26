import * as THREE from 'three';
import { shared } from './meshes';

/**
 * The toon kit shared by the character and enemy meshes, so both casts are drawn in one style:
 * three-band toon shading, big glossy eyes, soft rounded boxes and ink outlines.
 *
 * Materials are always new instances (the engine fades and tints them one mesh at a time); only
 * geometry and the ramp texture are shared across levels.
 */

/** Warm near-black for pupils, mouths, brows and outlines. */
export const INK = 0x1d1424;

/** The three-band toon ramp. Shared: level teardown must never free it. */
export const RAMP = (() => {
  const data = new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  t.userData.shared = true;
  return t;
})();

/**
 * A new toon material. With no emissive colour the intensity defaults to 1, so a later
 * `emissive.setHex()` from the engine (hit flashes, invincibility) actually shows.
 */
export const toon = (color: number, emissive = 0, intensity = emissive ? 0.35 : 1) =>
  new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity: intensity, gradientMap: RAMP });

/** A new unlit material, for sclera, pupils, highlights, LEDs and glows that must pop in dim castles. */
export const basic = (color: number, opacity?: number) =>
  new THREE.MeshBasicMaterial(
    opacity !== undefined && opacity < 1 ? { color, transparent: true, opacity } : { color },
  );

const geoCache = new Map<string, THREE.BufferGeometry>();

/** One cached geometry per key, marked shared so level teardown leaves it alone. */
export function cachedGeo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) {
    g = shared(make());
    geoCache.set(key, g);
  }
  return g as T;
}

const sphere = (r: number, w: number, h: number, phiStart = 0, phiLen = Math.PI * 2, thetaStart = 0, thetaLen = Math.PI) =>
  cachedGeo(`sphere:${r}:${w}:${h}:${phiStart}:${phiLen}:${thetaStart}:${thetaLen}`, () =>
    new THREE.SphereGeometry(r, w, h, phiStart, phiLen, thetaStart, thetaLen),
  );

export type LidShape = 'none' | 'angry' | 'sly' | 'stern' | 'sleepy';

export interface EyeOptions {
  /** Iris colour; INK gives a plain black pupil. */
  iris?: number;
  lid?: LidShape;
  /** Eyelid colour, usually the skin or body colour. */
  lidColor?: number;
  /** +1 for the eye on the character's right (screen left when facing the camera), -1 for the other. */
  side?: 1 | -1;
  /** Where the iris looks, in -1..1 on x and y. */
  look?: [number, number];
}

/**
 * A glossy cartoon eye centred on its own origin and facing +z. Sit it so the sclera stands about
 * 0.3r proud of the surface behind it. Highlights sit upper left, towards the scene's sun.
 */
export function makeEye(r: number, opts: EyeOptions = {}): THREE.Group {
  const { iris = INK, lid = 'none', lidColor = 0xffffff, side = 1, look = [0, 0] } = opts;
  const eye = new THREE.Group();
  const sclera = new THREE.Mesh(sphere(r, 14, 10), basic(0xffffff));
  sclera.scale.z = 0.6;
  eye.add(sclera);
  const irisMesh = new THREE.Mesh(sphere(0.55 * r, 12, 8), basic(iris));
  irisMesh.scale.z = 0.35;
  irisMesh.position.set(look[0] * 0.3 * r, look[1] * 0.3 * r, 0.5 * r);
  eye.add(irisMesh);
  if (iris !== INK) {
    const pupil = new THREE.Mesh(sphere(0.28 * r, 10, 8), basic(INK));
    pupil.scale.z = 0.35;
    pupil.position.set(look[0] * 0.3 * r, look[1] * 0.3 * r, 0.6 * r);
    eye.add(pupil);
  }
  const glint = new THREE.Mesh(sphere(0.2 * r, 8, 6), basic(0xffffff));
  glint.position.set(-0.22 * r + look[0] * 0.3 * r, 0.25 * r + look[1] * 0.3 * r, 0.68 * r);
  eye.add(glint);
  const dot = new THREE.Mesh(sphere(0.1 * r, 6, 4), basic(0xffffff));
  dot.position.set(0.16 * r + look[0] * 0.3 * r, -0.14 * r + look[1] * 0.3 * r, 0.66 * r);
  eye.add(dot);
  if (lid !== 'none') {
    const cap = new THREE.Mesh(sphere(1.08 * r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(lidColor));
    cap.scale.z = 0.65;
    const tilt = { angry: 0.45, sly: 0.85, stern: 0.6, sleepy: 1.05 }[lid];
    cap.rotation.x = tilt;
    if (lid === 'angry') cap.rotation.z = -side * 0.35;
    eye.add(cap);
  }
  return eye;
}

/** An ink eyebrow of width w; tilt it with rotation.z. */
export function brow(w: number): THREE.Mesh {
  return new THREE.Mesh(cachedGeo(`brow:${w}`, () => new THREE.BoxGeometry(w, 0.22 * w, 0.2 * w)), basic(INK));
}

/**
 * A box with soft rounded edges whose outer size is exactly w×h×d and which is centred on its
 * origin. The bevel catches a toon highlight band. Cached: the geometry is shared.
 */
export function roundedBox(w: number, h: number, d: number, r: number, b = 0.05): THREE.BufferGeometry {
  return cachedGeo(`rbox:${w}:${h}:${d}:${r}:${b}`, () => {
    const iw = w - 2 * b;
    const ih = h - 2 * b;
    const rr = Math.min(r, iw / 2, ih / 2);
    const s = new THREE.Shape();
    s.moveTo(-iw / 2 + rr, -ih / 2);
    s.lineTo(iw / 2 - rr, -ih / 2);
    s.quadraticCurveTo(iw / 2, -ih / 2, iw / 2, -ih / 2 + rr);
    s.lineTo(iw / 2, ih / 2 - rr);
    s.quadraticCurveTo(iw / 2, ih / 2, iw / 2 - rr, ih / 2);
    s.lineTo(-iw / 2 + rr, ih / 2);
    s.quadraticCurveTo(-iw / 2, ih / 2, -iw / 2, ih / 2 - rr);
    s.lineTo(-iw / 2, -ih / 2 + rr);
    s.quadraticCurveTo(-iw / 2, -ih / 2, -iw / 2 + rr, -ih / 2);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: Math.max(0.001, d - 2 * b),
      bevelEnabled: true,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: 2,
      curveSegments: 5,
    });
    g.center();
    return g;
  });
}

/**
 * An inverted-hull ink outline: a back-face child sharing the mesh's geometry, scaled out by t on
 * every side. Use it on one or two closed, opaque hero parts; never on transparent or fading meshes
 * or thin tubes. Returns the outline mesh (it is already added to `mesh`).
 */
export function inkOutline(mesh: THREE.Mesh, t: number, color = INK): THREE.Mesh {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const box = geo.boundingBox as THREE.Box3;
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const scale = new THREE.Vector3(
    1 + (2 * t) / Math.max(1e-4, size.x * Math.abs(mesh.scale.x)),
    1 + (2 * t) / Math.max(1e-4, size.y * Math.abs(mesh.scale.y)),
    1 + (2 * t) / Math.max(1e-4, size.z * Math.abs(mesh.scale.z)),
  );
  const hull = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
  hull.name = 'outline';
  hull.scale.copy(scale);
  hull.position.set(centre.x * (1 - scale.x), centre.y * (1 - scale.y), centre.z * (1 - scale.z));
  mesh.add(hull);
  return hull;
}
