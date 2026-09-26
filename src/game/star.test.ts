import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNES } from '../config/music';
import { parseMelody } from './musicTheory';
import {
  FLASH_LIMIT_HZ,
  STAR_BLINK_HZ,
  STAR_WARN,
  comboColor,
  comboLabel,
  comboPoints,
  knockPose,
  pickTune,
  spinAngle,
  spinDuration,
  starCycleRate,
  starHue,
  starLightness,
  starMix,
  starWeight,
  type StarKind,
} from './starRules';
import { mergeStatic } from './staticMerge';
import { StarTint } from './starTint';
import { INK, basic, toon } from './toonKit';

const KINDS: StarKind[] = ['rlhf', 'viral', 'mega'];

describe('star music', () => {
  const base = { level: 'overworld', over: false, starred: false, bossAwake: false } as const;

  it('plays the level theme, the boss tune while a boss is up, and the star tune over both', () => {
    expect(pickTune(base)).toBe('overworld');
    expect(pickTune({ ...base, bossAwake: true })).toBe('boss');
    expect(pickTune({ ...base, starred: true })).toBe('star');
    expect(pickTune({ ...base, starred: true, bossAwake: true })).toBe('star');
  });

  it('hands back to whatever should play when the star ends', () => {
    expect(pickTune({ ...base, level: 'castle', starred: false })).toBe('castle');
    expect(pickTune({ ...base, level: 'castle', starred: false, bossAwake: true })).toBe('boss');
  });

  it('goes quiet once the level is over, star or not', () => {
    expect(pickTune({ ...base, over: true })).toBeNull();
    expect(pickTune({ ...base, over: true, starred: true, bossAwake: true })).toBeNull();
  });

  it('ships a fast, original star loop that fills its bars', () => {
    const star = TUNES.star;
    expect(star.bpm).toBeGreaterThan(Math.max(...Object.values(TUNES).filter((t) => t !== star).map((t) => t.bpm)));
    expect(parseMelody(star.melody).steps).toBe(star.chords.length * 8);
  });
});

