/**
 * Pure colour maths for the art pass (no three.js, no DOM), so the readability tests can check
 * every theme's palette in node. Colours are 0xrrggbb numbers in sRGB.
 */

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (hex: number): [number, number, number] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const pack = (r: number, g: number, b: number) => (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b);

/** Parses '#rrggbb' (or passes a number through). */
export function hexOf(color: string | number): number {
  return typeof color === 'number' ? color : parseInt(color.replace('#', ''), 16);
}

/** Multiplies every channel by f, clamped. */
export function shade(hex: number, f: number): number {
  const [r, g, b] = rgb(hex);
  return pack(r * f, g * f, b * f);
}

/** Straight sRGB lerp from a (t = 0) to b (t = 1). */
export function mixHex(a: number, b: number, t: number): number {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return pack(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** A backdrop colour hazed toward the horizon sky by `haze` (0 = untouched, 1 = sky). */
export function hazeHex(color: number, sky: string | number, haze: number): number {
  return mixHex(color, hexOf(sky), haze);
}

/** '#rrggbb' for canvas painting. */
export function css(hex: number): string {
  return `#${(hex & 0xffffff).toString(16).padStart(6, '0')}`;
}

/** WCAG relative luminance. */
export function luminance(hex: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1 (same) to 21 (black on white). */
export function contrast(a: number, b: number): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A deterministic 0..1 hash of two numbers (integer or not). */
export function hash01(x: number, y: number): number {
  let h = Math.imul(Math.floor(x * 73856.093) | 0, 0x9e3779b1) ^ Math.imul(Math.floor(y * 19349.663) | 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
