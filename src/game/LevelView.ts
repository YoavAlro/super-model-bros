import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Theme } from '../config/themes';
import { artOptions, atlasUV, CELL, chamferBox, roundBlock, type Rect } from './art';
import { Fx } from './fx';
import { Backdrop } from './backdrop';
import { LevelGrid, T, type TileId } from './level';
import { arrowTexture } from './meshes';
import { hash01, mixHex } from './palette';
import { prefs } from './prefs';
import { mulberry32 } from './rng';
import * as art from './tileArt';
import { cachedGeo, RAMP } from './toonKit';

/**
 * Tile kinds, in the order their records are appended per tile. records[0] and [1] of a prompt tile
 * are therefore always [question, used], which activate() relies on.
 */
const KINDS = [
  'ground',
  'lava',
  'lavaGlow',
  'pitShade',
  'brick',
  'question',
  'used',
  'hard',
  'pipeHalf',
  'pipe1',
  'collarHalf',
  'collar1',
  'oneway',
  'conveyorR',
  'conveyorL',
  'toggleA',
  'toggleB',
  'hidden',
  'spikes',
  'gate',
  'cap',
  'decor',
  'shadow',
] as const;
export type TileKind = (typeof KINDS)[number];

/** Kinds that decorate a tile rather than being it: never bumped. */
const DRESSING = new Set<TileKind>(['cap', 'decor', 'shadow']);
/** Kinds whose instances move (bumps, swaps, removal). */
const DYNAMIC = new Set<TileKind>(['brick', 'question', 'used', 'hard', 'gate']);
/** Kinds a bump ripples into from a neighbour. */
const RIPPLES = new Set<TileKind>(['brick', 'question', 'used']);

/**
 * A running tile motion: 'hit' (a prompt answered), 'bump' (bricks, hard blocks, puzzle bumps) or
 * 'retract' (a gate sinking into its floor). t < 0 is a delay (the row ripple).
 */
interface Motion {
  rec: TileRecord;
  t: number;
  kind: 'hit' | 'bump' | 'retract';
  amp: number;
}
const HIT = 0.26;
const BUMP = 0.3;
const RETRACT = 0.35;

export interface TileRecord {
  mesh: THREE.InstancedMesh;
  i: number;
  /** The instance's resting matrix. */
  matrix: THREE.Matrix4;
  kind: TileKind;
  /** Resting placement: position, z rotation and uniform scale. */
  x: number;
  y: number;
  rz: number;
  s: number;
  hidden: boolean;
}

/** One instance to place, collected per tile before the meshes are built. */
interface Cell {
  kind: TileKind;
  /** Grid index of the tile this instance belongs to, or null for level dressing (deco rows, pit shade). */
  key: number | null;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  /** Turned about y (only the right half of a paired tube, which is the left half turned round). */
  ry: number;
  rz: number;
  s: number;
  tint: THREE.Color | null;
  hidden: boolean;
}

export interface LevelViewOptions {
  /** The theme tune's tempo (the prompt blocks' beat). */
  bpm: number;
  touch: boolean;
}

const DEPTH = 1.2;
/** Deco ground rows −1..−4 darken with depth. */
const DEPTH_TINT = [0.92, 0.85, 0.8, 0.76];
const SCORCH = mixHex(0xffffff, 0xff8a3a, 0.35);
/**
 * Ground and caps butt against their neighbours, but each instance has its own matrix, so pixels on
 * a shared edge can fall through to the inked side faces behind. A hair of overlap closes the seams.
 */
const SEAL = 1.003;
/** Resting self-glow of prompt blocks (their emissiveMap is their own face). */
const PROMPT_GLOW = 0.3;

const toonMat = (p: THREE.MeshToonMaterialParameters) => new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: RAMP, ...p });

/** Draws the tile grid with one InstancedMesh per tile kind, the sky and the backdrop. */
export class LevelView {
  /** Pooled particle FX for this level. */
  readonly fx: Fx;
  private readonly records = new Map<number, TileRecord[]>();
  private readonly bumps: Motion[] = [];
  private readonly zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly tmp = new THREE.Matrix4();
  private readonly materials = new Map<TileKind, THREE.Material>();
  /** The prompt block's four typing frames (dot k raised); frame 3 is the resting face. */
  private readonly promptFrames: THREE.Texture[];
  /** [right-moving, left-moving] belt textures, where the level has them. */
  private readonly conveyorTextures: (THREE.Texture | null)[] = [null, null];
  /** Pulley wheels on the front of each belt run's end tiles, turning with the belt. */
  private pulleys: { mesh: THREE.InstancedMesh; x: Float32Array; y: Float32Array; dir: Float32Array } | null = null;
  private conveyorSign = 1;
  private readonly backdrop: Backdrop;
  private lavaMat: THREE.MeshBasicMaterial | null = null;
  /** Lava surfaces (x, y of the top, per tile) and the pooled bubbles that bloop up out of them. */
  private readonly lavaTops: number[] = [];
  private bubbles: { mesh: THREE.InstancedMesh; x: Float32Array; y: Float32Array; age: Float32Array; life: Float32Array; next: number } | null = null;
  private readonly bubbleRng = mulberry32(77);
  private glowMat: THREE.MeshBasicMaterial | null = null;
  private time = 0;
  /** Which prompt frame is showing (−1: not yet set). */
  private promptFrame = -1;
  /** Hidden blocks' eased visibility (0..1) and where it is heading. */
  private hiddenK = 0;
  private hiddenTarget = 0;
  /** Which toggle set is solid, and the flash left on it after it turned solid. */
  private phase: 0 | 1 = 0;
  private toggleFlash = 0;

