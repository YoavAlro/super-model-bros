import * as THREE from 'three';
import type { Theme } from '../config/themes';
import { LevelGrid, T, type TileId } from './level';
import { brickTexture, canvasTexture, groundTexture, plainTexture, questionTexture } from './meshes';

interface TileRecord {
  mesh: THREE.InstancedMesh;
  i: number;
  matrix: THREE.Matrix4;
}

type Kind = 'grass' | 'ground' | 'brick' | 'question' | 'used' | 'pipe' | 'hard';

const DEPTH = 1.2;

/** Draws the tile grid with one InstancedMesh per tile kind, plus the backdrop. */
export class LevelView {
  private readonly records = new Map<number, TileRecord[]>();
  private readonly bumps: { rec: TileRecord; t: number }[] = [];
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly tmp = new THREE.Matrix4();

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

  update(dt: number): void {
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
    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        const tile = grid.get(tx, ty) as TileId;
        if (tile === T.EMPTY) continue;
        if (tile === T.GROUND) cells.push({ kind: grid.get(tx, ty + 1) === T.EMPTY ? 'grass' : 'ground', tx, ty });
        else if (tile === T.BRICK) cells.push({ kind: 'brick', tx, ty });
        else if (tile === T.HARD) cells.push({ kind: 'hard', tx, ty });
        else if (tile === T.PIPE) cells.push({ kind: 'pipe', tx, ty });
        else if (tile === T.QUESTION) {
          cells.push({ kind: 'question', tx, ty });
          cells.push({ kind: 'used', tx, ty, hiddenAtStart: true });
        }
      }
    }
    // Extra dirt below solid ground (not under pits), so the playfield can sit above touch controls.
    for (let tx = 0; tx < grid.width; tx++) {
      if (grid.get(tx, 0) === T.GROUND) for (let ty = -1; ty >= -4; ty--) cells.push({ kind: 'ground', tx, ty, deco: true });
    }

    const materials: Record<Kind, THREE.Material> = {
      grass: new THREE.MeshLambertMaterial({ map: groundTexture(true) }),
      ground: new THREE.MeshLambertMaterial({ map: groundTexture(false) }),
      brick: new THREE.MeshLambertMaterial({ map: brickTexture(), color: theme.brick }),
      question: new THREE.MeshLambertMaterial({ map: questionTexture(), emissive: 0x3a2400 }),
      used: new THREE.MeshLambertMaterial({ map: plainTexture(), color: 0x8a6a4a }),
      pipe: new THREE.MeshLambertMaterial({ color: theme.pipe }),
      hard: new THREE.MeshLambertMaterial({ map: plainTexture(), color: theme.hard }),
    };
    const geometry = new THREE.BoxGeometry(1, 1, DEPTH);
    const color = new THREE.Color();

    for (const kind of Object.keys(materials) as Kind[]) {
      const mine = cells.filter((c) => c.kind === kind);
      if (!mine.length) continue;
      const mesh = new THREE.InstancedMesh(geometry, materials[kind], mine.length);
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
      scene.add(mesh);
    }
  }

  private buildBackdrop(scene: THREE.Scene): void {
    const { grid, theme } = this;
    const group = new THREE.Group();
    const rand = mulberry32(grid.width);

    if (theme.backdrop === 'hills') {
      const hillMat = new THREE.MeshLambertMaterial({ color: 0x6fd46f });
      const farMat = new THREE.MeshLambertMaterial({ color: 0x9ee29e });
      for (let x = -10; x < grid.width + 20; x += 14 + rand() * 12) {
        const far = rand() > 0.5;
        const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), far ? farMat : hillMat);
        const r = far ? 9 + rand() * 5 : 5 + rand() * 3;
        hill.scale.set(r * 1.4, r, 1);
        hill.position.set(x, 1, far ? -22 : -8);
        group.add(hill);
      }
    } else if (theme.backdrop === 'crystals') {
      const mat = new THREE.MeshLambertMaterial({ color: 0x3f7fff, emissive: 0x1d4fd0, emissiveIntensity: 0.7 });
      for (let x = 0; x < grid.width; x += 6 + rand() * 8) {
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), mat);
        crystal.scale.set(1, 3 + rand() * 4, 1);
        crystal.position.set(x, 2 + rand() * 9, -9 - rand() * 8);
        crystal.rotation.z = (rand() - 0.5) * 0.6;
        group.add(crystal);
      }
    } else {
      const stone = new THREE.MeshLambertMaterial({ color: 0x3b3336 });
      const flame = new THREE.MeshBasicMaterial({ color: 0xffa640 });
      for (let x = 0; x < grid.width; x += 10) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(2, 16, 2), stone);
        pillar.position.set(x, 7, -7);
        const torch = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), flame);
        torch.position.set(x, 8, -5.9);
        group.add(pillar, torch);
      }
    }

    if (theme.clouds) {
      const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35 });
      for (let x = 0; x < grid.width + 20; x += 11 + rand() * 14) {
        const cloud = new THREE.Group();
        for (let i = 0; i < 4; i++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(0.9 + rand() * 0.5, 12, 8), cloudMat);
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

/** Seeded random, so backdrops look the same every time. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
