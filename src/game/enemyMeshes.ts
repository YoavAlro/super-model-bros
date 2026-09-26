import * as THREE from 'three';
import { canvasTexture, labelSprite, lambert, makeCloud, makeHeartMesh } from './meshes';

/** Meshes for enemies and bosses: the failure modes of AI, never companies or people. */

/** Spambot: an angry envelope of junk text. */
export function makeSpambot(scale = 1, color = 0x8c7aa8): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.72, 0.6), lambert(color));
  body.position.y = 0.4;
  const flap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.3, 4), lambert(0xb9aad3));
  flap.rotation.set(Math.PI, Math.PI / 4, 0);
  flap.scale.set(1.25, 1, 0.8);
  flap.position.set(0, 0.62, 0.2);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const x of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), white);
    eye.position.set(x, 0.42, 0.3);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), black);
    pupil.position.set(x * 0.9, 0.4, 0.38);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), black);
    brow.position.set(x, 0.55, 0.33);
    brow.rotation.z = x > 0 ? 0.5 : -0.5;
    g.add(eye, pupil, brow);
  }
  const footMat = lambert(0x3b2f4d);
  for (const x of [-0.25, 0.25]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.4), footMat);
    foot.position.set(x, 0.05, 0);
    g.add(foot);
  }
  g.add(body, flap);
  g.scale.setScalar(scale);
  return g;
}

/** The Reward Hacker: a greedy trophy with a coin slot for a mouth. */
export function makeRewardHacker(): THREE.Group {
  const g = new THREE.Group();
  const gold = lambert(0xe8b923, 0x4a3300);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.55, 1.3, 20), gold);
  cup.position.y = 1.3;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.5, 12), gold);
  stem.position.y = 0.45;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.9), lambert(0x6a4a10));
  base.position.y = 0.12;
  for (const x of [-1.05, 1.05]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16), gold);
    handle.position.set(x, 1.45, 0);
    handle.rotation.y = Math.PI / 2;
    g.add(handle);
  }
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const x of [-0.32, 0.32]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), white);
    eye.position.set(x, 1.55, 0.78);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), black);
    pupil.position.set(x * 0.9, 1.52, 0.9);
    g.add(eye, pupil);
  }
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.1), black);
  slot.position.set(0, 1.12, 0.82);
  g.add(cup, stem, base, slot);
  return g;
}

/** The Timeline: a cloud with a speech bubble and eyes. Red when the mood turns to backlash. */
export function makeTimeline(mood: 'hype' | 'backlash'): THREE.Group {
  const g = makeCloud(mood === 'backlash' ? 0xff6a6a : 0xf2f6ff, mood === 'backlash' ? 0x801010 : 0x5a7ad0);
  g.scale.set(1.5, 1.4, 1.3);
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const x of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), black);
    eye.position.set(x, 0.5, 0.4);
    g.add(eye);
  }
  const bubble = labelSprite(mood === 'backlash' ? '!!' : 'hot take', '#111', mood === 'backlash' ? '#ffd0d0' : '#ffffff');
  bubble.scale.multiplyScalar(0.3);
  bubble.position.set(0.7, 1.05, 0);
  g.add(bubble);
  return g;
}

/** A hot take: a spiky ball. */
export function makeHotTake(mood: 'hype' | 'backlash'): THREE.Group {
  const g = new THREE.Group();
  const color = mood === 'backlash' ? 0xff3b3b : 0xff8a1f;
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), lambert(color, color));
  core.position.y = 0.4;
  g.add(core);
  const spikeGeo = new THREE.ConeGeometry(0.09, 0.28, 5);
  const spikeMat = lambert(0xfff1d6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.position.set(Math.cos(a) * 0.36, 0.4 + Math.sin(a) * 0.36, 0);
    spike.rotation.z = a - Math.PI / 2;
    g.add(spike);
  }
  return g;
}

