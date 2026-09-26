import * as THREE from 'three';
import type { CapStyle, DecorStyle, HardStyle, ShelfStyle, SoilStyle, Theme } from '../config/themes';
import { css, evictThemeTextures, softTexture, type Paint } from './art';
import { hash01, shade } from './palette';
import { mulberry32 } from './rng';

/**
 * Tile painters: one 128 px atlas per tile family, laid out as four 64 px cells (F front, T top,
 * S sides, U underside; see CELL in art.ts). Ink is baked into the textures, never an outline hull.
 * Fixed kinds (prompt, used, toggles, hidden, gate, lava) are global; anything that bakes a theme
 * colour is 'theme' scope and dropped when the theme changes.
 */

type Ctx = CanvasRenderingContext2D;
const INK = 0x1d1424;
const TAU = Math.PI * 2;

let current: Theme | null = null;

/** Call first when building a level: a new theme frees the previous theme's textures. */
export function useTheme(theme: Theme): void {
  if (theme === current) return;
  if (current) evictThemeTextures();
  current = theme;
}

// ------------------------------------------------------------------ helpers
const rgba = (hex: number, a = 1) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
const up = (c: number) => shade(c, 1.18);
const dn = (c: number) => shade(c, 0.8);
const dd = (c: number) => shade(c, 0.62);

/** Which axes of a cell repeat seamlessly from tile to tile (the rest clamp to their edge pixels). */
type Wrap = 'none' | 'x' | 'y' | 'xy';
let scratch: HTMLCanvasElement | null = null;
/** [source start, source length, destination start, destination length] runs along one axis. */
const WRAPPED = [
  [0, 64, -58, 60],
  [0, 64, 2, 60],
  [0, 64, 62, 60],
] as const;
const CLAMPED = [
  [0, 1, 0, 2],
  [0, 64, 2, 60],
  [63, 1, 62, 2],
] as const;

/**
 * Paints one 64 px cell of a 128 px atlas. Painters draw in a 64 px space, which lands on the 60 px
 * window each cell is actually sampled over (CELL is inset 2 px against mip bleeding), so a border
 * drawn at the painter's edge sits exactly on the tile's edge. The 2 px gutters around the window
 * hold the cell's own continuation: the repeat on wrapped axes, the edge pixels otherwise.
 */
function inCell(c: Ctx, col: number, row: number, fn: (c: Ctx) => void, wrap: Wrap = 'none'): void {
  const s = (scratch ??= document.createElement('canvas'));
  s.width = s.height = 64; // also clears it and resets its state
  fn(s.getContext('2d')!);
  c.save();
  c.translate(col * 64, row * 64);
  c.beginPath();
  c.rect(0, 0, 64, 64);
  c.clip();
  c.imageSmoothingEnabled = true;
  const xs = wrap === 'x' || wrap === 'xy' ? WRAPPED : CLAMPED;
  const ys = wrap === 'y' || wrap === 'xy' ? WRAPPED : CLAMPED;
  for (const [sx, sw, dx, dw] of xs) for (const [sy, sh, dy, dh] of ys) c.drawImage(s, sx, sy, sw, sh, dx, dy, dw, dh);
  c.restore();
}
type CellFn = (c: Ctx, fn: (c: Ctx) => void, wrap?: Wrap) => void;
const F: CellFn = (c, fn, wrap) => inCell(c, 0, 0, fn, wrap);
const Tc: CellFn = (c, fn, wrap) => inCell(c, 1, 0, fn, wrap);
const S: CellFn = (c, fn, wrap) => inCell(c, 0, 1, fn, wrap);
const U: CellFn = (c, fn, wrap) => inCell(c, 1, 1, fn, wrap);

