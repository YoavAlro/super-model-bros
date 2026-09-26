import { isHazardTile, LevelGrid, T, tileSolid, type Solidity, type TileId } from './level';
import { newMover, stepMover, type Mover, type MoveStats } from './movement';
import type { Pad } from './pad';
import { forTilesUnder, type Body, type Grid } from './physics';

/**
 * Level reachability checker. It flies the real movement code through every standing spot with
 * a fan of scripted inputs (walks, run-ups, short hops, full jumps, mid-air stops and turns),
 * builds the graph of where each one lands, and reports whether the goal can be reached from the
 * spawn and whether any reachable spot is a soft-lock that can never reach it. Inputs that press the
 * same buttons share one simulated body until they differ (a run-up, the rise of a jump), which
 * gives the same answer as flying each one alone, in about half the time.
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
  trigger: Trigger | null; // null = walk one tile, no jump
  hold: number;
  steer: 'keep' | 'stop' | 'back';
}
/** Policies that share a direction and the run button. They are flown as one until their inputs differ. */
interface Family {
  dir: 1 | -1;
  run: boolean;
  members: Policy[];
}

function families(): Family[] {
  const out: Family[] = [];
  for (const dir of [1, -1] as const) {
    out.push({ dir, run: false, members: [{ trigger: null, hold: 0, steer: 'keep' }] });
    for (const run of [true, false]) {
      const members: Policy[] = [];
      const triggers: Trigger[] = run ? [0, 16, 40, 'edge'] : [0, 'edge'];
      for (const trigger of triggers) {
        for (const hold of [8, 999]) {
          for (const steer of ['keep', 'stop', 'back'] as const) members.push({ trigger, hold, steer });
        }
      }
      out.push({ dir, run, members });
    }
  }
  return out;
}
const FAMILIES = families();

/** One body in flight, standing in for every policy whose inputs have matched so far. */
interface Flight {
  m: Mover;
  airborne: boolean;
  apex: boolean;
  /** Frame at which an `edge` policy found the ledge to jump from. */
  edgeAt: number;
  members: Policy[];
}

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

/**
 * Where a 0.8-wide body of height `h` starts on spot (sx, sy). A spot is keyed by the column under
 * the body's center, so a landing right at a ledge can key the empty column next to it. Such a body
 * really stands hanging over the edge, feet still on the ledge (started in mid-air it would look like
 * a soft-lock). A "ledge" whose column is solid at body height is a wall's side, not a floor.
 */
