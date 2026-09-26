import * as THREE from 'three';
import type { Theme } from '../config/themes';
import { LevelGrid, T, type TileId } from './level';
import { arrowTexture, brickTexture, canvasTexture, groundTexture, plainTexture, questionTexture, spikeTexture } from './meshes';
import { mulberry32 } from './rng';

interface TileRecord {
  mesh: THREE.InstancedMesh;
  i: number;
  matrix: THREE.Matrix4;
}

type Kind =
  | 'grass'
  | 'ground'
  | 'brick'
  | 'question'
  | 'used'
  | 'pipe'
  | 'hard'
  | 'oneway'
  | 'conveyorR'
  | 'conveyorL'
  | 'toggleA'
  | 'toggleB'
  | 'hidden'
  | 'spikes'
  | 'lava'
  | 'gate';

const DEPTH = 1.2;

/** Draws the tile grid with one InstancedMesh per tile kind, plus the backdrop. */
export class LevelView {
  private readonly records = new Map<number, TileRecord[]>();
  private readonly bumps: { rec: TileRecord; t: number }[] = [];
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly tmp = new THREE.Matrix4();
  private readonly kindMeshes = new Map<Kind, THREE.InstancedMesh>();
  private readonly materials = new Map<Kind, THREE.Material>();
  private conveyorTextures: THREE.Texture[] = [];
  private lavaMat: THREE.MeshBasicMaterial | null = null;
  private time = 0;

  constructor(private readonly grid: LevelGrid, private readonly theme: Theme, scene: THREE.Scene) {
    scene.background = skyTexture(theme);
    this.buildTiles(scene);
    this.buildBackdrop(scene);
  }

  /** A question block was hit: swap it for a used block and bump it. */
  activate(tx: number, ty: number): void {
    const [question, used] = this.records.get(this.grid.index(tx, ty)) ?? [];
    if (!question || !used) return;
    this.setVisible(question, false);
    this.setVisible(used, true);
    this.bump(used);
  }

  bumpTile(tx: number, ty: number): void {
    const rec = this.records.get(this.grid.index(tx, ty))?.[0];
    if (rec) this.bump(rec);
  }

  removeTile(tx: number, ty: number): void {
    for (const rec of this.records.get(this.grid.index(tx, ty)) ?? []) this.setVisible(rec, false);
  }

  /** Hidden blocks appear while someone can see them. */
  setHiddenVisible(visible: boolean): void {
    const mat = this.materials.get('hidden') as THREE.MeshLambertMaterial | undefined;
    if (mat) {
      mat.opacity = visible ? 0.85 : 0.07;
      mat.emissiveIntensity = visible ? 0.6 : 0;
    }
  }

  /** Which toggle set is solid: the other one fades out. */
  setPhase(phase: 0 | 1): void {
    const a = this.materials.get('toggleA') as THREE.MeshLambertMaterial | undefined;
    const b = this.materials.get('toggleB') as THREE.MeshLambertMaterial | undefined;
    if (a) a.opacity = phase === 0 ? 1 : 0.18;
    if (b) b.opacity = phase === 1 ? 1 : 0.18;
  }

  /** Reverses the conveyor arrows (the belts themselves are reversed in the grid). Mirroring the
   *  texture also reverses its scroll, so the offset animation stays as it is. */
  setConveyorSign(sign: number): void {
    for (const tex of this.conveyorTextures) tex.repeat.x = sign;
  }

  update(dt: number): void {
    this.time += dt;
    for (let n = this.bumps.length - 1; n >= 0; n--) {
      const bump = this.bumps[n];
      bump.t += dt;
      const k = Math.min(bump.t / 0.18, 1);
      this.tmp.copy(bump.rec.matrix);
      this.tmp.elements[13] += Math.sin(k * Math.PI) * 0.35;
      bump.rec.mesh.setMatrixAt(bump.rec.i, this.tmp);
      bump.rec.mesh.instanceMatrix.needsUpdate = true;
      if (k >= 1) this.bumps.splice(n, 1);
    }
    for (const [i, tex] of this.conveyorTextures.entries()) tex.offset.x = (i === 0 ? -1 : 1) * this.time * 1.2;
    if (this.lavaMat) this.lavaMat.color.setHSL(0.04 + Math.sin(this.time * 2) * 0.015, 1, 0.5);
  }

  private bump(rec: TileRecord): void {
    this.bumps.push({ rec, t: 0 });
  }

  private setVisible(rec: TileRecord, visible: boolean): void {
    rec.mesh.setMatrixAt(rec.i, visible ? rec.matrix : this.hidden);
    rec.mesh.instanceMatrix.needsUpdate = true;
  }