  constructor(
    private readonly grid: LevelGrid,
    private readonly theme: Theme,
    scene: THREE.Scene,
    readonly opts: LevelViewOptions = { bpm: 120, touch: false },
  ) {
    art.useTheme(theme);
    artOptions.anisotropy = opts.touch ? 1 : 4;
    this.promptFrames = art.promptFrames();
    scene.background = art.skyTexture(theme);
    this.buildTiles(scene);
    this.buildBubbles(scene);
    this.buildPulleys(scene);
    this.backdrop = new Backdrop(scene, theme, grid.width, opts.touch);
    this.fx = new Fx(scene, opts.touch);
  }

  /** A question block was hit: swap it for a used block, which squashes and hops (its row ripples). */
  activate(tx: number, ty: number): void {
    const [question, used] = this.records.get(this.grid.index(tx, ty)) ?? [];
    if (!question || !used) return;
    this.setVisible(question, false);
    this.setVisible(used, true);
    this.move(used, 'hit');
    this.ripple(tx, ty);
  }

  /** Bumps the tile's block (never its cap, decor or shadow, and never a hidden record). */
  bumpTile(tx: number, ty: number): void {
    const rec = this.firstBlock(tx, ty);
    if (!rec) return;
    this.move(rec, 'bump');
    this.ripple(tx, ty);
  }

  /** Hides everything drawn for the tile (its cap and shadow too); a gate sinks into its floor first. */
  removeTile(tx: number, ty: number): void {
    for (const rec of this.records.get(this.grid.index(tx, ty)) ?? []) {
      if (rec.kind === 'gate' && !rec.hidden) {
        rec.hidden = true;
        this.move(rec, 'retract');
      } else this.setVisible(rec, false);
    }
  }

  /** Hidden blocks fade in while someone can see them. */
  setHiddenVisible(visible: boolean): void {
    this.hiddenTarget = visible ? 1 : 0;
  }

  /** Which toggle set is solid: the other one fades out, and the one turning solid flashes. */
  setPhase(phase: 0 | 1): void {
    const a = this.materials.get('toggleA') as THREE.MeshToonMaterial | undefined;
    const b = this.materials.get('toggleB') as THREE.MeshToonMaterial | undefined;
    if (a) a.opacity = phase === 0 ? 1 : 0.18;
    if (b) b.opacity = phase === 1 ? 1 : 0.18;
    if (phase !== this.phase) this.toggleFlash = 0.25;
    this.phase = phase;
    if (a) a.emissiveIntensity = 0;
    if (b) b.emissiveIntensity = 0;
  }

  /** Reverses the conveyor arrows (the belts themselves are reversed in the grid). Mirroring the
   *  texture also reverses its scroll, so the offset animation stays as it is. */
  setConveyorSign(sign: number): void {
    this.conveyorSign = sign;
    for (const tex of this.conveyorTextures) if (tex) tex.repeat.x = sign;
  }

  /** Per-frame animation. `camX` is the camera's x: the backdrop's life and celestials follow it. */
  update(dt: number, camX = 0): void {
    this.time += dt;
    this.stepMotions(dt);
    this.stepPrompt();
    this.stepHidden(dt);
    if (this.toggleFlash > 0) {
      this.toggleFlash = Math.max(0, this.toggleFlash - dt);
      const solid = this.materials.get(this.phase === 0 ? 'toggleA' : 'toggleB') as THREE.MeshToonMaterial | undefined;
      if (solid) solid.emissiveIntensity = (0.8 * this.toggleFlash) / 0.25;
    }
    this.conveyorTextures.forEach((tex, i) => {
      if (tex) tex.offset.x = (i === 0 ? -1 : 1) * this.time * 1.2;
    });
    if (this.lavaMat) {
      this.lavaMat.map!.offset.x = 0.15 * this.time;
      this.lavaMat.color.setHSL(0.08, 1, 0.92 + 0.05 * Math.sin(this.time * 2));
    }
    if (this.glowMat) this.glowMat.opacity = 0.42 + 0.08 * Math.sin(this.time * 3);
    this.stepBubbles(dt, camX);
    this.stepPulleys();
    this.backdrop.update(dt, this.time, camX);
    this.fx.update(dt);
  }

  /** Shows prompt frame k (0..3) on every prompt block: one typing dot per beat (see promptFrames). */
  setPromptFrame(k: number): void {
    const mat = this.materials.get('question') as THREE.MeshToonMaterial | undefined;
    if (!mat) return;
    mat.map = mat.emissiveMap = this.promptFrames[k & 3];
  }

  /** The tile's block: its first visible record that is not dressing (cap, decor, shadow). */
  private firstBlock(tx: number, ty: number): TileRecord | undefined {
    return this.records.get(this.grid.index(tx, ty))?.find((r) => !r.hidden && !DRESSING.has(r.kind));
  }