describe('star rainbow', () => {
  it('cycles fast when fresh and slower as it runs down', () => {
    for (const kind of KINDS) {
      const fresh = starCycleRate(kind, 10, 10, false);
      const mid = starCycleRate(kind, 6, 10, false);
      const warn = starCycleRate(kind, 1, 10, false);
      expect(fresh, kind).toBeGreaterThan(mid);
      expect(mid, kind).toBeGreaterThan(warn);
      expect(warn, kind).toBeGreaterThan(0);
    }
  });

  it('shows full colour until the warning, then blinks no faster than 3 Hz', () => {
    expect(starMix(STAR_WARN + 0.01, false)).toBe(1);
    expect(starMix(0, false)).toBe(0);
    expect(STAR_BLINK_HZ).toBeLessThanOrEqual(3);
    // Count on/off changes over the warning, sampled finely.
    let changes = 0;
    let prev = starMix(STAR_WARN, false);
    for (let left = STAR_WARN; left > 0; left -= 0.001) {
      const now = starMix(left, false);
      if (now !== prev) changes++;
      prev = now;
    }
    // Two changes make one flash: at most 3 flashes per second.
    expect(changes / 2 / STAR_WARN).toBeLessThanOrEqual(3);
    expect(changes).toBeGreaterThanOrEqual(6);
  });

  it('with reduced motion: a steady glow that fades out instead of blinking', () => {
    expect(starCycleRate('rlhf', 8, 8, true)).toBe(0);
    expect(starCycleRate('mega', 8, 12, true)).toBe(0);
    expect(starCycleRate('viral', 10, 10, true)).toBeLessThan(0.1);
    let prev = starMix(STAR_WARN, true);
    for (let left = STAR_WARN; left > 0; left -= 0.01) {
      const now = starMix(left, true);
      expect(now).toBeLessThanOrEqual(prev);
      prev = now;
    }
  });

  it('keeps every hue cycle, and the warning blink with the drift under it, within the flash limit', () => {
    const totals: Record<StarKind, number> = { rlhf: 8, viral: 10, mega: 12 };
    for (const kind of KINDS) {
      const total = totals[kind];
      for (const reduce of [false, true]) {
        for (let left = total; left > 0; left -= 0.05) {
          expect(starCycleRate(kind, left, total, reduce), kind).toBeLessThanOrEqual(FLASH_LIMIT_HZ);
        }
      }
      expect(STAR_BLINK_HZ + starCycleRate(kind, STAR_WARN / 2, total, false), kind).toBeLessThanOrEqual(FLASH_LIMIT_HZ);
    }
  });

  it("holds each part's lightness steady whatever the hue, keeping dark parts darker", () => {
    for (const own of [0, 0.1, 0.3, 0.5, 0.8, 1]) {
      const l = starLightness(own);
      expect(l).toBeGreaterThanOrEqual(0.25);
      expect(l).toBeLessThanOrEqual(0.75);
    }
    // Ordering survives: dark parts stay darker than light ones.
    expect(starLightness(0.1)).toBeLessThan(starLightness(0.9));
    // Eyes and ink lines mostly keep their colour; the body takes it fully.
    expect(starWeight(1)).toBeLessThan(1);
    expect(starWeight(0.05)).toBeLessThan(1);
    expect(starWeight(0.5)).toBe(1);
  });

  it('leans gold for RLHF and the frontier giant, and runs the whole rainbow when viral', () => {
    const hues = (kind: StarKind) => Array.from({ length: 200 }, (_, i) => starHue(kind, i / 50, (i % 7) / 6));
    for (const kind of ['rlhf', 'mega'] as const) {
      for (const h of hues(kind)) {
        expect(h, kind).toBeGreaterThan(0.05);
        expect(h, kind).toBeLessThan(0.18);
      }
    }
    const viral = hues('viral');
    expect(Math.max(...viral) - Math.min(...viral)).toBeGreaterThan(0.9);
    for (const h of viral) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});

describe('star somersault', () => {
  it('turns once through the rise, eased, and stops at the apex', () => {
    const d = spinDuration(23, 62);
    expect(d).toBeCloseTo(23 / 62);
    expect(spinAngle(0, d)).toBe(0);
    expect(spinAngle(d, d)).toBe(0);
    expect(spinAngle(d / 2, d)).toBeCloseTo(Math.PI);
    let prev = 0;
    for (let t = 0.001; t < d; t += 0.005) {
      const a = spinAngle(t, d);
      expect(a).toBeGreaterThanOrEqual(prev);
      expect(a).toBeLessThanOrEqual(2 * Math.PI);
      prev = a;
    }
    expect(spinDuration(100, 10)).toBeLessThanOrEqual(0.6);
    expect(spinDuration(1, 100)).toBeGreaterThanOrEqual(0.28);
  });
});

describe('star knock-offs', () => {
  it('flip upside down, pop up, drift away from the player and fall off the screen', () => {
    const start = knockPose(0, 1);
    expect(start.dy).toBe(0);
    expect(Math.abs(start.roll)).toBe(0);
    const flipped = knockPose(0.2, 1);
    expect(Math.abs(flipped.roll)).toBeGreaterThanOrEqual(Math.PI);
    expect(flipped.dy).toBeGreaterThan(0);
    expect(flipped.dx).toBeGreaterThan(0);
    expect(knockPose(0.2, -1).dx).toBeLessThan(0);
    expect(knockPose(0.3, 1).spin).toBeGreaterThan(knockPose(0.1, 1).spin);
    // It falls out of sight within a couple of seconds.
    let t = 0;
    while (!knockPose(t, 1).done) t += 0.01;
    expect(t).toBeGreaterThan(1);
    expect(t).toBeLessThan(3.01);
    expect(knockPose(t, 1).dy).toBeLessThan(-10);
  });

  it('scores an escalating chain', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(comboPoints)).toEqual([100, 200, 400, 800, 1600, 3200, 6400]);
    expect(comboPoints(20)).toBe(6400);
    expect(comboLabel(1)).toBe('100');
    expect(comboLabel(3)).toBe('400 ×3');
    expect(comboColor(1)).not.toBe(comboColor(4));
    expect(comboColor(99)).toBe(comboColor(7));
  });
});

