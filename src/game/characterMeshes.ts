import * as THREE from 'three';
import type { CharacterSpec } from '../config/characters';
import { labelSprite, lambert } from './meshes';

/** Meshes for the playable characters and friends: the model mascots, the helper, the crowd, and the GPT-4o ghost. */

/**
 * A playable model: about 1 unit tall, feet at y = 0, facing +z. The engine relies on a mesh named
 * `body` with its own (unshared) material that has `emissive` (star, tool and think glows), and on
 * every material being per-instance (clones turn see-through).
 */
export function makeCharacter(c: Pick<CharacterSpec, 'id' | 'color' | 'accent'>): THREE.Group {
  const { color, accent } = c;
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

/** Every character mesh, for the `?debug&gallery=characters` lineup. */
export function characterGallery(roster: readonly Pick<CharacterSpec, 'id' | 'name' | 'color' | 'accent'>[]): { name: string; mesh: THREE.Object3D }[] {
  return [
    ...roster.map((c) => ({ name: c.name, mesh: makeCharacter(c) })),
    { name: 'Helper', mesh: makeHelper() },
    { name: 'GPT-4o ghost', mesh: makeGhost4o() },
  ];
}
