import * as THREE from 'three';
import { DATA_TYPES, type DataTypeId } from '../config/dataTypes';
import { paintTexture } from './art';
import { shared } from './shared';
// Only called inside builders, never at module load (toonKit imports ./shared, not this module).
import { basic, cachedGeo } from './toonKit';

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

/**
 * Runs fn(t) (t = performance.now() in seconds) each time the mesh is drawn, then refreshes its world
 * matrix: three computes matrixWorld before onBeforeRender, so a transform written here would
 * otherwise show a frame late. Leaf meshes only; build the closure once, never per frame.
 */
export function onDraw(mesh: THREE.Object3D, fn: (t: number) => void): void {
  mesh.onBeforeRender = () => {
    fn(performance.now() / 1000);
    mesh.updateMatrix();
    if (mesh.parent) mesh.matrixWorld.multiplyMatrices(mesh.parent.matrixWorld, mesh.matrix);
    else mesh.matrixWorld.copy(mesh.matrix);
  };
}

let glintMat: THREE.MeshBasicMaterial | null = null;
/**
 * A flat white highlight w × h: place it upper left, just in front of the part it shines on (the sun
 * is upper left). Geometry and material are cached and shared.
 */
export function glint(w: number, h: number): THREE.Mesh {
  glintMat ??= shared(basic(0xffffff));
  const m = new THREE.Mesh(cachedGeo('glint', () => new THREE.SphereGeometry(1, 8, 6)), glintMat);
  m.scale.set(w, h, 0.01);
  return m;
}

const tokenGeo = shared(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 20));
const rimGeo = shared(new THREE.TorusGeometry(0.3, 0.035, 6, 20));
const rimMat = shared(lambert(0xffffff));
const tokenMats = new Map<string, THREE.Material[]>();