  /** Starts a motion on a record (replacing any it already has). */
  private move(rec: TileRecord, kind: Motion['kind'], amp = 1, t = 0): void {
    const i = this.bumps.findIndex((b) => b.rec === rec);
    if (i >= 0) {
      // A retract always finishes; a new bump never cuts a stronger one short.
      if (this.bumps[i].kind === 'retract' || (kind === 'bump' && amp < this.bumps[i].amp && this.bumps[i].t >= 0)) return;
      this.bumps.splice(i, 1);
    }
    this.bumps.push({ rec, t, kind, amp });
  }

  /** Row ripple: the blocks either side of a bumped one give a smaller, later bump. */
  private ripple(tx: number, ty: number): void {
    if (prefs.reduceMotion) return;
    for (const nx of [tx - 1, tx + 1]) {
      const rec = this.firstBlock(nx, ty);
      if (rec && RIPPLES.has(rec.kind)) this.move(rec, 'bump', 0.4, -0.04);
    }
  }

  /** Plays the block motions (see Motion), writing each instance's matrix in closed form. */
  private stepMotions(dt: number): void {
    for (let n = this.bumps.length - 1; n >= 0; n--) {
      const b = this.bumps[n];
      b.t += dt;
      const { rec } = b;
      const u = b.t;
      if (u < 0) continue;
      const dur = b.kind === 'hit' ? HIT : b.kind === 'bump' ? BUMP : RETRACT;
      const done = u >= dur;
      if (b.kind === 'retract') {
        if (done) {
          rec.mesh.setMatrixAt(rec.i, this.zero);
        } else {
          const k = (u / RETRACT) ** 2;
          const sy = 1 - k;
          this.writeMatrix(rec, 1, sy, rec.rz, rec.y - 0.5 + 0.5 * sy - rec.y);
        }
        rec.mesh.instanceMatrix.needsUpdate = true;
        if (done) this.bumps.splice(n, 1);
        continue;
      }
      if (rec.hidden) {
        this.bumps.splice(n, 1);
        continue;
      }
      if (done) rec.mesh.setMatrixAt(rec.i, rec.matrix);
      else if (!DYNAMIC.has(rec.kind)) {
        // Anything else (a puzzle bumping an odd tile): a plain hop.
        this.tmp.copy(rec.matrix);
        this.tmp.elements[13] += 0.22 * b.amp * Math.sin((Math.PI * u) / BUMP);
        rec.mesh.setMatrixAt(rec.i, this.tmp);
      } else if (b.kind === 'hit') {
        let sx: number;
        let sy: number;
        let dy = 0;
        if (u < 0.04) {
          sx = 1.14;
          sy = 0.86;
        } else if (u < 0.16) {
          const k = (u - 0.04) / 0.12;
          dy = 0.42 * Math.sin((k * Math.PI) / 2);
          sx = 1.14 - 0.2 * k;
          sy = 0.86 + 0.22 * k;
        } else {
          const k = (u - 0.16) / 0.1;
          dy = 0.42 * Math.cos((k * Math.PI) / 2) * (1 - k) - 0.05 * Math.sin(k * Math.PI);
          sx = 0.94 + 0.06 * k;
          sy = 1.08 - 0.08 * k;
        }
        this.writeMatrix(rec, sx, sy, rec.rz, dy);
      } else {
        const k = u / BUMP;
        const dy = 0.22 * b.amp * Math.sin(Math.PI * k);
        const rz = rec.rz + 0.07 * b.amp * Math.sin(4 * Math.PI * k) * (1 - k);
        const sy = 1 + 0.06 * b.amp * Math.sin(Math.PI * k);
        this.writeMatrix(rec, 1 / sy, sy, rz, dy);
      }
      rec.mesh.instanceMatrix.needsUpdate = true;
      if (done) this.bumps.splice(n, 1);
    }
  }

  /** Writes a block's matrix: its resting scale times (sx, sy), turned rz, lifted dy. */
  private writeMatrix(rec: TileRecord, sx: number, sy: number, rz: number, dy: number): void {
    const e = this.tmp.makeRotationZ(rz).elements;
    const s = rec.s;
    e[0] *= s * sx;
    e[1] *= s * sx;
    e[4] *= s * sy;
    e[5] *= s * sy;
    e[10] *= s;
    e[12] = rec.x;
    e[13] = rec.y + dy;
    rec.mesh.setMatrixAt(rec.i, this.tmp);
  }

  /** The prompt beat: one typing dot per beat of the theme tune, and a glow that breathes with it. */
  private stepPrompt(): void {
    const mat = this.materials.get('question') as THREE.MeshToonMaterial | undefined;
    if (!mat) return;
    const beat = (this.time * this.opts.bpm) / 60;
    const still = prefs.reduceMotion;
    const frame = still ? 3 : Math.floor(beat) % 4;
    if (frame !== this.promptFrame) {
      this.promptFrame = frame;
      this.setPromptFrame(frame);
    }
    mat.emissiveIntensity = still ? PROMPT_GLOW : PROMPT_GLOW - 0.08 + 0.2 * Math.exp(-5 * (beat - Math.floor(beat)));
  }

