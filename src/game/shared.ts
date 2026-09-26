import type * as THREE from 'three';

/**
 * Marks geometry, materials and textures reused across levels, so level teardown (`disposeObject`)
 * leaves them alone. Lives in its own module so meshes.ts and toonKit.ts can both import it
 * without an import cycle.
 */
export function shared<T extends THREE.Material | THREE.BufferGeometry | THREE.Texture>(thing: T): T {
  thing.userData.shared = true;
  return thing;
}
