import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { atlasUV, cachedMat, CELL, easeOutBack, onDraw, paintTexture, softTexture } from './art';
import { fxTexture } from './fx';
import { css, shade } from './palette';
import { prefs } from './prefs';
import { shared } from './shared';
// Only called inside builders, never at module load (toonKit imports ./shared, not this module).
import { basic, cachedGeo, INK, inkOutline, RAMP, roundedBox, toon } from './toonKit';

/** Mesh and texture builders. Every mesh's origin is at its feet, horizontally centered. */

export function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

export const questionTexture = () =>
  canvasTexture(32, (c, s) => {
    c.fillStyle = '#f7b731';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = '#8a4b08';
    c.lineWidth = 3;
    c.strokeRect(1.5, 1.5, s - 3, s - 3);
    c.fillStyle = '#8a4b08';
    for (const [x, y] of [[4, 4], [s - 6, 4], [4, s - 6], [s - 6, s - 6]]) c.fillRect(x, y, 2, 2);
    c.font = 'bold 22px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff4d6';
    c.fillText('?', s / 2, s / 2 + 1);
  });

export const brickTexture = () =>
  canvasTexture(32, (c, s) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#5a2a10';
    for (let y = 0; y < s; y += 8) {
      c.fillRect(0, y, s, 1);
      const off = (y / 8) % 2 === 0 ? 0 : 8;
      for (let x = off; x < s; x += 16) c.fillRect(x, y, 1, 8);
    }
  });

export const groundTexture = (grassTop: boolean) =>
  canvasTexture(32, (c, s) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, s, s);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 18; i++) c.fillRect((i * 13) % s, (i * 7) % s, 2, 2);
    if (grassTop) {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(0, 0, s, 6);
    }
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.strokeRect(0.5, 0.5, s - 1, s - 1);
  });

export const plainTexture = () =>
  canvasTexture(32, (c, s) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = 2;
    c.strokeRect(1, 1, s - 2, s - 2);
  });

/**
 * Conveyor belt ("rubber tread"): cleated rubber with chevrons pointing the way it moves. Not cached:
 * the level view scrolls it and flips repeat.x to mirror it.
 */
export function arrowTexture(dir: 1 | -1): THREE.CanvasTexture {
  const tex = paintTexture(64, 64, (c) => {
    c.fillStyle = '#2c2f38';
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#1a1c22';
    c.fillRect(0, 0, 64, 8);
    c.fillRect(0, 56, 64, 8);
    c.fillStyle = '#3c404a';
    for (let x = 7; x < 64; x += 16) c.fillRect(x, 8, 2, 48);
    c.strokeStyle = '#ffcf3a';
    c.lineWidth = 6;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (const x0 of [16, 48]) {
      c.beginPath();
      c.moveTo(x0 - 6 * dir, 18);
      c.lineTo(x0 + 6 * dir, 32);
      c.lineTo(x0 - 6 * dir, 46);
      c.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Spikes: a row of triangles on a transparent background. */
export const spikeTexture = () =>
  canvasTexture(32, (c, s) => {
    c.clearRect(0, 0, s, s);
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(i * 8, s);
      c.lineTo(i * 8 + 4, 6);
      c.lineTo(i * 8 + 8, s);
      c.fill();
    }
  });

/** A text sprite, e.g. a name tag or a flag label. Height is 1 world unit before scaling. */
export function labelSprite(text: string, color = '#ffffff', background = 'rgba(0,0,0,0.45)'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = '600 40px system-ui, sans-serif';
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 32;
  canvas.width = width;
  canvas.height = 60;
  ctx.font = font;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, 60, 16);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
  sprite.scale.set(width / 60, 1, 1);
  return sprite;
}

export const lambert = (color: number, emissive = 0) =>
  new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: emissive ? 0.6 : 0 });

export { shared } from './shared';
export { glint, onDraw } from './art';
export {
  animateItem,
  makeFunctionCall,
  makeHeart,
  makeHeartMesh,
  makePowerItem,
  makeScaleCrystal,
  makeToken,
  makeTrap,
} from './itemMeshes';

