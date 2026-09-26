import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CHARACTERS, ROSTER } from '../config/characters';
import { CAPE, IDLE, TROT, animateCharacter, makeCharacter, makeCrowd, makeHelper, makeLookalike, type CharacterMotion } from './characterMeshes';
import { blinkScale, flick, hold, idleMoment, landingSquint, nextBlink, phaseOf, popIn, springWobble, strideRate } from './mascotMotion';
import { prefs } from './prefs';

const meshesOf = (root: THREE.Object3D) => {
  const out: THREE.Mesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => (o as THREE.Mesh).isMesh && out.push(o as THREE.Mesh));
  return out;
};

/** Every vertex of every mesh, in the mascot's own space. */
function vertices(root: THREE.Object3D, visibleOnly = false, skipEyes = false): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  for (const m of meshesOf(root)) {
    let hidden = false;
    let eye = false;
    for (let o: THREE.Object3D | null = m; o && o !== root; o = o.parent) {
      hidden ||= !o.visible;
      eye ||= o.name === 'eye';
    }
    if ((visibleOnly && hidden) || (skipEyes && eye)) continue;
    const pos = m.geometry.getAttribute('position');
    const toRoot = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    for (let i = 0; i < pos.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toRoot));
  }
  return out;
}

/**
 * The reasoning cape's cloth hangs from (0, 0.72, -0.3), flares from CAPE.top to CAPE.hem half-width
 * over CAPE.length (its hem curves 0.025 lower in the middle), is 0.04 thick, and swings back from
 * 0.15 rad (standing) to 1.25 rad (airborne: Player caps it there). A vertex collides if it is
 * inside the fan the cloth sweeps between the `swing` angles, padded by its half thickness plus
 * `hair` (a safety margin for the rest pose; moving parts are checked against the cloth itself).
 */
function hitsCape(v: THREE.Vector3, hair = 0.005, swing: readonly [number, number] = [0.15, 1.25]): boolean {
  if (v.y > 0.74) return false;
  const pad = 0.02 + hair;
  const dy = v.y - 0.72;
  const dz = v.z + 0.3;
  const len = Math.hypot(dy, dz);
  if (len > CAPE.length + 0.025 + pad) return false;
  if (Math.abs(v.x) > CAPE.top + (CAPE.hem - CAPE.top) * Math.min(1, len / CAPE.length) + 0.01) return false;
  // Angle of the vertex from straight down, swinging back toward -z.
  const angle = Math.atan2(-dz, -dy);
  const turn = pad / Math.max(len, 0.05);
  return angle > swing[0] - turn && angle < swing[1] + turn;
}

