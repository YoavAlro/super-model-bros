import * as THREE from 'three';
import type { TintGroup } from './staticMerge';
import { starGlow, starHue, starLightness, starSaturation, starWeight, type StarKind } from './starRules';

/**
 * The star rainbow's material cache: finds every tintable material under a character's mesh, keeps
 * its own colour, emissive and emissive intensity in `material.userData.starOriginal`, tints it for
 * a frame, and puts it back exactly. No textures or DOM, so it is unit tested (`star.test.ts`).
 * Materials are per-instance (see `characterMeshes.ts` and `toonKit.ts`), so tinting one
 * character never tints another.
 *
 * Static parts merged by `staticMerge.ts` carry their colours in the vertices of one white material
 * (the geometry's `userData.tint` says which vertices had which colour): each of those colours is
 * tinted like the material it came from, in this character's own copy of the colour buffer, and the
 * merged material itself only takes the glow.
 */

type Tintable = THREE.Material & { color: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number };

interface Original {
  color: THREE.Color;
  emissive: THREE.Color | null;
  intensity: number;
}

/** A colour baked into a merged mesh's vertices. */
interface Paint {
  attr: THREE.BufferAttribute;
  /** [start, count, own]: own vertex colours are multiplied by the tint, as their material did. */
  ranges: [number, number, 0 | 1][];
  /** The colours as baked, to put back exactly. Shared by every group of the same buffer. */
  baked: Float32Array;
}

interface Part {
  mat: Tintable;
  orig: Original;
  /** 0 at the feet, 1 at the top of the character. */
  offset: number;
  lightness: number;
  weight: number;
  /** Set for a baked colour: it is written into these vertices, not into `mat` (whose colour stays white). */
  paint?: Paint;
  /** A merged material whose colours live in its vertices: only its glow is tinted. */
  glowOnly?: boolean;
}

const SRGB = THREE.SRGBColorSpace;
const HSL = { h: 0, s: 0, l: 0 };
const vivid = new THREE.Color();
const glow = new THREE.Color();
const tinted = new THREE.Color();

export class StarTint {
  private parts: Part[] | null = null;
  private buffers: Paint[] = [];
  private active = false;

  constructor(private readonly root: THREE.Object3D) {}

  /** Is any material showing star colours (until `restore()`)? */
  get tinted(): boolean {
    return this.active;
  }

  /** How many colours it tints: materials, and the colours baked into merged meshes. */
  get materials(): number {
    return this.parts?.filter((p) => !p.glowOnly).length ?? 0;
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
      if (!p.glowOnly) {
        vivid.setHSL(hue, sat, p.lightness, SRGB);
        tinted.copy(p.orig.color).lerp(vivid, mix * p.weight);
        if (p.paint) paint(p.paint, tinted);
        else p.mat.color.copy(tinted);
      }
      if (p.paint) continue;
      if (p.mat.emissive && p.orig.emissive) {
        // Blend from the part's own glow, so parts that glow anyway keep it on the off frames.
        p.mat.emissive.copy(p.orig.emissive).lerp(glow.setHSL(hue, 1, lum, SRGB), mix);
        p.mat.emissiveIntensity = THREE.MathUtils.lerp(p.orig.intensity, 1, mix);
      }
    }
    for (const b of this.buffers) b.attr.needsUpdate = true;
  }

  /** Puts every material's own colour, emissive and emissive intensity back. */
  restore(): void {
    if (!this.active || !this.parts) return;
    this.active = false;
    for (const p of this.parts) {
      if (p.paint) continue;
      p.mat.color.copy(p.orig.color);
      if (p.mat.emissive && p.orig.emissive) {
        p.mat.emissive.copy(p.orig.emissive);
        p.mat.emissiveIntensity = p.orig.intensity;
      }
    }
    for (const b of this.buffers) {
      (b.attr.array as Float32Array).set(b.baked);
      b.attr.needsUpdate = true;
    }
  }

  /**
   * Does every material match its cached original? `driven` is a material whose emissive the engine
   * sets itself whenever no star is up (the body's tool and think glows), so only its colour counts.
   */
  matchesOriginals(driven?: THREE.Material): boolean {
    return (
      (this.parts ?? []).every(
        (p) =>
          !!p.paint ||
          (p.mat.color.equals(p.orig.color) &&
            (p.mat === driven || !p.orig.emissive || (!!p.mat.emissive?.equals(p.orig.emissive) && p.mat.emissiveIntensity === p.orig.intensity))),
      ) && this.buffers.every((b) => (b.attr.array as Float32Array).every((v, i) => v === b.baked[i]))
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
        if (p.paint) continue;
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
    const found = new Map<Tintable, { y: number; glowOnly: boolean }>();
    const paints: { mat: Tintable; y: number; color: THREE.Color; paint: Paint }[] = [];
    const pos = new THREE.Vector3();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      root.worldToLocal(mesh.getWorldPosition(pos));
      const groups = mesh.geometry.userData.tint as TintGroup[] | undefined;
      const baked = !!groups && mats.length === 1 && !!mats[0]?.userData.baked;
      if (baked) {
        // This character's own copy of the merged geometry (the cached one is shared by every copy),
        // freed with the character: only its colours change.
        const own = mesh.geometry.clone();
        own.userData = { tint: groups };
        mesh.geometry = own;
        const attr = own.getAttribute('color') as THREE.BufferAttribute;
        const buffer = { attr, ranges: [], baked: new Float32Array(attr.array as Float32Array) };
        this.buffers.push(buffer);
        for (const t of groups!) {
          const at = root.worldToLocal(mesh.localToWorld(new THREE.Vector3(...t.at)));
          paints.push({ mat: mats[0] as Tintable, y: at.y, color: new THREE.Color(...t.color), paint: { ...buffer, ranges: t.ranges } });
        }
      }
      for (const m of mats as Tintable[]) if (m?.color instanceof THREE.Color && !found.has(m)) found.set(m, { y: pos.y, glowOnly: baked });
    });
    const ys = [...[...found.values()].filter((f) => !f.glowOnly).map((f) => f.y), ...paints.map((p) => p.y)];
    if (!ys.length) return [];
    const lo = Math.min(...ys);
    const span = Math.max(0.001, Math.max(...ys) - lo);
    const offset = (y: number) => THREE.MathUtils.clamp((y - lo) / span, 0, 1);
    return [
      ...[...found].map(([mat, { y, glowOnly }]) => {
        const orig: Original = { color: mat.color.clone(), emissive: mat.emissive?.clone() ?? null, intensity: 1 };
        mat.userData.starOriginal = orig;
        // capture() fills in the originals' values, lightness and weight.
        return { mat, orig, offset: offset(y), lightness: 0.5, weight: 1, glowOnly };
      }),
      ...paints.map(({ mat, y, color, paint }) => {
        color.getHSL(HSL, SRGB);
        return { mat, orig: { color, emissive: null, intensity: 1 }, offset: offset(y), lightness: starLightness(HSL.l), weight: starWeight(HSL.l), paint };
      }),
    ];
  }
}

/** Writes one tinted colour into a baked group's vertices (own vertex colours times the tint). */
function paint(p: Paint, c: THREE.Color): void {
  const out = p.attr.array as Float32Array;
  for (const [start, count, own] of p.ranges) {
    for (let i = start * 3, end = (start + count) * 3; i < end; i += 3) {
      out[i] = own ? p.baked[i] * c.r : c.r;
      out[i + 1] = own ? p.baked[i + 1] * c.g : c.g;
      out[i + 2] = own ? p.baked[i + 2] * c.b : c.b;
    }
  }
}