// ------------------------------------------------------------------ props
/**
 * Props are toy pieces too: toon-shaded on the kit's ramp, ink baked into their small textures, one
 * outline at most. Their materials are cached and shared, except where the engine or an enemy tints
 * one (clouds, hearts and the plate's pad get a new material per call).
 */

const toonC = (color: number, emissive = 0, intensity?: number) =>
  cachedMat(`toon:${color}:${emissive}:${intensity}`, () => toon(color, emissive, intensity));
const toonMap = (key: string, map: THREE.Texture, extra: THREE.MeshToonMaterialParameters = {}) =>
  cachedMat(key, () => new THREE.MeshToonMaterial({ color: 0xffffff, map, gradientMap: RAMP, ...extra }));

/** Paints a whole geometry one vertex colour (for merged, vertex-coloured props). */
function tint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geo.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(col, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const lathe = (pts: number[][], segments: number) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segments);

/** Plays fn(k) with k going 0 → 1 over `dur` seconds from the mesh's first draw, then stops. */
function introOnDraw(mesh: THREE.Mesh, dur: number, fn: (k: number, age: number) => void): void {
  let start = -1;
  onDraw(mesh, (t) => {
    if (start < 0) start = t;
    const age = t - start;
    fn(Math.min(1, age / dur), age);
    if (age >= dur + 0.12) mesh.onBeforeRender = () => {};
  });
}

/** The release pennant's "RELEASED" rubber stamp. */
function stampTexture(): THREE.Texture {
  return softTexture('flag:stamp', 128, 64, (c) => {
    c.clearRect(0, 0, 128, 64);
    c.globalAlpha = 0.92;
    c.strokeStyle = '#d8283e';
    c.lineWidth = 5;
    c.beginPath();
    c.roundRect(5, 7, 118, 50, 9);
    c.stroke();
    c.fillStyle = '#d8283e';
    c.font = '900 30px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('RELEASED', 64, 33, 108);
  });
}

function spoolGeo(): THREE.BufferGeometry {
  const wood = 0xb98a5a;
  return mergeGeometries([
    tint(new THREE.CylinderGeometry(0.6, 0.6, 0.03, 20).translate(0, 1.015, 0), 0x3a2a4a),
    tint(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16).translate(0, 1.05 + 0.02, 0), wood),
    tint(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16).translate(0, 1.65, 0), wood),
    tint(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 16).translate(0, 1.35, 0), wood),
    tint(new THREE.CylinderGeometry(0.34, 0.34, 0.36, 16).translate(0, 1.35, 0), 0x10a37f),
  ])!;
}

/** The pennant: pinked top and bottom edges and a V notch at the fly end; origin at its left middle. */
function pennantShape(w: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0.5);
  let i = 0;
  for (let x = 0.15; x < w - 0.05; x += 0.15, i++) s.lineTo(x, i % 2 ? 0.5 : 0.45);
  s.lineTo(w, 0.5);
  s.lineTo(w - 0.3, 0);
  s.lineTo(w, -0.5);
  i = 0;
  for (let x = w - 0.15; x > 0.05; x -= 0.15, i++) s.lineTo(x, i % 2 ? -0.5 : -0.45);
  s.lineTo(0, -0.5);
  s.closePath();
  return s;
}

/**
 * The goal: a release pennant on a thread spool, with a bell on top. The origin is at the ground
 * tile's bottom (the ground top is local y 1). The banner is the group named 'flag' (Stage slides its
 * position.y down at the clear) and carries the hidden 'stamp' sprite.
 */
