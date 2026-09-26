/** Axis-aligned body. (x, y) is the bottom-left corner, in tile units. */
export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
}

export interface Grid {
  isSolid(tx: number, ty: number): boolean;
}

export interface TileHit {
  tx: number;
  ty: number;
  side: 'head' | 'feet' | 'left' | 'right';
}

const EPS = 1e-4;

/** Moves a body through the tile grid (X then Y) and returns every solid tile it touched. */
export function moveBody(b: Body, dt: number, grid: Grid): TileHit[] {
  const hits: TileHit[] = [];

  if (b.vx !== 0) {
    const nx = b.x + b.vx * dt;
    const y0 = Math.floor(b.y + EPS);
    const y1 = Math.floor(b.y + b.h - EPS);
    const col = b.vx > 0 ? Math.floor(nx + b.w - EPS) : Math.floor(nx);
    let blocked = false;
    for (let ty = y0; ty <= y1; ty++) {
      if (grid.isSolid(col, ty)) {
        hits.push({ tx: col, ty, side: b.vx > 0 ? 'right' : 'left' });
        blocked = true;
      }
    }
    if (blocked) {
      b.x = b.vx > 0 ? col - b.w : col + 1;
      b.vx = 0;
    } else {
      b.x = nx;
    }
  }

  b.onGround = false;
  if (b.vy !== 0) {
    const ny = b.y + b.vy * dt;
    const x0 = Math.floor(b.x + EPS);
    const x1 = Math.floor(b.x + b.w - EPS);
    const row = b.vy > 0 ? Math.floor(ny + b.h - EPS) : Math.floor(ny);
    let blocked = false;
    for (let tx = x0; tx <= x1; tx++) {
      if (grid.isSolid(tx, row)) {
        hits.push({ tx, ty: row, side: b.vy > 0 ? 'head' : 'feet' });
        blocked = true;
      }
    }
    if (blocked) {
      if (b.vy > 0) {
        b.y = row - b.h;
      } else {
        b.y = row + 1;
        b.onGround = true;
      }
      b.vy = 0;
    } else {
      b.y = ny;
    }
  }
  return hits;
}

export function overlaps(a: Body, b: Body): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Of the head hits, the one closest to the body's center: the block that actually gets bumped. */
export function bumpedTile(b: Body, hits: TileHit[]): TileHit | undefined {
  const cx = b.x + b.w / 2;
  let best: TileHit | undefined;
  for (const h of hits) {
    if (h.side !== 'head') continue;
    if (!best || Math.abs(h.tx + 0.5 - cx) < Math.abs(best.tx + 0.5 - cx)) best = h;
  }
  return best;
}
