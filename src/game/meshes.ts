import * as THREE from 'three';

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

export function makeToken(color: number): THREE.Group {
  const g = new THREE.Group();
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.08, 20),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.45 }),
  );
  coin.rotation.x = Math.PI / 2;
  coin.position.y = 0.5;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 20), lambert(0xffffff));
  rim.position.y = 0.5;
  g.add(coin, rim);
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