export function makeFlag(label: string, height = 9): THREE.Group {
  const g = new THREE.Group();
  const barber = cachedMat(`flag:pole:${height}`, () => {
    const tex = softTexture('flag:barber', 16, 16, (c) => {
      c.fillStyle = '#fff4d6';
      c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#10a37f';
      c.beginPath();
      for (const o of [-16, 0, 16]) {
        c.moveTo(o, 16);
        c.lineTo(o + 6, 16);
        c.lineTo(o + 22, 0);
        c.lineTo(o + 16, 0);
        c.closePath();
      }
      c.fill();
    }).clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, height * 2);
    shared(tex);
    return new THREE.MeshToonMaterial({ color: 0xffffff, map: tex, gradientMap: RAMP });
  });
  const pole = new THREE.Mesh(cachedGeo(`flag:pole:${height}`, () => new THREE.CylinderGeometry(0.07, 0.07, height, 10)), barber);
  pole.position.y = height / 2;
  const spool = new THREE.Mesh(cachedGeo('flag:spool', spoolGeo), cachedMat('flag:spool', () => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP })));
  const bell = new THREE.Mesh(
    cachedGeo('flag:bell', () => lathe([[0, 0], [0.14, 0], [0.11, 0.06], [0.07, 0.16], [0.02, 0.2], [0, 0.22]], 12)),
    toonC(0xd9a53a, 0x6a4a10, 0.3),
  );
  bell.position.y = height;

  const banner = new THREE.Group();
  banner.name = 'flag';
  banner.position.set(0.1, height - 0.6, 0.45);
  const text = labelSprite(label, '#ffffff', 'rgba(0,0,0,0)');
  text.scale.multiplyScalar(0.8);
  text.center.set(0, 0.5);
  text.position.set(0.25, 0, 0.1);
  const w = text.scale.x + 0.5;
  const geo = new THREE.ShapeGeometry(pennantShape(w));
  const pennant = new THREE.Mesh(geo, cachedMat('flag:pennant', () => new THREE.MeshToonMaterial({ color: 0x10a37f, gradientMap: RAMP, side: THREE.DoubleSide })));
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const baseX = Float32Array.from({ length: pos.count }, (_, i) => pos.getX(i));
  onDraw(pennant, (t) => {
    if (prefs.reduceMotion) return;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, 0.08 * Math.sin(4 * t - 1.4 * baseX[i]) * (baseX[i] / w));
    pos.needsUpdate = true;
  });
  const stamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: stampTexture(), rotation: -0.21, transparent: true, depthWrite: false }));
  stamp.name = 'stamp';
  stamp.visible = false;
  stamp.position.set(Math.max(1.2, w * 0.6), 0.05, 0.16);
  stamp.scale.set(2.2, 1.1, 1);
  banner.add(pennant, text, stamp);
  g.add(pole, spool, bell, banner);
  return g;
}

/**
 * "Cotton pillow": a flat pillow you can stand on under five puffs, origin at the base. One new
 * material per call, because enemies tint theirs (the Timeline).
 */
export function makeCloud(color: number, emissive = 0x9ab8ff): THREE.Group {
  const g = new THREE.Group();
  const mat = toon(color, emissive, 0.3);
  const pillow = new THREE.Mesh(roundedBox(1.8, 0.34, 0.8, 0.17, 0.05), mat);
  pillow.position.y = 0.17;
  const puffs = new THREE.Mesh(
    cachedGeo('cloud:puffs', () =>
      mergeGeometries(
        [[-0.6, 0.3, 1], [0, 0.45, 1.25], [0.6, 0.3, 1], [-0.25, 0.32, 0.9], [0.3, 0.32, 0.9]].map(([x, y, s]) =>
          new THREE.SphereGeometry(0.5, 12, 8).scale(s, 0.8 * s, 0.7 * s).translate(x, y, 0),
        ),
      )!,
    ),
    mat,
  );
  // A new ink material per cloud too: bosses fade every material under their mesh.
  inkOutline(puffs, 0.03);
  g.add(pillow, puffs);
  return g;
}

/** A plank's face: its colour, a lighter top stripe, grain and a soft ink border. */
function plankTexture(color: number): THREE.Texture {
  return softTexture(`plank:${color}`, 128, 32, (c) => {
    c.fillStyle = css(color);
    c.fillRect(0, 0, 128, 32);
    c.fillStyle = css(shade(color, 1.2));
    c.fillRect(0, 0, 128, 4);
    c.strokeStyle = css(shade(color, 0.9));
    c.lineWidth = 1.5;
    for (const y of [12, 22]) {
      c.beginPath();
      c.moveTo(4, y);
      c.bezierCurveTo(40, y - 3, 80, y + 3, 124, y - 1);
      c.stroke();
    }
    c.strokeStyle = 'rgba(29,20,36,0.5)';
    c.lineWidth = 2;
    c.strokeRect(1, 1, 126, 30);
  });
}

