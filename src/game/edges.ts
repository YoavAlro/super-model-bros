import type { Edge } from '../config/themes';
import { hash01 } from './palette';

/** Pure silhouette profiles for the cardboard backdrop strips (config.edgeY in the world spec). */

const fract = (v: number) => v - Math.floor(v);

/**
 * Height of a strip's cut edge above (or, for hanging strips, below) its `top`, at world x.
 * Deterministic for a given seed (callers pass |z|·7.13) and always within ±1.3·amp.
 */
export function edgeY(edge: Edge, x: number, amp: number, period: number, seed: number): number {
  const h = (i: number) => hash01(i, seed);
  switch (edge) {
    case 'rolling':
      return amp * (0.6 * Math.sin((2 * Math.PI * x) / period + seed) + 0.4 * Math.sin((2 * Math.PI * x) / (0.47 * period) + 2.3 * seed));
    case 'scallop': {
      const u = x / period + seed;
      const f = fract(u);
      return amp * (0.7 + 0.3 * h(Math.floor(u))) * Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
    }
    case 'jagged': {
      const u = x / (period / 2);
      const j = Math.floor(u);
      const knot = (k: number) => (k % 2 === 0 ? 0.55 + 0.45 * h(k) : 0.15 * h(k)) * amp;
      const f = u - j;
      return knot(j) + (knot(j + 1) - knot(j)) * f;
    }
    case 'crenel':
      return fract(x / period) < 0.55 ? amp : 0;
    case 'skyline': {
      const i = Math.floor(x / period);
      const body = amp * (0.35 + 0.65 * h(i));
      const antenna = hash01(i, seed + 1) < 1 / 3 && Math.abs(fract(x / period) - 0.5) < 0.05;
      return body + (antenna ? 0.25 * amp : 0);
    }
    case 'roofs': {
      const i = Math.floor(x / period);
      return h(i) * amp * 0.3 + amp * (0.5 + 0.5 * h(i)) * (1 - Math.abs(2 * fract(x / period) - 1));
    }
    case 'drip': {
      const i = Math.floor(x / period);
      return amp * (0.4 + 0.6 * h(i)) * (1 - Math.abs(2 * fract(x / period) - 1)) ** 3;
    }
  }
}
