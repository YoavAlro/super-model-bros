import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { THEMES, type Edge, type ThemeId } from '../config/themes';
import { atlasUV, CELL, type Rect } from './art';
import { edgeY } from './edges';
import { Pool } from './fxPool';
import { contrast, hazeHex } from './palette';

const themes = Object.entries(THEMES) as [ThemeId, (typeof THEMES)[ThemeId]][];
const EDGES: Edge[] = ['rolling', 'scallop', 'jagged', 'crenel', 'skyline', 'roofs', 'drip'];

describe('backdrop readability (all 12 themes)', () => {
  it('(a) keeps every backdrop layer hazed toward the sky', () => {
    for (const [id, t] of themes) {
      const layers = [...t.strips, ...t.scenery.filter((s) => s.piece !== 'torches')];
      for (const l of layers) {
        expect(l.haze, `${id} z ${l.z}`).toBeGreaterThanOrEqual(0.25);
        if (l.z <= -55) expect(l.haze, `${id} far layer z ${l.z}`).toBeGreaterThanOrEqual(0.3);
      }
    }
  });

  it('(b) keeps tiles apart from everything behind them', () => {
    for (const [id, t] of themes) {
      const behind: { name: string; color: number }[] = [
        ...t.strips.map((s) => ({ name: `${s.edge} strip z ${s.z}`, color: hazeHex(s.color, t.skyBottom, s.haze) })),
        ...t.scenery.filter((s) => s.piece !== 'torches').map((s) => ({ name: `${s.piece} z ${s.z}`, color: hazeHex(s.colors[0], t.skyBottom, s.haze) })),
        ...(t.clouds ? [{ name: 'clouds', color: hazeHex(t.cloudColor ?? 0xffffff, t.skyBottom, 0.35) }] : []),
      ];
      for (const tile of ['grass', 'platform', 'brick', 'hard', 'ground'] as const) {
        for (const b of behind) expect(contrast(t[tile], b.color), `${id}: ${tile} vs ${b.name}`).toBeGreaterThanOrEqual(1.4);
      }
    }
  });

  it('(c) keeps flat-topped strips far away and only walls and torches close', () => {
    for (const [id, t] of themes) {
      for (const s of t.strips) if (s.edge === 'crenel' || s.edge === 'skyline') expect(s.z, `${id} ${s.edge}`).toBeLessThanOrEqual(-40);
      for (const s of t.scenery) if (s.z > -12) expect(['wall', 'torches'], `${id} ${s.piece} at z ${s.z}`).toContain(s.piece);
    }
  });

  it('keeps every sun channel at 0xa0 or above, so the cast never goes muddy', () => {
    for (const [id, t] of themes) {
      for (const shift of [16, 8, 0]) expect((t.lights.sun >> shift) & 255, `${id} sun ${t.lights.sun.toString(16)}`).toBeGreaterThanOrEqual(0xa0);
    }
  });

  it('(d) edge profiles are deterministic and bounded by 1.3·amp', () => {
    for (const edge of EDGES) {
      for (const [amp, period, seed] of [
        [3, 44, 70 * 7.13],
        [1.5, 3, 60 * 7.13],
        [6, 5, 0],
        [2.5, 7, 40 * 7.13],
      ]) {
        for (let x = -60; x < 300; x += 0.37) {
          const y = edgeY(edge, x, amp, period, seed);
          expect(Number.isFinite(y)).toBe(true);
          expect(Math.abs(y), `${edge} at ${x}`).toBeLessThanOrEqual(1.3 * amp);
          expect(edgeY(edge, x, amp, period, seed)).toBe(y);
        }
      }
    }
  });
});

describe('tile atlas', () => {
  it('(e) maps every face of a tile box into its own cell', () => {
    const geo = atlasUV(new THREE.BoxGeometry(1, 1, 1.2));
    const uv = geo.getAttribute('uv');
    const n = geo.getAttribute('normal');
    const inside = (u: number, v: number, r: Rect) => u >= r[0] - 1e-6 && u <= r[2] + 1e-6 && v >= r[1] - 1e-6 && v <= r[3] + 1e-6;
    for (let i = 0; i < uv.count; i++) {
      const [nx, ny, nz] = [n.getX(i), n.getY(i), n.getZ(i)];
      const cell = Math.abs(nz) > 0.5 ? CELL.F : ny > 0.5 ? CELL.T : ny < -0.5 ? CELL.U : CELL.S;
      expect(inside(uv.getX(i), uv.getY(i), cell), `vertex ${i} (${nx},${ny},${nz})`).toBe(true);
    }
  });
});

describe('fx pool', () => {
  it('(f) caps, expires and reuses particles without growing', () => {
    const pool = new Pool(64);
    const arrays = [pool.x, pool.y, pool.age, pool.r];
    let dropped = 0;
    for (let i = 0; i < 100; i++) {
      const p = pool.spawn();
      if (p < 0) dropped++;
      else pool.life[p] = 0.5;
    }
    expect(pool.count).toBe(64);
    expect(dropped).toBe(36);
    pool.step(0.3);
    expect(pool.count).toBe(64);
    pool.step(0.3);
    expect(pool.count).toBe(0);
    for (let i = 0; i < 10; i++) expect(pool.spawn()).toBe(i);
    expect(pool.count).toBe(10);
    expect(pool.x.length).toBe(64);
    expect([pool.x, pool.y, pool.age, pool.r]).toEqual(arrays);
  });

  it('integrates drag, gravity and spin, and swap-removes the dead', () => {
    const pool = new Pool(4);
    const a = pool.spawn();
    pool.vx[a] = 2;
    pool.grav[a] = 10;
    pool.spin[a] = 3;
    pool.life[a] = 1;
    const b = pool.spawn();
    pool.life[b] = 0.05;
    const c = pool.spawn();
    pool.x[c] = 7;
    pool.life[c] = 1;
    pool.step(0.1);
    expect(pool.count).toBe(2);
    expect(pool.x[0]).toBeCloseTo(0.2);
    expect(pool.vy[0]).toBeCloseTo(-1);
    expect(pool.rot[0]).toBeCloseTo(0.3);
    expect(pool.x[1]).toBeCloseTo(7);
  });
});
