import * as THREE from 'three';
import { starGlow, starHue, starLightness, starSaturation, starWeight, type StarKind } from './starRules';

/**
 * The star rainbow's material cache: finds every tintable material under a character's mesh, keeps
 * its own colour, emissive and emissive intensity in `material.userData.starOriginal`, tints it for
 * a frame, and puts it back exactly. No textures or DOM, so it is unit tested (`star.test.ts`).
 * Materials are per-instance (see `characterMeshes.ts` and `toonKit.ts`), so tinting one
 * character never tints another.
 */

type Tintable = THREE.Material & { color: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number };

interface Original {
  color: THREE.Color;
  emissive: THREE.Color | null;
  intensity: number;
}

interface Part {
  mat: Tintable;
  orig: Original;
  /** 0 at the feet, 1 at the top of the character. */
  offset: number;
  lightness: number;
  weight: number;
}

const SRGB = THREE.SRGBColorSpace;
const HSL = { h: 0, s: 0, l: 0 };
const vivid = new THREE.Color();
const glow = new THREE.Color();

export class StarTint {
  private parts: Part[] | null = null;
  private active = false;

  constructor(private readonly root: THREE.Object3D) {}

  /** Is any material showing star colours (until `restore()`)? */
  get tinted(): boolean {
    return this.active;
  }

  get materials(): number {
    return this.parts?.length ?? 0;
  }

  /**
   * Tints every material for this frame. `phase` is the rainbow's accumulated cycle count and `mix`
   * how strongly the star shows (0: exactly the character's own colours, as on a warning blink's
   * off frames; 1: full star colours).
   */
  apply(kind: StarKind, phase: number, mix: number): void {
    const parts = this.capture();
    this.active = true;
    const sat = starSaturation(kind);
    const lum = starGlow(kind);
    for (const p of parts) {
      const hue = starHue(kind, phase, p.offset);
      vivid.setHSL(hue, sat, p.lightness, SRGB);
      p.mat.color.copy(p.orig.color).lerp(vivid, mix * p.weight);
      if (p.mat.emissive && p.orig.emissive) {
        // Blend from the part's own glow, so parts that glow anyway keep it on the off frames.
        p.mat.emissive.copy(p.orig.emissive).lerp(glow.setHSL(hue, 1, lum, SRGB), mix);
        p.mat.emissiveIntensity = THREE.MathUtils.lerp(p.orig.intensity, 1, mix);
      }
    }
  }

  /** Puts every material's own colour, emissive and emissive intensity back. */
  restore(): void {
    if (!this.active || !this.parts) return;
    this.active = false;
    for (const p of this.parts) {
      p.mat.color.copy(p.orig.color);
      if (p.mat.emissive && p.orig.emissive) {
        p.mat.emissive.copy(p.orig.emissive);
        p.mat.emissiveIntensity = p.orig.intensity;
      }
    }
  }

  /**
   * Does every material match its cached original? `driven` is a material whose emissive the engine
   * sets itself whenever no star is up (the body's tool and think glows), so only its colour counts.
   */
  matchesOriginals(driven?: THREE.Material): boolean {
    return (this.parts ?? []).every(
      (p) =>
        p.mat.color.equals(p.orig.color) &&
        (p.mat === driven || !p.orig.emissive || (!!p.mat.emissive?.equals(p.orig.emissive) && p.mat.emissiveIntensity === p.orig.intensity)),
    );
  }

  /**
   * Finds every tintable material under the mesh once. At the start of each star (never while
   * tinted) it re-reads their current values as the originals, so a glow the engine set between
   * stars (a tool picked up) is what comes back.
   */
  private capture(): Part[] {
    if (!this.parts) this.parts = this.find();
    if (!this.active) {
      for (const p of this.parts) {
        p.orig.color.copy(p.mat.color);
        if (p.orig.emissive && p.mat.emissive) p.orig.emissive.copy(p.mat.emissive);
        p.orig.intensity = p.mat.emissiveIntensity ?? 1;
        p.orig.color.getHSL(HSL, SRGB);
        p.lightness = starLightness(HSL.l);
        p.weight = starWeight(HSL.l);
      }
    }
    return this.parts;
  }

  private find(): Part[] {
    const root = this.root;
    root.updateMatrixWorld(true);
    const found = new Map<Tintable, number>();
    const pos = new THREE.Vector3();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      root.worldToLocal(mesh.getWorldPosition(pos));
      for (const m of mats as Tintable[]) if (m?.color instanceof THREE.Color && !found.has(m)) found.set(m, pos.y);
    });
    if (!found.size) return [];
    const ys = [...found.values()];
    const lo = Math.min(...ys);
    const span = Math.max(0.001, Math.max(...ys) - lo);
    return [...found].map(([mat, y]) => {
      const orig: Original = { color: mat.color.clone(), emissive: mat.emissive?.clone() ?? null, intensity: 1 };
      mat.userData.starOriginal = orig;
      // capture() fills in the originals' values, lightness and weight.
      return { mat, orig, offset: (y - lo) / span, lightness: 0.5, weight: 1 };
    });
  }
}
