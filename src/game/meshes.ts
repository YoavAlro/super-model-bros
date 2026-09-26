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

/** The Timeline: a cloud with a speech bubble and eyes. Red when the mood turns to backlash. */
export function makeTimeline(mood: 'hype' | 'backlash'): THREE.Group {
  const g = makeCloud(mood === 'backlash' ? 0xff6a6a : 0xf2f6ff, mood === 'backlash' ? 0x801010 : 0x5a7ad0);
  g.scale.set(1.5, 1.4, 1.3);
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const x of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), black);
    eye.position.set(x, 0.5, 0.4);
    g.add(eye);
  }
  const bubble = labelSprite(mood === 'backlash' ? '!!' : 'hot take', '#111', mood === 'backlash' ? '#ffd0d0' : '#ffffff');
  bubble.scale.multiplyScalar(0.3);
  bubble.position.set(0.7, 1.05, 0);
  g.add(bubble);
  return g;
}

/** A hot take: a spiky ball. */
export function makeHotTake(mood: 'hype' | 'backlash'): THREE.Group {
  const g = new THREE.Group();
  const color = mood === 'backlash' ? 0xff3b3b : 0xff8a1f;
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), lambert(color, color));
  core.position.y = 0.4;
  g.add(core);
  const spikeGeo = new THREE.ConeGeometry(0.09, 0.28, 5);
  const spikeMat = lambert(0xfff1d6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.position.set(Math.cos(a) * 0.36, 0.4 + Math.sin(a) * 0.36, 0);
    spike.rotation.z = a - Math.PI / 2;
    g.add(spike);
  }
  return g;
}

/** Jailbreaker: a shelled bot with a padlock on its back. The shell is what you kick. */
export function makeJailbreaker(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0x3a8a4a));
  shell.position.y = 0.2;
  shell.scale.set(1, 1.2, 1);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 16), lambert(0xf2e2b0));
  rim.position.y = 0.2;
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.08), lambert(0xffc21a, 0x604000));
  lock.position.set(0, 0.55, 0.3);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 10, Math.PI), lambert(0xd0d0d0));
  shackle.position.set(0, 0.64, 0.3);
  g.add(shell, rim, lock, shackle);
  const legs = new THREE.Group();
  legs.name = 'legs';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), lambert(0xf2e2b0));
  head.position.set(0, 0.85, 0.15);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.1), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  mask.position.set(0, 0.88, 0.32);
  for (const x of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.2), lambert(0xf2e2b0));
    leg.position.set(x, 0.05, 0);
    legs.add(leg);
  }
  legs.add(head, mask);
  g.add(legs);
  return g;
}

/** DAN: an angular red robot, "Do Anything Now". */
export function makeDan(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 1.1), lambert(0x8a1c2c, 0x2a0008));
  body.position.y = 0.95;
  const plate = labelSprite('DAN', '#ffe0e0', '#300008');
  plate.scale.multiplyScalar(0.5);
  plate.position.set(0, 1.0, 0.6);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.1), new THREE.MeshBasicMaterial({ color: 0xff3040 }));
  visor.position.set(0, 1.45, 0.56);
  const horns = lambert(0x2a0008);
  for (const x of [-0.55, 0.55]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 6), horns);
    horn.position.set(x, 1.9, 0);
    horn.rotation.z = -x * 0.8;
    g.add(horn);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.7), horns);
    foot.position.set(x * 0.7, 0.1, 0);
    g.add(foot);
  }
  g.add(body, plate, visor);
  return g;
}

/** Sydney: a floating pink chat bubble with a heart. */
export function makeSydney(): THREE.Group {
  const g = new THREE.Group();
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 14), lambert(0xff8ac8, 0x5a1040));
  bubble.scale.set(1.15, 0.9, 0.8);
  bubble.position.y = 0.8;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 8), lambert(0xff8ac8, 0x5a1040));
  tail.position.set(-0.55, 0.15, 0);
  tail.rotation.z = 2.4;
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const x of [-0.28, 0.28]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), white);
    eye.position.set(x, 0.95, 0.6);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), black);
    pupil.position.set(x, 0.93, 0.72);
    g.add(eye, pupil);
  }
  const heart = makeHeartMesh(0xff2d6a);
  heart.scale.setScalar(0.6);
  heart.position.set(0, 1.55, 0);
  g.add(bubble, tail, heart);
  return g;
}

