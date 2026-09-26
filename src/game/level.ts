import type { DataTypeId } from '../config/dataTypes';

/** Tile ids stored in the level grid. */
export const T = {
  EMPTY: 0,
  GROUND: 1,
  BRICK: 2,
  QUESTION: 3,
  USED: 4,
  PIPE: 5,
  HARD: 6,
} as const;
export type TileId = (typeof T)[keyof typeof T];

export type BlockContent = 'token' | 'scale';

export type SpawnKind = 'spawn' | 'spambot' | 'token' | 'flag' | 'boss' | 'helper';

export interface Spawn {
  kind: SpawnKind;
  /** Tile coordinates, y = 0 at the bottom row. */
  x: number;
  y: number;
  token?: DataTypeId;
}

const TILE_CHARS: Record<string, TileId> = {
  '#': T.GROUND,
  X: T.HARD,
  B: T.BRICK,
  '?': T.QUESTION,
  M: T.QUESTION,
  P: T.PIPE,
};

const TOKEN_CHARS: Record<string, DataTypeId> = { o: 'books', w: 'web', k: 'wiki', c: 'code', f: 'feedback' };

const SPAWN_CHARS: Record<string, SpawnKind> = { S: 'spawn', e: 'spambot', F: 'flag', G: 'boss', H: 'helper' };

/**
 * A mutable tile grid parsed from an ASCII map. Row 0 of the map is the top of the level;
 * tile y = 0 is the bottom row. Out of bounds: left/right are walls, below is a pit, above is open sky.
 */
export class LevelGrid {
  readonly width: number;
  readonly height: number;
  readonly tiles: Uint8Array;
  /** What a question block releases, keyed by tile index. */
  readonly contents = new Map<number, BlockContent>();
  readonly spawns: Spawn[] = [];

  constructor(map: string[]) {
    this.height = map.length;
    this.width = Math.max(...map.map((row) => row.length));
    this.tiles = new Uint8Array(this.width * this.height);

    map.forEach((row, r) => {
      const y = this.height - 1 - r;
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const tile = TILE_CHARS[ch];
        if (tile !== undefined) {
          this.tiles[this.index(x, y)] = tile;
          if (tile === T.QUESTION) this.contents.set(this.index(x, y), ch === 'M' ? 'scale' : 'token');
        } else if (TOKEN_CHARS[ch]) {
          this.spawns.push({ kind: 'token', x, y, token: TOKEN_CHARS[ch] });
        } else if (SPAWN_CHARS[ch]) {
          this.spawns.push({ kind: SPAWN_CHARS[ch], x, y });
        }
      }
    });
  }

  index(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  get(tx: number, ty: number): TileId {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return T.EMPTY;
    return this.tiles[this.index(tx, ty)] as TileId;
  }

  set(tx: number, ty: number, tile: TileId): void {
    this.tiles[this.index(tx, ty)] = tile;
  }

  isSolid(tx: number, ty: number): boolean {
    if (tx < 0 || tx >= this.width) return true;
    if (ty < 0 || ty >= this.height) return false;
    return this.tiles[this.index(tx, ty)] !== T.EMPTY;
  }

  spawnOf(kind: SpawnKind): Spawn | undefined {
    return this.spawns.find((s) => s.kind === kind);
  }
}