function fillAll(c: Ctx, hex: number, a = 1): void {
  c.fillStyle = rgba(hex, a);
  c.fillRect(0, 0, 64, 64);
}
function rect(c: Ctx, x: number, y: number, w: number, h: number, hex: number, a = 1): void {
  c.fillStyle = rgba(hex, a);
  c.fillRect(x, y, w, h);
}
function border(c: Ctx, px: number, hex: number, a: number): void {
  c.strokeStyle = rgba(hex, a);
  c.lineWidth = px;
  c.strokeRect(px / 2, px / 2, 64 - px, 64 - px);
}
function disc(c: Ctx, x: number, y: number, r: number, hex: number, a = 1, ry = r): void {
  c.fillStyle = rgba(hex, a);
  c.beginPath();
  c.ellipse(x, y, r, ry, 0, 0, TAU);
  c.fill();
}
function line(c: Ctx, pts: number[], w: number, hex: number, a = 1): void {
  c.strokeStyle = rgba(hex, a);
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.stroke();
}
/** Runs fn at every ±64 offset, so features that cross an edge wrap and the cell tiles seamlessly. */
function wrap(fn: (dx: number, dy: number) => void): void {
  for (const dx of [-64, 0, 64]) for (const dy of [-64, 0, 64]) fn(dx, dy);
}
/** A two-tone bevel just inside the cell edge: light top-left, dark bottom-right. */
function bevel(c: Ctx, inset: number, w: number, light: number, dark: number): void {
  const s = 64 - 2 * inset;
  rect(c, inset, inset, s, w, light);
  rect(c, inset, inset, w, s, light);
  rect(c, inset, 64 - inset - w, s, w, dark);
  rect(c, 64 - inset - w, inset, w, s, dark);
}
function glyph(c: Ctx, text: string, x: number, y: number, px: number): void {
  c.font = `bold ${px}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x, y);
}

const atlas = (key: string, paint: Paint, scope: 'global' | 'theme' = 'global') => softTexture(key, 128, 128, paint, scope);

// --------------------------------------------------------------- fixed kinds
/** The prompt ("?") block, frame k of 4: dot k of the typing indicator is raised (frame 3: none). */
export function promptFrames(): THREE.Texture[] {
  return [0, 1, 2, 3].map((k) =>
    atlas(`prompt:${k}`, (c) => {
      F(c, (c) => {
        fillAll(c, 0xffc23a);
        bevel(c, 3, 2, 0xffe08a, 0xc46a0a);
        border(c, 3, 0x6a2e00, 0.85);
        c.font = 'bold 38px system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = css(0xc46a0a);
        c.fillText('?', 34, 29);
        c.strokeStyle = css(0x6a2e00);
        c.lineWidth = 5;
        c.lineJoin = 'round';
        c.strokeText('?', 32, 27);
        c.fillStyle = css(0xfff3d0);
        c.fillText('?', 32, 27);
        [22, 32, 42].forEach((x, i) => {
          c.beginPath();
          c.arc(x, i === k ? 47 : 51, 3.2, 0, TAU);
          c.fillStyle = css(0xfff3d0);
          c.fill();
          c.lineWidth = 1.5;
          c.strokeStyle = css(0x6a2e00);
          c.stroke();
        });
      });
      for (const [cell, hex] of [[Tc, 0xffd25a], [S, 0xe0a020], [U, 0xc48a18]] as const) {
        cell(c, (c) => {
          fillAll(c, hex);
          border(c, 3, 0x6a2e00, 0.6);
        });
      }
    }),
  );
}

/** The answered prompt: a debossed tick on warm grey. */
export function usedAtlas(): THREE.Texture {
  return atlas('used', (c) => {
    F(c, (c) => {
      fillAll(c, 0x9a8a7a);
      bevel(c, 3, 2, 0xb8a898, 0x6e6054);
      border(c, 3, 0x5a4a3e, 1);
      line(c, [20, 33, 29, 42, 45, 22], 7, 0x6e6054);
      line(c, [21, 34, 30, 43, 46, 23], 3, 0xb8a898);
    });
    for (const [cell, hex] of [[Tc, 0xa89888], [S, 0x85766a], [U, 0x6e6054]] as const) {
      cell(c, (c) => {
        fillAll(c, hex);
        border(c, 3, 0x5a4a3e, 0.6);
      });
    }
  });
}

/** Clay pill bricks in the theme's brick colour. */
export function brickAtlas(C: number): THREE.Texture {
  return atlas(
    `brick:${C}`,
    (c) => {
      const face = (c: Ctx) => {
        fillAll(c, dd(C));
        [0, 16, 0].forEach((off, row) => {
          const y = row * 21;
          for (let x = off - 32; x < 64; x += 32) {
            c.fillStyle = css(shade(C, 0.92 + 0.16 * hash01(x + 64, row)));
            c.beginPath();
            c.roundRect(x + 1.5, y + 1.5, 29, 18, 6);
            c.fill();
            rect(c, x + 5.5, y + 3.5, 21, 2, up(C));
            rect(c, x + 5.5, y + 15, 21, 2, dn(C));
          }
        });
        border(c, 2, INK, 0.45);
      };
      F(c, face);
      S(c, face);
      Tc(c, (c) => {
        fillAll(c, dd(C));
        [0, 16].forEach((off, row) => {
          for (let x = off - 32; x < 64; x += 32) {
            c.fillStyle = css(shade(up(C), 0.94 + 0.12 * hash01(x + 64, row + 7)));
            c.beginPath();
            c.roundRect(x + 1.5, row * 32 + 2, 29, 28, 12);
            c.fill();
          }
        });
        border(c, 2, INK, 0.45);
      });
      U(c, (c) => fillAll(c, dn(C)));
    },
    'theme',
  );
}

/** Toggle blocks: '[' (A, blue) and ']' (B, orange), the map characters, so colour is never the only cue. */
export function toggleAtlas(which: 'A' | 'B'): THREE.Texture {
  const C = which === 'A' ? 0x46a0ff : 0xff7a46;
  return atlas(`toggle:${which}`, (c) => {
    F(c, (c) => {
      fillAll(c, C);
      c.strokeStyle = rgba(0xffffff, 0.85);
      c.lineWidth = 3;
      c.strokeRect(7.5, 7.5, 49, 49);
      c.fillStyle = rgba(INK, 0.8);
      glyph(c, which === 'A' ? '[' : ']', 34, 34, 40);
      c.fillStyle = '#ffffff';
      glyph(c, which === 'A' ? '[' : ']', 32, 32, 40);
      border(c, 3, INK, 0.45);
    });
    for (const [cell, hex] of [[Tc, up(C)], [S, dn(C)], [U, dd(C)]] as const) {
      cell(c, (c) => {
        fillAll(c, hex);
        border(c, 3, INK, 0.45);
      });
    }
  });
}

/** Hidden blocks (seen while thinking): dashed outline, ∴ and a glassy sheen. */
export function hiddenAtlas(): THREE.Texture {
  const C = 0xc8a8ff;
  return atlas('hidden', (c) => {
    for (const cell of [F, Tc, S, U]) {
      cell(c, (c) => {
        fillAll(c, C);
        c.fillStyle = rgba(0xffffff, 0.22);
        c.beginPath();
        c.moveTo(14, 64);
        c.lineTo(64, 14);
        c.lineTo(64, 30);
        c.lineTo(30, 64);
        c.closePath();
        c.fill();
        c.setLineDash([6, 4]);
        c.strokeStyle = '#ffffff';
        c.lineWidth = 3;
        c.strokeRect(4.5, 4.5, 55, 55);
        c.setLineDash([]);
      });
    }
    F(c, (c) => {
      c.fillStyle = rgba(0xffffff, 0.9);
      glyph(c, '∴', 32, 32, 28);
    });
  });
}

/** Storm gates: hazard-free warning stripes with a padlock. */
export function gateAtlas(): THREE.Texture {
  return atlas('gate', (c) => {
    F(c, (c) => {
      fillAll(c, 0xb03a48);
      c.fillStyle = css(0xf3e6d0);
      for (let k = -64; k < 128; k += 20) {
        c.beginPath();
        c.moveTo(k, 0);
        c.lineTo(k + 10, 0);
        c.lineTo(k + 10 - 64, 64);
        c.lineTo(k - 64, 64);
        c.closePath();
        c.fill();
      }
      disc(c, 32, 34, 12, 0xf3e6d0);
      c.strokeStyle = css(INK);
      c.lineWidth = 2;
      c.beginPath();
      c.arc(32, 34, 12, 0, TAU);
      c.stroke();
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(32, 31, 4.5, Math.PI, TAU);
      c.stroke();
      rect(c, 26, 31, 12, 10, INK);
      border(c, 3, INK, 0.55);
    });
    for (const cell of [Tc, S, U]) {
      cell(c, (c) => {
        fillAll(c, 0xb03a48);
        border(c, 3, INK, 0.55);
      });
    }
  });
}

/** Lava (64 px, repeats in x so it can scroll). The same in every theme. */
export function lavaTexture(): THREE.Texture {
  const tex = softTexture('lava', 64, 64, (c) => {
    const g = c.createLinearGradient(0, 64, 0, 0);
    g.addColorStop(0, css(0xb01a0a));
    g.addColorStop(0.4, css(0xff5a1a));
    g.addColorStop(1, css(0xff5a1a));
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = css(0xffd23a);
    c.beginPath();
    c.moveTo(0, 16);
    for (let x = 0; x <= 64; x += 2) c.lineTo(x, 8 + 3 * Math.sin((4 * Math.PI * x) / 64));
    c.lineTo(64, 16);
    c.closePath();
    c.fill();
    c.fillRect(0, 0, 64, 8);
    for (const [x, y, r] of [[8, 14, 4], [24, 19, 3], [41, 12, 5], [55, 18, 3.5]]) disc(c, x, y, r, 0xffe07a);
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Construction-toy tube bodies (theme.pipe) with rib pairs. */
export function pipeBody(C: number): THREE.Texture {
  return softTexture(
    `pipeBody:${C}`,
    64,
    64,
    (c) => {
      fillAll(c, C);
      for (const y of [14, 46]) {
        rect(c, 0, y, 64, 3, up(C));
        rect(c, 0, y + 3, 64, 3, dn(C));
      }
    },
    'theme',
  );
}

/** The bolted collar on a tube's top tile. Bolts at u 0.2 and 0.8, so one faces the camera. */
export function pipeCollar(C: number): THREE.Texture {
  return softTexture(
    `pipeCollar:${C}`,
    64,
    64,
    (c) => {
      fillAll(c, up(C));
      rect(c, 0, 0, 64, 8, shade(C, 1.3));
      rect(c, 0, 9, 64, 2, INK, 0.55);
      rect(c, 0, 59, 64, 2, INK, 0.55);
      for (const x of [13, 51]) {
        disc(c, x, 36, 5, dd(C));
        disc(c, x - 1.5, 34.5, 1.6, up(C));
      }
    },
    'theme',
  );
}

/** Alpha map: a soft rounded square (3 px falloff), for the paper drop shadows. */
export function shadowAlpha(): THREE.Texture {
  return softTexture('alpha:shadow', 32, 32, (c) => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 4; i++) {
      const v = Math.round(((i + 1) / 4) * 255);
      c.fillStyle = `rgb(${v},${v},${v})`;
      c.beginPath();
      c.roundRect(1 + i, 1 + i, 30 - 2 * i, 30 - 2 * i, Math.max(1, 6 - i));
      c.fill();
    }
  });
}

/** Alpha map: opaque at the bottom, clear at the top (lava glow, pit shade). */
export function gradientAlpha(): THREE.Texture {
  return softTexture('alpha:gradient', 32, 32, (c) => {
    const g = c.createLinearGradient(0, 32, 0, 0);
    g.addColorStop(0, '#fff');
    g.addColorStop(1, '#000');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
  });
}

/** The 3-stop sky behind everything (2×128). */
export function skyTexture(theme: Theme): THREE.Texture {
  return softTexture(
    `sky:${theme.skyTop}:${theme.skyMid}:${theme.skyBottom}`,
    2,
    128,
    (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, theme.skyTop);
      g.addColorStop(0.55, theme.skyMid);
      g.addColorStop(1, theme.skyBottom);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    },
    'theme',
  );
}

// ------------------------------------------------------------ themed: caps
/**
 * The walkable top of ground (C = theme.grass). The front cell is squashed to 1×0.26 on screen, so
 * it is painted about 4× taller than it reads: body from y 0 to about 40, the style's edge below,
 * transparent under the edge (alphaTest cuts it).
 */
export function capAtlas(style: CapStyle, C: number, ground: number): THREE.Texture {
  return atlas(
    `cap:${style}:${C}:${ground}`,
    (c) => {
      const rnd = mulberry32(style.length * 977 + 13);
      F(c, (c) => {
        c.clearRect(0, 0, 64, 64);
        const body = (bottom: number) => rect(c, 0, 0, 64, bottom, C);
        switch (style) {
          case 'felt': {
            body(40);
            c.fillStyle = css(C);
            c.beginPath();
            c.moveTo(0, 39);
            for (let i = 0; i < 8; i++) {
              c.lineTo(i * 8 + 4, 58);
              c.lineTo((i + 1) * 8, 40);
            }
            c.lineTo(64, 39);
            c.closePath();
            c.fill();
            for (let i = 0; i < 30; i++) rect(c, rnd() * 63, 3 + rnd() * 32, 1, 3, up(C));
            break;
          }
          case 'moss':
            body(46);
            for (let i = 0; i < 6; i++) disc(c, 5.3 + i * 10.67, 46, 6, C);
            for (let i = 0; i < 12; i++) disc(c, 3 + ((i * 5.3 + rnd() * 3) % 58), 8 + rnd() * 8, 2.5, 0x8ff4ff, 1, 7);
            break;
          case 'stone':
            body(44);
            rect(c, 0, 0, 64, 3, up(C));
            rect(c, 0, 35, 64, 2, INK, 0.45);
            for (const x of [16, 48]) rect(c, x, 3, 2, 32, INK, 0.25);
            break;
          case 'cotton':
            body(40);
            for (let i = 0; i < 4; i++) {
              const x = 8 + i * 16;
              const g = c.createRadialGradient(x - 2, 38, 1, x, 40, 9);
              g.addColorStop(0, css(C));
              g.addColorStop(1, css(0xcfe0ff));
              c.fillStyle = g;
              c.beginPath();
              c.ellipse(x, 40, 9, 9, 0, 0, TAU);
              c.fill();
            }
            rect(c, 0, 0, 64, 36, C);
            break;
          case 'slate':
            body(40);
            rect(c, 0, 7, 64, 2, 0xe8f0ff);
            for (const [x, len] of [[7, 10], [19, 14], [33, 8], [45, 12], [57, 9]]) {
              c.fillStyle = css(C);
              c.beginPath();
              c.moveTo(x - 3, 39);
              c.quadraticCurveTo(x - 3, 40 + len * 0.6, x, 40 + len);
              c.quadraticCurveTo(x + 3, 40 + len * 0.6, x + 3, 39);
              c.closePath();
              c.fill();
            }
            break;
          case 'rubber':
            body(44);
            for (let y = 6; y < 40; y += 14) for (let x = 4; x < 64; x += 8) disc(c, x + (y % 28 ? 4 : 0), y, 1.5, dn(C), 1, 5);
            break;
          case 'carpet':
            body(40);
            rect(c, 0, 5, 64, 2, 0xd8b048);
            rect(c, 0, 33, 64, 2, 0xd8b048);
            for (let x = 1; x < 64; x += 4) rect(c, x, 40, 2, 18, 0xd8b048);
            break;
          case 'walkway':
            body(44);
            rect(c, 0, 4, 64, 3, 0xffffff);
            for (const x of [8, 24, 40, 56]) disc(c, x, 28, 2, 0x5a4a2a, 1, 7);
            break;
          case 'trim':
            // A gilt band thick enough to read as the walkable edge at phone size.
            rect(c, 0, 0, 64, 16, C);
            rect(c, 0, 3, 64, 2, 0xfff4c0);
            rect(c, 0, 15, 64, 2, INK);
            rect(c, 0, 17, 64, 27, shade(ground, 1.1));
            rect(c, 0, 40, 64, 2, C);
            break;
        }
      }, 'x');
      Tc(c, (c) => {
        if (style === 'trim') {
          fillAll(c, shade(ground, 1.25));
          rect(c, 0, 56, 64, 8, C);
          rect(c, 0, 57, 64, 2, 0xfff4c0);
          return;
        }
        fillAll(c, up(C));
        if (style === 'felt') for (let i = 0; i < 40; i++) disc(c, rnd() * 64, rnd() * 64, 1, i % 2 ? shade(C, 1.35) : dn(C));
        else if (style === 'moss') for (let i = 0; i < 12; i++) disc(c, rnd() * 64, rnd() * 64, 2.5, 0x8ff4ff);
        else if (style === 'rubber') for (let y = 4; y < 64; y += 8) for (let x = 4; x < 64; x += 8) disc(c, x, y, 1.5, C);
        else if (style === 'carpet') rect(c, 0, 58, 64, 3, 0xd8b048);
        else if (style === 'walkway') rect(c, 0, 58, 64, 3, 0xffffff);
      }, 'x');
      // The cap stands 0.03 proud of the ground, so its sides and underside would show through the
      // cut-out below the edge as a tick at every seam: sides stop at the edge line, the underside is
      // clear.
      S(c, (c) => rect(c, 0, 0, 64, 40, dn(C)));
      U(c, (c) => c.clearRect(0, 0, 64, 64));
    },
    'theme',
  );
}

// ------------------------------------------------------------ themed: soil
/** Ground (C = theme.ground). F is seamless both ways; S carries ink lines for exposed pit walls. */
export function soilAtlas(style: SoilStyle, C: number, glow = false): THREE.Texture {
  return atlas(
    `soil:${style}:${C}:${glow}`,
    (c) => {
      const rnd = mulberry32(style.length * 131 + 7);
      F(c, (c) => {
        fillAll(c, glow ? 0x000000 : C);
        switch (style) {
          case 'soil':
            if (glow) break;
            for (const y of [14, 34, 52]) {
              c.strokeStyle = css(shade(C, 0.92));
              c.lineWidth = 5;
              c.beginPath();
              for (let x = 0; x <= 64; x += 2) {
                const yy = y + 2 * Math.sin((TAU * x) / 64 + y);
                if (x === 0) c.moveTo(x, yy);
                else c.lineTo(x, yy);
              }
              c.stroke();
            }
            for (let i = 0; i < 6; i++) {
              const [x, y] = [rnd() * 64, rnd() * 64];
              wrap((dx, dy) => {
                disc(c, x + dx, y + dy + 1, 4, shade(C, 0.7), 1, 3);
                disc(c, x + dx, y + dy, 4, up(C), 1, 3);
              });
            }
            line(c, [8, 25, 15, 24, 21, 27, 28, 26, 33, 29], 1.2, shade(C, 0.6));
            line(c, [21, 27, 24, 31], 1.2, shade(C, 0.6));
            break;
          case 'rock':
            if (!glow) {
              for (let i = 0; i < 5; i++) {
                const pts = [rnd() * 64, rnd() * 64];
                for (let k = 0; k < 3; k++) pts.push(pts[pts.length - 2] + (rnd() - 0.5) * 18, pts[pts.length - 1] + (rnd() - 0.2) * 14);
                wrap((dx, dy) => line(c, pts.map((v, j) => v + (j % 2 ? dy : dx)), 1.5, INK, 0.4));
              }
            }
            for (let i = 0; i < 8; i++) {
              const [x, y] = [rnd() * 64, rnd() * 64];
              wrap((dx, dy) => {
                c.fillStyle = css(glow ? 0x5ad8ff : 0x3a7ab0);
                c.beginPath();
                c.moveTo(x + dx, y + dy - 3);
                c.lineTo(x + dx + 2.2, y + dy);
                c.lineTo(x + dx, y + dy + 3);
                c.lineTo(x + dx - 2.2, y + dy);
                c.closePath();
                c.fill();
              });
            }
            break;
          case 'ashlar':
            if (glow) break;
            fillAll(c, shade(C, 0.6));
            for (const [row, off] of [[0, 0], [1, 20]]) {
              for (const [x0, w] of [[off - 64, 40], [off - 24, 24], [off, 40], [off + 40, 24], [off + 64, 40]]) {
                const tone = shade(C, 0.94 + 0.12 * hash01(x0 + 128, row));
                rect(c, x0 + 1, row * 32 + 1, w - 2, 30, tone);
                rect(c, x0 + 1, row * 32 + 1, w - 2, 2, up(C));
              }
            }
            break;
          case 'cardboard':
            if (glow) break;
            rect(c, 0, 11, 64, 3, shade(C, 0.8));
            rect(c, 0, 49, 64, 3, shade(C, 0.8));
            for (let x = 0; x < 64; x += 16) {
              disc(c, x + 4, 24, 3, shade(C, 0.7), 1, 4);
              disc(c, x + 12, 38, 3, shade(C, 0.7), 1, 4);
            }
            c.strokeStyle = css(shade(C, 0.85));
            c.lineWidth = 2.5;
            c.beginPath();
            for (let x = 0; x <= 64; x += 1) {
              const y = 31 + 14 * Math.sin((TAU * x) / 16);
              if (x === 0) c.moveTo(x, y);
              else c.lineTo(x, y);
            }
            c.stroke();
            break;
          case 'papier':
            if (glow) break;
            for (let i = 0; i < 4; i++) {
              const [x, y, r] = [rnd() * 64, rnd() * 64, 8 + rnd() * 4];
              wrap((dx, dy) => disc(c, x + dx, y + dy, r, shade(C, 1.06), 0.5));
            }
            rect(c, 4, 4, 56, 4, shade(C, 0.75));
            for (let col = 0; col < 4; col++) {
              for (let y = 14; y < 62; y += 5) {
                const len = 6 + rnd() * 6;
                rect(c, 3 + col * 15, y, len, 2, shade(C, 0.75));
              }
            }
            break;
          case 'hexmould': {
            if (glow) break;
            // Six columns of five: an even column count, so the staggered grid repeats every 64 px.
            const rx = 7.11;
            const hy = 6.4;
            for (let col = -1; col <= 6; col++) {
              for (let row = -1; row <= 5; row++) {
                const cx = col * 10.667;
                const cy = row * 12.8 + (col & 1 ? 6.4 : 0);
                const v = [[cx - rx, cy], [cx - rx / 2, cy - hy], [cx + rx / 2, cy - hy], [cx + rx, cy], [cx + rx / 2, cy + hy], [cx - rx / 2, cy + hy]];
                line(c, [v[0][0], v[0][1], v[1][0], v[1][1], v[2][0], v[2][1]], 1.5, up(C));
                line(c, [v[3][0], v[3][1], v[4][0], v[4][1], v[5][0], v[5][1]], 1.5, dn(C));
              }
            }
            break;
          }
          case 'wainscot':
            if (glow) break;
            rect(c, 0, 0, 64, 3, shade(C, 0.7));
            rect(c, 0, 61, 64, 3, shade(C, 0.7));
            for (const x of [4, 36]) {
              rect(c, x, 6, 24, 52, shade(C, 1.05));
              rect(c, x, 6, 24, 2, up(C));
              rect(c, x, 6, 2, 52, up(C));
              rect(c, x, 56, 24, 2, dd(C));
              rect(c, x + 22, 6, 2, 52, dd(C));
            }
            break;
          case 'plates':
            if (glow) break;
            for (const px of [0, 32]) {
              for (const py of [0, 32]) {
                rect(c, px, py, 32, 32, shade(C, 0.6));
                rect(c, px + 1, py + 1, 30, 30, C);
                for (const [rx, ry] of [[5, 5], [27, 5], [5, 27], [27, 27]]) {
                  disc(c, px + rx, py + ry + 0.8, 2, shade(C, 0.6));
                  disc(c, px + rx, py + ry, 2, up(C));
                }
              }
            }
            break;
          case 'resin': {
            // Gold-mended crackle (kintsugi): the veins wrap both ways, so the ground reads as one
            // crazed glaze rather than the same stamp on every tile.
            const vein = glow ? 0xffc040 : 0xc9a44a;
            const a = glow ? 0.75 : 0.55;
            const veins: [number[], number][] = [
              [[0, 22, 10, 26, 19, 20, 30, 27, 41, 24, 52, 31, 64, 22], 1.6],
              [[30, 27, 33, 38, 27, 47, 31, 56, 28, 64], 1.6],
              [[28, 0, 26, 8, 19, 20], 1.6],
              [[41, 24, 46, 14, 55, 9], 1.2],
            ];
            wrap((dx, dy) => {
              for (const [pts, w] of veins) line(c, pts.map((v, j) => v + (j % 2 ? dy : dx)), w, vein, a);
            });
            break;
          }
          case 'starfield':
            for (let i = 0; i < 10; i++) {
              const [x, y, r] = [rnd() * 64, rnd() * 64, 0.6 + rnd() * 0.6];
              disc(c, x, y, r, 0xffffff, glow ? 1 : 0.7);
            }
            if (!glow) {
              c.strokeStyle = rgba(0xffffff, 0.12);
              c.lineWidth = 1;
              c.beginPath();
              for (let k = 0; k <= 6; k++) {
                const ang = (k / 6) * TAU;
                const [x, y] = [40 + 10 * Math.cos(ang), 22 + 10 * Math.sin(ang)];
                if (k === 0) c.moveTo(x, y);
                else c.lineTo(x, y);
              }
              c.stroke();
            }
            break;
        }
      }, 'xy');
      if (glow) return;
      Tc(c, (c) => fillAll(c, shade(C, 1.08)));
      S(c, (c) => {
        fillAll(c, shade(C, 0.8));
        rect(c, 0, 0, 3, 64, INK, 0.5);
        rect(c, 61, 0, 3, 64, INK, 0.5);
      }, 'y');
      U(c, (c) => fillAll(c, shade(C, 0.6)));
    },
    'theme',
  );
}

/** Soils whose flecks glow (they get an emissive map). */
export const GLOWING_SOILS: SoilStyle[] = ['rock', 'resin', 'starfield'];

// ------------------------------------------------------------ themed: hard
/** Unbreakable blocks (C = theme.hard): a heavy bevelled frame around a motif. */
export function hardAtlas(style: HardStyle, C: number, glow = false): THREE.Texture {
  return atlas(
    `hard:${style}:${C}:${glow}`,
    (c) => {
      const frame = (c: Ctx, base: number) => {
        fillAll(c, dd(base));
        rect(c, 2, 2, 60, 60, dn(base));
        bevel(c, 2, 2, up(base), dd(base));
        rect(c, 8, 8, 48, 48, style === 'star' ? shade(base, 0.5) : base);
        c.strokeStyle = rgba(INK, 0.7);
        c.lineWidth = 2;
        c.strokeRect(8, 8, 48, 48);
        border(c, 3, INK, 0.55);
      };
      if (glow) {
        F(c, (c) => {
          fillAll(c, 0x000000);
          star4(c, 32, 32, 10, 3, 0xffe08a);
        });
        return;
      }
      F(c, (c) => {
        frame(c, C);
        c.save();
        c.beginPath();
        c.rect(9, 9, 46, 46);
        c.clip();
        switch (style) {
          case 'rings':
            for (const r of [6, 12, 18, 24]) {
              c.strokeStyle = css(dn(C));
              c.lineWidth = 1.5;
              c.beginPath();
              c.arc(30, 34, r, 0, TAU);
              c.stroke();
            }
            line(c, [30, 34, 38, 28, 42, 30, 50, 20], 1.5, dd(C));
            break;
          case 'facets':
            for (const [pts, hex] of [
              [[8, 8, 56, 8], up(C)],
              [[56, 8, 56, 56], C],
              [[56, 56, 8, 56], dn(C)],
              [[8, 56, 8, 8], shade(C, 0.9)],
            ] as const) {
              c.fillStyle = css(hex);
              c.beginPath();
              c.moveTo(pts[0], pts[1]);
              c.lineTo(pts[2], pts[3]);
              c.lineTo(32, 32);
              c.closePath();
              c.fill();
            }
            break;
          case 'bands':
            for (const y of [16, 40]) {
              rect(c, 8, y, 48, 6, 0x4a4a52);
              for (const x of [16, 32, 48]) disc(c, x, y + 3, 2, 0x8a8a92);
            }
            break;
          case 'creases':
            line(c, [9, 9, 55, 55], 1, 0xffffff, 0.45);
            line(c, [55, 9, 9, 55], 1, 0xffffff, 0.45);
            line(c, [10, 9, 56, 55], 1, dn(C));
            line(c, [56, 9, 10, 55], 1, dn(C));
            line(c, [32, 22, 42, 32, 32, 42, 22, 32, 32, 22], 1.5, dn(C));
            break;
          case 'veins':
            c.strokeStyle = css(shade(C, 0.7));
            c.lineWidth = 1.5;
            for (const [a, b, cc, d] of [
              [10, 20, 30, 10],
              [12, 44, 40, 30],
              [20, 56, 50, 40],
            ]) {
              c.beginPath();
              c.moveTo(a, b);
              c.bezierCurveTo(a + 12, b - 10, cc - 6, d + 16, cc + 20, d + 6);
              c.stroke();
            }
            break;
          case 'strap':
            for (let i = 0; i < 5; i++) rect(c, 12, 13 + i * 8, i % 2 ? 26 : 36, 2, dn(C));
            line(c, [32, 8, 32, 56], 5, INK, 0.8);
            line(c, [8, 32, 56, 32], 5, INK, 0.8);
            line(c, [32, 8, 32, 56], 3, 0xe8d8a0);
            line(c, [8, 32, 56, 32], 3, 0xe8d8a0);
            disc(c, 32, 32, 4, 0xe8d8a0);
            c.strokeStyle = rgba(INK, 0.8);
            c.lineWidth = 1;
            c.beginPath();
            c.arc(32, 32, 4, 0, TAU);
            c.stroke();
            break;
          case 'screws':
            line(c, [10, 10, 54, 54], 2, dn(C));
            line(c, [54, 10, 10, 54], 2, dn(C));
            for (const [x, y] of [[15, 15], [49, 15], [15, 49], [49, 49]]) {
              disc(c, x, y, 4, up(C));
              line(c, [x - 2.5, y + 2.5, x + 2.5, y - 2.5], 1.5, INK, 0.8);
            }
            break;
          case 'corners':
            for (const [x, y, sx, sy] of [[8, 8, 1, 1], [56, 8, -1, 1], [8, 56, 1, -1], [56, 56, -1, -1]]) {
              c.fillStyle = css(0xd8a848);
              c.strokeStyle = rgba(INK, 0.8);
              c.lineWidth = 1.5;
              c.beginPath();
              c.moveTo(x, y);
              c.lineTo(x + 12 * sx, y);
              c.lineTo(x, y + 12 * sy);
              c.closePath();
              c.fill();
              c.stroke();
            }
            rect(c, 27, 28, 10, 8, 0xd8a848);
            c.strokeRect(27, 28, 10, 8);
            break;
          case 'crate':
            for (const y of [20, 36]) {
              rect(c, 8, y, 48, 4, up(C));
              rect(c, 8, y + 4, 48, 2, dn(C));
            }
            line(c, [32, 12, 40, 20, 35, 20, 35, 30, 29, 30, 29, 20, 24, 20, 32, 12], 1.5, dn(C));
            break;
          case 'star':
            c.strokeStyle = css(0xd8b048);
            c.lineWidth = 2;
            c.strokeRect(12, 12, 40, 40);
            star4(c, 32, 32, 10, 3, 0xffe08a);
            break;
        }
        c.restore();
      });
      Tc(c, (c) => frame(c, shade(C, 1.12)));
      S(c, (c) => frame(c, shade(C, 0.9)));
      U(c, (c) => frame(c, shade(C, 0.7)));
    },
    'theme',
  );
}

function star4(c: Ctx, x: number, y: number, outer: number, inner: number, hex: number): void {
  c.fillStyle = css(hex);
  c.beginPath();
  for (let k = 0; k < 8; k++) {
    const r = k % 2 ? inner : outer;
    const a = (k / 8) * TAU - Math.PI / 2;
    if (k === 0) c.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
    else c.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  c.closePath();
  c.fill();
}

// ----------------------------------------------------------- themed: shelf
/**
 * One-way shelves (C = theme.platform). The slab's F is squashed to 1×0.3 and the fringe (U) to
 * 1×0.16, so round features are painted tall. U is transparent unless the style hangs a fringe.
 */
export function shelfAtlas(style: ShelfStyle, C: number): THREE.Texture {
  return atlas(
    `shelf:${style}:${C}`,
    (c) => {
      const SQ = 3.3; // the front's vertical squash
      F(c, (c) => {
        fillAll(c, C);
        switch (style) {
          case 'rope':
            for (const y of [16, 28, 40, 52]) rect(c, 0, y, 64, 2, shade(C, 0.85));
            for (const x of [10, 54]) disc(c, x, 34, 3, 0x5a4a3a, 1, 3 * SQ);
            break;
          case 'gills':
            rect(c, 0, 0, 64, 12, up(C));
            break;
          case 'brackets':
          case 'rivets':
            for (const x of style === 'brackets' ? [12, 52] : [8, 20, 32, 44, 56]) {
              disc(c, x, 34, 2.5, up(C), 1, 2.5 * SQ);
              rect(c, x - 2, 34 + 2.5 * SQ, 4, 2, INK, 0.5);
            }
            break;
          case 'news':
            for (const [x, y, w] of [[6, 14, 24], [36, 14, 20], [6, 26, 40]]) rect(c, x, y, w, 2, shade(C, 0.6));
            rect(c, 0, 38, 64, 2, shade(C, 0.6), 0.6);
            break;
          case 'holes':
            for (const x of [12, 32, 52]) {
              disc(c, x, 32, 5, up(C), 1, 5 * SQ);
              disc(c, x, 34, 5, 0x2a2a2a, 1, 5 * SQ - 2);
            }
            break;
          case 'books': {
            const cols = [0x6a3a5a, 0x2a6a6a, 0xb88a3a, C];
            let x = 0;
            for (let i = 0; x < 64; i++) {
              const w = 6 + ((i * 5) % 6);
              rect(c, x, 0, w - 1, 64, cols[i % 4]);
              rect(c, x, 12, w - 1, 2, 0xd8b048);
              rect(c, x, 50, w - 1, 2, 0xd8b048);
              x += w;
            }
            break;
          }
          case 'slots':
            for (let i = 0; i < 6; i++) rect(c, 5 + i * 10, 18, 4, 30, 0x2a2a2a);
            break;
          case 'glow':
            rect(c, 0, 61, 64, 3, 0xffd166);
            break;
          case 'scallops':
            break;
        }
        rect(c, 0, 0, 64, 3, style === 'glow' ? 0xffffff : up(C));
        rect(c, 0, 62, 64, 2, INK, 0.5);
      }, 'x');
      Tc(c, (c) => {
        fillAll(c, up(C));
        rect(c, 0, 61, 64, 3, 0xffffff, 0.5);
      }, 'x');
      S(c, (c) => fillAll(c, dn(C)));
      U(c, (c) => {
        c.clearRect(0, 0, 64, 64);
        switch (style) {
          case 'rope':
            c.strokeStyle = css(0xc8a060);
            c.lineWidth = 4;
            for (const x of [6, 58]) {
              c.beginPath();
              c.ellipse(x, 25, 4, 25, 0, 0, TAU);
              c.stroke();
            }
            break;
          case 'gills':
            disc(c, 32, 0, 30, shade(C, 0.75), 1, 56);
            for (let i = 0; i < 9; i++) {
              const a = Math.PI * (0.1 + (0.8 * i) / 8);
              line(c, [32, 0, 32 + 27 * Math.cos(a), 50 * Math.sin(a)], 1.5, shade(C, 0.55));
            }
            break;
          case 'brackets':
            for (const x of [8, 52]) {
              rect(c, x, 0, 4, 64, 0x3a3a42);
              line(c, [x < 32 ? x + 4 : x, 50, x < 32 ? x + 14 : x - 10, 2], 3, 0x3a3a42);
            }
            rect(c, 8, 0, 14, 5, 0x3a3a42);
            rect(c, 42, 0, 14, 5, 0x3a3a42);
            break;
          case 'scallops':
            for (let i = 0; i < 5; i++) {
              disc(c, 6.4 + i * 12.8, 0, 6.4, 0xcfe0ff, 1, 42);
              disc(c, 6.4 + i * 12.8, 0, 5.4, shade(C, 0.92), 1, 36);
            }
            break;
          case 'books':
            rect(c, 28, 0, 8, 36, 0x3a3a42);
            break;
          case 'slots':
            for (const x of [10, 50]) rect(c, x, 0, 5, 40, 0x3a3a42);
            break;
          case 'glow': {
            const g = c.createLinearGradient(0, 0, 0, 64);
            g.addColorStop(0, rgba(0xfff0c0, 0.8));
            g.addColorStop(1, rgba(0xfff0c0, 0));
            c.fillStyle = g;
            c.fillRect(0, 0, 64, 64);
            break;
          }
          default:
            break;
        }
      }, 'x');
    },
    'theme',
  );
}

// --------------------------------------------------------------------- decor
/**
 * Little cut-outs standing on some caps (daisies, shrooms, screws…), 64 px, transparent around them.
 * The quad they go on is 0.5 × 0.3, so painters draw in a 64 × 38.4 space (scaled up to fill the
 * canvas) with the ground line at the bottom. Ink edges, like the tiles.
 */
export function decorTexture(style: DecorStyle): THREE.Texture {
  return softTexture(`decor:${style}`, 64, 64, (c) => {
    c.clearRect(0, 0, 64, 64);
    c.setTransform(1, 0, 0, 64 / 38.4, 0, 0);
    const G = 38.4;
    const ink = (w = 2) => {
      c.strokeStyle = rgba(INK, 0.75);
      c.lineWidth = w;
      c.lineJoin = 'round';
      c.stroke();
    };
    const blob = (x: number, y: number, r: number, hex: number, ry = r) => {
      c.beginPath();
      c.ellipse(x, y, r, ry, 0, 0, TAU);
      c.fillStyle = rgba(hex);
      c.fill();
      ink(1.5);
    };
    const poly = (pts: number[], hex: number) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = rgba(hex);
      c.fill();
      ink(1.5);
    };
    const star4 = (x: number, y: number, r: number, hex: number) => {
      const pts: number[] = [];
      for (let k = 0; k < 8; k++) {
        const rr = k % 2 ? r * 0.3 : r;
        const a = (k / 8) * TAU - Math.PI / 2;
        pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      poly(pts, hex);
    };
    const hexNut = (x: number, y: number, r: number, hex: number, hole: number) => {
      const pts: number[] = [];
      for (let k = 0; k < 6; k++) pts.push(x + Math.cos((k / 6) * TAU) * r, y + Math.sin((k / 6) * TAU) * r * 0.8);
      poly(pts, hex);
      disc(c, x, y, r * 0.38, hole);
    };
    switch (style) {
      case 'daisies':
        for (const [x, h] of [[14, 22], [30, 28], [47, 18]]) {
          line(c, [x, G, x + 1, G - h], 2.5, 0x2f8a3a);
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * TAU;
            blob(x + 1 + Math.cos(a) * 4.2, G - h + Math.sin(a) * 4.2, 3.2, 0xffffff);
          }
          blob(x + 1, G - h, 2.6, 0xffc933);
        }
        for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3.5]]) blob(56 + dx, G - 5 + dy, 3, 0x46c04a);
        break;
      case 'shrooms':
        for (const [x, h, r] of [[16, 16, 8], [34, 24, 10], [50, 12, 6]]) {
          c.beginPath();
          c.rect(x - r * 0.3, G - h, r * 0.6, h);
          c.fillStyle = rgba(0xcfe8ff);
          c.fill();
          ink(1.5);
          c.beginPath();
          c.ellipse(x, G - h, r, r * 0.75, 0, Math.PI, TAU);
          c.closePath();
          c.fillStyle = rgba(0x5ad8ff);
          c.fill();
          ink(1.5);
          disc(c, x - r * 0.35, G - h - r * 0.35, r * 0.18, 0xffffff, 0.85);
        }
        break;
      case 'tufts':
        for (let k = 0; k < 5; k++) {
          const x = 10 + k * 7;
          line(c, [x, G, x + (k - 2) * 3, G - 14 - (k % 2) * 6], 3, 0x9ac050);
        }
        line(c, [48, G, 49, G - 16], 2.5, 0x6a9a3a);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU;
          blob(49 + Math.cos(a) * 4, G - 18 + Math.sin(a) * 4, 3, 0xff8a3a);
        }
        blob(49, G - 18, 2.2, 0xffe08a);
        break;
      case 'papers':
        for (const [x, r] of [[20, 10], [44, 8]]) {
          blob(x, G - r, r, 0xe8e0c8);
          line(c, [x - r * 0.6, G - r * 1.2, x - 1, G - r * 0.8, x + r * 0.5, G - r * 1.3], 1.2, 0xb8b0a0);
          line(c, [x - r * 0.3, G - r * 0.4, x + r * 0.4, G - r * 0.6], 1.2, 0xb8b0a0);
        }
        break;
      case 'screws':
      case 'bolts': {
        const [a, b] = style === 'screws' ? [0xc0c8d0, 0xa0a8b0] : [0x8a8e96, 0x6a6e76];
        // A screw (or bolt) lying down, and a hex nut.
        c.beginPath();
        c.rect(10, G - 9, 22, 7);
        c.fillStyle = rgba(b);
        c.fill();
        ink(1.5);
        for (let x = 13; x < 32; x += 4) line(c, [x, G - 9, x + 2, G - 2], 1, shade(b, 0.7));
        blob(10, G - 5.5, 6, a, 7);
        line(c, [10, G - 11, 10, G], 1.5, shade(a, 0.6));
        hexNut(46, G - 7, 8, a, shade(b, 0.55));
        if (style === 'bolts') hexNut(58, G - 5, 5, b, shade(b, 0.5));
        break;
      }
      case 'candles':
        for (const [x, h] of [[20, 18], [42, 12]]) {
          c.beginPath();
          c.rect(x - 5, G - h, 10, h);
          c.fillStyle = rgba(0xf0e0c0);
          c.fill();
          ink(1.5);
          blob(x - 2, G - h + 3, 2.2, 0xf0e0c0, 3.5);
          line(c, [x, G - h, x, G - h - 3], 1.2, INK);
          c.beginPath();
          c.ellipse(x, G - h - 7, 3.2, 5.5, 0, 0, TAU);
          c.fillStyle = rgba(0xffd27a);
          c.fill();
          disc(c, x, G - h - 6, 1.4, 0xffffff, 0.9);
        }
        break;
      case 'shards':
        for (const [x, h, w, tilt] of [[18, 22, 8, -4], [34, 30, 10, 2], [50, 16, 7, 5]]) {
          poly([x - w / 2, G, x + w / 2, G, x + tilt + w * 0.2, G - h, x + tilt - w * 0.3, G - h + 3], 0xd8b458);
          poly([x, G, x + w / 2, G, x + tilt + w * 0.2, G - h], shade(0xd8b458, 1.2));
        }
        break;
      case 'twinkles':
        star4(16, G - 12, 9, 0xffe08a);
        star4(36, G - 20, 7, 0xffe08a);
        star4(52, G - 9, 6, 0xffe08a);
        break;
    }
  });
}

/** A lava bubble: a molten crest-yellow ball with a darker rim and a glint (the hazard palette only). */
export function bubbleTexture(): THREE.Texture {
  return softTexture('lava:bubble', 32, 32, (c) => {
    c.clearRect(0, 0, 32, 32);
    disc(c, 16, 16, 14, 0xff5a1a);
    disc(c, 16, 15, 11, 0xffd23a);
    disc(c, 11, 10, 3, 0xffffff, 0.85);
  });
}

/** A conveyor pulley's face: a dark rubber wheel with four spokes, a yellow hub and an ink rim. */
export function pulleyTexture(): THREE.Texture {
  return softTexture('conveyor:pulley', 64, 64, (c) => {
    c.clearRect(0, 0, 64, 64);
    disc(c, 32, 32, 32, 0x1a1c22);
    disc(c, 32, 32, 27, 0x3c404a);
    for (let k = 0; k < 4; k++) {
      c.save();
      c.translate(32, 32);
      c.rotate((k * Math.PI) / 2);
      rect(c, -3, 6, 6, 20, 0x1a1c22);
      c.restore();
    }
    disc(c, 32, 32, 9, 0xffcf3a);
    disc(c, 32, 32, 4, 0x1a1c22);
    disc(c, 24, 22, 3, 0xffffff, 0.35);
  });
}
