import * as THREE from 'three';

/** Frees every geometry, material and texture under a scene, except the ones shared across levels. */
export function disposeObject(root: THREE.Object3D): void {
  const seen = new Set<unknown>();
  const free = (thing: { dispose(): void; userData?: Record<string, unknown> } | null | undefined) => {
    if (!thing || seen.has(thing) || thing.userData?.shared) return;
    seen.add(thing);
    thing.dispose();
  };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) free(mesh.geometry);
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      if (m.userData.shared) continue;
      for (const value of Object.values(m)) if (value instanceof THREE.Texture) free(value);
      free(m);
    }
  });
  const bg = (root as THREE.Scene).background;
  if (bg instanceof THREE.Texture) free(bg);
}
