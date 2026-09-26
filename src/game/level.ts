import type { DataTypeId } from '../config/dataTypes';
import type { Grid } from './physics';

/** Tile ids stored in the level grid. */
export const T = {
  EMPTY: 0,
  GROUND: 1,
  BRICK: 2,
  QUESTION: 3,
  USED: 4,
  PIPE: 5,
  HARD: 6,
  ONEWAY: 7,
  CONVEYOR_R: 8,
  CONVEYOR_L: 9,
  TOGGLE_A: 10,
  TOGGLE_B: 11,
  HIDDEN: 12,
  SPIKES: 13,
  LAVA: 14,
  GATE: 15,
} as const;
export type TileId = (typeof T)[keyof typeof T];

/** What a question block releases. */
export type BlockContent = 'token' | 'scale' | 'power' | 'hype' | 'oneup' | 'moment';

export type EnemyKind = 'spambot' | 'jailbreaker' | 'ghost' | 'piranha' | 'rewardOrb' | 'lawyer' | 'crusher' | 'praise' | 'timeline' | 'agent' | 'paperclip';

export type SpawnKind = 'spawn' | 'flag' | 'boss' | 'helper' | 'token' | 'heart' | 'platform' | EnemyKind;

export interface Spawn {
  kind: SpawnKind;
  /** Tile coordinates, y = 0 at the bottom row. */
  x: number;
  y: number;
  token?: DataTypeId;
}

/** A digit in the map: a level-specific marker (puzzle pieces, labels) read by the level config. */
export interface Mark {
  ch: string;
  x: number;
  y: number;
}

const TILE_CHARS: Record<string, TileId> = {
  '#': T.GROUND,
  X: T.HARD,
  B: T.BRICK,
  '?': T.QUESTION,
  M: T.QUESTION,
  '*': T.QUESTION,
  $: T.QUESTION,
  U: T.QUESTION,
  '!': T.QUESTION,
  P: T.PIPE,
  '=': T.ONEWAY,
  '>': T.CONVEYOR_R,
  '<': T.CONVEYOR_L,
  '[': T.TOGGLE_A,
  ']': T.TOGGLE_B,
  ':': T.HIDDEN,
  '^': T.SPIKES,
  L: T.LAVA,
  D: T.GATE,
};

const BLOCK_CONTENT: Record<string, BlockContent> = {
  '?': 'token',
  M: 'scale',
  '*': 'power',
  $: 'hype',
  U: 'oneup',
  '!': 'moment',
};

export const TOKEN_CHARS: Record<string, DataTypeId> = {
  o: 'books',
  w: 'web',
  k: 'wiki',
  c: 'code',
  f: 'feedback',
  n: 'principles',
  v: 'images',
  t: 'reasoning',
  u: 'tools',
  a: 'agentic',
  m: 'audio',
  s: 'shadow',
};

const SPAWN_CHARS: Record<string, SpawnKind> = {
  S: 'spawn',
  F: 'flag',
  G: 'boss',
  H: 'helper',
  '+': 'heart',
  '~': 'platform',
  T: 'timeline',
  e: 'spambot',
  j: 'jailbreaker',
  g: 'ghost',
  p: 'piranha',
  r: 'rewardOrb',
  l: 'lawyer',
  z: 'crusher',
  y: 'praise',
  d: 'agent',
  i: 'paperclip',
};

export interface Solidity {
  /** Hidden blocks are solid (and drawn) only once revealed. */
  hiddenSolid: boolean;
  /** Which toggle set is solid right now: 0 = '[' blocks, 1 = ']' blocks. */
  phase: 0 | 1;
}

/** Whether a tile blocks movement. Shared by the game and the reachability checker. */
export function tileSolid(tile: TileId, s: Solidity): boolean {
  switch (tile) {
    case T.EMPTY:
    case T.ONEWAY:
    case T.LAVA:
      return false;
    case T.HIDDEN:
      return s.hiddenSolid;
    case T.TOGGLE_A:
      return s.phase === 0;
    case T.TOGGLE_B:
      return s.phase === 1;
    default:
      return true;
  }
}

export const isHazardTile = (tile: TileId) => tile === T.SPIKES || tile === T.LAVA;

/**
 * A mutable tile grid parsed from an ASCII map. Row 0 of the map is the top of the level;
 * tile y = 0 is the bottom row. Out of bounds: left/right are walls, below is a pit, above is open sky.
 */
export class LevelGrid implements Grid {
  readonly width: number;
  readonly height: number;
  readonly tiles: Uint8Array;
  /** What a question block releases, keyed by tile index. */
  readonly contents = new Map<number, BlockContent>();
  readonly spawns: Spawn[] = [];
  readonly marks: Mark[] = [];
  readonly solidity: Solidity = { hiddenSolid: false, phase: 0 };
  /** Storms can reverse every conveyor at once. */
  conveyorSign = 1;

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
          if (tile === T.QUESTION) this.contents.set(this.index(x, y), BLOCK_CONTENT[ch]);
        } else if (TOKEN_CHARS[ch]) {
          this.spawns.push({ kind: 'token', x, y, token: TOKEN_CHARS[ch] });
        } else if (SPAWN_CHARS[ch]) {
          this.spawns.push({ kind: SPAWN_CHARS[ch], x, y });
        } else if (ch >= '0' && ch <= '9') {
          this.marks.push({ ch, x, y });
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
    return tileSolid(this.tiles[this.index(tx, ty)] as TileId, this.solidity);
  }

  isOneWay(tx: number, ty: number): boolean {
    return this.get(tx, ty) === T.ONEWAY;
  }

  conveyor(tx: number, ty: number): number {
    const t = this.get(tx, ty);
    return (t === T.CONVEYOR_R ? 1 : t === T.CONVEYOR_L ? -1 : 0) * this.conveyorSign;
  }

  isHazard(tx: number, ty: number): boolean {
    return isHazardTile(this.get(tx, ty));
  }

  spawnOf(kind: SpawnKind): Spawn | undefined {
    return this.spawns.find((s) => s.kind === kind);
  }

  /** Token types placed in the map, including the ones question blocks release. */
  tokenTypes(blockToken: DataTypeId): Set<DataTypeId> {
    const set = new Set<DataTypeId>();
    for (const s of this.spawns) if (s.token) set.add(s.token);
    for (const c of this.contents.values()) if (c === 'token') set.add(blockToken);
    return set;
  }
}
