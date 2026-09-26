import * as THREE from 'three';
import { ROSTER } from '../config/characters';
import { characterGallery } from './characterMeshes';
import { enemyGallery } from './enemyMeshes';
import { itemGallery } from './itemMeshes';
import { animateItem, canvasTexture, labelSprite, propGallery } from './meshes';

/**
 * Debug-only mesh gallery (`?debug&gallery=characters`, `=enemies`, `=items` or `=props`): every mesh in a lit lineup
 * with its name, at close-up size and at in-game size, so looks can be reviewed side by side.
 */
export function showGallery(root: HTMLElement, which: 'characters' | 'enemies' | 'items' | 'props'): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  root.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = canvasTexture(4, (c, s) => {
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#4f86f7');
    g.addColorStop(1, '#b8e2ff');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-4, 10, 8);
  scene.add(sun);

  const items =
    which === 'characters' ? characterGallery(ROSTER) : which === 'enemies' ? enemyGallery() : which === 'items' ? itemGallery() : propGallery();
  const perRow = which === 'characters' ? items.length : which === 'items' ? 9 : which === 'props' ? 5 : 7;
  const close = which === 'characters' ? 2 : which === 'items' ? 2.4 : which === 'props' ? 1.5 : 1;
  const cell = which === 'characters' ? 2.6 : which === 'items' ? 2.6 : which === 'props' ? 6.4 : 4.2;
  const spinners: THREE.Object3D[] = [];
  items.forEach((item, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const x = (col - (perRow - 1) / 2) * cell;
    const y = -row * 5.2;
    item.mesh.scale.multiplyScalar(close);
    item.mesh.position.set(x, y, 0);
    scene.add(item.mesh);
    spinners.push(item.mesh);
    const tag = labelSprite(item.name);
    tag.scale.multiplyScalar(0.45);
    tag.position.set(x, y - 0.6, 0.5);
    scene.add(tag);
  });
  // Characters also appear at in-game size, standing on a strip of ground.
  if (which === 'characters') {
    ROSTER.forEach((c, i) => {
      const small = characterGallery([c])[0].mesh;
      small.position.set((i - (ROSTER.length - 1) / 2) * 1.2, -4.2, 0);
      scene.add(small);
    });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 1.2), new THREE.MeshLambertMaterial({ color: 0x46c04a }));
    ground.position.set(0, -4.4, 0);
    scene.add(ground);
  }
  const rows = Math.ceil(items.length / perRow);
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
  const spanX = perRow * cell;
  const dist = Math.max(spanX / (2 * Math.tan(THREE.MathUtils.degToRad(20)) * camera.aspect), rows * 6) + 2;
  const centerY = which === 'characters' ? -1 : -((rows - 1) * 5.2) / 2 + 1;
  camera.position.set(0, centerY + 0.8, dist);
  camera.lookAt(0, centerY, 0);
  const t0 = performance.now();
  renderer.setAnimationLoop((now) => {
    const t = (now - t0) / 1000;
    for (const m of spinners) {
      // Items sit in a holder (so the close-up scale survives their idles) and play their own idle.
      const inner = m.userData.inner as THREE.Object3D | undefined;
      if (inner?.userData.anim) animateItem(inner, t);
      else (inner ?? m).rotation.y = Math.sin(t * 0.8) * 0.5;
    }
    renderer.render(scene, camera);
  });
  (window as unknown as { __smbGallery: () => number }).__smbGallery = () => items.length;
}
