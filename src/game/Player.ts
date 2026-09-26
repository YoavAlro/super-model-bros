import * as THREE from 'three';
import type { CharacterSpec } from '../config/characters';
import type { FormAbility } from '../config/levelSpec';
import { labelSprite, makeCape, makeCharacter } from './meshes';
import { approach, newMover, stepMover, type MoveEvents, type MoveStats, type Mover } from './movement';
import type { Pad } from './pad';
import type { Grid } from './physics';
import { sfx } from './sfx';

const SMALL_H = 0.95;
const BIG_H = 1.75;

/** A power you keep until you get hit. */
export type HeldPower = 'tool' | 'cape' | null;
export type StarKind = 'rlhf' | 'viral';

export class PlayerActor {
  readonly mover: Mover;
  readonly mesh: THREE.Group;
  big = false;
  power: HeldPower = null;
  /** Seconds of star invincibility left. */
  star = 0;
  starKind: StarKind | null = null;
  dead = false;
  finished = false;
  /** Blinking grace period after a hit. */
  invulnerable = 0;
  /** Feet height before this step, for stomp detection. */
  prevBottom = 0;
  /** Holding the power button with the reasoning cape. */
  thinking = false;
  /** The power button went down this step. */
  actionPressed = false;
  /** Seconds until the power button works again. */
  cooldown = 0;
  /** Scales horizontal speed (hangovers, fog, winter laziness). Set by the stage each step. */
  speedScale = 1;
  ability: FormAbility | undefined;
  readonly perks = new Set<string>();
  /** Temporary boosts from hype power-ups, set by the stage each step. */
  boost: { glide?: number; airJumps?: number; speed?: number } = {};
  /** For clones: turns the owner's pad into this clone's pad (copy it, ignore it, or improvise). */
  brain: ((self: PlayerActor, owner: Pad) => Pad) | null = null;
  /** Clones that vanish when their hype power-up ends. */
  hypeClone = false;
  /** In levels with three model sizes: 0 small and quick, 1 regular, 2 large and strong. */
  sizeMode = 1;
  private tag: THREE.Sprite;
  private readonly cape: THREE.Object3D;
  private readonly bodyMat: THREE.MeshLambertMaterial | undefined;
  private actionHeldPrev = false;
  private squash = 0;