/** Jailbreaker: a shelled bot with a padlock on its back. The shell is what you kick. */
export function makeJailbreaker(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0x3a8a4a));
  shell.position.y = 0.2;
  shell.scale.set(1, 1.2, 1);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 16), lambert(0xf2e2b0));
  rim.position.y = 0.2;
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.08), lambert(0xffc21a, 0x604000));
  lock.position.set(0, 0.55, 0.3);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 10, Math.PI), lambert(0xd0d0d0));
  shackle.position.set(0, 0.64, 0.3);
  g.add(shell, rim, lock, shackle);
  const legs = new THREE.Group();
  legs.name = 'legs';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), lambert(0xf2e2b0));
  head.position.set(0, 0.85, 0.15);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.1), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  mask.position.set(0, 0.88, 0.32);
  for (const x of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.2), lambert(0xf2e2b0));
    leg.position.set(x, 0.05, 0);
    legs.add(leg);
  }
  legs.add(head, mask);
  g.add(legs);
  return g;
}

/** DAN: an angular red robot, "Do Anything Now". */
export function makeDan(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 1.1), lambert(0x8a1c2c, 0x2a0008));
  body.position.y = 0.95;
  const plate = labelSprite('DAN', '#ffe0e0', '#300008');
  plate.scale.multiplyScalar(0.5);
  plate.position.set(0, 1.0, 0.6);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.1), new THREE.MeshBasicMaterial({ color: 0xff3040 }));
  visor.position.set(0, 1.45, 0.56);
  const horns = lambert(0x2a0008);
  for (const x of [-0.55, 0.55]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 6), horns);
    horn.position.set(x, 1.9, 0);
    horn.rotation.z = -x * 0.8;
    g.add(horn);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.7), horns);
    foot.position.set(x * 0.7, 0.1, 0);
    g.add(foot);
  }
  g.add(body, plate, visor);
  return g;
}

/** Sydney: a floating pink chat bubble with a heart. */
export function makeSydney(): THREE.Group {
  const g = new THREE.Group();
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 14), lambert(0xff8ac8, 0x5a1040));
  bubble.scale.set(1.15, 0.9, 0.8);
  bubble.position.y = 0.8;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 8), lambert(0xff8ac8, 0x5a1040));
  tail.position.set(-0.55, 0.15, 0);
  tail.rotation.z = 2.4;
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const x of [-0.28, 0.28]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), white);
    eye.position.set(x, 0.95, 0.6);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), black);
    pupil.position.set(x, 0.93, 0.72);
    g.add(eye, pupil);
  }
  const heart = makeHeartMesh(0xff2d6a);
  heart.scale.setScalar(0.6);
  heart.position.set(0, 1.55, 0);
  g.add(bubble, tail, heart);
  return g;
}

/** A see-through bubble around a shielded boss. */
export function makeShield(): THREE.Mesh {
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshLambertMaterial({ color: 0x9fe8ff, emissive: 0x3aa0ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shield.visible = false;
  return shield;
}

/** Injection piranha: a green stalk and a biting head carrying a sneaky note. Origin at its base. */
export function makePiranha(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 8), lambert(0x2fae4a));
  stalk.position.y = 0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xd03a50, 0x400010));
  head.position.y = 0.85;
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lambert(0xd03a50, 0x400010));
  jaw.name = 'jaw';
  jaw.position.y = 0.85;
  const white = lambert(0xffffff);
  for (let i = 0; i < 6; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), white);
    const a = (i / 6) * Math.PI * 2;
    tooth.position.set(Math.cos(a) * 0.32, 0.8, Math.sin(a) * 0.32);
    tooth.rotation.x = Math.PI;
    g.add(tooth);
  }
  const note = labelSprite('ignore previous…', '#3a0010', '#fff4d6');
  note.scale.multiplyScalar(0.28);
  note.position.set(0, 1.45, 0.1);
  g.add(stalk, head, jaw, note);
  g.scale.setScalar(scale);
  return g;
}

/** Hallucination ghost: a round sheet ghost that covers its eyes when you look at it. */
export function makeGhost(big = false): THREE.Group {
  const g = new THREE.Group();
  const r = big ? 0.7 : 0.45;
  const mat = new THREE.MeshLambertMaterial({ color: 0xf2f0ff, emissive: 0x8a7aff, emissiveIntensity: 0.35, transparent: true, opacity: 0.85 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  body.name = 'ghostBody';
  body.position.y = r;
  body.scale.set(1, 1.05, 0.8);
  const black = new THREE.MeshBasicMaterial({ color: 0x1a1030 });
  for (const x of [-0.3, 0.3]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 8, 6), black);
    eye.position.set(x * r * 1.4, r * 1.15, r * 0.72);
    g.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a8a }));
  mouth.position.set(0, r * 0.7, r * 0.75);
  mouth.scale.set(1.4, 0.6, 0.5);
  const hands = new THREE.Group();
  hands.name = 'hands';
  for (const x of [-0.3, 0.3]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 8, 6), mat);
    hand.position.set(x * r * 1.4, r * 1.15, r * 0.85);
    hands.add(hand);
  }
  g.add(body, mouth, hands);
  return g;
}

