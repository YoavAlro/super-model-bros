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
  /** One-way platforms block only a body that lands on them from above. */
  isOneWay?(tx: number, ty: number): boolean;
  /** Conveyor push under a tile: -1, 0 or 1. */
  conveyor?(tx: number, ty: number): number;
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
      const solid = grid.isSolid(tx, row);
      // A one-way platform catches a falling body whose feet started at or above its top.
      const ledge = !solid && b.vy < 0 && b.y >= row + 1 - EPS && !!grid.isOneWay?.(tx, row);
      if (solid || ledge) {
        if (solid) hits.push({ tx, ty: row, side: b.vy > 0 ? 'head' : 'feet' });
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

/** Calls `fn` for every tile the body overlaps (optionally grown by `pad` on every side). */
export function forTilesUnder(b: Body, pad: number, fn: (tx: number, ty: number) => void): void {
  const x0 = Math.floor(b.x - pad + EPS);
  const x1 = Math.floor(b.x + b.w + pad - EPS);
  const y0 = Math.floor(b.y - pad + EPS);
  const y1 = Math.floor(b.y + b.h + pad - EPS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) fn(tx, ty);
}
