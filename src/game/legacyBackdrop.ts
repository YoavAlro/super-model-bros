import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { THEMES, type Theme, type ThemeId } from '../config/themes';
import { mulberry32 } from './rng';

/**
 * TEMPORARY: the pre-facelift backdrops, kept only until src/game/backdrop.ts (the cardboard
 * dioramas built from theme.strips / scenery / life / celestial) replaces them. Delete this file and
 * its one call in LevelView then.
 */
type Legacy = 'hills' | 'crystals' | 'pillars' | 'cloudsea' | 'pipes' | 'ghost' | 'gears' | 'towers' | 'stars';
const LEGACY: Record<ThemeId, Legacy> = {
  plains: 'hills',
  caves: 'crystals',
  castle: 'pillars',
  hills: 'hills',
  skies: 'cloudsea',
  skycastle: 'towers',
  storm: 'towers',
  pipes: 'pipes',
  ghost: 'ghost',
  factory: 'gears',
  frontier: 'towers',
  finale: 'stars',
};

export function buildLegacyBackdrop(scene: THREE.Scene, theme: Theme, W: number): void {
  const backdrop = LEGACY[(Object.keys(THEMES) as ThemeId[]).find((id) => THEMES[id] === theme) ?? 'plains'];
  const group = new THREE.Group();
  const rand = mulberry32(W);

  if (backdrop === 'hills') {
    const hillMat = new THREE.MeshLambertMaterial({ color: theme.grass === 0x46c04a ? 0x6fd46f : 0x9ccf5a });
    const farMat = new THREE.MeshLambertMaterial({ color: theme.grass === 0x46c04a ? 0x9ee29e : 0xc8e39a });
    const geo = new THREE.SphereGeometry(1, 20, 12);
    for (let x = -10; x < W + 20; x += 14 + rand() * 12) {
      const far = rand() > 0.5;
      const hill = new THREE.Mesh(geo, far ? farMat : hillMat);
      const r = far ? 9 + rand() * 5 : 5 + rand() * 3;
      hill.scale.set(r * 1.4, r, 1);
      hill.position.set(x, 1, far ? -22 : -8);
      group.add(hill);
    }
  } else if (backdrop === 'crystals') {
    const mat = new THREE.MeshLambertMaterial({ color: 0x3f7fff, emissive: 0x1d4fd0, emissiveIntensity: 0.7 });
    const geo = new THREE.OctahedronGeometry(0.8);
    for (let x = 0; x < W; x += 6 + rand() * 8) {
      const crystal = new THREE.Mesh(geo, mat);
      crystal.scale.set(1, 3 + rand() * 4, 1);
      crystal.position.set(x, 2 + rand() * 9, -9 - rand() * 8);
      crystal.rotation.z = (rand() - 0.5) * 0.6;
      group.add(crystal);
    }
  } else if (backdrop === 'pillars') {
    const stone = new THREE.MeshLambertMaterial({ color: 0x3b3336 });
    const flame = new THREE.MeshBasicMaterial({ color: 0xffa640 });
    const pillarGeo = new THREE.BoxGeometry(2, 16, 2);
    const torchGeo = new THREE.SphereGeometry(0.25, 8, 6);
    for (let x = 0; x < W; x += 10) {
      const pillar = new THREE.Mesh(pillarGeo, stone);
      pillar.position.set(x, 7, -7);
      const torch = new THREE.Mesh(torchGeo, flame);
      torch.position.set(x, 8, -5.9);
      group.add(pillar, torch);
    }
  } else if (backdrop === 'cloudsea') {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xdde8ff, emissiveIntensity: 0.5 });
    const geo = new THREE.SphereGeometry(1, 14, 10);
    for (let x = -10; x < W + 20; x += 3 + rand() * 4) {
      const puff = new THREE.Mesh(geo, mat);
      const r = 2.5 + rand() * 2.5;
      puff.scale.set(r * 1.3, r * 0.7, 1);
      puff.position.set(x, -2.5 + rand() * 1.5, -6 - rand() * 10);
      group.add(puff);
    }
  } else if (backdrop === 'pipes') {
    const mat = new THREE.MeshLambertMaterial({ color: 0x1f6a55 });
    const rim = new THREE.MeshLambertMaterial({ color: 0x2a8a70 });
    const geo = new THREE.CylinderGeometry(1, 1, 1, 16);
    for (let x = 0; x < W; x += 5 + rand() * 7) {
      const h = 3 + rand() * 10;
      const r = 0.8 + rand() * 1.2;
      const pipe = new THREE.Mesh(geo, mat);
      pipe.scale.set(r, h, r);
      pipe.position.set(x, h / 2 - 1, -8 - rand() * 8);
      const lip = new THREE.Mesh(geo, rim);
      lip.scale.set(r * 1.2, 0.6, r * 1.2);
      lip.position.set(x, h - 1, pipe.position.z);
      group.add(pipe, lip);
    }
  } else if (backdrop === 'ghost') {
    const wall = new THREE.MeshLambertMaterial({ color: 0x2a1a3a });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffe08a });
    const winGeo = new THREE.BoxGeometry(1.2, 1.8, 0.1);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, 30), wall);
    back.position.set(W / 2, 7, -10);
    group.add(back);
    for (let x = 4; x < W; x += 9 + rand() * 6) {
      const win = new THREE.Mesh(winGeo, glow);
      win.position.set(x, 7 + rand() * 3, -9.9);
      group.add(win);
    }
    const moon = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), new THREE.MeshBasicMaterial({ color: 0xf6f0d8 }));
    moon.position.set(W * 0.3, 12, -30);
    group.add(moon);
  } else if (backdrop === 'gears') {
    const mat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
    for (let x = 0; x < W; x += 8 + rand() * 8) {
      const r = 1.5 + rand() * 2.5;
      const gear = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.28, 6, 10), mat);
      gear.position.set(x, 4 + rand() * 8, -9 - rand() * 6);
      gear.name = 'gear';
      group.add(gear);
    }
  } else if (backdrop === 'towers') {
    const stone = new THREE.MeshLambertMaterial({ color: 0x2a2236 });
    const roof = new THREE.MeshLambertMaterial({ color: 0x4a2a5a });
    const light = new THREE.MeshBasicMaterial({ color: 0xffc46a });
    const bodyGeo = new THREE.CylinderGeometry(1.4, 1.6, 1, 10);
    const roofGeo = new THREE.ConeGeometry(1.9, 3, 10);
    const winGeo = new THREE.BoxGeometry(0.4, 0.7, 0.1);
    for (let x = 0; x < W + 10; x += 9 + rand() * 9) {
      const h = 8 + rand() * 8;
      const tower = new THREE.Mesh(bodyGeo, stone);
      tower.scale.y = h;
      tower.position.set(x, h / 2 - 1, -14 - rand() * 6);
      const cap = new THREE.Mesh(roofGeo, roof);
      cap.position.set(x, h + 0.5, tower.position.z);
      const win = new THREE.Mesh(winGeo, light);
      win.position.set(x, h * 0.7, tower.position.z + 1.6);
      group.add(tower, cap, win);
    }
  } else {
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const geo = new THREE.SphereGeometry(0.07, 6, 4);
    for (let i = 0; i < W * 1.5; i++) {
      const s = new THREE.Mesh(geo, starMat);
      s.position.set(rand() * (W + 30) - 10, rand() * 18, -15 - rand() * 15);
      group.add(s);
    }
  }

  if (theme.clouds) {
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35 });
    const geo = new THREE.SphereGeometry(1, 12, 8);
    for (let x = 0; x < W + 20; x += 11 + rand() * 14) {
      const cloud = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const puff = new THREE.Mesh(geo, cloudMat);
        puff.scale.setScalar(0.9 + rand() * 0.5);
        puff.position.set(i * 1.1 - 1.6, rand() * 0.4, 0);
        cloud.add(puff);
      }
      cloud.scale.set(1, 0.7, 0.4);
      cloud.position.set(x, 11 + rand() * 3, -12);
      group.add(cloud);
    }
  }
  scene.add(mergeByMaterial(group));
}

/**
 * Bakes every mesh under the group into one mesh per material, so the old backdrops cost a few
 * draws instead of one per hill, star or crystal (the finale's sky alone was ~95 draws on a phone).
 */
function mergeByMaterial(group: THREE.Group): THREE.Group {
  group.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
    const mat = mesh.material as THREE.Material;
    const list = byMat.get(mat);
    if (list) list.push(geo);
    else byMat.set(mat, [geo]);
  });
  const merged = new THREE.Group();
  for (const [mat, geos] of byMat) {
    merged.add(new THREE.Mesh(mergeGeometries(geos)!, mat));
    for (const g of geos) g.dispose();
  }
  group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  return merged;
}