export function standingX(view: Grid, sx: number, sy: number, h: number): number {
  const floorAt = (tx: number) => view.isSolid(tx, sy - 1) || !!view.isOneWay?.(tx, sy - 1);
  const fits = (tx: number) => {
    for (let ty = sy; ty < sy + h; ty++) if (view.isSolid(tx, ty)) return false;
    return true;
  };
  if (floorAt(sx)) return sx + 0.1;
  if (floorAt(sx - 1) && fits(sx - 1)) return sx - 0.35;
  if (floorAt(sx + 1) && fits(sx + 1)) return sx + 0.55;
  return sx + 0.1;
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

  const hasHazards = grid.tiles.some((t) => isHazardTile(t as TileId));
  const touchesHazard = (b: Body) => {
    if (!hasHazards) return false;
    let hit = false;
    forTilesUnder(b, 0.02, (tx, ty) => {
      if (!hit && isHazardTile(grid.get(tx, ty))) hit = true;
    });
    return hit;
  };

  /** Flies a family of policies from a spot: where each lands, and whether any reaches the goal. */
  const simulate = (sx: number, sy: number, fam: Family): { lands: number[]; goal: boolean } => {
    const lands: number[] = [];
    let goal = false;
    const m = newMover(standingX(view, sx, sy, opts.h), sy, 0.8, opts.h);
    m.body.onGround = true;
    let flights: Flight[] = [{ m, airborne: false, apex: false, edgeAt: -1, members: fam.members }];
    let next: Flight[] = [];
    const pad: Pad = { left: false, right: false, jump: false, run: fam.run, action: false };
    const walk = fam.members[0].trigger === null;

    // The buttons a policy presses on frame f, packed as jump + 2 * (direction + 1).
    const inputOf = (p: Policy, fl: Flight, f: number) => {
      const at = p.trigger === 'edge' ? fl.edgeAt : (p.trigger ?? -1);
      const jump = at >= 0 && f >= at && f < at + p.hold;
      const dir = fl.apex && p.steer === 'stop' ? 0 : fl.apex && p.steer === 'back' ? -fam.dir : fam.dir;
      return (jump ? 1 : 0) + 2 * (dir + 1);
    };

    const advance = (fl: Flight, input: number, f: number) => {
      const b = fl.m.body;
      const dir = (input >> 1) - 1;
      pad.left = dir < 0;
      pad.right = dir > 0;
      pad.jump = (input & 1) === 1;
      stepMover(fl.m, pad, opts.stats, view, STEP);
      if (b.vy <= 0 && fl.airborne) fl.apex = true;
      if (touchesHazard(b) || b.y < -1) return;
      if (b.x + b.w > goalX - 0.1) {
        goal = true;
        return;
      }
      const cx = Math.floor(b.x + b.w / 2);
      furthestX = Math.max(furthestX, cx);
      if (!b.onGround) {
        fl.airborne = true;
        next.push(fl);
      } else if (fl.airborne || (walk && cx !== sx)) {
        lands.push(key(cx, Math.round(b.y)));
      } else {
        // Edge policies that never found an edge to jump from give up.
        if (f > 90 && fl.edgeAt < 0 && fl.members.some((p) => p.trigger === 'edge')) fl.members = fl.members.filter((p) => p.trigger !== 'edge');
        if (fl.members.length) next.push(fl);
      }
    };

    for (let f = 0; f < MAX_FRAMES && flights.length; f++) {
      next = [];
      for (const fl of flights) {
        const b = fl.m.body;
        if (!walk && fl.edgeAt < 0 && b.onGround) {
          const aheadX = fam.dir > 0 ? b.x + b.w + 0.12 : b.x - 0.12;
          if (!view.isSolid(Math.floor(aheadX), Math.floor(b.y) - 1) && !view.isOneWay!(Math.floor(aheadX), Math.floor(b.y) - 1)) fl.edgeAt = f;
        }
        const members = fl.members;
        const first = inputOf(members[0], fl, f);
        let same = true;
        for (let i = 1; i < members.length && same; i++) same = inputOf(members[i], fl, f) === first;
        if (same) {
          advance(fl, first, f);
          continue;
        }
        // Members that press different buttons this frame split into their own flights, each with
        // its own copy of the body (copied before any of them moves).
        const byInput = new Map<number, Policy[]>();
        for (const p of members) {
          const input = inputOf(p, fl, f);
          const group = byInput.get(input);
          if (group) group.push(p);
          else byInput.set(input, [p]);
        }
        const groups = [...byInput];
        const split = groups.map(([input, group], i): [number, Flight] => [
          input,
          i === 0 ? fl : { ...fl, m: { ...fl.m, body: { ...fl.m.body } }, members: group },
        ]);
        fl.members = groups[0][1];
        for (const [input, flight] of split) advance(flight, input, f);
      }
      flights = next;
    }
    return { lands, goal };
  };

  while (queue.length) {
    const node = queue.pop()!;
    const sx = node % W;
    const sy = Math.floor(node / W);
    const out = new Set<number>();
    for (const fam of FAMILIES) {
      const r = simulate(sx, sy, fam);
      if (r.goal) reachesGoal.add(node);
      for (const land of r.lands) {
        if (land === node) continue;
        out.add(land);
        if (!visited.has(land)) {
          visited.add(land);
          queue.push(land);
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