/** A thrown legal brief: a folded paper. */
export function makeBrief(): THREE.Group {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.05), lambert(0xfdf8e8));
  paper.position.y = 0.2;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.06, 0.06), lambert(0xc0362c));
  band.position.y = 0.2;
  g.add(paper, band);
  return g;
}

/** A copyright claim: a walking briefcase with a stack of papers. */
export function makeLawyer(): THREE.Group {
  const g = new THREE.Group();
  const leather = lambert(0x6a3a1a);
  const caseBody = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 0.35), leather);
  caseBody.position.y = 0.6;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 12, Math.PI), lambert(0x2a1a0a));
  handle.position.y = 0.92;
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.04), lambert(0xffc21a, 0x604000));
  clasp.position.set(0, 0.8, 0.19);
  const papers = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), lambert(0xfdf8e8));
  papers.position.set(0, 1.0, -0.02);
  papers.rotation.z = 0.15;
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const x of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), white);
    eye.position.set(x, 0.62, 0.19);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), black);
    pupil.position.set(x, 0.61, 0.24);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), lambert(0x2a2a30));
    leg.position.set(x * 1.3, 0.15, 0);
    g.add(eye, pupil, leg);
  }
  g.add(caseBody, handle, clasp, papers);
  return g;
}

/** A scroll of hidden instructions (the Injection Piranha's spit). */
export function makeScroll(): THREE.Group {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 10), lambert(0xfff4d6, 0x403010));
  paper.rotation.z = Math.PI / 2;
  paper.position.y = 0.2;
  const ink = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.26), lambert(0x3a0010));
  ink.position.y = 0.2;
  g.add(paper, ink);
  return g;
}

/** The Hallucination King: a big crowned ghost. */
export function makeGhostKing(): THREE.Group {
  const g = makeGhost(true);
  g.scale.setScalar(1.7);
  const gold = lambert(0xffd166, 0x806000);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.3, 8, 1, true), gold);
  crown.position.y = 1.45;
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), gold);
    const a = (i / 5) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.36, 1.68, Math.sin(a) * 0.36);
    g.add(spike);
  }
  g.add(crown);
  return g;
}

/** A rate limit: a heavy block stamped "429" (the HTTP status for Too Many Requests), with a scowl. */
export function makeCrusher(): THREE.Group {
  const g = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1), lambert(0x6a6f7a));
  block.name = 'crusherBody';
  block.position.y = 0.9;
  const face = canvasTexture(64, (c, s) => {
    c.fillStyle = '#8a303a';
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#ffe0e0';
    c.font = 'bold 24px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('429', s / 2, s * 0.72);
    c.fillStyle = '#111';
    c.fillRect(s * 0.18, s * 0.26, s * 0.22, s * 0.12);
    c.fillRect(s * 0.6, s * 0.26, s * 0.22, s * 0.12);
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: face }));
  plate.name = 'crusherFace';
  plate.position.set(0, 0.9, 0.51);
  const spikeMat = lambert(0x9aa0aa);
  for (const x of [-0.6, 0, 0.6]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 4), spikeMat);
    spike.rotation.x = Math.PI;
    spike.position.set(x, -0.1, 0);
    g.add(spike);
  }
  g.add(block, plate);
  return g;
}

/** A runaway agent: a small one-eyed robot. */
export function makeAgentDrone(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.5), lambert(0xff8a3d, 0x401800));
  body.position.y = 0.35;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2040 }));
  eye.position.set(0, 0.4, 0.26);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22), lambert(0x333333));
  antenna.position.y = 0.7;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), lambert(0xffd166, 0xffd166));
  bulb.position.y = 0.83;
  const legMat = lambert(0x2b2b30);
  for (const x of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.2), legMat);
    leg.position.set(x, 0.07, 0);
    g.add(leg);
  }
  g.add(body, eye, antenna, bulb);
  return g;
}