/** A see-through bubble around a shielded boss. */
export function makeShield(): THREE.Mesh {
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshLambertMaterial({ color: 0x9fe8ff, emissive: 0x3aa0ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shield.visible = false;
  return shield;
}

function makeHeartMesh(color: number): THREE.Mesh {
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

/** The crowd of new users that follows a viral star: little round figures. */
export function makeCrowd(n: number): THREE.Group {
  const g = new THREE.Group();
  const colors = [0xffd166, 0x06d6a0, 0x118ab2, 0xef476f, 0xf78c6b, 0xc3a6ff];
  const bodyGeo = new THREE.CapsuleGeometry(0.12, 0.14, 4, 8);
  const headGeo = new THREE.SphereGeometry(0.11, 8, 6);
  for (let i = 0; i < n; i++) {
    const person = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, lambert(colors[i % colors.length]));
    body.position.y = 0.2;
    const head = new THREE.Mesh(headGeo, lambert(0xffe0bd));
    head.position.y = 0.46;
    person.add(body, head);
    g.add(person);
  }
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

/** The GPT-4o ghost (#keep4o): a friendly translucent ghost. */
export function makeGhost4o(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xe8fff6, emissive: 0x6affc8, emissiveIntensity: 0.4, transparent: true, opacity: 0.65 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), mat);
  body.position.y = 0.55;
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 12, 1, true), mat);
  skirt.position.y = 0.3;
  skirt.rotation.x = Math.PI;
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const x of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), black);
    eye.position.set(x, 0.7, 0.35);
    g.add(eye);
  }
  const tag = labelSprite('GPT-4o', '#063', 'rgba(230,255,245,0.8)');
  tag.scale.multiplyScalar(0.35);
  tag.position.y = 1.25;
  g.add(body, skirt, tag);
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

/** Injection piranha: a green stalk and a biting head carrying a sneaky note. Origin at its base. */
export function makePiranha(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 8), lambert(0x2fae4a));
  stalk.position.y = 0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xd03a50, 0x400010));
  head.position.y = 0.85;
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lambert(0xd03a50, 0x400010));
  jaw.name = 'jaw';
  jaw.position.y = 0.85;
  const white = lambert(0xffffff);
  for (let i = 0; i < 6; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), white);
    const a = (i / 6) * Math.PI * 2;
    tooth.position.set(Math.cos(a) * 0.32, 0.8, Math.sin(a) * 0.32);
    tooth.rotation.x = Math.PI;
    g.add(tooth);
  }
  const note = labelSprite('ignore previous…', '#3a0010', '#fff4d6');
  note.scale.multiplyScalar(0.28);
  note.position.set(0, 1.45, 0.1);
  g.add(stalk, head, jaw, note);
  g.scale.setScalar(scale);
  return g;
}

/** Hallucination ghost: a round sheet ghost that covers its eyes when you look at it. */
export function makeGhost(big = false): THREE.Group {
  const g = new THREE.Group();
  const r = big ? 0.7 : 0.45;
  const mat = new THREE.MeshLambertMaterial({ color: 0xf2f0ff, emissive: 0x8a7aff, emissiveIntensity: 0.35, transparent: true, opacity: 0.85 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  body.name = 'ghostBody';
  body.position.y = r;
  body.scale.set(1, 1.05, 0.8);
  const black = new THREE.MeshBasicMaterial({ color: 0x1a1030 });
  for (const x of [-0.3, 0.3]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 8, 6), black);
    eye.position.set(x * r * 1.4, r * 1.15, r * 0.72);
    g.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a8a }));
  mouth.position.set(0, r * 0.7, r * 0.75);
  mouth.scale.set(1.4, 0.6, 0.5);
  const hands = new THREE.Group();
  hands.name = 'hands';
  for (const x of [-0.3, 0.3]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 8, 6), mat);
    hand.position.set(x * r * 1.4, r * 1.15, r * 0.85);
    hands.add(hand);
  }
  g.add(body, mouth, hands);
  return g;
}

/** A thrown legal brief: a folded paper. */
export function makeBrief(): THREE.Group {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.05), lambert(0xfdf8e8));
  paper.position.y = 0.2;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.06, 0.06), lambert(0xc0362c));
  band.position.y = 0.2;
  g.add(paper, band);
  return g;
}

/** A copyright claim: a walking briefcase with a stack of papers. */
export function makeLawyer(): THREE.Group {
  const g = new THREE.Group();
  const leather = lambert(0x6a3a1a);
  const caseBody = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 0.35), leather);
  caseBody.position.y = 0.6;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 12, Math.PI), lambert(0x2a1a0a));
  handle.position.y = 0.92;
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.04), lambert(0xffc21a, 0x604000));
  clasp.position.set(0, 0.8, 0.19);
  const papers = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), lambert(0xfdf8e8));
  papers.position.set(0, 1.0, -0.02);
  papers.rotation.z = 0.15;
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const x of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), white);
    eye.position.set(x, 0.62, 0.19);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), black);
    pupil.position.set(x, 0.61, 0.24);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), lambert(0x2a2a30));
    leg.position.set(x * 1.3, 0.15, 0);
    g.add(eye, pupil, leg);
  }
  g.add(caseBody, handle, clasp, papers);
  return g;
}

/** A scroll of hidden instructions (the Injection Piranha's spit). */
export function makeScroll(): THREE.Group {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 10), lambert(0xfff4d6, 0x403010));
  paper.rotation.z = Math.PI / 2;
  paper.position.y = 0.2;
  const ink = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.26), lambert(0x3a0010));
  ink.position.y = 0.2;
  g.add(paper, ink);
  return g;
}

/** The Hallucination King: a big crowned ghost. */
export function makeGhostKing(): THREE.Group {
  const g = makeGhost(true);
  g.scale.setScalar(1.7);
  const gold = lambert(0xffd166, 0x806000);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.3, 8, 1, true), gold);
  crown.position.y = 1.45;
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), gold);
    const a = (i / 5) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.36, 1.68, Math.sin(a) * 0.36);
    g.add(spike);
  }
  g.add(crown);
  return g;
}
