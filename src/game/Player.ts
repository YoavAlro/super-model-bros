import * as THREE from 'three';
import type { CharacterSpec } from '../config/characters';
import type { Pad } from './Input';
import { labelSprite, makeCharacter } from './meshes';
import { moveBody, type Body, type Grid, type TileHit } from './physics';
import { sfx } from './sfx';

const SMALL_H = 0.95;
const BIG_H = 1.75;
const COYOTE = 0.09;
const JUMP_BUFFER = 0.12;
const MAX_FALL = 28;

export class PlayerActor {
  readonly body: Body;
  readonly mesh: THREE.Group;
  big = false;
  dead = false;
  finished = false;
  invulnerable = 0;
  /** Feet height before this step, for stomp detection. */
  prevBottom = 0;
  private tag: THREE.Sprite;
  private facing = 1;
  private coyote = 0;
  private jumpBuffer = 0;
  private jumpHeldPrev = false;
  private cutJump = false;
  private squash = 0;

  constructor(
    readonly spec: CharacterSpec,
    formName: string,
    x: number,
    y: number,
    private readonly scene: THREE.Scene,
  ) {
    this.body = { x, y, w: 0.8, h: SMALL_H, vx: 0, vy: 0, onGround: false };
    this.mesh = makeCharacter(spec.color, spec.accent);
    this.tag = this.makeTag(formName);
    scene.add(this.mesh, this.tag);
  }

  setForm(formName: string): void {
    this.scene.remove(this.tag);
    this.tag = this.makeTag(formName);
    this.scene.add(this.tag);
  }

  grow(): void {
    if (this.big) return;
    this.big = true;
    this.body.h = BIG_H;
    sfx.powerup();
  }

  /** Returns true if the hit was absorbed (shrank); false means the player dies. */
  hurt(): boolean {
    if (this.invulnerable > 0 || this.dead || this.finished) return true;
    if (!this.big) return false;
    this.big = false;
    this.body.h = SMALL_H;
    this.invulnerable = 2;
    sfx.hurt();
    return true;
  }

  kill(): void {
    if (this.dead) return;
    this.dead = true;
    this.body.vx = 0;
    this.body.vy = 16;
    sfx.die();
  }

  bounce(jumpHeld: boolean): void {
    this.body.vy = jumpHeld ? 18 : 12;
    this.cutJump = !jumpHeld;
  }

  step(dt: number, pad: Pad, grid: Grid): TileHit[] {
    const b = this.body;
    this.prevBottom = b.y;
    this.invulnerable = Math.max(0, this.invulnerable - dt);

    if (this.dead) {
      b.vy -= 50 * dt;
      b.y += b.vy * dt;
      return [];
    }
    if (this.finished) {
      b.vx = 0;
      b.vy = Math.max(b.vy - 40 * dt, -6);
      return moveBody(b, dt, grid);
    }

    const s = this.spec;
    const dir = (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
    if (dir !== 0) this.facing = dir;
    const target = dir * (pad.run ? s.runSpeed : s.walkSpeed);
    const turning = dir !== 0 && Math.sign(b.vx) === -dir;
    const accel = (b.onGround ? 42 : 26) * (turning ? 1.8 : 1);
    const friction = b.onGround ? 34 : 6;
    b.vx = approach(b.vx, target, (dir !== 0 ? accel : friction) * dt);

    const jumpPressed = pad.jump && !this.jumpHeldPrev;
    this.jumpHeldPrev = pad.jump;
    this.coyote = b.onGround ? COYOTE : this.coyote - dt;
    this.jumpBuffer = jumpPressed ? JUMP_BUFFER : this.jumpBuffer - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      // A running start jumps higher, like the classics.
      b.vy = s.jumpVelocity + Math.abs(b.vx) * 0.12;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.cutJump = false;
      this.squash = -0.2;
      sfx.jump();
    }
    if (!pad.jump && b.vy > 0 && !this.cutJump) {
      b.vy *= 0.5;
      this.cutJump = true;
    }

    b.vy -= (b.vy > 0 ? s.gravity : s.fallGravity) * dt;
    b.vy = Math.max(b.vy, -MAX_FALL);
    const wasAirborne = !b.onGround;
    const hits = moveBody(b, dt, grid);
    if (wasAirborne && b.onGround) this.squash = 0.25;
    return hits;
  }

  updateMesh(t: number, dt: number): void {
    const b = this.body;
    this.squash = approach(this.squash, 0, dt * 2.5);
    const sx = (this.big ? 1.12 : 1) * (1 + this.squash * 0.5);
    const sy = (this.big ? 1.8 : 1) * (1 - this.squash);
    this.mesh.scale.set(sx, sy, sx);
    this.mesh.position.set(b.x + b.w / 2, b.y, 0);
    this.mesh.rotation.y = this.facing * 0.55;
    this.mesh.rotation.z = this.dead ? t * 8 : 0;
    // Waddle while running on the ground.
    this.mesh.rotation.x = b.onGround && Math.abs(b.vx) > 1 ? Math.sin(t * 22) * 0.06 : 0;
    this.mesh.visible = this.invulnerable <= 0 || Math.floor(t * 20) % 2 === 0;
    this.tag.position.set(b.x + b.w / 2, b.y + b.h + 0.55, 0);
    this.tag.visible = !this.dead;
  }

  dispose(): void {
    this.scene.remove(this.mesh, this.tag);
  }

  private makeTag(text: string): THREE.Sprite {
    const tag = labelSprite(text);
    tag.scale.multiplyScalar(0.42);
    return tag;
  }
}

export function approach(value: number, target: number, delta: number): number {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}
