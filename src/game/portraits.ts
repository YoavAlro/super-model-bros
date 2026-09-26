import * as THREE from 'three';
import type { CharacterSpec } from '../config/characters';
import { makeCharacter } from './characterMeshes';
import { disposeObject } from './dispose';

/**
 * Renders each character once into a small head-and-shoulders portrait (a PNG data URL) for the
 * title screen's roster cards, lit like the game. One short-lived WebGL context for the whole
 * roster, released straight away. Returns an empty map when WebGL is unavailable.
 */
export function renderPortraits(roster: readonly CharacterSpec[], cssSize: number): Map<string, string> {
  const out = new Map<string, string>();
  const px = Math.round(cssSize * Math.min(window.devicePixelRatio || 1, 2));
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return out;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(px, px, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-4, 10, 8);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  camera.position.set(0.35, 0.75, 2.7);
  camera.lookAt(0, 0.56, 0);
  for (const c of roster) {
    const mesh = makeCharacter(c);
    mesh.rotation.y = 0.3;
    scene.add(mesh);
    renderer.render(scene, camera);
    out.set(c.id, renderer.domElement.toDataURL('image/png'));
    scene.remove(mesh);
    disposeObject(mesh);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