/**
 * "Wind-up plank", three tiles wide, origin at the base: brass rivets, a key at its right end that
 * turns as it travels, and tassels underneath so it reads as a lift you can jump up through.
 */
export function makeMovingPlatform(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    cachedGeo('plank:body', () => atlasUV(roundedBox(3, 0.4, 1, 0.12, 0.05).clone(), CELL.FULL)),
    toonMap(`plank:${color}`, plankTexture(color)),
  );
  body.position.y = 0.2;
  const brass = toonC(0xd9a53a, 0x6a4a10, 0.3);
  const rivets = new THREE.Mesh(
    cachedGeo('plank:rivets', () => mergeGeometries([-1.2, -0.4, 0.4, 1.2].map((x) => new THREE.SphereGeometry(0.04, 6, 4).translate(x, 0, 0.5)))!),
    brass,
  );
  rivets.position.y = 0.2;
  const key = new THREE.Mesh(
    cachedGeo('plank:key', () =>
      mergeGeometries([new THREE.TorusGeometry(0.12, 0.035, 6, 12).translate(1.72, 0, 0), new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6).rotateZ(Math.PI / 2).translate(1.6, 0, 0)])!,
    ),
    brass,
  );
  key.position.y = 0.2;
  let lastX = Number.NaN;
  onDraw(key, () => {
    const x = g.position.x;
    if (!Number.isNaN(lastX)) key.rotation.x += Math.abs(x - lastX) * 6;
    lastX = x;
  });
  const tassels = new THREE.Mesh(
    cachedGeo('plank:tassels', () => mergeGeometries([-1.2, -0.6, 0, 0.6, 1.2].map((x) => new THREE.ConeGeometry(0.06, 0.16, 5).rotateX(Math.PI).translate(x, -0.08, 0.2)))!),
    toonC(shade(color, 0.7)),
  );
  g.add(body, rivets, key, tassels);
  return g;
}

/** Tileable cotton wool: soft pale blobs on a mostly opaque base. */
function cottonTexture(): THREE.Texture {
  return softTexture('fog:cotton', 64, 64, (c) => {
    c.fillStyle = 'rgba(220,226,238,0.86)';
    c.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 12; i++) {
      const x = (i * 23) % 64;
      const y = (i * 37) % 64;
      const r = 8 + ((i * 7) % 9);
      for (const [dx, dy] of [[0, 0], [64, 0], [-64, 0], [0, 64], [0, -64]]) {
        const grad = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        grad.addColorStop(0, 'rgba(240,244,250,0.95)');
        grad.addColorStop(1, 'rgba(240,244,250,0)');
        c.fillStyle = grad;
        c.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
      }
    }
  });
}

