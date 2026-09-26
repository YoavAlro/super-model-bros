import * as THREE from 'three';
import { CHARACTERS, type CharacterId } from '../config/characters';
import type { KartSpec } from '../config/karts';
import type { Settings } from '../save';
import type { Hud } from '../ui/Hud';
import { el } from '../ui/dom';
import type { Input } from './Input';
import { humansDone, KART, kartRivals, LANES, makeTrack, newRace, placeOf, stepRace, type Race } from './kart';
import { canvasTexture, labelSprite, makeCharacter, makeToken } from './meshes';
import { sfx } from './sfx';
import { disposeObject } from './dispose';
import { STEP } from './Stage';

/** World units between lanes. */
const LANE_W = 2.4;

export interface KartResult {
  /** Places of the human racers, in player order. */
  places: number[];
  /** Everyone, in finishing order. */
  standings: CharacterId[];
  outcome: 'done' | 'quit';
}

type KartState = 'countdown' | 'racing' | 'finish' | 'done';

const hashString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** One Benchmark Kart race: a three.js view over the pure sim in `kart.ts`. */
export class KartRace {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  readonly race: Race;
  private readonly karts: { group: THREE.Group; racer: Race['racers'][number] }[] = [];
  private readonly things: { mesh: THREE.Object3D; index: number }[] = [];
  private state: KartState = 'countdown';
  private countdown = 2.4;
  private finishTimer = 0;
  private accumulator = 0;
  private readonly panel = el('div', 'kart-hud');
  private resolve!: (r: KartResult) => void;
  readonly done: Promise<KartResult>;
  private lastPlace = 0;
  private paused = false;
  private readonly restoreHint: () => void;

  constructor(
    readonly spec: KartSpec,
    private readonly chars: CharacterId[],
    private readonly input: Input,
    private readonly hud: Hud,
    private readonly overlay: HTMLElement,
    private readonly settings: Settings,
  ) {
    const seed = hashString(spec.id);
    const track = makeTrack(spec.length, { hurdles: spec.hurdles, pads: spec.pads, tokens: spec.tokens }, seed);
    this.race = newRace(track, chars, kartRivals(spec, chars), seed + 1);
    this.done = new Promise((r) => (this.resolve = r));
    this.build();
    this.overlay.append(this.panel);
    this.hud.showTraining(false);
    this.restoreHint = this.hud.pushHint(
      chars.length > 1
        ? 'P1: A/D lanes · W hop · L-Shift boost   |   P2: ←/→ lanes · ↑ hop · R-Shift boost   |   Esc pause'
        : '←/→ or A/D switch lanes · Space/W/↑ hop · Shift boost (3 tokens) · Esc pause',
    );
    this.hud.toast(`${spec.name}! Get ready…`, 'info', 2200);
  }

