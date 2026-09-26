import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The engine's contract with the enemy meshes: the named parts it looks up, the materials it
 * fades and tints, ground contact, and per-enemy mesh budgets. The meshes draw canvas textures,
 * so a no-op 2D context stands in for the DOM.
 */
type Meshes = typeof import('./enemyMeshes');
let M: Meshes;

beforeAll(async () => {
  // Every drawing call is a no-op; property writes (fillStyle, font, ...) are swallowed.
  const ctx: object = new Proxy({}, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 40 }) : () => ctx), set: () => true });
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  M = await import('./enemyMeshes');
});

/** Visible meshes, not counting ink-outline hulls (the budgets leave those out). */
function meshCount(root: THREE.Object3D): number {
  let n = 0;
  const walk = (o: THREE.Object3D) => {
    if (!o.visible) return;
    if ((o as THREE.Mesh).isMesh && o.name !== 'outline') n++;
    o.children.forEach(walk);
  };
  walk(root);
  return n;
}

/** Exact bounds of the visible meshes' vertices. Sprites, ink hulls and hidden parts (a lowered shield) are skipped. */
function bounds(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  const walk = (o: THREE.Object3D) => {
    if (!o.visible || o.name === 'outline') return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      const p = mesh.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld));
    }
    o.children.forEach(walk);
  };
  walk(root);
  return box;
}

function materials(root: THREE.Object3D): Set<THREE.Material> {
  const out = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (m) for (const x of Array.isArray(m) ? m : [m]) out.add(x);
  });
  return out;
}

const RESERVED = ['legs', 'jaw', 'ghostBody', 'hands', 'crusherBody', 'crusherFace', 'ring', 'shield', 'clip', 'body', 'eye', 'gear', 'pad', 'flag', 'alarm'];

/**
 * Per-mesh budgets (visible meshes, outline hulls left out). They leave the phone's 120 draw calls
 * room for a screenful of enemies, a hero or two and the level: mergeStatic() draws each material
 * kind once per scope, so a new part of a new colour costs nothing unless it needs its own scope.
 */
const ENEMY = 12;
const BOSS = 16;
const PROJECTILE = 4;

type Case = { name: string; make: () => THREE.Object3D; budget: number; ground?: boolean };
const cases = (): Case[] => [
  { name: 'spambot', make: () => M.makeSpambot(), budget: ENEMY, ground: true },
  { name: 'hot take', make: () => M.makeHotTake('hype'), budget: ENEMY, ground: true },
  { name: 'backlash take', make: () => M.makeHotTake('backlash'), budget: ENEMY, ground: true },
  { name: 'timeline', make: () => M.makeTimeline('hype'), budget: ENEMY },
  { name: 'backlash timeline', make: () => M.makeTimeline('backlash'), budget: ENEMY },
  { name: 'jailbreaker', make: () => M.makeJailbreaker(), budget: ENEMY, ground: true },
  { name: 'piranha', make: () => M.makePiranha(), budget: ENEMY, ground: true },
  { name: 'ghost', make: () => M.makeGhost(), budget: ENEMY },
  { name: 'lawyer', make: () => M.makeLawyer(), budget: ENEMY, ground: true },
  { name: 'brief', make: () => M.makeBrief(), budget: PROJECTILE },
  { name: 'scroll', make: () => M.makeScroll(), budget: PROJECTILE },
  { name: 'crusher', make: () => M.makeCrusher(), budget: ENEMY, ground: true },
  { name: 'agent', make: () => M.makeAgentDrone(), budget: ENEMY, ground: true },
  { name: 'paperclip', make: () => M.makePaperclip(1.2), budget: ENEMY, ground: true },
  { name: 'garbage in', make: () => M.makeSpambot(2.8, 0xa8473f), budget: BOSS, ground: true },
  { name: 'reward hacker', make: () => M.makeRewardHacker(), budget: BOSS, ground: true },
  { name: 'dan', make: () => M.makeDan(), budget: BOSS, ground: true },
  { name: 'sydney', make: () => M.makeSydney(), budget: BOSS },
  { name: 'piranha boss', make: () => M.makePiranha(2.2), budget: BOSS, ground: true },
  { name: 'hallucination king', make: () => M.makeGhostKing(), budget: BOSS },
  { name: 'orchestrator', make: () => M.makeOrchestrator(), budget: BOSS },
  { name: 'maximizer', make: () => M.makePaperclipMaximizer(), budget: BOSS, ground: true },
];