  /** Lava bubbles: a small pool of cut-out bubbles, one draw, spawned only where the camera is. */
  private buildBubbles(scene: THREE.Scene): void {
    if (!this.lavaTops.length) return;
    const cap = 12;
    const mesh = new THREE.InstancedMesh(
      cachedGeo('tile:plane:1x1', () => new THREE.PlaneGeometry(1, 1)),
      new THREE.MeshBasicMaterial({ map: art.bubbleTexture(), alphaTest: 0.4 }),
      cap,
    );
    mesh.name = 'tiles:bubbles';
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    this.bubbles = { mesh, x: new Float32Array(cap), y: new Float32Array(cap), age: new Float32Array(cap), life: new Float32Array(cap), next: 0 };
  }

  private stepBubbles(dt: number, camX: number): void {
    const b = this.bubbles;
    if (!b) return;
    const rng = this.bubbleRng;
    const cap = b.x.length;
    const speed = prefs.reduceMotion ? 0.3 : 1;
    b.next -= dt * speed;
    if (b.next <= 0 && b.mesh.count < cap) {
      b.next = 0.12 + 0.2 * rng();
      // A random lava surface near the camera (a few tries, then give up this time).
      for (let tries = 0; tries < 6; tries++) {
        const i = Math.floor(rng() * (this.lavaTops.length / 2)) * 2;
        const x = this.lavaTops[i];
        if (Math.abs(x - camX) > 20) continue;
        const n = b.mesh.count++;
        b.x[n] = x + (rng() - 0.5) * 0.7;
        b.y[n] = this.lavaTops[i + 1];
        b.age[n] = 0;
        b.life[n] = 0.6 + 0.5 * rng();
        break;
      }
    }
    const m = b.mesh.instanceMatrix.array as Float32Array;
    for (let n = b.mesh.count - 1; n >= 0; n--) {
      b.age[n] += dt * speed;
      const k = b.age[n] / b.life[n];
      if (k >= 1) {
        // Swap-remove.
        const last = --b.mesh.count;
        b.x[n] = b.x[last];
        b.y[n] = b.y[last];
        b.age[n] = b.age[last];
        b.life[n] = b.life[last];
        continue;
      }
      // It swells as it rises out of the surface, then pops.
      const s = k < 0.85 ? 0.1 + 0.22 * k : (0.29 + 0.6 * (k - 0.85)) * (1 - (k - 0.85) / 0.15);
      const o = n * 16;
      m.fill(0, o, o + 16);
      m[o] = s;
      m[o + 5] = s;
      m[o + 10] = 1;
      m[o + 12] = b.x[n];
      m[o + 13] = b.y[n] - 0.08 + 0.28 * Math.min(k, 0.85);
      m[o + 14] = 0.35;
      m[o + 15] = 1;
    }
    b.mesh.instanceMatrix.needsUpdate = true;
    b.mesh.visible = b.mesh.count > 0;
  }

