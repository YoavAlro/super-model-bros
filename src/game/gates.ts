import { T, type TileId } from './level';

/**
 * Pure rules for gates (`D` tiles) that storms open over time. A phased rollout opens the level's
 * gate groups one at a time, left to right, each once a player has waited next to it; a closed
 * road never opens.
 */

export interface GateGroup {
  /** First and last column holding gate tiles. */
  x0: number;
  x1: number;
  tiles: { x: number; y: number }[];
}

interface TileSource {
  readonly width: number;
  readonly height: number;
  get(tx: number, ty: number): TileId;
}

/** Gate tiles grouped by neighboring columns, left to right. */
export function gateGroups(grid: TileSource): GateGroup[] {
  const groups: GateGroup[] = [];
  let current: GateGroup | null = null;
  for (let x = 0; x < grid.width; x++) {
    const tiles: { x: number; y: number }[] = [];
    for (let y = 0; y < grid.height; y++) if (grid.get(x, y) === T.GATE) tiles.push({ x, y });
    if (!tiles.length) {
      current = null;
      continue;
    }
    if (!current) {
      current = { x0: x, x1: x, tiles: [] };
      groups.push(current);
    }
    current.x1 = x;
    current.tiles.push(...tiles);
  }
  return groups;
}

export interface GateState {
  /** How many groups have been resolved (opened, or found closed for good). */
  resolved: number;
  /** Seconds a player has waited at the next group. */
  waited: number;
}

/**
 * One step of the gate timeline. Groups resolve in order, once a player is within `range` tiles to
 * the left of the next one: a group with a wait opens after that many seconds of waiting; a group
 * with `null` never opens and resolves at once (its label says to find another way). Returns the
 * index of the group resolved this step, or -1.
 */
export function stepGates(
  state: GateState,
  groups: readonly GateGroup[],
  waits: readonly (number | null)[],
  playerXs: readonly number[],
  dt: number,
  range = 6,
): number {
  const i = state.resolved;
  const next = groups[i];
  if (!next) return -1;
  if (!playerXs.some((x) => x >= next.x0 - range && x <= next.x1 + 1)) return -1;
  const wait = waits[i] === undefined ? 0 : waits[i];
  if (wait !== null) {
    state.waited += dt;
    if (state.waited < wait) return -1;
  }
  state.waited = 0;
  state.resolved++;
  return i;
}

/** The gate tiles that eventually open (for the reachability checker). */
export function openingGateTiles(groups: readonly GateGroup[], waits: readonly (number | null)[]): Set<string> {
  const open = new Set<string>();
  groups.forEach((g, i) => {
    if (waits[i] !== null) for (const t of g.tiles) open.add(`${t.x},${t.y}`);
  });
  return open;
}