describe('mascot meshes', () => {
  for (const c of ROSTER) {
    describe(c.name, () => {
      const a = makeCharacter(c);
      const b = makeCharacter(c);

      it('has one body mesh with its own glowing material', () => {
        const bodies = meshesOf(a).filter((m) => m.name === 'body');
        expect(bodies).toHaveLength(1);
        const mat = bodies[0].material as THREE.MeshToonMaterial;
        expect(mat.emissive).toBeInstanceOf(THREE.Color);
        expect(mat.emissiveIntensity).toBeGreaterThanOrEqual(0.9);
      });

      it('shares no material with another copy of itself', () => {
        const mats = (r: THREE.Object3D) => new Set(meshesOf(r).flatMap((m) => (Array.isArray(m.material) ? m.material : [m.material])));
        const mb = mats(b);
        for (const m of mats(a)) expect(mb.has(m)).toBe(false);
      });

      it('shares geometry with another copy of itself (cached)', () => {
        const ga = meshesOf(a).map((m) => m.geometry);
        const gb = new Set(meshesOf(b).map((m) => m.geometry));
        expect(ga.every((g) => gb.has(g))).toBe(true);
      });

      it('is about one unit tall, feet on the ground, within the width budget', () => {
        const vs = vertices(a, true);
        const box = new THREE.Box3().setFromPoints(vs);
        expect(box.min.y).toBeGreaterThanOrEqual(-0.005);
        expect(box.max.y).toBeLessThanOrEqual(1.16);
        expect(box.max.y).toBeGreaterThan(0.9);
        expect(box.max.x - box.min.x).toBeLessThanOrEqual(1.0);
        expect(Math.abs(a.userData.top - box.max.y)).toBeLessThan(0.035);
      });

      it('stays within the draw budget', () => {
        // Every mesh, hidden ones too; static parts are merged (staticMerge.ts), so this counts scopes and kinds.
        expect(meshesOf(a).length).toBeLessThanOrEqual(28);
        const tris = meshesOf(a).reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3, 0);
        expect(tris).toBeLessThan(7000);
      });

      it('gives every vertex-coloured mesh a colour attribute', () => {
        for (const m of meshesOf(a)) {
          if ((m.material as THREE.Material & { vertexColors?: boolean }).vertexColors) expect(m.geometry.getAttribute('color')).toBeDefined();
        }
      });

      it('keeps clear of the reasoning cape, standing and airborne', () => {
        const hits = vertices(a).filter((v) => hitsCape(v));
        expect(hits.slice(0, 3).map((v) => v.toArray().map((n) => +n.toFixed(3)))).toEqual([]);
      });

      it('keeps clear of the reasoning cape while it idles, runs and jumps (moving parts too)', () => {
        const m = makeCharacter(c);
        let t = 0;
        const hits: number[][] = [];
        // On the ground Player holds the cape at 0.15 rad; in the air it swings back as far as 1.25.
        const states: [CharacterMotion, [number, number]][] = [
          [IDLE, [0.15, 0.15]],
          [{ speed: 12, airborne: false, vy: 0 }, [0.15, 0.15]],
          [{ speed: 8, airborne: true, vy: 10 }, [0.15, 1.25]],
          [{ speed: 10, airborne: true, vy: -5, dashing: true }, [0.15, 1.25]],
        ];
        for (const [s, swing] of states) {
          for (let i = 0; i < 360 && !hits.length; i++) {
            animateCharacter(m, (t += 1 / 30), s);
            if (i % 9 === 0) for (const v of vertices(m, true)) if (hitsCape(v, 0, swing)) hits.push(v.toArray().map((n) => +n.toFixed(3)));
          }
        }
        expect(hits.slice(0, 3)).toEqual([]);
      });

      it('has blinking eyes and every part the idle life looks for', () => {
        const eyes: THREE.Object3D[] = [];
        a.traverse((o) => o.name === 'eye' && eyes.push(o));
        expect(eyes.length).toBe(2);
        expect(typeof c.look.iris).toBe('number');
      });

      it('animates without throwing and returns to its rest pose under reduced motion', () => {
        const m = makeCharacter(c);
        const rest = vertices(m, false, true);
        const shown = (r: THREE.Object3D) => {
          const out: boolean[] = [];
          r.traverse((o) => out.push(o.visible));
          return out;
        };
        const restShown = shown(m);
        const states: CharacterMotion[] = [
          { speed: 12, airborne: false, vy: 0 },
          { speed: 6, airborne: true, vy: 12 },
          { speed: 0, airborne: false, vy: 0, thinking: true },
          { speed: 10, airborne: true, vy: -5, dashing: true },
          { speed: 20, airborne: false, vy: 0, seated: true },
          IDLE,
        ];
        let t = 0;
        for (const s of states) for (let i = 0; i < 40; i++) animateCharacter(m, (t += 1 / 30), s);
        // Idle for a long while (idle moments), then reduced motion settles every part.
        for (let i = 0; i < 400; i++) animateCharacter(m, (t += 1 / 30), IDLE);
        expect(vertices(m).every((v) => Number.isFinite(v.x + v.y + v.z))).toBe(true);
        prefs.reduceMotion = true;
        try {
          for (let i = 0; i < 90; i++) animateCharacter(m, (t += 1 / 30), { speed: 12, airborne: false, vy: 0 });
          // An air-dash is secondary motion too: no streaming tail or wind under reduced motion.
          for (let i = 0; i < 90; i++) animateCharacter(m, (t += 1 / 30), { speed: 0, airborne: false, vy: 0, dashing: true });
        } finally {
          prefs.reduceMotion = false;
        }
        const now = vertices(m, false, true);
        const worst = Math.max(...now.map((v, i) => v.distanceTo(rest[i])));
        expect(worst).toBeLessThan(1e-4);
        expect(shown(m)).toEqual(restShown);
      });

      it('does not idle (typing, pondering, chatting) while driving a kart', () => {
        const m = makeCharacter(c);
        let t = 0;
        for (let i = 0; i < 150; i++) animateCharacter(m, (t += 1 / 30), { speed: 20, airborne: false, vy: 0, seated: true });
        expect(m.userData.idle).toBe(0);
      });
    });
  }

  it('gives every hero its own iris colour and body plan', () => {
    expect(new Set(ROSTER.map((c) => c.look.iris)).size).toBe(ROSTER.length);
    expect(new Set(ROSTER.map((c) => c.look.plan)).size).toBe(ROSTER.length);
  });

  it('keeps the cape clasp touching the back', () => {
    for (const c of ROSTER) {
      const m = makeCharacter(c);
      m.updateMatrixWorld(true);
      // Straight in from behind at the clasp's height, the first thing hit is the back, 0.02–0.08 in front of it.
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 0.72, -1), new THREE.Vector3(0, 0, 1));
      const hit = ray.intersectObject(m, true).find((h) => h.object.name !== 'outline');
      expect(hit, c.name).toBeDefined();
      expect(hit!.point.z, c.name).toBeGreaterThan(-0.3);
      expect(hit!.point.z, c.name).toBeLessThan(-0.2);
    }
  });

  it('builds the helper', () => {
    const h = makeHelper();
    expect(h.userData.plan).toBe('helper');
    expect(meshesOf(h).length).toBeLessThanOrEqual(16);
    animateCharacter(h, 1, IDLE);
  });

  it('makes cheap look-alikes of every mascot: the same silhouette, still trotting and blinking', () => {
    const visible = (r: THREE.Object3D) => {
      let n = 0;
      r.traverseVisible((o) => (o as THREE.Mesh).isMesh && n++);
      return n;
    };
    for (const c of ROSTER) {
      const full = makeCharacter(c);
      const copy = makeLookalike(c);
      expect(visible(copy), c.name).toBeLessThanOrEqual(13);
      expect(visible(copy), c.name).toBeLessThan(visible(full));
      const box = (r: THREE.Object3D) => new THREE.Box3().setFromPoints(vertices(r, true));
      expect(box(copy).min.distanceTo(box(full).min), c.name).toBeLessThan(1e-4);
      expect(box(copy).max.distanceTo(box(full).max), c.name).toBeLessThan(1e-4);
      for (const name of ['pose', 'legL', 'legR']) expect(copy.getObjectByName(name), `${c.name} ${name}`).toBeDefined();
      const eyes: THREE.Object3D[] = [];
      copy.traverse((o) => o.name === 'eye' && eyes.push(o));
      expect(eyes, c.name).toHaveLength(2);
      let t = 0;
      for (let i = 0; i < 60; i++) animateCharacter(copy, (t += 1 / 30), TROT);
      expect(copy.getObjectByName('legL')!.rotation.x, c.name).not.toBe(0);
    }
  });

  it('draws each person of the viral crowd in one mesh', () => {
    const crowd = makeCrowd(10);
    expect(crowd.children).toHaveLength(10);
    for (const person of crowd.children) expect(meshesOf(person)).toHaveLength(1);
  });

  it('ignores meshes that are not mascots', () => {
    expect(() => animateCharacter(new THREE.Group(), 1, IDLE)).not.toThrow();
  });

  it('has a look for every character', () => {
    for (const c of Object.values(CHARACTERS)) expect(c.look.colors).toBeTruthy();
  });
});

