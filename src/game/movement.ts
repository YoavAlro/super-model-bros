import type { Pad } from './pad';
import { moveBody, type Body, type Grid, type TileHit } from './physics';

/** Movement tuning for one step. Built from a character plus whatever powers are active. */
export interface MoveStats {
  walkSpeed: number;
  runSpeed: number;
  jumpVelocity: number;
  /** Gravity while rising. */
  gravity: number;
  /** Gravity while falling. Lower = floatier. */
  fallGravity: number;
  /** Holding jump while falling glides: fall gravity is scaled by this and fall speed capped. */
  glide?: number;
  /** Press run in the air for one horizontal dash per jump. */
  airDash?: boolean;
  /** Extra jumps allowed in the air. */
  airJumps?: number;
  /** Multiplies acceleration (efficient characters get up to speed sooner). */
  accel?: number;
}

/** Everything the controller remembers between steps. Plain data, so it can be copied or sent. */
export interface Mover {
  body: Body;
  facing: number;
  coyote: number;
  jumpBuffer: number;
  jumpHeldPrev: boolean;
  runHeldPrev: boolean;
  cutJump: boolean;
  airJumpsLeft: number;
  dashTime: number;
  dashUsed: boolean;
}

export interface MoveEvents {
  hits: TileHit[];
  jumped: boolean;
  airJumped: boolean;
  dashed: boolean;
  landed: boolean;
}

export const COYOTE = 0.09;
export const JUMP_BUFFER = 0.12;
export const MAX_FALL = 28;
const GLIDE_FALL = 4;
const DASH_TIME = 0.16;
const DASH_SPEED = 21;
const CONVEYOR_SPEED = 3.2;

export function newMover(x: number, y: number, w: number, h: number): Mover {
  return {
    body: { x, y, w, h, vx: 0, vy: 0, onGround: false },
    facing: 1,
    coyote: 0,
    jumpBuffer: 0,
    jumpHeldPrev: false,
    runHeldPrev: false,
    cutJump: false,
    airJumpsLeft: 0,
    dashTime: 0,
    dashUsed: false,
  };
}

export function approach(value: number, target: number, delta: number): number {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}

/**
 * One fixed step of platformer control: acceleration and friction, variable jump height,
 * coyote time, jump buffering, running jumps, and the optional glide / dash / air jumps.
 * `speedScale` slows everything horizontal (hangovers, fog, winter laziness).
 */
export function stepMover(m: Mover, pad: Pad, s: MoveStats, grid: Grid, dt: number, speedScale = 1): MoveEvents {
  const b = m.body;
  const ev: MoveEvents = { hits: [], jumped: false, airJumped: false, dashed: false, landed: false };
  const dir = (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
  if (dir !== 0) m.facing = dir;

  const runPressed = pad.run && !m.runHeldPrev;
  m.runHeldPrev = pad.run;
  if (s.airDash && runPressed && !b.onGround && !m.dashUsed) {
    m.dashUsed = true;
    m.dashTime = DASH_TIME;
    ev.dashed = true;
  }

  if (m.dashTime > 0) {
    m.dashTime -= dt;
    b.vx = m.facing * DASH_SPEED * speedScale;
    b.vy = 0;
  } else {
    const target = dir * (pad.run ? s.runSpeed : s.walkSpeed) * speedScale;
    const turning = dir !== 0 && Math.sign(b.vx) === -dir;
    const accel = (b.onGround ? 42 : 26) * (turning ? 1.8 : 1) * (s.accel ?? 1);
    const friction = b.onGround ? 34 : 6;
    b.vx = approach(b.vx, target, (dir !== 0 ? accel : friction) * dt);
  }

  const jumpPressed = pad.jump && !m.jumpHeldPrev;
  m.jumpHeldPrev = pad.jump;
  if (b.onGround) {
    m.coyote = COYOTE;
    m.airJumpsLeft = s.airJumps ?? 0;
    m.dashUsed = false;
  } else {
    m.coyote -= dt;
  }
  m.jumpBuffer = jumpPressed ? JUMP_BUFFER : m.jumpBuffer - dt;
  if (m.jumpBuffer > 0 && m.coyote > 0) {
    // A running start jumps higher, like the classics.
    b.vy = s.jumpVelocity + Math.abs(b.vx) * 0.12;
    m.jumpBuffer = 0;
    m.coyote = 0;
    m.cutJump = false;
    ev.jumped = true;
  } else if (jumpPressed && !b.onGround && m.coyote <= 0 && m.airJumpsLeft > 0) {
    m.airJumpsLeft--;
    b.vy = s.jumpVelocity * 0.85;
    m.jumpBuffer = 0;
    m.cutJump = false;
    ev.airJumped = true;
  }
  if (!pad.jump && b.vy > 0 && !m.cutJump) {
    b.vy *= 0.5;
    m.cutJump = true;
  }

  if (m.dashTime <= 0) {
    const gliding = !!s.glide && pad.jump && b.vy <= 0;
    const g = b.vy > 0 ? s.gravity : s.fallGravity * (gliding ? s.glide! : 1);
    b.vy -= g * dt;
    b.vy = Math.max(b.vy, gliding ? -GLIDE_FALL : -MAX_FALL);
  }

  // Conveyor belts carry whatever stands on them.
  let push = 0;
  if (b.onGround && grid.conveyor) {
    const ty = Math.floor(b.y - 0.01);
    push = grid.conveyor(Math.floor(b.x + b.w / 2), ty) * CONVEYOR_SPEED;
  }
  const wasAirborne = !b.onGround;
  b.vx += push;
  ev.hits = moveBody(b, dt, grid);
  if (b.vx !== 0) b.vx -= push;
  ev.landed = wasAirborne && b.onGround;
  return ev;
}