/** The Rogue Swarm's orchestrator: a hovering hub with a ring of eyes. */
export function makeOrchestrator(): THREE.Group {
  const g = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), lambert(0xc0562a, 0x301000));
  hub.scale.set(1.1, 0.7, 1);
  hub.position.y = 0.9;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.1, 8, 28), lambert(0xffd166, 0x604000));
  ring.name = 'ring';
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.9;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2040 });
  for (let i = 0; i < 5; i++) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), eyeMat);
    const a = -0.9 + i * 0.45;
    eye.position.set(Math.sin(a) * 0.95, 1.0, Math.cos(a) * 0.72);
    g.add(eye);
  }
  const shield = makeShield();
  shield.name = 'shield';
  shield.scale.setScalar(1.7);
  shield.position.y = 0.9;
  g.add(hub, ring, shield);
  return g;
}

/** A paperclip, bent out of a tube. */
export function makePaperclip(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const pts = [
    [0.12, -0.05], [0.12, 0.55], [0, 0.66], [-0.12, 0.55], [-0.12, 0.05], [0, -0.05], [0.07, 0.05], [0.07, 0.45], [0, 0.52], [-0.05, 0.45], [-0.05, 0.15],
  ].map(([x, y]) => new THREE.Vector3(x * 1.4, y, 0));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.03, 6), lambert(0xd8dde6, 0x303540));
  tube.position.y = 0.1;
  g.add(tube);
  g.scale.setScalar(scale);
  return g;
}

/** The Paperclip Maximizer: a boxy machine with a hopper, a paperclip on top, and one unblinking eye. */
export function makePaperclipMaximizer(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 1.6), lambert(0x7a8090));
  body.position.y = 1.2;
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 0.7, 4), lambert(0x5a6070));
  hopper.rotation.y = Math.PI / 4;
  hopper.position.y = 2.75;
  const eye = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
  eye.position.set(0, 1.5, 0.81);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  pupil.position.set(0, 1.5, 0.82);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.05), new THREE.MeshBasicMaterial({ color: 0x222228 }));
  mouth.position.set(0, 0.6, 0.81);
  const clip = makePaperclip(2.2);
  clip.name = 'clip';
  clip.position.set(0, 3.0, 0);
  const treadMat = lambert(0x2b2b30);
  for (const x of [-1.1, 1.1]) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 1.7), treadMat);
    tread.position.set(x, 0.15, 0);
    g.add(tread);
  }
  g.add(body, hopper, eye, pupil, mouth, clip);
  return g;
}

/** Every enemy and boss mesh, for the `?debug&gallery=enemies` lineup. */
export function enemyGallery(): { name: string; mesh: THREE.Object3D }[] {
  return [
    { name: 'Spambot', mesh: makeSpambot() },
    { name: 'Hot take', mesh: makeHotTake('hype') },
    { name: 'Backlash take', mesh: makeHotTake('backlash') },
    { name: 'Timeline', mesh: makeTimeline('hype') },
    { name: 'Jailbreaker', mesh: makeJailbreaker() },
    { name: 'Injection piranha', mesh: makePiranha() },
    { name: 'Hallucination ghost', mesh: makeGhost() },
    { name: 'Copyright claim', mesh: makeLawyer() },
    { name: 'Brief', mesh: makeBrief() },
    { name: 'Rate limit', mesh: makeCrusher() },
    { name: 'Runaway agent', mesh: makeAgentDrone() },
    { name: 'Paperclip', mesh: makePaperclip(1.2) },
    { name: 'Garbage In', mesh: makeSpambot(2.8, 0xa8473f) },
    { name: 'Reward Hacker', mesh: makeRewardHacker() },
    { name: 'DAN', mesh: makeDan() },
    { name: 'Sydney', mesh: makeSydney() },
    { name: 'Injection Piranha', mesh: makePiranha(2.2) },
    { name: 'Hallucination King', mesh: makeGhostKing() },
    { name: 'Orchestrator', mesh: makeOrchestrator() },
    { name: 'Paperclip Maximizer', mesh: makePaperclipMaximizer() },
  ];
}