/** Opaque on the left, fading out from u 0.75 with a scalloped (sine-shifted) leading edge. */
function fogEdgeAlpha(): THREE.Texture {
  return softTexture('fog:edge', 64, 64, (c) => {
    const img = c.createImageData(64, 64);
    for (let y = 0; y < 64; y++) {
      const shift = 4 * Math.sin((y / 64) * Math.PI * 4);
      for (let x = 0; x < 64; x++) {
        const k = Math.min(1, Math.max(0, (x - 48 - shift) / (16 - 4)));
        const v = Math.round(255 * (1 - k * k * (3 - 2 * k)));
        const o = (y * 64 + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
        img.data[o + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
  });
}

/** "Cotton-wool front": three drifting layers of fog, origin at the leading edge. */
export function makeFogWall(): THREE.Group {
  const g = new THREE.Group();
  const noise = cottonTexture();
  const edge = fogEdgeAlpha();
  const layers: [number, number, number, number, number, number][] = [
    [40, 30, -20, 1.2, 0xffffff, 0.02],
    [38, 28, -19, 0.4, 0xffffff, 0.035],
    [36, 26, -18, -2, 0xa8acc0, 0.05],
  ];
  for (const [w, h, x, z, color, speed] of layers) {
    const map = noise.clone();
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(4, 3);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map, alphaMap: edge, color, transparent: true, depthWrite: false }),
    );
    plane.position.set(x, 7, z);
    onDraw(plane, (t) => (map.offset.x = t * speed));
    g.add(plane);
  }
  g.add(fogPages());
  return g;
}

/** Six letter pages tumbling inside the fog, half veiled by its front layer. */
function fogPages(): THREE.InstancedMesh {
  const tex = softTexture('fog:page', 32, 32, (c) => {
    c.fillStyle = '#f4efe2';
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = 'rgba(70,70,90,0.5)';
    c.fillRect(5, 5, 12, 2);
    for (const y of [11, 16, 21, 26]) c.fillRect(5, y, 22, 1.5);
  });
  const pages = new THREE.InstancedMesh(
    cachedGeo('fog:page', () => new THREE.PlaneGeometry(0.5, 0.65)),
    cachedMat('fog:page', () => new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })),
    6,
  );
  pages.frustumCulled = false;
  pages.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  onDraw(pages, (t) => {
    const k = prefs.reduceMotion ? 0.3 : 1;
    for (let i = 0; i < 6; i++) {
      const u = (0.05 * t * k + i / 6) % 1;
      p.set(-12 + 11 * u, 2 + ((i * 5) % 11) + 0.6 * Math.sin(1.1 * t * k + i), 0.8);
      q.setFromEuler(e.set(0.3 * Math.sin(t * k + i), 2.1 * t * k + i, 1.3 * t * k + 2 * i));
      pages.setMatrixAt(i, m.compose(p, q, one));
    }
    pages.instanceMatrix.needsUpdate = true;
  });
  return pages;
}

/**
 * An artifact panel's material: its face is a title bar with three dots, two code lines and a soft ink
 * border, repeated along the block. Cached per colour and width.
 */
function panelMat(color: number, w: number): THREE.MeshToonMaterial {
  return cachedMat(`panel:${color}:${w}`, () => {
    const tex = softTexture(`panel:${color}`, 128, 32, (c) => {
      c.fillStyle = css(color);
      c.fillRect(0, 0, 128, 32);
      c.fillStyle = css(shade(color, 0.75));
      c.fillRect(0, 0, 128, 10);
      c.fillStyle = '#fff4d6';
      for (const x of [8, 16, 24]) {
        c.beginPath();
        c.arc(x, 5, 2.2, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = css(shade(color, 1.25));
      c.fillRect(8, 15, 70, 3);
      c.fillRect(8, 23, 44, 3);
      c.strokeStyle = 'rgba(29,20,36,0.5)';
      c.lineWidth = 2;
      c.strokeRect(1, 1, 126, 30);
    }).clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = Math.max(1, Math.round(w / 2));
    return new THREE.MeshToonMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 0.3, map: shared(tex), gradientMap: RAMP });
  });
}

/** "Artifact panel": a built block (Artifacts), origin at its base centre. It scans in when it appears. */
export function makeBuiltBlock(w: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(cachedGeo(`panel:${w}`, () => atlasUV(roundedBox(w, 0.4, 1, 0.08, 0.04).clone(), CELL.FULL)), panelMat(color, w));
  body.position.y = 0.2;
  introOnDraw(body, 0.16, (k) => (body.scale.x = 0.05 + 0.95 * easeOutBack(k)));
  g.add(body);
  return g;
}

