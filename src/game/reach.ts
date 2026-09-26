import { isHazardTile, LevelGrid, T, tileSolid, type Solidity } from './level';
import { newMover, stepMover, type MoveStats } from './movement';
import type { Pad } from './pad';
import { forTilesUnder, type Grid } from './physics';

/**
 * Level reachability checker. It flies the real movement code through every standing spot with
 * a fan of scripted inputs (walks, run-ups, short hops, full jumps, mid-air stops and turns),
 * builds the graph of where each one lands, and reports whether the goal can be reached from the
 * spawn and whether any reachable spot is a soft-lock that can never reach it.
 */

const STEP = 1 / 120;
const MAX_FRAMES = 360;

export interface ReachOptions {
  stats: MoveStats;
  /** Body height: small (0.95) or big (1.75). */
  h: number;
  /** Gates stay shut unless the level opens them on a timer. */
  gatesOpen?: boolean;
  /** Opens just these gate tiles (a storm's gates that open once you wait). */
  openGate?: (tx: number, ty: number) => boolean;
}

export interface ReachReport {
  goalReachable: boolean;
  /** Standing spots reachable from the spawn. */
  spots: number;
  /** Reachable spots from which the goal can never be reached. */
  deadEnds: { x: number; y: number }[];
  /** The furthest x the player can reach (useful when the goal is not reachable). */
  furthestX: number;
}

type Trigger = number | 'edge';
interface Policy {
  dir: 1 | -1;
  run: boolean;
  trigger: Trigger | null; // null = walk one tile, no jump
  hold: number;
  steer: 'keep' | 'stop' | 'back';
}

function policies(): Policy[] {
  const out: Policy[] = [];
  for (const dir of [1, -1] as const) {
    out.push({ dir, run: false, trigger: null, hold: 0, steer: 'keep' });
    for (const run of [true, false]) {
      const triggers: Trigger[] = run ? [0, 16, 40, 'edge'] : [0, 'edge'];
      for (const trigger of triggers) {
        for (const hold of [8, 999]) {
          for (const steer of ['keep', 'stop', 'back'] as const) out.push({ dir, run, trigger, hold, steer });
        }
      }
    }
  }
  return out;
}
const POLICIES = policies();

/** The grid as the checker sees it: hidden blocks absent, toggles solid, gates per options. */
function checkerGrid(grid: LevelGrid, gatesOpen: boolean, openGate?: (tx: number, ty: number) => boolean): Grid {
  const solidity: Solidity = { hiddenSolid: false, phase: 0 };
  return {
    isSolid(tx, ty) {
      if (tx < 0 || tx >= grid.width) return true;
      if (ty < 0 || ty >= grid.height) return false;
      const t = grid.get(tx, ty);
      if (t === T.TOGGLE_B) return true;
      if (t === T.GATE) return !(gatesOpen || openGate?.(tx, ty));
      return tileSolid(t, solidity);
    },
    isOneWay: (tx, ty) => grid.isOneWay(tx, ty),
    conveyor: (tx, ty) => grid.conveyor(tx, ty),
  };
}

export function analyzeReach(grid: LevelGrid, start: { x: number; y: number }, goalX: number, opts: ReachOptions): ReachReport {
  const view = checkerGrid(grid, !!opts.gatesOpen, opts.openGate);
  const W = grid.width;
  const key = (x: number, y: number) => y * W + x;
  const startKey = key(start.x, start.y);
  const visited = new Set<number>([startKey]);
  const queue = [startKey];
  const edges = new Map<number, Set<number>>();
  const reachesGoal = new Set<number>();
  let furthestX = start.x;

  const touchesHazard = (b: { x: number; y: number; w: number; h: number }) => {
    let hit = false;
    forTilesUnder({ ...b, vx: 0, vy: 0, onGround: false }, 0.02, (tx, ty) => {
      if (!hit && isHazardTile(grid.get(tx, ty))) hit = true;
    });
    return hit;
  };

  const simulate = (sx: number, sy: number, p: Policy): { land?: number; goal: boolean } => {
    const m = newMover(sx + 0.1, sy, 0.8, opts.h);
    const b = m.body;
    b.onGround = true;
    const pad: Pad = { left: false, right: false, jump: false, run: p.run, action: false };
    let airborne = false;
    let jumpAt = typeof p.trigger === 'number' ? p.trigger : -1;
    let apex = false;
    for (let f = 0; f < MAX_FRAMES; f++) {
      let dir: number = p.dir;
      if (apex && p.steer === 'stop') dir = 0;
      if (apex && p.steer === 'back') dir = -p.dir;
      pad.left = dir < 0;
      pad.right = dir > 0;
      if (p.trigger === 'edge' && jumpAt < 0 && b.onGround) {
        const aheadX = p.dir > 0 ? b.x + b.w + 0.12 : b.x - 0.12;
        if (!view.isSolid(Math.floor(aheadX), Math.floor(b.y) - 1) && !view.isOneWay!(Math.floor(aheadX), Math.floor(b.y) - 1)) jumpAt = f;
      }
      pad.jump = p.trigger !== null && jumpAt >= 0 && f >= jumpAt && f < jumpAt + p.hold;
      stepMover(m, pad, opts.stats, view, STEP);
      if (b.vy <= 0 && airborne) apex = true;
      if (touchesHazard(b)) return { goal: false };
      if (b.x + b.w > goalX - 0.1) return { goal: true };
      if (b.y < -1) return { goal: false };
      furthestX = Math.max(furthestX, Math.floor(b.x + b.w / 2));
      const cx = Math.floor(b.x + b.w / 2);
      if (!b.onGround) {
        airborne = true;
      } else if (airborne) {
        return { land: key(cx, Math.round(b.y)), goal: false };
      } else if (p.trigger === null && cx !== sx) {
        return { land: key(cx, Math.round(b.y)), goal: false };
      } else if (p.trigger !== null && jumpAt < 0 && f > 90) {
        return { goal: false }; // never found an edge to jump from
      }
    }
    return { goal: false };
  };

  while (queue.length) {
    const node = queue.pop()!;
    const sx = node % W;
    const sy = Math.floor(node / W);
    const out = new Set<number>();
    for (const p of POLICIES) {
      const r = simulate(sx, sy, p);
      if (r.goal) reachesGoal.add(node);
      if (r.land !== undefined && r.land !== node) {
        out.add(r.land);
        if (!visited.has(r.land)) {
          visited.add(r.land);
          queue.push(r.land);
        }
      }
    }
    edges.set(node, out);
  }

  // Walk the graph backwards from the spots that reach the goal.
  const reverse = new Map<number, number[]>();
  for (const [from, tos] of edges) for (const to of tos) (reverse.get(to) ?? reverse.set(to, []).get(to)!).push(from);
  const canFinish = new Set(reachesGoal);
  const back = [...reachesGoal];
  while (back.length) {
    const n = back.pop()!;
    for (const from of reverse.get(n) ?? []) {
      if (!canFinish.has(from)) {
        canFinish.add(from);
        back.push(from);
      }
    }
  }
  const deadEnds = [...visited].filter((n) => !canFinish.has(n)).map((n) => ({ x: n % W, y: Math.floor(n / W) }));
  return { goalReachable: canFinish.has(startKey), spots: visited.size, deadEnds, furthestX };
}
