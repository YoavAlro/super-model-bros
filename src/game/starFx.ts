import * as THREE from 'three';
import { canvasTexture, labelSprite } from './meshes';
import { prefs } from './prefs';
import {
  comboColor,
  comboLabel,
  knockPose,
  starCycleRate,
  starGlow,
  starHue,
  starLightness,
  starMix,
  starSaturation,
  starWeight,
  type KnockPose,
  type StarKind,
} from './starRules';

/**
 * Star power visuals: the rainbow that cycles over a whole character, the sparkle trail, the jump
 * somersault pivot, and enemies knocked off the screen with a combo popup. The timing and colour
 * rules are pure and live in `starRules.ts`; this module only applies them to meshes.
 */

type Tintable = THREE.Material & { color: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number };

interface Original {
  color: THREE.Color;
  emissive: THREE.Color | null;
  intensity: number;
}

interface Tint {
  mat: Tintable;
  orig: Original;
  /** 0 at the feet, 1 at the top of the character. */
  offset: number;
  lightness: number;
  weight: number;
}

/** What a starred player looks like this frame (null: no star). */
export interface StarState {
  kind: StarKind;
  /** Seconds left, and the star's full length. */
  left: number;
  total: number;
}

/** The player's body box, for the sparkle emitter. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
}

const HSL = { h: 0, s: 0, l: 0 };
const vivid = new THREE.Color();

/**
 * One player's star effects. The first time a star lights up, it walks the character's mesh and
 * caches every material's own colour and emissive in `material.userData.starOriginal`; `restore()`
 * puts them back exactly.
 */
export class StarFx {
  private tints: Tint[] | null = null;
  private tinted = false;
  private phase = 0;
  /** Last frame's seconds left: a jump up means a new star (time for the pickup burst). */
  private lastLeft = 0;
  private readonly sparkles: Sparkles;
  private readonly aura: THREE.Sprite;

  constructor(
    private readonly root: THREE.Object3D,
    private readonly scene: THREE.Scene,
  ) {
    this.sparkles = new Sparkles();
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.aura.visible = false;
    scene.add(this.sparkles.points, this.aura);
  }

  /** Every frame: tint and sparkle while `star` is set, restore the moment it is not. */
  update(dt: number, star: StarState | null, body: Box): void {
    if (star && star.left > this.lastLeft + 0.05) this.sparkles.burst(star.kind, body, this.phase);
    this.lastLeft = star?.left ?? 0;
    this.sparkles.update(dt, star, body, this.phase);
    this.aura.visible = !!star;
    if (!star) {
      this.restore();
      return;
    }
    const reduce = prefs.reduceMotion;
    this.phase += starCycleRate(star.kind, star.left, star.total, reduce) * dt;
    const mix = starMix(star.left, reduce);
    const sat = starSaturation(star.kind);
    const glow = starGlow(star.kind) * mix;
    // A soft halo behind the character in the star's colour. It breathes in size with the colour
    // cycle (never in brightness), so reduced motion holds it still.
    const a = this.aura;
    const breathe = 1 + 0.06 * Math.sin(2 * Math.PI * this.phase);
    a.position.set(body.x + body.w / 2, body.y + body.h * 0.5, -0.4);
    a.scale.setScalar((body.h * 1.7 + 0.8) * breathe);
    a.material.color.setHSL(starHue(star.kind, this.phase, 0.5), 1, 0.5, THREE.SRGBColorSpace);
    a.material.opacity = (star.kind === 'mega' ? 0.75 : 0.55) * mix;
    for (const t of this.capture()) {
      const hue = starHue(star.kind, this.phase, t.offset);
      vivid.setHSL(hue, sat, t.lightness, THREE.SRGBColorSpace);
      t.mat.color.copy(t.orig.color).lerp(vivid, mix * t.weight);
      if (t.mat.emissive) {
        t.mat.emissive.setHSL(hue, 1, glow, THREE.SRGBColorSpace);
        t.mat.emissiveIntensity = 1;
      }
    }
    this.tinted = true;
  }

  /** Puts every material's own colour and emissive back. */
  restore(): void {
    if (!this.tinted || !this.tints) return;
    this.tinted = false;
    for (const t of this.tints) {
      t.mat.color.copy(t.orig.color);
      if (t.mat.emissive && t.orig.emissive) {
        t.mat.emissive.copy(t.orig.emissive);
        t.mat.emissiveIntensity = t.orig.intensity;
      }
    }
  }