/** "Typeset em dash": a warm white bar that drops in and lands with a squash. */
export function makeEmDash(w: number): THREE.Group {
  const g = new THREE.Group();
  const tex = softTexture('emdash', 64, 16, (c) => {
    c.fillStyle = '#fff6e6';
    c.fillRect(0, 0, 64, 16);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fillRect(0, 3, 64, 3);
    c.fillStyle = 'rgba(29,20,36,0.7)';
    c.fillRect(0, 0, 64, 2);
    c.fillRect(0, 14, 64, 2);
  });
  const bar = new THREE.Mesh(cachedGeo(`emdash:${w}`, () => atlasUV(roundedBox(w, 0.22, 0.5, 0.1, 0.04).clone(), CELL.FULL)), toonMap('emdash', tex));
  bar.position.y = 0.19;
  introOnDraw(bar, 0.25, (_k, age) => {
    if (age < 0.15) {
      const k = age / 0.15;
      bar.position.y = 0.19 + 0.4 * (1 - k) * (1 - k);
      bar.scale.y = 1;
    } else {
      const sy = 0.8 + 0.2 * Math.min(1, (age - 0.15) / 0.1);
      bar.scale.y = sy;
      bar.position.y = 0.08 + 0.11 * sy;
    }
  });
  g.add(bar);
  return g;
}

function bridgeGeo(w: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(w, 0.3, 1).translate(0, 0.2, 0)];
  const tx = w / 2 - 0.2;
  for (const x of [-tx, tx]) {
    parts.push(
      new THREE.BoxGeometry(0.28, 1.2, 0.28).translate(x, 0.95, -0.35),
      new THREE.BoxGeometry(0.22, 1.0, 0.22).translate(x, 2.05, -0.35),
      new THREE.BoxGeometry(0.16, 0.6, 0.16).translate(x, 2.85, -0.35),
    );
  }
  const cableY = (x: number) => 0.9 + 1.9 * ((2 * x) / (2 * tx)) ** 2;
  const pts = Array.from({ length: 24 }, (_, i) => {
    const x = -tx + (2 * tx * i) / 23;
    return new THREE.Vector3(x, cableY(x), -0.35);
  });
  parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.04, 4));
  for (let x = -tx + 0.5; x < tx - 0.25; x += 0.5) {
    const h = cableY(x) - 0.35;
    if (h > 0.05) parts.push(new THREE.BoxGeometry(0.03, h, 0.03).translate(x, 0.35 + h / 2, -0.35));
  }
  return mergeGeometries(parts)!;
}

/** "Kit-built Golden Gate" in International Orange: one mesh, one draw. It extends as it appears. */
export function makeBridge(w: number): THREE.Group {
  const g = new THREE.Group();
  const bridge = new THREE.Mesh(cachedGeo(`bridge:${w}`, () => bridgeGeo(w)), toonC(0xc0362c, 0x401008, 0.35));
  introOnDraw(bridge, 0.4, (k) => (bridge.scale.x = 0.2 + 0.8 * easeOutBack(k)));
  g.add(bridge);
  return g;
}

/** Falling particles (confetti for the Sora spectacle, snow for Winter Laziness): felt pom-poms. */
export function makeParticles(n: number, colors: number[], size: number): THREE.Points {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    pos[i * 3] = ((i * 37) % 100) / 100;
    pos[i * 3 + 1] = ((i * 71) % 100) / 100;
    pos[i * 3 + 2] = ((i * 13) % 100) / 100;
    c.setHex(colors[i % colors.length]);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size, map: fxTexture('puff'), alphaTest: 0.4, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  pts.frustumCulled = false;
  pts.userData.base = pos.slice();
  return pts;
}

/**
 * "Rumor bubble" above the player (Q*: the power-up that is only a rumor): a thought cloud with a
 * dashed outline, because dashed means unconfirmed.
 */
