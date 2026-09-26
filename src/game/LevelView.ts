import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Theme } from '../config/themes';
import { artOptions, atlasUV, CELL, chamferBox, roundBlock, type Rect } from './art';
import { Fx } from './fx';
import { buildLegacyBackdrop } from './legacyBackdrop';
import { LevelGrid, T, type TileId } from './level';
import { arrowTexture } from './meshes';
import { hash01, mixHex } from './palette';
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
  private readonly bumps: { rec: TileRecord; t: number }[] = [];
  private readonly zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly tmp = new THREE.Matrix4();
  private readonly materials = new Map<TileKind, THREE.Material>();
  /** The prompt block's four typing frames (dot k raised); frame 3 is the resting face. */
  private readonly promptFrames: THREE.Texture[];
  /** [right-moving, left-moving] belt textures, where the level has them. */
  private readonly conveyorTextures: (THREE.Texture | null)[] = [null, null];
  private lavaMat: THREE.MeshBasicMaterial | null = null;
  private glowMat: THREE.MeshBasicMaterial | null = null;
  private time = 0;

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
    buildLegacyBackdrop(scene, theme, grid.width);
    this.fx = new Fx(scene, opts.touch);
  }

  /** A question block was hit: swap it for a used block and bump it. */
  activate(tx: number, ty: number): void {
    const [question, used] = this.records.get(this.grid.index(tx, ty)) ?? [];
    if (!question || !used) return;
    this.setVisible(question, false);
    this.setVisible(used, true);
    this.bump(used);
  }

  /** Bumps the tile's block (never its cap, decor or shadow, and never a hidden record). */
  bumpTile(tx: number, ty: number): void {
    const rec = this.records.get(this.grid.index(tx, ty))?.find((r) => !r.hidden && !DRESSING.has(r.kind));
    if (rec) this.bump(rec);
  }

  /** Hides everything drawn for the tile (its cap and shadow too). */
  removeTile(tx: number, ty: number): void {
    for (const rec of this.records.get(this.grid.index(tx, ty)) ?? []) this.setVisible(rec, false);
  }

  /** Hidden blocks appear while someone can see them. */
  setHiddenVisible(visible: boolean): void {
    const mat = this.materials.get('hidden') as THREE.MeshToonMaterial | undefined;
    if (mat) {
      mat.opacity = visible ? 0.85 : 0.07;
      mat.emissiveIntensity = visible ? 0.6 : 0;
    }
  }

  /** Which toggle set is solid: the other one fades out. */
  setPhase(phase: 0 | 1): void {
    const a = this.materials.get('toggleA') as THREE.MeshToonMaterial | undefined;
    const b = this.materials.get('toggleB') as THREE.MeshToonMaterial | undefined;
    if (a) a.opacity = phase === 0 ? 1 : 0.18;
    if (b) b.opacity = phase === 1 ? 1 : 0.18;
  }

  /** Reverses the conveyor arrows (the belts themselves are reversed in the grid). Mirroring the
   *  texture also reverses its scroll, so the offset animation stays as it is. */
  setConveyorSign(sign: number): void {
    for (const tex of this.conveyorTextures) if (tex) tex.repeat.x = sign;
  }

  /** Per-frame animation. `_camX` is the camera's x, for the backdrop's parallax (backdrop.ts). */
  update(dt: number, _camX = 0): void {
    this.time += dt;
    for (let n = this.bumps.length - 1; n >= 0; n--) {
      const bump = this.bumps[n];
      bump.t += dt;
      const k = Math.min(bump.t / 0.18, 1);
      if (!bump.rec.hidden) {
        this.tmp.copy(bump.rec.matrix);
        this.tmp.elements[13] += Math.sin(k * Math.PI) * 0.35;
        bump.rec.mesh.setMatrixAt(bump.rec.i, this.tmp);
        bump.rec.mesh.instanceMatrix.needsUpdate = true;
      }
      if (k >= 1) this.bumps.splice(n, 1);
    }
    this.conveyorTextures.forEach((tex, i) => {
      if (tex) tex.offset.x = (i === 0 ? -1 : 1) * this.time * 1.2;
    });
    if (this.lavaMat) {
      this.lavaMat.map!.offset.x = 0.15 * this.time;
      this.lavaMat.color.setHSL(0.08, 1, 0.92 + 0.05 * Math.sin(this.time * 2));
    }
    if (this.glowMat) this.glowMat.opacity = 0.42 + 0.08 * Math.sin(this.time * 3);
    this.fx.update(dt);
  }

  /** Shows prompt frame k (0..3) on every prompt block: one typing dot per beat (see promptFrames). */
  setPromptFrame(k: number): void {
    const mat = this.materials.get('question') as THREE.MeshToonMaterial | undefined;
    if (!mat) return;
    mat.map = mat.emissiveMap = this.promptFrames[k & 3];
  }

  private bump(rec: TileRecord): void {
    this.bumps.push({ rec, t: 0 });
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
          if (at(tx, ty + 1) === T.EMPTY) add('lavaGlow', key, cx, ty + 1.6, { z: -0.3 });
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
        return toonMat({ alphaTest: 0.5, side: THREE.DoubleSide });
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