describe('mascot timing', () => {
  it('blinks shut halfway and is open outside the blink', () => {
    expect(blinkScale(-0.01, 0.12)).toBe(1);
    expect(blinkScale(0.06, 0.12)).toBeCloseTo(0.1);
    expect(blinkScale(0.12, 0.12)).toBe(1);
    expect(blinkScale(0.03, 0.12)).toBeGreaterThan(0.1);
  });

  it('squints on landing and opens back up', () => {
    expect(landingSquint(0)).toBeCloseTo(0.7);
    expect(landingSquint(0.1)).toBeCloseTo(0.85);
    expect(landingSquint(0.3)).toBe(1);
  });

  it('wobbles from zero and settles', () => {
    expect(springWobble(0, 0.4)).toBe(0);
    expect(Math.abs(springWobble(0.06, 0.4))).toBeGreaterThan(0.1);
    expect(springWobble(2, 0.4)).toBe(0);
  });

  it('flicks 0 → 1 → 0', () => {
    expect(flick(0, 0.3)).toBe(0);
    expect(flick(0.15, 0.3)).toBeCloseTo(1);
    expect(flick(0.3, 0.3)).toBe(0);
    expect(flick(-1, 0.3)).toBe(0);
  });

  it('plays idle moments after a wait, then every period', () => {
    expect(idleMoment(3, 6, 1)).toBe(-1);
    expect(idleMoment(6.5, 6, 1)).toBeCloseTo(0.5);
    expect(idleMoment(7.5, 6, 1)).toBe(-1);
    expect(idleMoment(12.25, 6, 1)).toBeCloseTo(0.25);
  });

  it('pops in with an overshoot and settles at full size', () => {
    expect(popIn(0)).toBe(0);
    expect(popIn(0.7)).toBeGreaterThan(1);
    expect(popIn(1)).toBe(1);
    expect(popIn(2)).toBe(1);
  });

  it('holds an idle moment smoothly between its fades', () => {
    expect(hold(-1)).toBe(0);
    expect(hold(0)).toBe(0);
    expect(hold(0.5)).toBe(1);
    expect(hold(0.1)).toBeCloseTo(0.5);
    expect(hold(1)).toBe(0);
  });

  it('strides faster with speed, up to a cap', () => {
    expect(strideRate(13)).toBeGreaterThan(strideRate(8));
    expect(strideRate(40)).toBe(strideRate(16));
  });

  it('spaces blinks 3–5 s apart and phases them per name', () => {
    expect(nextBlink(0)).toBe(3);
    expect(nextBlink(1)).toBe(5);
    expect(phaseOf('chatBubble')).not.toBe(phaseOf('scarfBlock'));
    for (const n of ['a', 'chatBubble', 'galeCat']) expect(phaseOf(n)).toBeGreaterThanOrEqual(0), expect(phaseOf(n)).toBeLessThan(1);
  });
});