/** A glyph on a colored disk: tokens are told apart by shape, not only color. */
function faceTexture(glyph: string, color: number, ink = '#10131f'): THREE.CanvasTexture {
  const tex = canvasTexture(64, (c, s) => {
    c.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    c.fillRect(0, 0, s, s);
    c.fillStyle = ink;
    c.font = `bold ${glyph.length > 1 ? 26 : 34}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // A cylinder's cap maps the texture sideways; once the coin is turned to face the camera, a
    // glyph drawn a quarter-turn counter-clockwise reads upright.
    c.translate(s / 2, s / 2);
    c.rotate(-Math.PI / 2);
    c.fillText(glyph, 0, 2);
  });
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function coinMaterials(key: string, glyph: string, color: number, ink?: string): THREE.Material[] {
  let mats = tokenMats.get(key);
  if (!mats) {
    const side = shared(new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.45 }));
    const face = shared(new THREE.MeshLambertMaterial({ map: faceTexture(glyph, color, ink), emissive: color, emissiveIntensity: 0.25 }));
    // Cylinder groups: side, top, bottom. The coin is turned to face the camera, so top/bottom are its faces.
    mats = [side, face, face];
    tokenMats.set(key, mats);
  }
  return mats;
}

function coin(key: string, glyph: string, color: number, ink?: string): THREE.Group {
  const g = new THREE.Group();
  const disk = new THREE.Mesh(tokenGeo, coinMaterials(key, glyph, color, ink));
  disk.rotation.x = Math.PI / 2;
  disk.position.y = 0.5;
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.y = 0.5;
  g.add(disk, rim);
  return g;
}

export function makeToken(type: DataTypeId): THREE.Group {
  const t = DATA_TYPES[type];
  return coin(type, t.glyph, t.color);
}

/** Reward orbs look almost like tokens; praise coins say "brilliant!". */
export function makeTrap(kind: 'rewardOrb' | 'praise'): THREE.Group {
  const g = kind === 'rewardOrb' ? coin('trap-orb', '+1', 0xffc21a, '#5a2a00') : coin('trap-praise', '★', 0xff9ad5, '#5a0034');
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 10),
    new THREE.MeshBasicMaterial({ color: kind === 'rewardOrb' ? 0xffa000 : 0xff5ab4, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  glow.position.y = 0.5;
  g.add(glow);
  return g;
}

function star(color: number, emissive: number): THREE.Mesh {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.42 : 0.18;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
  geo.translate(0, 0, -0.08);
  const mesh = new THREE.Mesh(geo, lambert(color, emissive));
  mesh.position.y = 0.45;
  return mesh;
}

/** Power-up meshes by kind. `color` tints hype and moment items. */
export function makePowerItem(kind: string, color = 0xff4fd8): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'scale' || kind === 'mega') {
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(kind === 'mega' ? 0.45 : 0.38),
      new THREE.MeshLambertMaterial({ color: kind === 'mega' ? 0xffd166 : 0x3ff2d0, emissive: kind === 'mega' ? 0xc08a00 : 0x19c2a2, emissiveIntensity: 0.8 }),
    );
    crystal.position.y = 0.45;
    crystal.scale.y = 1.25;
    g.add(crystal);
  } else if (kind === 'rlhf') {
    g.add(star(0xffd84d, 0xffb000));
  } else if (kind === 'viral') {
    g.add(star(0xffffff, 0x66ccff));
  } else if (kind === 'tool') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4), lambert(0x2fae4a));
    stem.position.y = 0.2;
    const head = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.09, 8, 6), lambert(0x1fd1b0, 0x0a8a74));
    head.position.y = 0.55;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lambert(0xffffff, 0xffffff));
    core.position.y = 0.55;
    g.add(stem, head, core);
  } else if (kind === 'cape') {
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.06), lambert(0x7a3cff, 0x3a1080));
    cloth.position.y = 0.45;
    cloth.rotation.z = 0.2;
    g.add(cloth);
  } else if (kind === 'fork') {
    for (const x of [-0.16, 0.16]) {
      const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), lambert(0xe0304a, 0x600010));
      cherry.position.set(x, 0.25, 0);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), lambert(0x2fae4a));
      stem.position.set(x * 0.5, 0.55, 0);
      stem.rotation.z = -x * 2;
      g.add(cherry, stem);
    }
  } else if (kind === 'frozen') {
    const inside = makePowerItem('fork');
    inside.position.y = 0.05;
    const ice = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.78, 0.78),
      new THREE.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x3a7aa0, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    ice.position.y = 0.42;
    g.add(inside, ice);
  } else if (kind === 'oneup') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 20, Math.PI * 1.6), lambert(0x46e07a, 0x138a3a));
    ring.position.y = 0.45;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 3), lambert(0x46e07a, 0x138a3a));
    arrow.position.set(0.27, 0.58, 0);
    arrow.rotation.z = -0.4;
    g.add(ring, arrow);
  } else {
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), lambert(color, color));
    orb.position.y = 0.45;
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.04, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }),
    );
    halo.position.y = 0.45;
    g.add(orb, halo);
  }
  return g;
}

/** A function call: a glowing pair of brackets. */
export function makeFunctionCall(): THREE.Group {
  const g = new THREE.Group();
  const mat = lambert(0x1fd1b0, 0x1fd1b0);
  for (const x of [-0.12, 0.12]) {
    const bracket = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 6, 10, Math.PI), mat);
    bracket.position.set(x, 0.22, 0);
    bracket.rotation.z = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(bracket);
  }
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lambert(0xffffff, 0xffffff));
  dot.position.y = 0.22;
  g.add(dot);
  return g;
}

/** The Scale power-up: a glowing parameter crystal. */
export function makeScaleCrystal(): THREE.Group {
  const g = new THREE.Group();
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.38),
    new THREE.MeshLambertMaterial({ color: 0x3ff2d0, emissive: 0x19c2a2, emissiveIntensity: 0.8 }),
  );
  crystal.position.y = 0.45;
  crystal.scale.y = 1.25;
  g.add(crystal);
  return g;
}

/** A flagpole whose flag carries the model's name and release date. */
export function makeFlag(label: string, height = 9): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, height), lambert(0xdddddd));
  pole.position.y = height / 2;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), lambert(0x46c04a));
  ball.position.y = height + 0.1;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lambert(0x9c7a55));
  base.position.y = 0.5;
  const flag = labelSprite(label, '#ffffff', '#10a37f');
  flag.name = 'flag';
  flag.scale.multiplyScalar(0.8);
  flag.center.set(0, 0.5);
  flag.position.set(0.1, height - 0.6, 0);
  g.add(pole, ball, base, flag);
  return g;
}

/** A puffy cloud, origin at its base. */
export function makeCloud(color: number, emissive = 0x9ab8ff): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: 0.3 });
  const geo = new THREE.SphereGeometry(0.5, 12, 8);
  for (const [x, y, s] of [[-0.6, 0.3, 1], [0, 0.45, 1.25], [0.6, 0.3, 1], [-0.25, 0.15, 0.9], [0.3, 0.15, 0.9]]) {
    const puff = new THREE.Mesh(geo, mat);
    puff.position.set(x, y, 0);
    puff.scale.set(s, s * 0.8, s * 0.7);
    g.add(puff);
  }
  return g;
}

export function makeHeartMesh(color: number): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(0, -0.35);
  s.bezierCurveTo(-0.5, 0, -0.35, 0.4, 0, 0.18);
  s.bezierCurveTo(0.35, 0.4, 0.5, 0, 0, -0.35);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false });
  geo.translate(0, 0, -0.07);
  return new THREE.Mesh(geo, lambert(color, color));
}

/** A heart token ("nothing without its people"). */
export function makeHeart(): THREE.Group {
  const g = new THREE.Group();
  const heart = makeHeartMesh(0xff4d7a);
  heart.position.y = 0.5;
  g.add(heart);
  return g;
}

/** A floating platform actor, three tiles wide. */
export function makeMovingPlatform(color: number): THREE.Group {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 1), lambert(color, 0x202020));
  slab.position.y = 0.2;
  g.add(slab);
  return g;
}

/** A wall of fog that rolls across the level. Origin at its leading edge. */
export function makeFogWall(): THREE.Group {
  const g = new THREE.Group();
  const tex = canvasTexture(64, (c, s) => {
    const grad = c.createLinearGradient(0, 0, s, 0);
    grad.addColorStop(0, 'rgba(225,230,240,0.95)');
    grad.addColorStop(0.75, 'rgba(225,230,240,0.7)');
    grad.addColorStop(1, 'rgba(225,230,240,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, s, s);
  });
  tex.magFilter = THREE.LinearFilter;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  plane.position.set(-20, 7, 1.2);
  g.add(plane);
  return g;
}

/** A built block (Artifacts): a glowing slab. Origin at its base center. */
export function makeBuiltBlock(w: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, 1), lambert(color, color));
  slab.position.y = 0.2;
  g.add(slab);
  return g;
}

/** An em dash platform: a long flat bar. */
export function makeEmDash(w: number): THREE.Group {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.5), lambert(0xf4f4f4, 0x404040));
  bar.position.y = 0.19;
  g.add(bar);
  const label = labelSprite('—', '#111', 'rgba(255,255,255,0.0)');
  label.scale.multiplyScalar(0.5);
  label.position.y = 0.6;
  g.add(label);
  return g;
}

/** A Golden Gate bridge span in International Orange, with towers at both ends. */
export function makeBridge(w: number): THREE.Group {
  const g = new THREE.Group();
  const orange = lambert(0xc0362c, 0x401008);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 1), orange);
  deck.position.y = 0.2;
  g.add(deck);
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 0.25), orange);
    tower.position.set(x, 1.3, -0.35);
    g.add(tower);
  }
  const cable = new THREE.Mesh(new THREE.TorusGeometry(w / 2 - 0.2, 0.04, 4, 24, Math.PI), orange);
  cable.rotation.z = Math.PI;
  cable.scale.y = 2.2 / Math.max(1, w / 2 - 0.2);
  cable.position.set(0, 2.6, -0.35);
  g.add(cable);
  return g;
}

/** Falling particles (confetti for the Sora spectacle, snow for Winter Laziness). */
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
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
  pts.frustumCulled = false;
  pts.userData.base = pos.slice();
  return pts;
}

/** A floating label above the player (Q*: the power-up that is only a rumor). */
export function makeAura(text: string, color: string): THREE.Sprite {
  const s = labelSprite(text, color, 'rgba(20,0,40,0.45)');
  s.scale.multiplyScalar(0.5);
  return s;
}

/** A pressure plate on the floor: glows when something stands on it. */
export function makePlate(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.08, 0.96), lambert(0x3a3a44));
  base.position.y = 0.04;
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 0.76), lambert(0xffc040, 0x000000));
  pad.name = 'pad';
  pad.position.y = 0.1;
  g.add(base, pad);
  return g;
}