  private buildTiles(scene: THREE.Scene): void {
    const { grid, theme } = this;
    const cells: { kind: Kind; tx: number; ty: number; hiddenAtStart?: boolean; deco?: boolean }[] = [];
    const simple: Partial<Record<TileId, Kind>> = {
      [T.BRICK]: 'brick',
      [T.HARD]: 'hard',
      [T.PIPE]: 'pipe',
      [T.ONEWAY]: 'oneway',
      [T.CONVEYOR_R]: 'conveyorR',
      [T.CONVEYOR_L]: 'conveyorL',
      [T.TOGGLE_A]: 'toggleA',
      [T.TOGGLE_B]: 'toggleB',
      [T.HIDDEN]: 'hidden',
      [T.SPIKES]: 'spikes',
      [T.LAVA]: 'lava',
      [T.GATE]: 'gate',
    };
    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        const tile = grid.get(tx, ty) as TileId;
        if (tile === T.EMPTY) continue;
        if (tile === T.GROUND) cells.push({ kind: grid.get(tx, ty + 1) === T.EMPTY ? 'grass' : 'ground', tx, ty });
        else if (tile === T.QUESTION) {
          cells.push({ kind: 'question', tx, ty });
          cells.push({ kind: 'used', tx, ty, hiddenAtStart: true });
        } else if (simple[tile]) cells.push({ kind: simple[tile]!, tx, ty });
      }
    }
    // Extra dirt below solid ground (not under pits), so the playfield can sit above touch controls.
    for (let tx = 0; tx < grid.width; tx++) {
      if (grid.get(tx, 0) === T.GROUND) for (let ty = -1; ty >= -4; ty--) cells.push({ kind: 'ground', tx, ty, deco: true });
      else if (theme.lavaPits && grid.get(tx, 0) === T.EMPTY) cells.push({ kind: 'lava', tx, ty: -1, deco: true });
    }

    const [convR, convL] = [arrowTexture(1), arrowTexture(-1)];
    this.conveyorTextures = [convR, convL];
    const materials: Record<Kind, THREE.Material> = {
      grass: new THREE.MeshLambertMaterial({ map: groundTexture(true) }),
      ground: new THREE.MeshLambertMaterial({ map: groundTexture(false) }),
      brick: new THREE.MeshLambertMaterial({ map: brickTexture(), color: theme.brick }),
      question: new THREE.MeshLambertMaterial({ map: questionTexture(), emissive: 0x3a2400 }),
      used: new THREE.MeshLambertMaterial({ map: plainTexture(), color: 0x8a6a4a }),
      pipe: new THREE.MeshLambertMaterial({ color: theme.pipe }),
      hard: new THREE.MeshLambertMaterial({ map: plainTexture(), color: theme.hard }),
      oneway: new THREE.MeshLambertMaterial({ color: theme.platform, emissive: theme.platform, emissiveIntensity: 0.15 }),
      conveyorR: new THREE.MeshLambertMaterial({ map: convR, color: 0x9aa0aa }),
      conveyorL: new THREE.MeshLambertMaterial({ map: convL, color: 0x9aa0aa }),
      toggleA: new THREE.MeshLambertMaterial({ map: plainTexture(), color: 0x46a0ff, transparent: true }),
      toggleB: new THREE.MeshLambertMaterial({ map: plainTexture(), color: 0xff7a46, transparent: true, opacity: 0.18 }),
      hidden: new THREE.MeshLambertMaterial({ map: plainTexture(), color: 0xc8a8ff, emissive: 0x6a3cff, emissiveIntensity: 0, transparent: true, opacity: 0.07, depthWrite: false }),
      spikes: new THREE.MeshLambertMaterial({ map: spikeTexture(), color: 0xd0d4dc, transparent: true, alphaTest: 0.3 }),
      lava: (this.lavaMat = new THREE.MeshBasicMaterial({ color: 0xff5a1a })),
      gate: new THREE.MeshLambertMaterial({ map: plainTexture(), color: 0xb03a48, emissive: 0x400010 }),
    };
    const geometry = new THREE.BoxGeometry(1, 1, DEPTH);
    const slab = new THREE.BoxGeometry(1, 0.3, DEPTH);
    slab.translate(0, 0.35, 0);
    const color = new THREE.Color();

    for (const kind of Object.keys(materials) as Kind[]) {
      const mine = cells.filter((c) => c.kind === kind);
      if (!mine.length) {
        materials[kind].dispose();
        continue;
      }
      this.materials.set(kind, materials[kind]);
      const mesh = new THREE.InstancedMesh(kind === 'oneway' ? slab : geometry, materials[kind], mine.length);
      this.kindMeshes.set(kind, mesh);
      mine.forEach((c, i) => {
        const matrix = new THREE.Matrix4();
        if (kind === 'pipe') {
          // The top segment is a little wider: the pipe's lip.
          const lip = this.grid.get(c.tx, c.ty + 1) !== T.PIPE;
          const leftHalf = this.grid.get(c.tx - 1, c.ty) !== T.PIPE;
          matrix.compose(
            new THREE.Vector3(c.tx + 0.5 + (lip ? (leftHalf ? -0.06 : 0.06) : 0), c.ty + 0.5, 0),
            new THREE.Quaternion(),
            new THREE.Vector3(lip ? 1.12 : 1, 1, lip ? DEPTH * 0.95 : DEPTH * 0.8),
          );
        } else if (kind === 'lava') {
          matrix.compose(new THREE.Vector3(c.tx + 0.5, c.ty + 0.4, 0), new THREE.Quaternion(), new THREE.Vector3(1, 0.8, DEPTH));
        } else {
          matrix.makeTranslation(c.tx + 0.5, c.ty + 0.5, 0);
        }
        mesh.setMatrixAt(i, c.hiddenAtStart ? this.hidden : matrix);
        if (kind === 'grass') mesh.setColorAt(i, color.setHex(theme.grass));
        if (kind === 'ground') mesh.setColorAt(i, color.setHex(theme.ground));
        if (c.deco) return;
        const key = this.grid.index(c.tx, c.ty);
        const list = this.records.get(key) ?? [];
        list.push({ mesh, i, matrix });
        this.records.set(key, list);
      });
      if (kind === 'hidden') mesh.renderOrder = 2;
      // Instances span the whole level and some start hidden, so a culling sphere would be wrong.
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
  }

  private buildBackdrop(scene: THREE.Scene): void {
    const { grid, theme } = this;
    const group = new THREE.Group();
    const rand = mulberry32(grid.width);
    const W = grid.width;

    if (theme.backdrop === 'hills') {
      const hillMat = new THREE.MeshLambertMaterial({ color: theme.grass === 0x46c04a ? 0x6fd46f : 0x9ccf5a });
      const farMat = new THREE.MeshLambertMaterial({ color: theme.grass === 0x46c04a ? 0x9ee29e : 0xc8e39a });
      const geo = new THREE.SphereGeometry(1, 20, 12);
      for (let x = -10; x < W + 20; x += 14 + rand() * 12) {
        const far = rand() > 0.5;
        const hill = new THREE.Mesh(geo, far ? farMat : hillMat);
        const r = far ? 9 + rand() * 5 : 5 + rand() * 3;
        hill.scale.set(r * 1.4, r, 1);
        hill.position.set(x, 1, far ? -22 : -8);
        group.add(hill);
      }
    } else if (theme.backdrop === 'crystals') {
      const mat = new THREE.MeshLambertMaterial({ color: 0x3f7fff, emissive: 0x1d4fd0, emissiveIntensity: 0.7 });
      const geo = new THREE.OctahedronGeometry(0.8);
      for (let x = 0; x < W; x += 6 + rand() * 8) {
        const crystal = new THREE.Mesh(geo, mat);
        crystal.scale.set(1, 3 + rand() * 4, 1);
        crystal.position.set(x, 2 + rand() * 9, -9 - rand() * 8);
        crystal.rotation.z = (rand() - 0.5) * 0.6;
        group.add(crystal);
      }
    } else if (theme.backdrop === 'pillars') {
      const stone = new THREE.MeshLambertMaterial({ color: 0x3b3336 });
      const flame = new THREE.MeshBasicMaterial({ color: 0xffa640 });
      const pillarGeo = new THREE.BoxGeometry(2, 16, 2);
      const torchGeo = new THREE.SphereGeometry(0.25, 8, 6);
      for (let x = 0; x < W; x += 10) {
        const pillar = new THREE.Mesh(pillarGeo, stone);
        pillar.position.set(x, 7, -7);
        const torch = new THREE.Mesh(torchGeo, flame);
        torch.position.set(x, 8, -5.9);
        group.add(pillar, torch);
      }
    } else if (theme.backdrop === 'cloudsea') {
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xdde8ff, emissiveIntensity: 0.5 });
      const geo = new THREE.SphereGeometry(1, 14, 10);
      for (let x = -10; x < W + 20; x += 3 + rand() * 4) {
        const puff = new THREE.Mesh(geo, mat);
        const r = 2.5 + rand() * 2.5;
        puff.scale.set(r * 1.3, r * 0.7, 1);
        puff.position.set(x, -2.5 + rand() * 1.5, -6 - rand() * 10);
        group.add(puff);
      }
    } else if (theme.backdrop === 'pipes') {
      const mat = new THREE.MeshLambertMaterial({ color: 0x1f6a55 });
      const rim = new THREE.MeshLambertMaterial({ color: 0x2a8a70 });
      const geo = new THREE.CylinderGeometry(1, 1, 1, 16);
      for (let x = 0; x < W; x += 5 + rand() * 7) {
        const h = 3 + rand() * 10;
        const r = 0.8 + rand() * 1.2;
        const pipe = new THREE.Mesh(geo, mat);
        pipe.scale.set(r, h, r);
        pipe.position.set(x, h / 2 - 1, -8 - rand() * 8);
        const lip = new THREE.Mesh(geo, rim);
        lip.scale.set(r * 1.2, 0.6, r * 1.2);
        lip.position.set(x, h - 1, pipe.position.z);
        group.add(pipe, lip);
      }
    } else if (theme.backdrop === 'ghost') {
      const wall = new THREE.MeshLambertMaterial({ color: 0x2a1a3a });
      const glow = new THREE.MeshBasicMaterial({ color: 0xffe08a });
      const winGeo = new THREE.BoxGeometry(1.2, 1.8, 0.1);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, 30), wall);
      back.position.set(W / 2, 7, -10);
      group.add(back);
      for (let x = 4; x < W; x += 9 + rand() * 6) {
        const win = new THREE.Mesh(winGeo, glow);
        win.position.set(x, 7 + rand() * 3, -9.9);
        group.add(win);
      }
      const moon = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), new THREE.MeshBasicMaterial({ color: 0xf6f0d8 }));
      moon.position.set(W * 0.3, 12, -30);
      group.add(moon);
    } else if (theme.backdrop === 'gears') {
      const mat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
      for (let x = 0; x < W; x += 8 + rand() * 8) {
        const r = 1.5 + rand() * 2.5;
        const gear = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.28, 6, 10), mat);
        gear.position.set(x, 4 + rand() * 8, -9 - rand() * 6);
        gear.name = 'gear';
        group.add(gear);
      }
    } else if (theme.backdrop === 'towers') {
      const stone = new THREE.MeshLambertMaterial({ color: 0x2a2236 });
      const roof = new THREE.MeshLambertMaterial({ color: 0x4a2a5a });
      const light = new THREE.MeshBasicMaterial({ color: 0xffc46a });
      const bodyGeo = new THREE.CylinderGeometry(1.4, 1.6, 1, 10);
      const roofGeo = new THREE.ConeGeometry(1.9, 3, 10);
      const winGeo = new THREE.BoxGeometry(0.4, 0.7, 0.1);
      for (let x = 0; x < W + 10; x += 9 + rand() * 9) {
        const h = 8 + rand() * 8;
        const tower = new THREE.Mesh(bodyGeo, stone);
        tower.scale.y = h;
        tower.position.set(x, h / 2 - 1, -14 - rand() * 6);
        const cap = new THREE.Mesh(roofGeo, roof);
        cap.position.set(x, h + 0.5, tower.position.z);
        const win = new THREE.Mesh(winGeo, light);
        win.position.set(x, h * 0.7, tower.position.z + 1.6);
        group.add(tower, cap, win);
      }
    } else {
      const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const geo = new THREE.SphereGeometry(0.07, 6, 4);
      for (let i = 0; i < W * 1.5; i++) {
        const s = new THREE.Mesh(geo, starMat);
        s.position.set(rand() * (W + 30) - 10, rand() * 18, -15 - rand() * 15);
        group.add(s);
      }
    }

    if (theme.clouds) {
      const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35 });
      const geo = new THREE.SphereGeometry(1, 12, 8);
      for (let x = 0; x < W + 20; x += 11 + rand() * 14) {
        const cloud = new THREE.Group();
        for (let i = 0; i < 4; i++) {
          const puff = new THREE.Mesh(geo, cloudMat);
          puff.scale.setScalar(0.9 + rand() * 0.5);
          puff.position.set(i * 1.1 - 1.6, rand() * 0.4, 0);
          cloud.add(puff);
        }
        cloud.scale.set(1, 0.7, 0.4);
        cloud.position.set(x, 11 + rand() * 3, -12);
        group.add(cloud);
      }
    }
    scene.add(group);
  }
}

function skyTexture(theme: Theme): THREE.Texture {
  const texture = canvasTexture(64, (c, s) => {
    const gradient = c.createLinearGradient(0, 0, 0, s);
    gradient.addColorStop(0, theme.skyTop);
    gradient.addColorStop(1, theme.skyBottom);
    c.fillStyle = gradient;
    c.fillRect(0, 0, s, s);
  });
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
