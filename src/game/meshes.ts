import * as THREE from 'three';
import { DATA_TYPES, type DataTypeId } from '../config/dataTypes';

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

/** Conveyor belt: chevrons pointing the way it moves. The level view scrolls it. */
export function arrowTexture(dir: 1 | -1): THREE.CanvasTexture {
  const tex = canvasTexture(32, (c, s) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#3a3f4a';
    c.fillRect(0, 0, s, 4);
    c.fillRect(0, s - 4, s, 4);
    c.strokeStyle = '#ffcf3a';
    c.lineWidth = 4;
    for (const x0 of [6, 20]) {
      c.beginPath();
      c.moveTo(x0 - 4 * dir, 9);
      c.lineTo(x0 + 4 * dir, 16);
      c.lineTo(x0 - 4 * dir, 23);
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

const lambert = (color: number, emissive = 0) =>
  new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: emissive ? 0.6 : 0 });

/** A playable model: rounded body, dark visor with glowing eyes, and an antenna. About 1 unit tall. */
export function makeCharacter(color: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.26, 6, 16), lambert(color));
  body.name = 'body';
  body.position.y = 0.47;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), lambert(accent));
  belly.scale.set(1, 1, 0.5);
  belly.position.set(0, 0.36, 0.22);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.2), lambert(0x16181d));
  visor.position.set(0, 0.66, 0.24);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9ff7ff });
  for (const x of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.02), eyeMat);
    eye.position.set(x, 0.67, 0.35);
    eye.name = 'eye';
    g.add(eye);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18), lambert(0x333333));
  antenna.position.y = 0.98;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), lambert(accent, accent));
  tip.position.y = 1.09;
  const footMat = lambert(0x2b2b30);
  for (const x of [-0.14, 0.14]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.3), footMat);
    foot.position.set(x, 0.05, 0.04);
    g.add(foot);
  }
  g.add(body, belly, visor, antenna, tip);
  return g;
}

/** Spambot: an angry envelope of junk text. */
export function makeSpambot(scale = 1, color = 0x8c7aa8): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.72, 0.6), lambert(color));
  body.position.y = 0.4;
  const flap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.3, 4), lambert(0xb9aad3));
  flap.rotation.set(Math.PI, Math.PI / 4, 0);
  flap.scale.set(1.25, 1, 0.8);
  flap.position.set(0, 0.62, 0.2);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const x of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), white);
    eye.position.set(x, 0.42, 0.3);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), black);
    pupil.position.set(x * 0.9, 0.4, 0.38);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), black);
    brow.position.set(x, 0.55, 0.33);
    brow.rotation.z = x > 0 ? 0.5 : -0.5;
    g.add(eye, pupil, brow);
  }
  const footMat = lambert(0x3b2f4d);
  for (const x of [-0.25, 0.25]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.4), footMat);
    foot.position.set(x, 0.05, 0);
    g.add(foot);
  }
  g.add(body, flap);
  g.scale.setScalar(scale);
  return g;
}

/** The open-source helper: small, round, friendly. */
export function makeHelper(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.2, 4, 12), lambert(0xfff1d6));
  body.position.y = 0.32;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), lambert(0xffd21e));
  head.position.y = 0.82;
  const black = new THREE.MeshBasicMaterial({ color: 0x222222 });
  for (const x of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), black);
    eye.position.set(x, 0.88, 0.31);
    g.add(eye);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12, Math.PI), black);
  smile.rotation.z = Math.PI;
  smile.position.set(0, 0.76, 0.32);
  g.add(body, head, smile);
  return g;
}

/** Marks geometry/materials reused across levels, so level teardown leaves them alone. */
function shared<T extends THREE.Material | THREE.BufferGeometry>(thing: T): T {
  thing.userData.shared = true;
  return thing;
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
    c.fillText(glyph, s / 2, s / 2 + 2);
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

/** The reasoning cape: a cloth panel hanging from the shoulders. */
export function makeCape(color: number): THREE.Group {
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.04), lambert(0x7a3cff, 0x3a1080));
  cloth.position.set(0, -0.27, 0);
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.72, -0.3);
  pivot.add(cloth);
  const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), lambert(color, color));
  clasp.position.set(0, 0.72, -0.28);
  g.add(pivot, clasp);
  // Player.updateMesh swings the cloth through this pivot.
  g.userData.pivot = pivot;
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

/** The Reward Hacker: a greedy trophy with a coin slot for a mouth. */
export function makeRewardHacker(): THREE.Group {
  const g = new THREE.Group();
  const gold = lambert(0xe8b923, 0x4a3300);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.55, 1.3, 20), gold);
  cup.position.y = 1.3;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.5, 12), gold);
  stem.position.y = 0.45;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.9), lambert(0x6a4a10));
  base.position.y = 0.12;
  for (const x of [-1.05, 1.05]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16), gold);
    handle.position.set(x, 1.45, 0);
    handle.rotation.y = Math.PI / 2;
    g.add(handle);
  }
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const x of [-0.32, 0.32]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), white);
    eye.position.set(x, 1.55, 0.78);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), black);
    pupil.position.set(x * 0.9, 1.52, 0.9);
    g.add(eye, pupil);
  }
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.1), black);
  slot.position.set(0, 1.12, 0.82);
  g.add(cup, stem, base, slot);
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
