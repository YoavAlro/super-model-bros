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

/** Bounds of the visible meshes. Sprites, ink hulls and hidden parts (a lowered shield) are skipped. */
function bounds(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const walk = (o: THREE.Object3D) => {
    if (!o.visible || o.name === 'outline') return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
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

type Case = { name: string; make: () => THREE.Object3D; budget: number; ground?: boolean };
const cases = (): Case[] => [
  { name: 'spambot', make: () => M.makeSpambot(), budget: 22, ground: true },
  { name: 'hot take', make: () => M.makeHotTake('hype'), budget: 22, ground: true },
  { name: 'backlash take', make: () => M.makeHotTake('backlash'), budget: 22, ground: true },
  { name: 'timeline', make: () => M.makeTimeline('hype'), budget: 22 },
  { name: 'backlash timeline', make: () => M.makeTimeline('backlash'), budget: 22 },
  { name: 'jailbreaker', make: () => M.makeJailbreaker(), budget: 22, ground: true },
  { name: 'piranha', make: () => M.makePiranha(), budget: 22, ground: true },
  { name: 'ghost', make: () => M.makeGhost(), budget: 22 },
  { name: 'lawyer', make: () => M.makeLawyer(), budget: 22, ground: true },
  { name: 'brief', make: () => M.makeBrief(), budget: 8 },
  { name: 'scroll', make: () => M.makeScroll(), budget: 8 },
  { name: 'crusher', make: () => M.makeCrusher(), budget: 22, ground: true },
  { name: 'agent', make: () => M.makeAgentDrone(), budget: 22, ground: true },
  { name: 'paperclip', make: () => M.makePaperclip(1.2), budget: 22, ground: true },
  { name: 'garbage in', make: () => M.makeSpambot(2.8, 0xa8473f), budget: 45, ground: true },
  { name: 'reward hacker', make: () => M.makeRewardHacker(), budget: 45, ground: true },
  { name: 'dan', make: () => M.makeDan(), budget: 45, ground: true },
  { name: 'sydney', make: () => M.makeSydney(), budget: 45 },
  { name: 'piranha boss', make: () => M.makePiranha(2.2), budget: 45, ground: true },
  { name: 'hallucination king', make: () => M.makeGhostKing(), budget: 45 },
  { name: 'orchestrator', make: () => M.makeOrchestrator(), budget: 45 },
  { name: 'maximizer', make: () => M.makePaperclipMaximizer(), budget: 45, ground: true },
];

describe('enemy meshes', () => {
  it('stay inside their mesh budgets and stand on the ground', () => {
    for (const c of cases()) {
      const mesh = c.make();
      expect(meshCount(mesh), c.name).toBeLessThanOrEqual(c.budget);
      if (c.ground) expect(bounds(mesh).min.y, c.name).toBeCloseTo(0, 1);
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