describe('star tint', () => {
  /** A little character: a lit body with an engine-driven emissive, a glowing tip, unlit eyes, a toon part. */
  function character() {
    const root = new THREE.Group();
    const body = new THREE.MeshLambertMaterial({ color: 0x3a7bd5, emissive: 0x000000, emissiveIntensity: 0 });
    const tip = new THREE.MeshLambertMaterial({ color: 0xffb000, emissive: 0xffb000, emissiveIntensity: 0.6 });
    const eye = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hat = new THREE.MeshToonMaterial({ color: 0x8844aa, emissive: 0x110022, emissiveIntensity: 1 });
    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const add = (m: THREE.Material, y: number) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.y = y;
      root.add(mesh);
    };
    add(body, 0.4);
    add(tip, 1.1);
    add(eye, 0.7);
    add(eye, 0.7);
    add(hat, 0.95);
    const mats = [body, tip, eye, hat];
    const snapshot = () =>
      mats.map((m) => ({
        color: m.color.getHex(),
        emissive: 'emissive' in m ? (m.emissive as THREE.Color).getHex() : null,
        intensity: 'emissiveIntensity' in m ? m.emissiveIntensity : null,
      }));
    return { root, body, mats, snapshot };
  }

  it('finds every material once and tints them all', () => {
    const c = character();
    const own = c.snapshot();
    const tint = new StarTint(c.root);
    tint.apply('viral', 0.3, 1);
    expect(tint.materials).toBe(4);
    expect(tint.tinted).toBe(true);
    const now = c.snapshot();
    for (let i = 0; i < own.length; i++) expect(now[i].color, `material ${i}`).not.toBe(own[i].color);
    expect(now[0].intensity).toBe(1);
  });

  it("shows each part's own colours and glow on a warning blink's off frames", () => {
    const c = character();
    const own = c.snapshot();
    const tint = new StarTint(c.root);
    tint.apply('rlhf', 0.2, 1);
    tint.apply('rlhf', 0.4, 0);
    expect(c.snapshot()).toEqual(own);
    expect(tint.tinted).toBe(true);
  });

  it('puts every colour, emissive and intensity back exactly, across stars', () => {
    const c = character();
    const own = c.snapshot();
    const tint = new StarTint(c.root);
    // A star with its blink, a second star grabbed on top, then the end.
    tint.apply('rlhf', 0.1, 1);
    tint.apply('rlhf', 0.3, 0);
    tint.apply('viral', 0.6, 1);
    tint.apply('mega', 0.9, 0.5);
    tint.restore();
    expect(c.snapshot()).toEqual(own);
    expect(tint.tinted).toBe(false);
    expect(tint.matchesOriginals()).toBe(true);
    tint.restore();
    expect(c.snapshot()).toEqual(own);
  });

  it('brings back a glow the engine set between stars, and ignores the driven one when checking', () => {
    const c = character();
    const tint = new StarTint(c.root);
    tint.apply('rlhf', 0.1, 1);
    tint.restore();
    // A tool glow set on the body between two stars comes back after the second.
    c.body.emissive.setHex(0x0d5c50);
    const withTool = c.snapshot();
    tint.apply('viral', 0.5, 1);
    tint.restore();
    expect(c.snapshot()).toEqual(withTool);
    // Outside a star the engine drives the body's emissive (a thinking pulse): that alone is not a leak.
    c.body.emissive.setHex(0x402060);
    expect(tint.matchesOriginals()).toBe(false);
    expect(tint.matchesOriginals(c.body)).toBe(true);
  });

  describe('on merged meshes', () => {
    /** A lit body the engine glows, and static parts of four colours that merge into two meshes. */
    function doll() {
      const root = new THREE.Group();
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      geo.userData.shared = true;
      const body = new THREE.Mesh(geo, toon(0x3a7bd5));
      body.name = 'body';
      body.position.y = 0.5;
      root.add(body);
      for (const [mat, y] of [[toon(0xd04040), 0.05], [toon(0x40c060), 0.25], [basic(0xffffff), 0.9], [basic(INK), 1.0]] as const) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(0.1, y, 0.1);
        root.add(m);
      }
      return root;
    }
    /** The colour each visible vertex is drawn in (material colour times vertex colour), sorted. */
    const drawn = (root: THREE.Object3D) => {
      const out: string[] = [];
      root.traverse((o) => {
        const m = o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
        if (!m.isMesh || m.name === 'body') return;
        const col = m.material.vertexColors ? m.geometry.getAttribute('color') : null;
        for (let i = 0; i < m.geometry.getAttribute('position').count; i++) {
          const c = m.material.color.clone();
          if (col) c.multiply(new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)));
          out.push(c.toArray().map((v) => v.toFixed(6)).join(','));
        }
      });
      return out.sort();
    };

    it('tints each baked colour exactly as its own material would have been', () => {
      const parts = doll();
      const merged = doll();
      mergeStatic(merged);
      const meshes = merged.children.filter((o) => (o as THREE.Mesh).material && o.name !== 'body');
      expect(meshes).toHaveLength(2);
      expect(drawn(merged)).toEqual(drawn(parts));
      const a = new StarTint(parts);
      const b = new StarTint(merged);
      for (const [kind, phase] of [['viral', 0.3], ['rlhf', 0.6], ['mega', 0.1]] as const) {
        a.apply(kind, phase, 1);
        b.apply(kind, phase, 1);
        expect(drawn(merged), kind).toEqual(drawn(parts));
        expect(drawn(merged), kind).not.toEqual(drawn(doll()));
      }
      expect(b.materials).toBe(a.materials);
    });

    it('tints its own copy of the colours and puts them back exactly', () => {
      const root = doll();
      mergeStatic(root);
      const mesh = root.children.find((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.userData.baked) as THREE.Mesh;
      const cached = mesh.geometry;
      const own = drawn(root);
      const cachedColors = Float32Array.from(cached.getAttribute('color').array as Float32Array);
      const tint = new StarTint(root);
      tint.apply('viral', 0.4, 1);
      // The cached geometry (shared by every copy of the character) is never touched; the copy is freed with it.
      expect(mesh.geometry).not.toBe(cached);
      expect(mesh.geometry.userData.shared).toBeFalsy();
      expect(cached.getAttribute('color').array).toEqual(cachedColors);
      expect((mesh.material as THREE.MeshToonMaterial).color.getHex()).toBe(0xffffff);
      expect(drawn(root)).not.toEqual(own);
      expect(tint.matchesOriginals()).toBe(false);
      tint.apply('rlhf', 0.2, 0);
      expect(drawn(root)).toEqual(own);
      tint.apply('mega', 0.7, 0.5);
      tint.restore();
      expect(drawn(root)).toEqual(own);
      expect(mesh.geometry.getAttribute('color').array).toEqual(cachedColors);
      expect(tint.matchesOriginals()).toBe(true);
    });
  });
});