  private build(): void {
    const t = this.spec.theme;
    this.scene.background = canvasTexture(4, (c, s) => {
      const g = c.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, t.skyTop);
      g.addColorStop(1, t.skyBottom);
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    });
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-10, 20, 8);
    this.scene.add(sun);

    const L = this.race.track.length;
    const width = LANES * LANE_W;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(L + 200, 120), new THREE.MeshLambertMaterial({ color: t.ground }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(L / 2, -0.02, 0);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(L + 60, width + 0.6), new THREE.MeshLambertMaterial({ color: t.road }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(L / 2 + 10, 0, 0);
    this.scene.add(ground, road);
    // Dashed lane stripes.
    const dash = new THREE.BoxGeometry(2.2, 0.02, 0.12);
    const stripeMat = new THREE.MeshBasicMaterial({ color: t.stripe });
    const stripes = new THREE.InstancedMesh(dash, stripeMat, Math.ceil((L + 60) / 6) * (LANES - 1));
    let n = 0;
    const m = new THREE.Matrix4();
    for (let lane = 1; lane < LANES; lane++) {
      for (let x = -20; x < L + 40; x += 6) {
        m.makeTranslation(x, 0.01, this.laneZ(lane - 0.5));
        stripes.setMatrixAt(n++, m);
      }
    }
    stripes.count = n;
    this.scene.add(stripes);
    // Start and finish lines.
    for (const [x, label] of [
      [0, 'START'],
      [L, 'FINISH'],
    ] as const) {
      const checks = canvasTexture(64, (c, s) => {
        for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
          c.fillStyle = (i + j) % 2 ? '#111' : '#fff';
          c.fillRect((i * s) / 8, (j * s) / 2, s / 8, s / 2);
        }
      });
      const line = new THREE.Mesh(new THREE.PlaneGeometry(1.2, width + 0.6), new THREE.MeshBasicMaterial({ map: checks }));
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.02, 0);
      const sign = labelSprite(label, '#ffffff', 'rgba(0,0,0,0.55)');
      sign.scale.multiplyScalar(1.4);
      sign.position.set(x, 4.2, 0);
      this.scene.add(line, sign);
    }
    // Hurdles, pads and tokens.
    const hurdleGeo = new THREE.BoxGeometry(0.5, 0.9, LANE_W * 0.8);
    const hurdleMat = new THREE.MeshLambertMaterial({ color: 0xe84a5f, emissive: 0x400010 });
    const padGeo = new THREE.PlaneGeometry(2.2, LANE_W * 0.7);
    const padTex = canvasTexture(64, (c, s) => {
      c.fillStyle = '#1fd1b0';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#eafff9';
      for (const off of [0.15, 0.5]) {
        c.beginPath();
        c.moveTo(s * off, s * 0.15);
        c.lineTo(s * (off + 0.3), s * 0.5);
        c.lineTo(s * off, s * 0.85);
        c.lineTo(s * (off + 0.12), s * 0.85);
        c.lineTo(s * (off + 0.42), s * 0.5);
        c.lineTo(s * (off + 0.12), s * 0.15);
        c.fill();
      }
    });
    const padMat = new THREE.MeshBasicMaterial({ map: padTex });
    this.race.track.things.forEach((thing, index) => {
      let mesh: THREE.Object3D;
      if (thing.kind === 'hurdle') {
        mesh = new THREE.Mesh(hurdleGeo, hurdleMat);
        mesh.position.set(thing.at, 0.45, this.laneZ(thing.lane));
      } else if (thing.kind === 'pad') {
        mesh = new THREE.Mesh(padGeo, padMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(thing.at, 0.03, this.laneZ(thing.lane));
      } else {
        mesh = makeToken('reasoning');
        mesh.scale.setScalar(1.3);
        mesh.position.set(thing.at, 0.6, this.laneZ(thing.lane));
      }
      this.scene.add(mesh);
      this.things.push({ mesh, index });
    });
    // Karts.
    for (const racer of this.race.racers) {
      const c = CHARACTERS[racer.id as CharacterId];
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.1), new THREE.MeshLambertMaterial({ color: c.color }));
      body.position.y = 0.45;
      const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12);
      const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1f });
      for (const [x, z] of [
        [0.6, 0.6],
        [-0.6, 0.6],
        [0.6, -0.6],
        [-0.6, -0.6],
      ]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.28, z);
        group.add(w);
      }
      const driver = makeCharacter(c.color, c.accent);
      driver.scale.setScalar(0.75);
      driver.position.set(-0.2, 0.55, 0);
      driver.rotation.y = Math.PI / 2;
      const tag = labelSprite(racer.human ? `▼ ${c.name}` : c.name, '#ffffff', racer.human ? 'rgba(20,110,60,0.85)' : 'rgba(0,0,0,0.45)');
      tag.scale.multiplyScalar(racer.human ? 0.6 : 0.42);
      tag.position.y = racer.human ? 2.4 : 1.9;
      group.add(body, driver, tag);
      this.scene.add(group);
      this.karts.push({ group, racer });
    }
  }

  private laneZ(lane: number): number {
    return (lane - (LANES - 1) / 2) * LANE_W;
  }

  frame(dt: number, t: number, renderer: THREE.WebGLRenderer): void {
    if (this.input.consumePause() && this.state !== 'done') this.togglePause();
    if (!this.paused) {
      this.input.update();
      this.accumulator += dt * (this.settings.assist ? 0.8 : 1);
      while (this.accumulator >= STEP) {
        this.simulate(STEP);
        this.accumulator -= STEP;
      }
    }
    for (const k of this.karts) {
      const r = k.racer;
      const hop = r.hop > 0 ? Math.sin((1 - r.hop / KART.hop) * Math.PI) * 1.1 : 0;
      k.group.position.set(r.s, hop, this.laneZ(r.z));
      k.group.rotation.z = r.stun > 0 ? Math.sin(t * 30) * 0.15 : 0;
      k.group.rotation.x = r.boost > 0 ? Math.sin(t * 40) * 0.04 : 0;
    }
    const lead = this.karts.find((k) => k.racer.human);
    for (const th of this.things) {
      th.mesh.rotation.y = this.race.track.things[th.index].kind === 'token' ? t * 3 : th.mesh.rotation.y;
      // A token or pad you already used fades from your view.
      if (lead && this.race.track.things[th.index].kind !== 'hurdle') th.mesh.visible = !lead.racer.used.has(th.index);
    }
    this.placeCamera();
    renderer.render(this.scene, this.camera);
    this.updatePanel();
  }

  private simulate(dt: number): void {
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      if (Math.ceil(this.countdown) !== before && this.countdown > 0) sfx.bump();
      if (this.countdown <= 0) {
        this.state = 'racing';
        sfx.star();
        this.hud.toast('Go!', 'good', 1200);
      }
      return;
    }
    if (this.state === 'done') return;
    const humans = this.race.racers.filter((r) => r.human).length;
    const pads = this.input.pads.slice(0, humans);
    const stunned = this.race.racers.filter((r) => r.human && r.stun > 0).length;
    stepRace(this.race, pads, dt);
    if (this.race.racers.filter((r) => r.human && r.stun > 0).length > stunned) sfx.hurt();
    if (this.state === 'racing' && humansDone(this.race)) {
      this.state = 'finish';
      this.finishTimer = 2;
      sfx.flag();
      const p = placeOf(this.race, this.chars[0]);
      this.hud.toast(p === 1 ? 'You won the race!' : `You finished ${ordinal(p)}. Good race!`, p === 1 ? 'good' : 'info', 2500);
    }
    if (this.state === 'finish') {
      this.finishTimer -= dt;
      if (this.finishTimer <= 0) this.finish('done');
    }
  }

  private placeCamera(): void {
    const humans = this.karts.filter((k) => k.racer.human);
    const s = humans.reduce((a, k) => a + k.racer.s, 0) / humans.length;
    const z = humans.reduce((a, k) => a + this.laneZ(k.racer.z), 0) / humans.length;
    // High and close behind: karts on your tail do not hide yours.
    this.camera.position.set(s - 6.5, 7, z * 0.5);
    this.camera.lookAt(s + 7, 0, z * 0.3);
  }

  private updatePanel(): void {
    const me = this.race.racers.find((r) => r.human)!;
    const place = placeOf(this.race, me.id);
    const pctDone = Math.min(100, Math.round((me.s / this.race.track.length) * 100));
    const text =
      this.state === 'countdown'
        ? `${this.spec.name} · ${Math.max(1, Math.ceil(this.countdown))}…`
        : `${this.spec.name} · ${ordinal(place)} of ${this.race.racers.length} · ${pctDone}% · ◉ ${me.tokens} (boost: ${KART.boostCost})`;
    if (this.panel.textContent !== text) this.panel.textContent = text;
    if (place < this.lastPlace && this.state === 'racing') sfx.token();
    this.lastPlace = place;
  }

  private togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) {
      this.hud.showPause(
        () => this.togglePause(),
        () => {
          this.hud.hidePause();
          this.paused = false;
          this.quit();
        },
      );
    } else {
      this.hud.hidePause();
      this.input.clear();
    }
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  private finish(outcome: KartResult['outcome']): void {
    if (this.state === 'done') return;
    this.state = 'done';
    const standings = [...this.race.order, ...this.race.racers.filter((r) => r.finished === null).sort((a, b) => b.s - a.s).map((r) => r.id)] as CharacterId[];
    this.resolve({ outcome, places: this.chars.map((id) => placeOf(this.race, id)), standings });
  }

  quit(): void {
    this.finish('quit');
  }

  /** Test hooks (with ?debug). */
  debug() {
    return {
      kartState: () => ({ state: this.state, place: placeOf(this.race, this.chars[0]), s: this.race.racers[0].s, length: this.race.track.length, order: [...this.race.order] }),
      /** Moves the human racers just short of the finish line. */
      kartFinish: () => {
        for (const r of this.race.racers) if (r.human) r.s = Math.max(r.s, this.race.track.length - 6);
        return true;
      },
    };
  }

  dispose(): void {
    this.panel.remove();
    this.hud.showTraining(true);
    this.restoreHint();
    disposeObject(this.scene);
  }
}

export const ordinal = (n: number): string => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