describe('enemy meshes', () => {
  it('stay inside their mesh budgets and stand on the ground', () => {
    for (const c of cases()) {
      const mesh = c.make();
      expect(meshCount(mesh), c.name).toBeLessThanOrEqual(c.budget);
      if (c.ground) expect(bounds(mesh).min.y, c.name).toBeCloseTo(0, 1);
    }
  });

  it('stay within 15% of their body box height, so a stomp lands where the top looks to be', () => {
    // Body box heights from Enemies.ts and Bosses.ts. Left out on purpose: the Timeline (a floating
    // cloud), ghosts and the Hallucination King (see-through sheets, curl and crown), Sydney (its
    // heart antenna), the Injection Piranha (its boss box is shorter than the 2.2x plant) and the
    // Maximizer (smoke puffs and the idol clip above its roof).
    const tops: [string, () => THREE.Object3D, number][] = [
      ['spambot', () => M.makeSpambot(), 0.8],
      ['hot take', () => M.makeHotTake('hype'), 0.8],
      ['jailbreaker', () => M.makeJailbreaker(), 1.1],
      ['piranha', () => M.makePiranha(), 1.2],
      ['lawyer', () => M.makeLawyer(), 1.1],
      ['crusher', () => M.makeCrusher(), 1.8],
      ['agent', () => M.makeAgentDrone(), 0.7],
      ['paperclip', () => M.makePaperclip(1.2), 0.9],
      ['garbage in', () => M.makeSpambot(2.8, 0xa8473f), 2.2],
      ['reward hacker', () => M.makeRewardHacker(), 2.3],
      ['dan', () => M.makeDan(), 2.1],
      ['orchestrator', () => M.makeOrchestrator(), 1.8],
    ];
    for (const [name, make, h] of tops) expect(bounds(make()).max.y, name).toBeLessThanOrEqual(1.15 * h);
  });

  it('keep Sydney inside the shield bubble the boss raises (radius 1.4 around y 0.8), at either facing', () => {
    for (const yaw of [-0.4, 0.4]) {
      const sydney = M.makeSydney();
      sydney.rotation.y = yaw;
      sydney.updateMatrixWorld(true);
      // The farthest any vertex reaches from the bubble's centre, as the camera sees it.
      let reach = 0;
      const v = new THREE.Vector3();
      sydney.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || o.name === 'outline') return;
        const p = mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
          reach = Math.max(reach, Math.hypot(v.x, v.y - 0.8));
        }
      });
      expect(reach, `yaw ${yaw}`).toBeLessThan(1.4);
    }
  });

  it('never repeat a reserved name, so getObjectByName finds the right part', () => {
    for (const c of cases()) {
      const names: string[] = [];
      c.make().traverse((o) => RESERVED.includes(o.name) && names.push(o.name));
      expect(new Set(names).size, c.name).toBe(names.length);
    }
  });

  it('make fresh materials for every instance', () => {
    for (const c of cases()) {
      const a = materials(c.make());
      for (const m of materials(c.make())) expect(a.has(m), c.name).toBe(false);
      for (const m of a) expect(m.userData.shared, c.name).toBeFalsy();
    }
  });

  it('keep the parts the engine animates', () => {
    const legs = M.makeJailbreaker().getObjectByName('legs');
    expect(legs).toBeInstanceOf(THREE.Group);
    for (const scale of [1, 2.2]) {
      const jaw = M.makePiranha(scale).getObjectByName('jaw');
      expect(jaw).toBeInstanceOf(THREE.Group);
      expect(jaw!.rotation.x).toBe(0);
    }
    const ring = M.makeOrchestrator().getObjectByName('ring')!;
    expect(ring.rotation.x).toBeCloseTo(Math.PI / 2);
    expect(ring.children.length).toBeGreaterThan(0);
    expect(M.makeOrchestrator().getObjectByName('shield')).toBeInstanceOf(THREE.Mesh);
    const clip = M.makePaperclipMaximizer().getObjectByName('clip')!;
    expect(clip).toBeInstanceOf(THREE.Group);
    expect(clip.getObjectByName('feet')!.visible).toBe(false);
    const shield = M.makeShield();
    expect(shield).toBeInstanceOf(THREE.Mesh);
    expect(shield.visible).toBe(false);
    expect(shield.name).toBe('');
  });

  it('give ghosts one fading sheet and mittens to hide behind', () => {
    for (const make of [() => M.makeGhost(), () => M.makeGhost(true)]) {
      const ghost = make();
      const body = ghost.getObjectByName('ghostBody') as THREE.Mesh;
      const sheet = body.material as THREE.Material;
      expect(Array.isArray(body.material)).toBe(false);
      expect(sheet.transparent).toBe(true);
      const hands = ghost.getObjectByName('hands')!;
      expect(hands).toBeInstanceOf(THREE.Group);
      hands.traverse((o) => (o as THREE.Mesh).isMesh && expect((o as THREE.Mesh).material).toBe(sheet));
      expect(ghost.getObjectByName('wisp')).toBeDefined();
    }
    const king = M.makeGhostKing();
    expect(king.getObjectByName('hands')!.visible).toBe(false);
    expect(king.getObjectByName('ghostBody')).toBeInstanceOf(THREE.Mesh);
  });

  it('keep the crusher inside its 1.8 box with a tintable body', () => {
    const crusher = M.makeCrusher();
    const box = bounds(crusher);
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
    expect(box.max.y).toBeLessThanOrEqual(1.8 + 1e-6);
    expect(box.max.y).toBeGreaterThan(1.79);
    const body = crusher.getObjectByName('crusherBody') as THREE.Mesh;
    const mat = body.material as THREE.MeshToonMaterial;
    expect(mat.emissive).toBeInstanceOf(THREE.Color);
    expect(mat.emissiveIntensity).toBe(1);
    expect(crusher.getObjectByName('crusherFace')).toBeInstanceOf(THREE.Mesh);
  });
});