export function makeAura(text: string, color: string): THREE.Sprite {
  const font = '600 28px system-ui, sans-serif';
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const W = Math.ceil(probe.measureText(text).width) + 40;
  const tex = paintTexture(W, 64, (c) => {
    const [x0, x1, yT, yB] = [16, W - 16, 12, 44];
    const mid = (yT + yB) / 2;
    const bumps = Math.max(2, Math.round((x1 - x0) / 26));
    const step = (x1 - x0) / bumps;
    c.beginPath();
    c.moveTo(x0, yB);
    c.arc(x0, mid, (yB - yT) / 2, Math.PI / 2, (3 * Math.PI) / 2);
    for (let i = 0; i < bumps; i++) c.quadraticCurveTo(x0 + step * (i + 0.5), yT - 11, x0 + step * (i + 1), yT);
    c.arc(x1, mid, (yB - yT) / 2, -Math.PI / 2, Math.PI / 2);
    for (let i = bumps; i > 0; i--) c.quadraticCurveTo(x0 + step * (i - 0.5), yB + 9, x0 + step * (i - 1), yB);
    c.closePath();
    c.fillStyle = 'rgba(20,0,40,0.55)';
    c.fill();
    c.setLineDash([6, 5]);
    c.lineWidth = 3;
    c.strokeStyle = color;
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(20,0,40,0.55)';
    for (const [x, y, r] of [[12, 54, 5], [5, 61, 3]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    c.font = font;
    c.fillStyle = color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, W / 2, mid + 1);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set((W / 64) * 0.5, 0.5, 1);
  return sprite;
}

/** A keyhole: a round top over a flared slot, centred on its circle. */
function keyholeGeo(x: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.012, 0);
  s.lineTo(-0.022, -0.05);
  s.lineTo(0.022, -0.05);
  s.lineTo(0.012, 0);
  s.absarc(0, 0.01, 0.025, -0.3, Math.PI + 0.3, false);
  s.closePath();
  return new THREE.ShapeGeometry(s, 8).translate(x, 0.07, 0.49);
}

/**
 * "Two-key arcade button": a dark housing, two keyholes on the lip and a domed amber pad that glows
 * when pressed. 'pad' keeps a new toon material per call: Puzzles writes its emissive.
 */
export function makePlate(): THREE.Group {
  const g = new THREE.Group();
  const housing = new THREE.Mesh(roundedBox(0.96, 0.12, 0.96, 0.06, 0.03), toonC(0x2a2a34));
  housing.position.y = 0.06;
  const keys = new THREE.Mesh(cachedGeo('plate:keys', () => mergeGeometries([keyholeGeo(-0.25), keyholeGeo(0.25)])!), cachedMat('ink', () => basic(INK)));
  const padMat = toon(0xffc040);
  const pad = new THREE.Mesh(cachedGeo('plate:pad', () => lathe([[0, 0], [0.34, 0], [0.33, 0.05], [0.25, 0.09], [0, 0.1]], 20)), padMat);
  pad.name = 'pad';
  pad.position.y = 0.1;
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Mesh(cachedGeo('plate:glow', () => new THREE.RingGeometry(0.34, 0.44, 24).rotateX(-Math.PI / 2)), glowMat);
  glow.position.y = 0.121;
  onDraw(glow, () => (glowMat.opacity = padMat.emissive.r > 0 ? 0.6 : 0));
  g.add(housing, keys, pad, glow);
  return g;
}

/** Every prop, for the `?debug&gallery=props` lineup. */
export function propGallery(): { name: string; mesh: THREE.Object3D }[] {
  const flag = makeFlag('GPT-2 · 2019', 3.2);
  const stamp = flag.getObjectByName('stamp')!;
  stamp.visible = true;
  flag.getObjectByName('flag')!.position.y = 2;
  flag.position.y = -1;
  const fog = makeFogWall();
  fog.scale.setScalar(0.08);
  fog.position.set(1.4, -0.4, 0);
  return [
    { name: 'flag', mesh: flag },
    { name: 'cloud', mesh: makeCloud(0xffffff) },
    { name: 'plank', mesh: makeMovingPlatform(0xc98a4b) },
    { name: 'built block', mesh: makeBuiltBlock(3, 0xd97757) },
    { name: 'em dash', mesh: makeEmDash(3) },
    { name: 'bridge', mesh: makeBridge(4) },
    { name: 'plate', mesh: makePlate() },
    { name: 'rumor', mesh: makeAura('Q* ?', '#e8d8ff') },
    { name: 'fog', mesh: fog },
    { name: 'confetti', mesh: makeParticles(40, [0xffd166, 0xef476f, 0x06d6a0], 0.25) },
  ];
}