  /**
   * Conveyor pulleys: a spoked wheel on the front face of both end tiles of every belt run, drawn
   * within the tile (they never overhang), turning the way the belt runs.
   */
  private buildPulleys(scene: THREE.Scene): void {
    const { grid } = this;
    const ends: [number, number, number][] = [];
    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        const tile = grid.get(tx, ty);
        if (tile !== T.CONVEYOR_R && tile !== T.CONVEYOR_L) continue;
        const dir = tile === T.CONVEYOR_R ? 1 : -1;
        if (grid.get(tx - 1, ty) !== tile) ends.push([tx + 0.5, ty + 0.5, dir]);
        if (grid.get(tx + 1, ty) !== tile && grid.get(tx - 1, ty) === tile) ends.push([tx + 0.5, ty + 0.5, dir]);
      }
    }
    if (!ends.length) return;
    const mesh = new THREE.InstancedMesh(
      cachedGeo('tile:pulley', () => new THREE.CircleGeometry(0.4, 20)),
      toonMat({ map: art.pulleyTexture() }),
      ends.length,
    );
    mesh.name = 'tiles:pulleys';
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    this.pulleys = {
      mesh,
      x: Float32Array.from(ends, (e) => e[0]),
      y: Float32Array.from(ends, (e) => e[1]),
      dir: Float32Array.from(ends, (e) => e[2]),
    };
    this.stepPulleys();
  }

  private stepPulleys(): void {
    const p = this.pulleys;
    if (!p) return;
    // The belt's surface runs at 1.2 tiles/s; a wheel of radius 0.4 turns at 1.2 / 0.4 rad/s.
    const turn = -3 * this.time * this.conveyorSign;
    for (let i = 0; i < p.x.length; i++) {
      this.tmp.makeRotationZ(turn * p.dir[i]).setPosition(p.x[i], p.y[i], DEPTH / 2 + 0.012);
      p.mesh.setMatrixAt(i, this.tmp);
    }
    p.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Eases hidden blocks between faint and shown over 0.15 s. */
  private stepHidden(dt: number): void {
    const mat = this.materials.get('hidden') as THREE.MeshToonMaterial | undefined;
    if (!mat || this.hiddenK === this.hiddenTarget) return;
    const step = dt / 0.15;
    this.hiddenK = this.hiddenTarget > this.hiddenK ? Math.min(1, this.hiddenK + step) : Math.max(0, this.hiddenK - step);
    const k = this.hiddenK * this.hiddenK * (3 - 2 * this.hiddenK);
    mat.opacity = 0.07 + (0.85 - 0.07) * k;
    mat.emissiveIntensity = 0.6 * k;
  }

  private setVisible(rec: TileRecord, visible: boolean): void {
    rec.hidden = !visible;
    if (visible) rec.mesh.visible = true;
    rec.mesh.setMatrixAt(rec.i, visible ? rec.matrix : this.zero);
    rec.mesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ build
  private buildTiles(scene: THREE.Scene): void {
    const cells = this.collectCells();
    const byKind = new Map<TileKind, Cell[]>();
    for (const c of cells) {
      const list = byKind.get(c.kind);
      if (list) list.push(c);
      else byKind.set(c.kind, [c]);
    }
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const euler = new THREE.Euler();
    for (const kind of KINDS) {
      const mine = byKind.get(kind);
      if (!mine?.length) continue;
      const material = this.material(kind);
      this.materials.set(kind, material);
      const mesh = new THREE.InstancedMesh(this.geometry(kind), material, mine.length);
      mesh.name = `tiles:${kind}`;
      if (DYNAMIC.has(kind)) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mine.forEach((c, i) => {
        const matrix = new THREE.Matrix4().compose(
          pos.set(c.x, c.y, c.z),
          quat.setFromEuler(euler.set(0, c.ry, c.rz)),
          scl.set(c.sx * c.s, c.sy * c.s, c.sz * c.s),
        );
        mesh.setMatrixAt(i, c.hidden ? this.zero : matrix);
        if (c.tint) mesh.setColorAt(i, c.tint);
        if (c.key === null) return;
        const list = this.records.get(c.key) ?? [];
        list.push({ mesh, i, matrix, kind, x: c.x, y: c.y, rz: c.rz, s: c.s, hidden: c.hidden });
        this.records.set(c.key, list);
      });
      // A kind whose every instance starts hidden (answered blocks, before any is hit) costs no draw
      // until one is shown.
      mesh.visible = mine.some((c) => !c.hidden);
      if (kind === 'hidden') mesh.renderOrder = 2;
      // Instances span the whole level and some start hidden, so a culling sphere would be wrong.
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
  }

  /** Every instance of the level, tile by tile. */
  private collectCells(): Cell[] {
    const { grid, theme } = this;
    const cells: Cell[] = [];
    const add = (kind: TileKind, key: number | null, x: number, y: number, o: Partial<Cell> = {}) =>
      cells.push({ kind, key, x, y, z: 0, sx: 1, sy: 1, sz: 1, ry: 0, rz: 0, s: 1, tint: null, hidden: false, ...o });
    const simple: Partial<Record<TileId, TileKind>> = {
      [T.BRICK]: 'brick',
      [T.HARD]: 'hard',
      [T.ONEWAY]: 'oneway',
      [T.CONVEYOR_R]: 'conveyorR',
      [T.CONVEYOR_L]: 'conveyorL',
      [T.TOGGLE_A]: 'toggleA',
      [T.TOGGLE_B]: 'toggleB',
      [T.HIDDEN]: 'hidden',
      [T.GATE]: 'gate',
    };
    const at = (tx: number, ty: number) => grid.get(tx, ty);
    const inside = (tx: number) => tx >= 0 && tx < grid.width;
    // Ground a cap sits on: open above (a gate may open; toggles and hidden blocks come and go).
    const capped = (tx: number, ty: number) => {
      const above = at(tx, ty + 1);
      return at(tx, ty) === T.GROUND && (above === T.EMPTY || above === T.GATE || above === T.TOGGLE_A || above === T.TOGGLE_B || above === T.HIDDEN);
    };
    // A cap overhangs the end of its run where the ground drops away.
    const lipAt = (bx: number, ty: number) => inside(bx) && (at(bx, ty) === T.EMPTY || at(bx, ty) === T.LAVA);
    // Walking off this side of (tx, ty) drops into lava.
    const intoLava = (bx: number, ty: number) => {
      if (!inside(bx)) return false;
      for (let y = ty; y >= 0; y--) {
        const tile = at(bx, y);
        if (tile === T.LAVA) return true;
        if (tile !== T.EMPTY) return false;
      }
      return !!theme.lavaPits;
    };
    const jitter = (tx: number, ty: number, f = 1) => {
      const v = (0.95 + 0.1 * hash01(tx, ty)) * f;
      return new THREE.Color(v, v, v);
    };
    // Decor cut-outs stand on some caps, never next to pipes or gates.
    const decorRng = mulberry32(grid.width * 7);
    const decorEvery = this.opts.touch ? 1 / 6 : 1 / 3;
    const busy = (tx: number, ty: number) => [at(tx - 1, ty + 1), at(tx + 1, ty + 1), at(tx, ty + 1)].some((t) => t === T.PIPE || t === T.GATE);
    const shadowFor = (key: number, tx: number, ty: number, oneway = false) => {
      if (ty > 0 && at(tx, ty - 1) === T.EMPTY) {
        add('shadow', key, tx + 0.57, oneway ? ty + 0.71 : ty + 0.36, { z: -0.66, sy: oneway ? 0.3 : 1 });
      }
    };

    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        const tile = at(tx, ty);
        if (tile === T.EMPTY || tile === T.PIPE) continue;
        const key = grid.index(tx, ty);
        const cx = tx + 0.5;
        const cy = ty + 0.5;
        if (tile === T.GROUND) {
          add('ground', key, cx, cy, { s: SEAL, tint: jitter(tx, ty) });
          if (capped(tx, ty)) {
            const lipL = lipAt(tx - 1, ty);
            const lipR = lipAt(tx + 1, ty);
            const scorched = (lipL && intoLava(tx - 1, ty)) || (lipR && intoLava(tx + 1, ty));
            add('cap', key, cx + 0.04 * (+lipR - +lipL), ty + 0.9, {
              s: SEAL,
              sx: 1 + 0.08 * (+lipL + +lipR),
              tint: scorched ? new THREE.Color(SCORCH) : null,
            });
            if (theme.tiles.decor && decorRng() < decorEvery && !busy(tx, ty)) {
              const flip = decorRng() < 0.5 ? -1 : 1;
              add('decor', key, cx + (decorRng() - 0.5) * 0.4, ty + 1.18, { z: -0.35, sx: flip * (0.8 + 0.4 * decorRng()) });
            }
          }
          shadowFor(key, tx, ty);
        } else if (tile === T.QUESTION) {
          add('question', key, cx, cy);
          add('used', key, cx, cy, { s: 0.96, hidden: true });
          shadowFor(key, tx, ty);
        } else if (tile === T.USED) {
          add('used', key, cx, cy, { s: 0.96 });
          shadowFor(key, tx, ty);
        } else if (tile === T.LAVA) {
          add('lava', key, cx, ty + 0.4, { sy: 0.8 });
          if (at(tx, ty + 1) === T.EMPTY) {
            add('lavaGlow', key, cx, ty + 1.6, { z: -0.3 });
            this.lavaTops.push(cx, ty + 0.8);
          }
        } else if (tile === T.SPIKES) {
          add('spikes', key, cx, ty);
        } else if (simple[tile]) {
          const kind = simple[tile]!;
          add(kind, key, cx, cy, kind === 'brick' ? { rz: (hash01(tx, ty + 17) - 0.5) * 0.024, s: 0.98 } : {});
          if (kind === 'brick' || kind === 'hard') shadowFor(key, tx, ty);
          else if (kind === 'oneway') shadowFor(key, tx, ty, true);
        }
      }
    }
    this.collectPipes(add);

    // Extra ground below row 0 (not under pits), so the playfield can sit above touch controls.
    for (let tx = 0; tx < grid.width; tx++) {
      const tile = at(tx, 0);
      if (tile === T.GROUND) {
        for (let d = 0; d < 4; d++) add('ground', null, tx + 0.5, -d - 0.5, { s: SEAL, tint: jitter(tx, -d - 1, DEPTH_TINT[d]) });
      } else if (theme.lavaPits && tile === T.EMPTY) {
        add('lava', null, tx + 0.5, -0.6, { sy: 0.8 });
        add('lavaGlow', null, tx + 0.5, 0.6, { z: -0.3 });
        this.lavaTops.push(tx + 0.5, -0.2);
      } else if (!theme.lavaPits && tile === T.EMPTY) {
        // Pits read as holes into darkness.
        add('pitShade', null, tx + 0.5, -2.6, { z: -0.62 });
      }
    }
    return cells;
  }

  /**
   * Construction-toy tubes: per row, each run of pipe columns pairs up from the left into one
   * double-width tube (a left and a right half at the pair's centre); an odd column is a thin single.
   * The top tile of each column gets a bolted collar.
   */
  private collectPipes(add: (kind: TileKind, key: number | null, x: number, y: number, o?: Partial<Cell>) => void): void {
    const { grid } = this;
    for (let ty = 0; ty < grid.height; ty++) {
      let tx = 0;
      while (tx < grid.width) {
        if (grid.get(tx, ty) !== T.PIPE) {
          tx++;
          continue;
        }
        let end = tx;
        while (grid.get(end + 1, ty) === T.PIPE) end++;
        for (let x = tx; x <= end; x += 2) {
          const top = (col: number) => grid.get(col, ty + 1) !== T.PIPE;
          if (x + 1 <= end) {
            const cx = x + 1;
            // Both halves share one mesh: the right half is the left one turned about y.
            add('pipeHalf', grid.index(x, ty), cx, ty + 0.5, { sz: 0.6 });
            add('pipeHalf', grid.index(x + 1, ty), cx, ty + 0.5, { sz: 0.6, ry: Math.PI });
            if (top(x)) add('collarHalf', grid.index(x, ty), cx, ty + 0.5, { sz: 0.6 });
            if (top(x + 1)) add('collarHalf', grid.index(x + 1, ty), cx, ty + 0.5, { sz: 0.6, ry: Math.PI });
          } else {
            add('pipe1', grid.index(x, ty), x + 0.5, ty + 0.5);
            if (top(x)) add('collar1', grid.index(x, ty), x + 0.5, ty + 0.5);
          }
        }
        tx = end + 1;
      }
    }
  }

  private geometry(kind: TileKind): THREE.BufferGeometry {
    switch (kind) {
      case 'ground':
        return cachedGeo('tile:box', () => insetSides(atlasUV(new THREE.BoxGeometry(1, 1, DEPTH))));
      case 'cap':
        return cachedGeo('tile:cap', () => insetSides(atlasUV(new THREE.BoxGeometry(1, 0.26, 1.26)), false));
      case 'lava':
        return cachedGeo('tile:lava', () =>
          atlasUV(new THREE.BoxGeometry(1, 1, DEPTH), { front: CELL.FULL, top: [0, 0.85, 1, 1] as Rect, side: CELL.FULL, bottom: CELL.FULL }),
        );
      case 'lavaGlow':
        return cachedGeo('tile:plane:1x1.6', () => new THREE.PlaneGeometry(1, 1.6));
      case 'pitShade':
        return cachedGeo('tile:plane:1x6.8', () => new THREE.PlaneGeometry(1, 6.8));
      case 'shadow':
        return cachedGeo('tile:plane:1x1', () => new THREE.PlaneGeometry(1, 1));
      case 'brick':
      case 'hard':
      case 'toggleA':
      case 'toggleB':
      case 'hidden':
      case 'gate':
        return chamferBox(0.06);
      case 'question':
      case 'used':
        return roundBlock();
      case 'oneway':
        return cachedGeo('tile:oneway', onewayGeo);
      case 'conveyorR':
      case 'conveyorL':
        return cachedGeo('tile:plainBox', () => new THREE.BoxGeometry(1, 1, DEPTH));
      case 'spikes':
        return cachedGeo('tile:spikes', spikesGeo);
      case 'pipeHalf':
        return cachedGeo('tile:pipeHalf', () => new THREE.CylinderGeometry(1, 1, 1, 12, 1, true, Math.PI, Math.PI));
      case 'pipe1':
        return cachedGeo('tile:pipe1', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, true));
      case 'collarHalf':
      case 'collar1':
        return cachedGeo(`tile:${kind}`, () => collarGeo(kind));
      case 'decor':
        return cachedGeo('tile:plane:0.5x0.3', () => new THREE.PlaneGeometry(0.5, 0.3));
    }
  }

  /** Materials are per level (the view mutates opacity, emissive and map); textures are shared. */
  private material(kind: TileKind): THREE.Material {
    const { theme } = this;
    const style = theme.tiles;
    switch (kind) {
      case 'ground': {
        const glow = art.GLOWING_SOILS.includes(style.soil);
        return toonMat({
          map: art.soilAtlas(style.soil, theme.ground),
          ...(glow ? { emissive: 0xffffff, emissiveMap: art.soilAtlas(style.soil, theme.ground, true), emissiveIntensity: 0.8 } : {}),
        });
      }
      case 'cap':
        return toonMat({ map: art.capAtlas(style.cap, theme.grass, theme.ground), alphaTest: 0.5 });
      case 'brick':
        return toonMat({ map: art.brickAtlas(theme.brick) });
      case 'question':
        // The prompt glows a little in its own colour, so it stays the same amber under every
        // theme's lights (cool cave or storm light would turn it olive).
        return toonMat({ map: this.promptFrames[3], emissive: 0xffffff, emissiveMap: this.promptFrames[3], emissiveIntensity: PROMPT_GLOW });
      case 'used':
        return toonMat({ map: art.usedAtlas() });
      case 'hard':
        return toonMat({
          map: art.hardAtlas(style.hard, theme.hard),
          ...(style.hard === 'star' ? { emissive: 0xffffff, emissiveMap: art.hardAtlas('star', theme.hard, true), emissiveIntensity: 0.8 } : {}),
        });
      case 'oneway':
        return toonMat({
          map: art.shelfAtlas(style.shelf, theme.platform),
          alphaTest: 0.5,
          emissive: theme.platform,
          emissiveIntensity: style.shelf === 'glow' ? 0.35 : 0.15,
        });
      case 'conveyorR':
      case 'conveyorL': {
        const tex = arrowTexture(kind === 'conveyorR' ? 1 : -1);
        this.conveyorTextures[kind === 'conveyorR' ? 0 : 1] = tex;
        return toonMat({ map: tex });
      }
      case 'toggleA':
        return toonMat({ map: art.toggleAtlas('A'), transparent: true, emissive: 0x46a0ff, emissiveIntensity: 0 });
      case 'toggleB':
        return toonMat({ map: art.toggleAtlas('B'), transparent: true, opacity: 0.18, emissive: 0xff7a46, emissiveIntensity: 0 });
      case 'hidden':
        return toonMat({ map: art.hiddenAtlas(), transparent: true, opacity: 0.07, depthWrite: false, emissive: 0x6a3cff, emissiveIntensity: 0 });
      case 'spikes':
        return toonMat({ vertexColors: true });
      case 'gate':
        return toonMat({ map: art.gateAtlas(), emissive: 0x400010, emissiveIntensity: 1 });
      case 'pipeHalf':
      case 'pipe1':
        return toonMat({ map: art.pipeBody(theme.pipe) });
      case 'collarHalf':
      case 'collar1':
        return toonMat({ map: art.pipeCollar(theme.pipe), vertexColors: true });
      case 'lava':
        return (this.lavaMat = new THREE.MeshBasicMaterial({ map: art.lavaTexture() }));
      case 'lavaGlow':
        return (this.glowMat = new THREE.MeshBasicMaterial({
          color: 0xff7a2a,
          alphaMap: art.gradientAlpha(),
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }));
      case 'pitShade':
        return new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: art.gradientAlpha(), transparent: true, opacity: 0.6, depthWrite: false });
      case 'shadow':
        return new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: art.shadowAlpha(), transparent: true, opacity: 0.24, depthWrite: false });
      case 'decor':
        return toonMat({ map: art.decorTexture(style.decor ?? 'daisies'), alphaTest: 0.5, side: THREE.DoubleSide });
    }
  }
}