  /** For the debug hooks: is it tinted, and does every material match its cached original? */
  debug(): { tinted: boolean; restored: boolean; materials: number; sparkles: number } {
    const restored = (this.tints ?? []).every(
      (t) => t.mat.color.equals(t.orig.color) && (!t.orig.emissive || (!!t.mat.emissive?.equals(t.orig.emissive) && t.mat.emissiveIntensity === t.orig.intensity)),
    );
    return { tinted: this.tinted, restored, materials: this.tints?.length ?? 0, sparkles: this.sparkles.live };
  }

  dispose(): void {
    this.restore();
    this.scene.remove(this.sparkles.points, this.aura);
    this.sparkles.dispose();
    this.aura.material.dispose();
  }

  /** Finds every tintable material under the mesh once, remembering its own colours. */
  private capture(): Tint[] {
    if (this.tints) return this.tints;
    const root = this.root;
    root.updateMatrixWorld(true);
    const found = new Map<Tintable, number>();
    const pos = new THREE.Vector3();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      root.worldToLocal(mesh.getWorldPosition(pos));
      for (const m of mats as Tintable[]) if (m?.color instanceof THREE.Color && !found.has(m)) found.set(m, pos.y);
    });
    const ys = [...found.values()];
    const lo = Math.min(...ys);
    const span = Math.max(0.001, Math.max(...ys) - lo);
    this.tints = [...found].map(([mat, y]) => {
      const cached = mat.userData.starOriginal as Original | undefined;
      const orig: Original = cached ?? { color: mat.color.clone(), emissive: mat.emissive?.clone() ?? null, intensity: mat.emissiveIntensity ?? 1 };
      mat.userData.starOriginal = orig;
      orig.color.getHSL(HSL, THREE.SRGBColorSpace);
      return { mat, orig, offset: (y - lo) / span, lightness: starLightness(HSL.l), weight: starWeight(HSL.l) };
    });
    return this.tints;
  }
}

// ---------------------------------------------------------------- sparkles

const SPARKS = 40;
/** Sparkles thrown out in a ring when a star is grabbed. */
const BURST = 14;

/** A soft round glow for the star aura. Shared. */
let auraTex: THREE.Texture | null = null;
function auraTexture(): THREE.Texture {
  auraTex ??= (() => {
    const t = canvasTexture(64, (c, s) => {
      const m = s / 2;
      const g = c.createRadialGradient(m, m, 0, m, m, m);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    });
    t.magFilter = THREE.LinearFilter;
    t.userData.shared = true;
    return t;
  })();
  return auraTex;
}

/** A little four-point twinkle with a soft dark rim, tinted per sparkle by its vertex colour. Shared. */
let sparkTexture: THREE.Texture | null = null;
function sparkle(): THREE.Texture {
  sparkTexture ??= (() => {
    const t = canvasTexture(64, (c, s) => {
      const m = s / 2;
      const star = (r: number, k: number) => {
        c.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 - Math.PI / 2;
          const d = i % 2 === 0 ? r : r * k;
          c.lineTo(m + Math.cos(a) * d, m + Math.sin(a) * d);
        }
        c.closePath();
      };
      c.clearRect(0, 0, s, s);
      c.lineJoin = 'round';
      star(m - 3, 0.3);
      c.fillStyle = 'rgba(70,60,80,0.9)';
      c.strokeStyle = 'rgba(70,60,80,0.9)';
      c.lineWidth = 5;
      c.stroke();
      c.fill();
      star(m - 6, 0.26);
      c.fillStyle = '#ffffff';
      c.fill();
      const glow = c.createRadialGradient(m, m, 0, m, m, m * 0.35);
      glow.addColorStop(0, 'rgba(255,255,255,1)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = glow;
      c.fillRect(0, 0, s, s);
    });
    t.magFilter = THREE.LinearFilter;
    // Shared by every player's sparkles: level teardown must never free it.
    t.userData.shared = true;
    return t;
  })();
  return sparkTexture;
}

/**
 * A pooled trail of twinkles for one player: one Points object, fixed typed arrays, nothing
 * allocated per frame. They spawn around the body and stay where they were born, so they trail
 * behind a running player.
 */