  constructor(
    readonly spec: CharacterSpec,
    public form: string,
    x: number,
    y: number,
    private readonly scene: THREE.Scene,
    /** Which controller drives this actor. */
    readonly padIndex: number,
    /** Fork clones copy their owner's moves and never cost a life. */
    readonly clone = false,
    cloneTag = 'fork',
  ) {
    this.mover = newMover(x, y, 0.8, SMALL_H);
    this.mesh = makeCharacter(spec.color, spec.accent);
    this.bodyMat = (this.mesh.getObjectByName('body') as THREE.Mesh | undefined)?.material as THREE.MeshLambertMaterial;
    this.cape = makeCape(spec.accent);
    this.cape.visible = false;
    this.mesh.add(this.cape);
    if (clone) this.mesh.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.setValues?.({ transparent: true, opacity: 0.55 }));
    this.tag = this.makeTag(clone ? cloneTag : form);
    scene.add(this.mesh, this.tag);
  }

  get body() {
    return this.mover.body;
  }

  get invincible(): boolean {
    return this.star > 0;
  }

  setForm(formName: string): void {
    this.form = formName;
    if (this.clone) return;
    this.scene.remove(this.tag);
    this.tag.material.map?.dispose();
    this.tag.material.dispose();
    this.tag = this.makeTag(formName);
    this.scene.add(this.tag);
  }

  grow(): void {
    if (this.big) return;
    this.big = true;
    this.body.h = BIG_H;
  }

  /** Switch model size (Claude 3 Haiku / Sonnet / Opus). */
  setSize(mode: number): void {
    this.sizeMode = mode;
    if (mode === 0 && this.big) {
      this.big = false;
      this.body.h = SMALL_H;
    } else if (mode === 2) {
      this.grow();
    }
  }

  givePower(power: HeldPower): void {
    this.grow();
    this.power = power;
  }

  giveStar(kind: StarKind, seconds: number): void {
    this.star = seconds;
    this.starKind = kind;
  }

  /** Undo the latest power-up (flattery): the held power first, then size. Returns false if there was none. */
  losePowerUp(): boolean {
    if (this.power) this.power = null;
    else if (this.big) {
      this.big = false;
      this.body.h = SMALL_H;
    } else return false;
    return true;
  }

  /** Returns true if the hit was absorbed; false means the player dies. */
  hurt(): boolean {
    if (this.invulnerable > 0 || this.star > 0 || this.dead || this.finished) return true;
    if (this.clone) return false;
    if (this.ability?.sizes && this.sizeMode === 2) {
      // The largest model shrinks back to the regular size instead of dying.
      this.sizeMode = 1;
      this.big = false;
      this.body.h = SMALL_H;
      this.setForm(this.ability.sizes[1]);
    } else if (this.power) {
      this.power = null;
    } else if (this.big) {
      this.big = false;
      this.body.h = SMALL_H;
    } else {
      return false;
    }
    this.invulnerable = 2;
    sfx.hurt();
    return true;
  }

  kill(): void {
    if (this.dead) return;
    this.dead = true;
    this.power = null;
    this.star = 0;
    this.body.vx = 0;
    this.body.vy = 16;
    if (!this.clone) sfx.die();
  }

  /** Back on its feet after a respawn. */
  revive(x: number, y: number): void {
    this.dead = false;
    this.big = false;
    this.body.h = SMALL_H;
    this.body.x = x;
    this.body.y = y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.invulnerable = 2;
  }

  bounce(jumpHeld: boolean): void {
    this.body.vy = jumpHeld ? 18 : 12;
    this.mover.cutJump = !jumpHeld;
  }

  stats(): MoveStats {
    const s = this.spec;
    const a = this.ability ?? {};
    const boost = this.boost;
    const sized = a.sizes ? [1.15, 1, 0.9][this.sizeMode] : 1;
    const sizedJump = a.sizes ? [1.05, 1, 0.97][this.sizeMode] : 1;
    const speed = (boost.speed ?? 1) * sized;
    return {
      walkSpeed: s.walkSpeed * speed,
      runSpeed: s.runSpeed * speed,
      jumpVelocity: s.jumpVelocity * (a.jump ?? 1) * sizedJump,
      gravity: s.gravity,
      fallGravity: s.fallGravity * (a.float ?? 1),
      glide: this.power === 'cape' ? 0.28 : (boost.glide ?? (this.perks.has('glide') ? 0.6 : undefined)),
      airDash: s.traitKind === 'airDash',
      airJumps: Math.max(this.perks.has('doubleJump') ? 1 : 0, boost.airJumps ?? 0),
      accel: s.accel,
    };
  }

  step(dt: number, pad: Pad, grid: Grid): MoveEvents | null {
    const b = this.body;
    this.prevBottom = b.y;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.star > 0) {
      this.star = Math.max(0, this.star - dt);
      if (this.star === 0) this.starKind = null;
    }
    this.actionPressed = pad.action && !this.actionHeldPrev;
    this.actionHeldPrev = pad.action;
    this.thinking = this.power === 'cape' && pad.action && !this.dead && !this.finished;

    if (this.dead) {
      b.vy -= 50 * dt;
      b.y += b.vy * dt;
      return null;
    }
    if (this.finished) {
      b.vx = 0;
      b.vy = Math.max(b.vy - 40 * dt, -6);
      const none: Pad = { left: false, right: false, jump: false, run: false, action: false };
      return stepMover(this.mover, none, this.stats(), grid, dt);
    }
    const ev = stepMover(this.mover, pad, this.stats(), grid, dt, this.speedScale * (this.thinking ? 0.55 : 1));
    if (ev.jumped || ev.airJumped) {
      this.squash = -0.2;
      if (!this.clone) sfx.jump();
    }
    if (ev.dashed) sfx.dash();
    if (ev.landed) this.squash = 0.25;
    return ev;
  }

  updateMesh(t: number, dt: number): void {
    const b = this.body;
    this.squash = approach(this.squash, 0, dt * 2.5);
    const sx = (this.big ? 1.12 : 1) * (1 + this.squash * 0.5);
    const sy = (this.big ? 1.8 : 1) * (1 - this.squash);
    this.mesh.scale.set(sx, sy, sx);
    this.mesh.position.set(b.x + b.w / 2, b.y, 0);
    this.mesh.rotation.y = this.mover.facing * 0.55;
    this.mesh.rotation.z = this.dead ? t * 8 : 0;
    // Waddle while running on the ground.
    this.mesh.rotation.x = b.onGround && Math.abs(b.vx) > 1 ? Math.sin(t * 22) * 0.06 : 0;
    this.mesh.visible = this.invulnerable <= 0 || Math.floor(t * 20) % 2 === 0;
    this.cape.visible = this.power === 'cape';
    (this.cape.userData.pivot as THREE.Object3D).rotation.x = b.onGround ? 0.15 : 0.15 + Math.min(0.9, Math.abs(b.vy) * 0.06);
    if (this.bodyMat) {
      if (this.star > 0) {
        const hue = this.starKind === 'viral' ? (t * 1.5) % 1 : 0.13;
        const pulse = 0.4 + 0.4 * Math.abs(Math.sin(t * 12));
        this.bodyMat.emissive.setHSL(hue, 1, 0.5 * pulse);
      } else if (this.power === 'tool') {
        this.bodyMat.emissive.setHex(0x0d5c50);
      } else if (this.thinking) {
        this.bodyMat.emissive.setHSL(0.75, 0.8, 0.25 + 0.1 * Math.sin(t * 6));
      } else {
        this.bodyMat.emissive.setHex(0x000000);
      }
    }
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