/**
 * Sets a box's side (and, with `tops`, top and bottom) faces back from its front by a hair. Each of
 * those faces' front edge lies in the front plane, and that depth tie let the inked side cell win
 * pixels along every seam; set back 1.5% in depth (and pulled in 0.6%), the front always wins, while
 * an exposed pit wall still shows its ink. Caps keep their top flush, so the lip edge stays crisp.
 */
function insetSides(geo: THREE.BufferGeometry, tops = true, f = 0.994, fz = 0.985): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    const side = Math.abs(nrm.getX(i)) > 0.5;
    const top = !side && Math.abs(nrm.getY(i)) > 0.5;
    if (side) pos.setX(i, pos.getX(i) * f);
    else if (top && tops) pos.setY(i, pos.getY(i) * f);
    if (side || (top && tops)) pos.setZ(i, pos.getZ(i) * fz);
  }
  pos.needsUpdate = true;
  geo.computeBoundingBox();
  return geo;
}

/** Paints a whole geometry one colour (as a vertex colour attribute), or per vertex via fn(y). */
function colorize(geo: THREE.BufferGeometry, hex: number | ((y: number) => THREE.Color)): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    if (typeof hex === 'number') c.setHex(hex);
    else c.copy(hex(pos.getY(i)));
    c.toArray(col, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** A one-way shelf: a slab at the top of the tile plus a fringe hanging under its front edge. */
function onewayGeo(): THREE.BufferGeometry {
  const slab = atlasUV(new THREE.BoxGeometry(1, 0.3, DEPTH), { front: CELL.F, top: CELL.T, side: CELL.S, bottom: CELL.S });
  slab.translate(0, 0.35, 0);
  const fringe = new THREE.PlaneGeometry(1, 0.16);
  fringe.translate(0, 0.12, 0.6);
  atlasUV(fringe, CELL.U);
  return mergeGeometries([slab, fringe])!;
}

/** Spikes, a "pushpin bed": a red plate with five steel pins. The same in every theme. */
function spikesGeo(): THREE.BufferGeometry {
  const plate = colorize(new THREE.BoxGeometry(0.96, 0.16, 1.0).translate(0, 0.08, 0), 0xe23a3a);
  const steel = new THREE.Color(0xb8c0cc);
  const tip = new THREE.Color(0xffffff);
  const pin = (h: number, x: number, z: number) => {
    const g = new THREE.ConeGeometry(0.15, h, 6).translate(x, 0.16 + h / 2, z);
    const c = new THREE.Color();
    return colorize(g, (y) => c.copy(steel).lerp(tip, THREE.MathUtils.clamp((y - 0.16) / h, 0, 1)));
  };
  return mergeGeometries([plate, pin(0.78, -0.3, 0.18), pin(0.78, 0, 0.18), pin(0.78, 0.3, 0.18), pin(0.66, -0.15, -0.22), pin(0.66, 0.15, -0.22)])!;
}

/**
 * A tube's collar: a wider band, a flat rim ring and a dark mouth; for paired tubes, the left half
 * of each (x < 0), which the right tile turns round. Bolts at u 0.2 and 0.8, so one faces the camera.
 */
function collarGeo(kind: 'collarHalf' | 'collar1'): THREE.BufferGeometry {
  const single = kind === 'collar1';
  const r = single ? 0.56 : 1.1;
  const inner = single ? 0.38 : 0.78;
  const [bandStart, len] = single ? [0, Math.PI * 2] : [Math.PI, Math.PI];
  const ringStart = single ? 0 : Math.PI / 2;
  const band = colorize(new THREE.CylinderGeometry(r, r, 0.5, single ? 16 : 12, 1, true, bandStart, len).translate(0, 0.25, 0), 0xffffff);
  const ring = colorize(new THREE.RingGeometry(inner, r, 12, 1, ringStart, len).rotateX(-Math.PI / 2).translate(0, 0.5, 0), 0xffffff);
  const mouth = colorize(new THREE.CircleGeometry(inner, 12, ringStart, len).rotateX(-Math.PI / 2).translate(0, 0.48, 0), 0x241c28);
  return mergeGeometries([band, ring, mouth])!;
}