class Sparkles {
  readonly points: THREE.Points;
  live = 0;
  private readonly pos = new Float32Array(SPARKS * 3);
  private readonly col = new Float32Array(SPARKS * 4);
  private readonly size = new Float32Array(SPARKS);
  private readonly vel = new Float32Array(SPARKS * 2);
  private readonly age = new Float32Array(SPARKS);
  private readonly life = new Float32Array(SPARKS);
  private readonly base = new Float32Array(SPARKS);
  private readonly rgb = new Float32Array(SPARKS * 3);
  private next = 0;
  private due = 0;
  private readonly material: THREE.PointsMaterial;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('sparkSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.PointsMaterial({ size: 1, map: sparkle(), vertexColors: true, transparent: true, depthWrite: false });
    // Per-sparkle sizes: scale the point size by an attribute.
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'attribute float sparkSize;\nvoid main() {')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * sparkSize;');
    };
    this.material.customProgramCacheKey = () => 'starSparkles';
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.points.visible = false;
  }

  update(dt: number, star: StarState | null, b: Box, phase: number): void {
    const reduce = prefs.reduceMotion;
    if (star) {
      const warn = starMix(star.left, true) < 1;
      const rate = (star.kind === 'mega' ? 40 : 26) * (reduce ? 0.35 : 1) * (warn ? 0.5 : 1);
      this.due += rate * dt;
      while (this.due >= 1) {
        this.due--;
        this.spawn(star.kind, b, phase);
      }
    } else {
      this.due = 0;
    }
    let live = 0;
    for (let i = 0; i < SPARKS; i++) {
      if (this.age[i] >= this.life[i]) {
        this.size[i] = 0;
        this.col[i * 4 + 3] = 0;
        continue;
      }
      live++;
      this.age[i] += dt;
      this.pos[i * 3] += this.vel[i * 2] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 2 + 1] * dt;
      const u = Math.min(1, this.age[i] / this.life[i]);
      const swell = Math.sin(Math.PI * u);
      // A gentle size twinkle, under 3 Hz; none with reduced motion.
      const twinkle = reduce ? 1 : 0.75 + 0.25 * Math.sin(this.age[i] * 18 + i * 1.7);
      this.size[i] = this.base[i] * swell * twinkle;
      this.col[i * 4] = this.rgb[i * 3];
      this.col[i * 4 + 1] = this.rgb[i * 3 + 1];
      this.col[i * 4 + 2] = this.rgb[i * 3 + 2];
      this.col[i * 4 + 3] = Math.min(1, swell * 1.6);
    }
    this.live = live;
    this.points.visible = live > 0;
    if (!live) return;
    const attrs = this.points.geometry.attributes;
    attrs.position.needsUpdate = true;
    attrs.color.needsUpdate = true;
    attrs.sparkSize.needsUpdate = true;
  }

  /** The pickup: a ring of sparkles flung out from the middle of the body. */
  burst(kind: StarKind, b: Box, phase: number): void {
    for (let k = 0; k < BURST; k++) {
      const i = this.spawn(kind, b, phase);
      const a = (k / BURST) * Math.PI * 2;
      const speed = kind === 'mega' ? 5 : 3.6;
      this.pos[i * 3] = b.x + b.w / 2;
      this.pos[i * 3 + 1] = b.y + b.h / 2;
      this.pos[i * 3 + 2] = 0.5;
      this.vel[i * 2] = Math.cos(a) * speed;
      this.vel[i * 2 + 1] = Math.sin(a) * speed;
      this.life[i] = 0.55;
      this.base[i] *= 1.3;
    }
  }

  private spawn(kind: StarKind, b: Box, phase: number): number {
    const i = this.next;
    this.next = (this.next + 1) % SPARKS;
    const r = Math.random;
    const pad = kind === 'mega' ? 0.5 : 0.35;
    this.pos[i * 3] = b.x - pad + r() * (b.w + 2 * pad);
    this.pos[i * 3 + 1] = b.y + r() * (b.h + 0.25);
    this.pos[i * 3 + 2] = -0.3 + r() * 0.9;
    this.vel[i * 2] = -b.vx * 0.12 + (r() - 0.5) * 0.9;
    this.vel[i * 2 + 1] = 0.3 + r() * 0.9;
    this.age[i] = 0;
    this.life[i] = 0.45 + r() * 0.4;
    this.base[i] = (kind === 'mega' ? 1.8 : 1.15) * (0.7 + r() * 0.6);
    const hue = kind === 'viral' ? (phase + r()) % 1 : 0.1 + r() * 0.07;
    const light = kind === 'viral' ? 0.62 : r() < 0.3 ? 0.9 : 0.62;
    vivid.setHSL(hue, 1, light, THREE.SRGBColorSpace);
    this.rgb[i * 3] = vivid.r;
    this.rgb[i * 3 + 1] = vivid.g;
    this.rgb[i * 3 + 2] = vivid.b;
    return i;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

// ------------------------------------------------------------ transforms

const before = new THREE.Vector3();
const after = new THREE.Vector3();

/**
 * Rolls `obj` by `angle` around its own forward (z) axis through the point `height` above its
 * origin (its middle), instead of around its feet. Call after the frame's position and rotation are set.
 */
export function rollAboutMiddle(obj: THREE.Object3D, angle: number, height: number): void {
  before.set(0, height, 0).applyEuler(obj.rotation);
  obj.rotation.z += angle;
  after.set(0, height, 0).applyEuler(obj.rotation);
  obj.position.add(before).sub(after);
}

// ------------------------------------------------------------ knock-offs

interface Flying {
  mesh: THREE.Object3D;
  x: number;
  y: number;
  /** Half the enemy's height: it flips around its middle. */
  mid: number;
  dir: number;
  age: number;
  popup: THREE.Sprite;
}

/** Popups and knocked-off enemies are drawn in front of the level's tiles. */
const FRONT_Z = 1.3;
const POPUP_LIFE = 0.9;
/** The popup starts this far above the enemy, clear of the player's name tag. */
const POPUP_RISE = 1.05;

/**
 * Enemies a star knocked away: each flips upside down, pops up and falls off the screen spinning,
 * with a combo popup where it was hit. The enemy is already out of play; this only flies its mesh.
 * Advanced in simulation time (so pausing freezes it) and drawn after the enemies' own updateMesh.
 */
export class KnockOffs {
  private readonly flying: Flying[] = [];
  private readonly pose: KnockPose = { dx: 0, dy: 0, roll: 0, spin: 0, done: false };

  constructor(private readonly scene: THREE.Scene) {}

  get count(): number {
    return this.flying.length;
  }

  /** `dir` is ±1, away from the player; `chain` is how many this star has knocked off so far. */
  add(mesh: THREE.Object3D, body: { x: number; y: number; w: number; h: number }, dir: number, chain: number): void {
    const popup = labelSprite(comboLabel(chain), comboColor(chain), 'rgba(30,14,48,0.6)');
    popup.scale.multiplyScalar(0.46 * (1 + Math.min(chain - 1, 6) * 0.07));
    popup.renderOrder = 3;
    popup.position.set(body.x + body.w / 2, body.y + body.h + POPUP_RISE, FRONT_Z + 0.1);
    this.scene.add(popup);
    this.flying.push({ mesh, x: body.x + body.w / 2, y: body.y, mid: body.h / 2, dir, age: 0, popup });
  }

  step(dt: number): void {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.age += dt;
      if (f.age >= POPUP_LIFE && f.popup.parent) this.dropPopup(f.popup);
      if (!knockPose(f.age, f.dir, this.pose).done) continue;
      f.mesh.visible = false;
      this.flying.splice(i, 1);
    }
  }

  draw(): void {
    for (const f of this.flying) {
      const pose = knockPose(f.age, f.dir, this.pose);
      const m = f.mesh;
      m.visible = true;
      m.position.set(f.x + pose.dx, f.y + pose.dy, FRONT_Z);
      // Reduced motion: it still flips and falls, but without the fast spin.
      const calm = prefs.reduceMotion;
      m.rotation.set(0, calm ? 0 : pose.spin, 0);
      rollAboutMiddle(m, calm ? -f.dir * Math.min(Math.PI, Math.abs(pose.roll)) : pose.roll, f.mid * m.scale.y);
      if (f.popup.parent) {
        // The popup drifts up where the enemy was hit, easing out, and fades in its last third.
        const u = Math.min(1, f.age / POPUP_LIFE);
        f.popup.position.y = f.y + f.mid * 2 + POPUP_RISE + (1 - (1 - u) ** 2) * 1.2;
        f.popup.material.opacity = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      }
    }
  }

  private dropPopup(popup: THREE.Sprite): void {
    this.scene.remove(popup);
    popup.material.map?.dispose();
    popup.material.dispose();
  }
}
