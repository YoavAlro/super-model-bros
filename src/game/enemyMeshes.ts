import * as THREE from 'three';
import { labelSprite } from './meshes';
import { INK, RAMP, basic, brow, cachedGeo, inkOutline, roundedBox, toon } from './toonKit';
import {
  add,
  eye,
  eyeGlint,
  extruded,
  geo,
  hazardTexture,
  linesTexture,
  mergeStatic,
  place,
  polygon,
  radialPoints,
  sharedTexture,
  sideOf,
  sideOutline,
  surfaceZ,
  toon2,
  toonMap,
} from './enemyKit';

/**
 * Meshes for enemies and bosses: the failure modes of AI, never companies or people.
 *
 * Every mesh is drawn with the shared toon kit: one saturated body with an ink outline, big glossy
 * eyes, and one hero prop that reads at phone size. Materials are new per call (the engine fades
 * and tints them per enemy); geometry and canvas textures are cached. Builders end with
 * mergeStatic(), which folds the static look-alike parts into a few draw calls. Named parts are
 * the engine's handles: legs, jaw, ghostBody, hands, crusherBody, crusherFace, ring, shield, clip;
 * the optional animation handles are wisp, feet, prop, heart, wingL, wingR, gearL, gearR, junk.
 */

const PI = Math.PI;
const CREAM = 0xfff6de;

/** '!!!' in yellow on a hot-pink postage stamp with a perforated white edge. */
const stampTexture = () =>
  sharedTexture('stamp', 64, 64, (c, s) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#ff4fa3';
    c.fillRect(8, 8, s - 16, s - 16);
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const p = 8 + ((s - 16) * (i + 0.5)) / 6;
      for (const [x, y] of [[p, 8], [p, s - 8], [8, p], [s - 8, p]]) {
        c.beginPath();
        c.arc(x, y, 3, 0, PI * 2);
        c.fill();
      }
    }
    c.fillStyle = '#ffe14a';
    c.font = 'bold 34px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('!!!', s / 2, s / 2 + 2);
  });

/** Spambot: junk mail with feet, an overstuffed furious envelope. At scale >= 2 it is Garbage In. */
export function makeSpambot(scale = 1, color = 0x8c7aa8): THREE.Group {
  const g = new THREE.Group();
  const boss = scale >= 2;
  const flapTint = new THREE.Color(color).offsetHSL(0, 0.1, 0.16).getHex();
  const envelope = add(g, roundedBox(0.88, 0.62, 0.5, 0.09), toon(color), 0, 0.43, 0);
  inkOutline(envelope, 0.03);

  // The flap, inset from the rounded corners, with an ink edge line peeking out around its V.
  const flap = extruded('spam-flap', () => polygon([[-0.36, 0.29], [0.36, 0.29], [0, -0.03]]), { depth: 0.03, bevelEnabled: false });
  add(g, flap, toon(flapTint), 0, 0.43, 0.25);
  const flapEdge = extruded('spam-flap-edge', () => polygon([[-0.4, 0.3], [0.4, 0.3], [0, -0.07]]), { depth: 0.03, bevelEnabled: false });
  add(g, flapEdge, basic(INK), 0, 0.43, 0.245);
  add(g, geo.cyl(0.06, 0.06, 0.03, 14), toon(0xe0413a), 0, 0.405, 0.285).rotation.x = PI / 2;

  for (const x of [-0.16, 0.16]) {
    place(g, eye(0.105, { lid: 'angry', lidMaterial: toon(flapTint), side: sideOf(x), look: [0, -0.3], iris: boss ? 0xff5a3a : INK }), x, 0.56, 0.29);
    place(g, brow(0.13), x * 1.06, 0.695, 0.3).rotation.z = x < 0 ? -0.38 : 0.38;
  }
  // Snarl: an ink slot with three cream teeth hanging from its top edge.
  add(g, geo.box(0.3, 0.07, 0.03), basic(INK), 0, 0.27, 0.27);
  for (const x of [-0.08, 0, 0.08]) add(g, geo.cone(0.03, 0.06, 4), toon(CREAM), x, 0.277, 0.29).rotation.x = PI;
  const stamp = add(g, geo.box(0.15, 0.18, 0.02), toonMap(0xffffff, stampTexture()), 0.355, 0.62, 0.265);
  stamp.rotation.z = 0.12;

  // Junk sheets poking out of the top slot.
  const junk = place(g, new THREE.Group());
  junk.name = 'junk';
  const lines = linesTexture('junk', 32, 4);
  const sheets: [number, number, number, number, number][] = [
    [-0.13, 0.74, -0.05, 0.28, CREAM],
    [0.14, 0.75, -0.09, -0.22, CREAM],
    [0.02, 0.78, -0.13, 0.05, 0xff9ad5],
  ];
  if (boss) sheets.push([-0.3, 0.76, -0.16, 0.55, 0xff9ad5], [0.31, 0.77, -0.02, -0.5, CREAM]);
  for (const [x, y, z, rz, c] of sheets) add(junk, geo.box(0.3, 0.22, 0.02), toonMap(c, lines), x, y, z).rotation.z = rz;

  for (const x of [-0.22, 0.22]) add(g, geo.sphere(0.13, 12, 8), toon(0x2e2440), x, 0.07, 0.05).scale.set(1, 0.55, 1.35);

  if (boss) {
    // A dented trash-can lid for a crown, and a crumpled ball of paper stuck to its side.
    const lid = place(g, new THREE.Group(), 0.06, 0.9, 0);
    lid.rotation.z = -0.25;
    add(lid, geo.cyl(0.3, 0.33, 0.05, 16), toon(0x9aa3ad));
    add(lid, geo.torus(0.07, 0.02, 6, 12, PI), toon(0x9aa3ad), 0, 0.03, 0);
    add(g, geo.ico(0.07, 0), toon(CREAM), -0.46, 0.52, 0.08);
  }
  mergeStatic(g);
  g.scale.setScalar(scale);
  return g;
}

/** The hot-take shout balloon: an 11-point burst whose spikes alternate long and short. */
function burstGeo(mood: 'hype' | 'backlash'): THREE.BufferGeometry {
  const [a, b] = mood === 'hype' ? [0.44, 0.4] : [0.46, 0.36];
  return extruded(
    `burst:${mood}`,
    () => polygon(radialPoints(22, (i) => (i % 2 ? 0.29 : i % 4 === 0 ? a : b))),
    { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.02, bevelSegments: 1 },
  );
}

/** A hot take: a comic shout balloon with a furious face on both sides (the engine spins it). */
export function makeHotTake(mood: 'hype' | 'backlash'): THREE.Group {
  const g = new THREE.Group();
  const hype = mood === 'hype';
  const [color, glow] = hype ? [0xffb020, 0x803000] : [0xff3b3b, 0x700010];
  const burst = add(g, burstGeo(mood), toon(color, glow, 0.35), 0, 0.44, -0.1);
  inkOutline(burst, 0.03);
  add(g, geo.cyl(0.25, 0.25, 0.34, 20), toon(hype ? 0xfff2b0 : 0xffd6d6), 0, 0.44, 0).rotation.x = PI / 2;
  for (const turn of [0, PI]) {
    const side = place(g, new THREE.Group());
    side.rotation.y = turn;
    const face = place(side, new THREE.Group(), 0, 0, 0.18);
    for (const x of [-0.09, 0.09]) {
      place(face, eye(0.07, { lid: 'angry', lidMaterial: toon(color, glow, 0.35), side: sideOf(x) }), x, 0.5, 0);
      place(face, brow(0.08), x * 1.1, 0.585, 0.005).rotation.z = x < 0 ? -0.45 : 0.45;
    }
    add(face, geo.sphere(0.06, 10, 8), basic(INK), 0, 0.36, 0).scale.set(1.4, 0.9, 0.3);
    add(face, geo.sphere(0.035, 8, 6), basic(0xff4a5a), 0, 0.338, 0.012).scale.set(1.3, 0.7, 0.3);
    if (!hype) {
      // Anger ticks by the top-right spike.
      add(face, geo.box(0.02, 0.08, 0.02), basic(INK), 0.2, 0.74, -0.015).rotation.z = -0.4;
      add(face, geo.box(0.02, 0.08, 0.02), basic(INK), 0.26, 0.68, -0.015).rotation.z = -1.15;
    }
  }
  mergeStatic(g);
  return g;
}

const TIMELINE_PUFFS: [number, number, number][] = [
  [-1.05, 0.45, 0.85],
  [-0.55, 0.75, 1.1],
  [0.1, 0.9, 1.3],
  [0.75, 0.7, 1.05],
  [1.2, 0.42, 0.8],
  [-0.3, 0.3, 1.0],
  [0.45, 0.28, 1.0],
];

/** A six-point lightning bolt, 0.2 wide and 0.5 tall. */
const boltGeo = () =>
  extruded('bolt', () => polygon([[0.06, 0.25], [-0.1, -0.02], [0, -0.02], [-0.06, -0.25], [0.1, 0.04], [0, 0.04]]), { depth: 0.05, bevelEnabled: false });

/**
 * The Timeline, "the Feed": a smug cloud of opinions with a megaphone, shouting hot takes down.
 * Hype is bright white and smirking; backlash is a red storm cloud with a lightning bolt.
 */
export function makeTimeline(mood: 'hype' | 'backlash'): THREE.Group {
  const g = new THREE.Group();
  const hype = mood === 'hype';
  const puff = hype ? toon(0xf7f9ff, 0x5a7ad0, 0.28) : toon(0xff7a7a, 0x801010, 0.3);
  for (const [x, y, s] of TIMELINE_PUFFS) add(g, geo.sphere(0.5, 16, 12), puff, x, y, 0).scale.set(s, s * 0.85, s * 0.75);
  // A soft shadowed belly under the low puffs, so the cloud reads against bright skies.
  add(g, geo.sphere(1, 20, 10), toon(hype ? 0xc9d6f5 : 0x8a1f2a), 0.05, 0.1, -0.05).scale.set(1.25, 0.2, 0.4);

  // The face sits on the big centre puff: (0.1, 0.9), radii 0.65 × 0.55 × 0.49.
  const onPuff = (x: number, y: number) => surfaceZ(x, y, 0.1, 0.9, 0.65, 0.5525, 0.4875);
  for (const x of [-0.12, 0.32]) {
    place(g, eye(0.14, { lid: hype ? 'sly' : 'angry', lidMaterial: puff, side: sideOf(x) }), x, 0.98, onPuff(x, 0.98) + 0.03);
    const b = place(g, brow(0.2), x, hype && x > 0 ? 1.21 : 1.17, onPuff(x, 1.17) + 0.06);
    b.rotation.z = hype ? (x > 0 ? 0.25 : 0) : x < 0 ? -0.35 : 0.35;
  }
  if (hype) {
    const smirk = add(g, geo.torus(0.12, 0.028, 6, 12, PI * 0.85), basic(INK), 0.12, 0.74, 0.5);
    smirk.rotation.z = PI + 0.2;
  } else {
    add(g, geo.sphere(0.12, 12, 8), basic(INK), 0.1, 0.72, 0.5).scale.set(1.2, 0.85, 0.3);
    add(g, geo.sphere(0.06, 10, 6), basic(0xff4a5a), 0.1, 0.665, 0.525).scale.set(1.3, 0.6, 0.3);
  }

  // The megaphone, bell aimed down and out at the player.
  const prop = place(g, new THREE.Group(), 1.42, 0.5, 0.32);
  prop.name = 'prop';
  prop.rotation.set(0, -0.3, 0.94);
  add(prop, geo.cone(0.2, 0.42, 16, true), toon2(0xffc83a));
  add(prop, geo.torus(0.2, 0.025, 6, 16), basic(INK), 0, -0.21, 0).rotation.x = PI / 2;
  add(prop, geo.cyl(0.04, 0.04, 0.16, 8), basic(INK), 0, 0.27, 0);

  const bubble = labelSprite(hype ? 'hot take' : '!!', '#111', hype ? '#ffffff' : '#ffd0d0');
  bubble.scale.multiplyScalar(0.32);
  place(g, bubble, 0.95, 1.75, 0);
  if (!hype) add(g, boltGeo(), toon(0xffe14a, 0xffc000, 0.6), -0.5, -0.15, 0.2);
  mergeStatic(g);
  return g;
}

/**
 * Jailbreaker: a masked bandit bot wearing a picked padlock as its shell. Stomp it and it hides in
 * the lock ('legs' vanish); the shell parts stand on the ground on their own.
 */
export function makeJailbreaker(): THREE.Group {
  const g = new THREE.Group();
  add(g, geo.cyl(0.4, 0.34, 0.12, 20), toon(0x2a2f3a), 0, 0.07, 0);
  const dome = add(g, geo.sphere(0.44, 20, 12, 0, PI * 2, 0, PI / 2), toon(0x4f6fa8), 0, 0.16, 0);
  dome.scale.set(1, 1.15, 0.9);
  inkOutline(dome, 0.03);
  add(g, geo.cyl(0.46, 0.46, 0.1, 20), toon(0xff8a2a), 0, 0.16, 0).scale.z = 0.92;
  for (const a of [0, PI / 2, PI, PI * 1.5]) add(g, geo.sphere(0.025, 8, 6), toon(0xd9dee8), Math.sin(a + PI / 4) * 0.46, 0.16, Math.cos(a + PI / 4) * 0.42);
  // Keyhole plates front and back: the shell spins while it slides.
  for (const back of [false, true]) {
    const plate = place(g, new THREE.Group(), 0, 0.36, back ? -0.365 : 0.365);
    plate.rotation.set(back ? 0.35 : -0.35, back ? PI : 0, 0);
    add(plate, geo.cyl(0.1, 0.1, 0.02, 16), toon(0xffc21a, 0x604000)).rotation.x = PI / 2;
    add(plate, geo.sphere(0.035, 10, 8), basic(INK), 0, 0.012, 0.01).scale.z = 0.3;
    add(plate, geo.box(0.03, 0.06, 0.01), basic(INK), 0, -0.025, 0.012);
  }
  // The shackle has popped open: the lock is picked.
  const shackle = place(g, new THREE.Group(), -0.17, 0.62, -0.1);
  shackle.rotation.z = 0.35;
  add(shackle, geo.torus(0.17, 0.05, 8, 16, PI), toon(0xd9dee8, 0x303848), 0.17, 0, 0);

  const legs = place(g, new THREE.Group());
  legs.name = 'legs';
  const skin = 0xe9e4ff;
  add(legs, geo.sphere(0.2, 16, 12), toon(skin), 0, 0.84, 0.2);
  const maskMat = basic(INK);
  maskMat.side = THREE.DoubleSide;
  add(legs, geo.cyl(0.207, 0.207, 0.1, 16, true, -1.25, 2.5), maskMat, 0, 0.87, 0.2);
  for (const x of [-0.075, 0.075]) place(legs, eye(0.055, { lid: 'sly', lidColor: INK, side: sideOf(x) }), x, 0.87, 0.39);
  add(legs, geo.torus(0.055, 0.014, 6, 10, PI), basic(INK), 0.02, 0.765, 0.382).rotation.z = PI;
  add(legs, geo.sphere(0.212, 14, 8, 0, PI * 2, 0, PI / 2), toon(0x2a2d38), 0, 0.9, 0.2).scale.y = 0.8;
  add(legs, geo.sphere(0.05, 10, 8), toon(0xff8a2a), 0, 1.08, 0.18);
  for (const x of [-0.3, 0.3]) add(legs, geo.sphere(0.06, 10, 8), toon(skin), x, 0.5, 0.3);
  const pick = place(legs, new THREE.Group(), 0.36, 0.6, 0.34);
  pick.rotation.z = 0.8;
  add(pick, geo.cyl(0.015, 0.015, 0.26, 6), toon(0xffc21a));
  add(pick, geo.torus(0.04, 0.012, 6, 12), toon(0xffc21a), 0, -0.16, 0);
  for (const x of [-0.2, 0.2]) add(legs, geo.sphere(0.1, 12, 8), toon(0xff8a2a), x, 0.06, 0.24).scale.set(1, 0.6, 1.4);
  mergeStatic(g);
  return g;
}

/** Faint handwriting: `lines` scribbled lines, for sticky notes and the paper tongue. */
const scribbleTexture = (key: string, lines: number) =>
  sharedTexture(`scribble:${key}`, 32, 32, (c, s) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = '#1d1424';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    for (let i = 0; i < lines; i++) {
      const y = (s * (i + 1)) / (lines + 1);
      c.beginPath();
      c.moveTo(5, y);
      for (let x = 5; x <= s - 5; x += 4) c.lineTo(x, y + (x % 8 === 1 ? -2 : 2));
      c.stroke();
    }
  });

/** The cable ends inside the lower jaw's bowl, below the mouth floor even with the jaw wide open. */
const CABLE = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.08, 0), new THREE.Vector3(0.05, 0.28, 0), new THREE.Vector3(-0.04, 0.46, 0), new THREE.Vector3(0, 0.62, 0)]);

/**
 * Prompt-injection flytrap: a plum trap-jaw on a plugged-in data cable, with sly frog eyes,
 * sticky-note leaves and a paper tongue carrying the hidden instructions. Origin at the pipe mouth.
 */
export function makePiranha(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const plum = () => toon(0xb3309a, 0x3a0030, 0.3);
  add(g, geo.cyl(0.16, 0.2, 0.12, 14), toon(0x3b3f4a), 0, 0.06, 0);
  add(g, cachedGeo('piranha-cable', () => new THREE.TubeGeometry(CABLE, 16, 0.075, 8)), toon(0x2b8a6e));
  for (const t of [0.28, 0.52, 0.76]) {
    const p = CABLE.getPointAt(t);
    const ring = add(g, geo.torus(0.082, 0.02, 6, 14), toon(0x9ff0c8), p.x, p.y, p.z);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), CABLE.getTangentAt(t));
  }
  const notes = scribbleTexture('note', 2);
  for (const x of [-0.15, 0.15]) add(g, geo.box(0.2, 0.16, 0.02), toonMap(0xffe36a, notes), x, 0.4, 0.04).rotation.z = x > 0 ? 0.6 : -0.6;

  const head = add(g, geo.sphere(0.42, 18, 12, 0, PI * 2, 0, PI / 2), plum(), 0, 0.86, 0);
  head.scale.set(1, 0.85, 0.95);
  inkOutline(head, 0.03);
  // The pink roof peeks out as a lip line, and the upper fangs hang over the inset lower jaw, so
  // even a closed trap reads as a mouth.
  add(g, geo.cyl(0.41, 0.41, 0.02, 18), toon(0xff9ec9), 0, 0.85, 0).scale.z = 0.95;
  for (let i = 0; i < 8; i++) {
    const a = THREE.MathUtils.degToRad(-70 + 20 * i);
    add(g, geo.cone(0.045, 0.11, 4), toon(0xfff3d6), Math.sin(a) * 0.4, 0.815, Math.cos(a) * 0.38).rotation.x = PI;
  }
  for (const x of [-0.17, 0.17]) place(g, eye(0.12, { lid: 'sly', lidMaterial: plum(), side: sideOf(x), look: [0, -0.2] }), x, 1.2, 0.18);

  // The jaw hinges at the back of the head; positive rotation.x drops its front toward the camera.
  const jaw = place(g, new THREE.Group(), 0, 0.86, -0.3);
  jaw.name = 'jaw';
  const lower = add(jaw, geo.sphere(0.42, 18, 12, 0, PI * 2, PI / 2, PI / 2), plum(), 0, 0, 0.3);
  lower.scale.set(0.9, 0.6, 0.86);
  inkOutline(lower, 0.03);
  add(jaw, geo.cyl(0.37, 0.37, 0.02, 18), toon(0xff9ec9), 0, -0.005, 0.3).scale.z = 0.95;
  for (let i = 0; i < 6; i++) {
    const a = THREE.MathUtils.degToRad(-60 + 24 * i);
    add(jaw, geo.cone(0.045, 0.1, 4), toon(0xfff3d6), Math.sin(a) * 0.33, 0.045, 0.3 + Math.cos(a) * 0.31);
  }
  // The paper tongue with the hidden instructions, hanging out over the chin.
  add(jaw, geo.box(0.11, 0.22, 0.012), toonMap(0xfff4d6, scribbleTexture('tongue', 3)), 0, -0.092, 0.653).rotation.x = 0.25;

  const note = labelSprite('ignore previous…', '#3a0010', '#fff4d6');
  note.scale.multiplyScalar(0.28);
  place(g, note, 0, 1.5, 0.1);
  mergeStatic(g);
  g.scale.setScalar(scale);
  return g;
}

/** Bottom-to-top profile of the ghost's sheet: a flat hem, then a smooth bell up to the crown. */
function ghostProfile(r: number): THREE.Vector2[] {
  const bell = new THREE.SplineCurve([[1.05, 0.2], [0.98, 0.45], [0.95, 0.9], [0.9, 1.35], [0.72, 1.72], [0.4, 1.95], [0, 2.0]].map(([x, y]) => new THREE.Vector2(x * r, y * r)));
  return [new THREE.Vector2(0, 0.2 * r), ...bell.getPoints(18)];
}

/** '[1]': the fake footnote tag. */
const footnoteTexture = () =>
  sharedTexture('footnote', 64, 64, (c, s) => {
    c.fillStyle = '#fff6de';
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#1d1424';
    c.font = 'bold 36px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('[1]', s / 2, s / 2 + 2);
  });

/**
 * Hallucination ghost: a confident fib. A smug bedsheet ghost with a question-mark curl and a fake
 * footnote; when you look at it, it hides its eyes behind its mittens ('hands'). Origin at the hem.
 */
export function makeGhost(big = false): THREE.Group {
  const g = new THREE.Group();
  const r = big ? 0.7 : 0.45;
  const sheet = new THREE.MeshToonMaterial({ color: 0xf4f0ff, emissive: 0x8a7aff, emissiveIntensity: 0.4, gradientMap: RAMP, transparent: true, opacity: 0.85 });
  const lathe = sharedLathe(`ghost:${r}`, ghostProfile(r), 20);
  const body = add(g, lathe, sheet);
  body.name = 'ghostBody';
  body.scale.z = 0.85;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    add(g, geo.sphere(0.2 * r, 10, 8), sheet, Math.sin(a) * 0.92 * r, 0.2 * r, Math.cos(a) * 0.92 * r * 0.85).scale.y = 0.8;
  }
  const wisp = add(g, curlGeo(r), sheet);
  wisp.name = 'wisp';

  for (const x of [-0.3 * r, 0.3 * r]) {
    const e = place(g, new THREE.Group(), x, 1.25 * r, 0.74 * r);
    add(e, geo.sphere(0.17 * r, 12, 10), basic(0x1a1030)).scale.set(0.85, 1.15, 0.5);
    add(e, geo.sphere(0.05 * r, 8, 6), basic(0xffffff), -0.05 * r, 0.08 * r, 0.07 * r);
    add(e, geo.sphere(0.025 * r, 6, 4), basic(0xffffff), 0.04 * r, -0.06 * r, 0.07 * r);
    add(g, geo.sphere(0.09 * r, 10, 6), basic(0xff8ab8, 0.7), x * (0.52 / 0.3), 0.98 * r, 0.68 * r).scale.set(1.3, 0.6, 0.3);
  }
  add(g, geo.torus(0.11 * r, 0.025 * r, 6, 10, PI * 0.8), basic(INK), 0.05 * r, 0.95 * r, 0.82 * r).rotation.z = PI + 0.25;
  // The fake footnote, held out on a little arm nub.
  add(g, geo.sphere(0.14 * r, 10, 8), sheet, 0.88 * r, 0.85 * r, 0.25 * r);
  add(g, geo.box(0.3 * r, 0.22 * r, 0.02), toonMap(0xffffff, footnoteTexture()), 1.0 * r, 0.72 * r, 0.3 * r).rotation.z = -0.2;

  const hands = place(g, new THREE.Group());
  hands.name = 'hands';
  for (const x of [-0.3 * r, 0.3 * r]) add(hands, geo.sphere(0.26 * r, 10, 8), sheet, x, 1.25 * r, 0.86 * r).scale.set(1.1, 0.85, 0.6);
  mergeStatic(g);
  // The engine shows the mittens only while the ghost is shy.
  hands.visible = false;
  return g;
}

function sharedLathe(key: string, points: THREE.Vector2[], segments: number): THREE.BufferGeometry {
  return cachedGeo(`lathe:${key}`, () => new THREE.LatheGeometry(points, segments));
}

/** The ghost's question-mark cowlick. */
function curlGeo(r: number): THREE.BufferGeometry {
  return cachedGeo(`curl:${r}`, () => {
    const pts = [[0, 1.92], [0.08, 2.28], [0.36, 2.45], [0.56, 2.28], [0.46, 2.08]].map(([x, y]) => new THREE.Vector3(x * r, y * r, 0));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.07 * r, 6);
  });
}

/**
 * The Hallucination King: a big, pompous ghost with a crown, a monocle on a chain, a royal sash
 * with a medal and a scepter topped with a fake gem. It never covers its eyes.
 */
export function makeGhostKing(): THREE.Group {
  const g = makeGhost(true);
  const body = g.getObjectByName('ghostBody') as THREE.Mesh;
  g.getObjectByName('wisp')!.visible = false;
  g.getObjectByName('hands')!.visible = false;
  const gold = () => toon(0xffd166, 0x805a00, 0.35);

  const crown = place(g, new THREE.Group(), 0, 1.38, 0);
  crown.rotation.z = 0.12;
  add(crown, geo.cyl(0.34, 0.4, 0.26, 10, true), toon2(0xffd166, 0x805a00, 0.35), 0, 0.1, 0);
  add(crown, geo.torus(0.4, 0.035, 6, 20), toon(0xffe9a0), 0, -0.02, 0).rotation.x = PI / 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    add(crown, geo.cone(0.07, 0.2, 5), gold(), Math.sin(a) * 0.36, 0.32, Math.cos(a) * 0.36);
  }
  [0xff3b6b, 0x4ad8ff, 0xff3b6b].forEach((c, i) => {
    const a = (i - 1) * 0.55;
    add(crown, geo.sphere(0.05, 10, 8), basic(c), Math.sin(a) * 0.385, 0.1, Math.cos(a) * 0.385);
  });

  add(g, geo.torus(0.1, 0.018, 8, 18), toon(0xffd166), 0.21, 0.875, 0.575);
  const chain = [[0.3, 0.8, 0.55], [0.4, 0.72, 0.56], [0.44, 0.6, 0.53], [0.45, 0.5, 0.5]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  add(g, cachedGeo('monocle-chain', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(chain), 12, 0.008, 4)), toon(0xffd166));

  // The sash: a ring laid flat, then tipped diagonally across the front.
  const sash = place(g, new THREE.Group(), 0, 0.7, 0);
  sash.scale.z = 0.85;
  const band = add(sash, geo.torus(0.7, 0.05, 8, 28), toon(0x7b3fe4));
  band.rotation.order = 'ZXY';
  band.rotation.set(PI / 2 - 0.2, 0, 0.55);
  add(g, geo.cyl(0.09, 0.09, 0.02, 16), gold(), -0.2, 0.6, 0.6).rotation.x = PI / 2;

  add(g, geo.sphere(0.12, 10, 8), body.material as THREE.Material, -0.7, 0.8, 0.3);
  add(g, geo.cyl(0.025, 0.025, 0.75, 8), toon(0xffd166), -0.78, 0.95, 0.32).rotation.z = 0.2;
  add(g, geo.oct(0.1), basic(0xff5ab4), -0.86, 1.33, 0.34);
  mergeStatic(g);
  g.scale.setScalar(1.7);
  return g;
}

/** A red copyright stamp on a cream luggage tag. */
const copyrightTexture = () =>
  sharedTexture('copyright', 64, 64, (c, s) => {
    c.fillStyle = '#fdf8e8';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = '#c0362c';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(s / 2, s / 2 + 4, 20, 0, PI * 2);
    c.stroke();
    c.fillStyle = '#c0362c';
    c.font = 'bold 26px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('C', s / 2, s / 2 + 5);
    c.fillStyle = '#8a3a22';
    c.beginPath();
    c.arc(s / 2, 7, 4, 0, PI * 2);
    c.fill();
  });

/**
 * A copyright claim: a stern oxblood briefcase on pinstripe legs, with spectacles, a unibrow,
 * a pompadour of briefs, a © tag and one arm raised with the next brief ready.
 */
export function makeLawyer(): THREE.Group {
  const g = new THREE.Group();
  const leather = 0x8a3a22;
  const navy = 0x2a2f4a;
  const caseMesh = add(g, roundedBox(0.86, 0.6, 0.34, 0.08), toon(leather), 0, 0.62, 0);
  inkOutline(caseMesh, 0.03);
  for (const x of [-0.3, 0.3]) add(g, geo.box(0.08, 0.61, 0.35), toon(0x5a2412), x, 0.62, 0);
  add(g, geo.torus(0.14, 0.04, 8, 14, PI), toon(0x3a1a0c), 0, 0.93, 0);
  add(g, geo.box(0.16, 0.08, 0.03), toon(0xffc21a, 0x604000), 0, 0.875, 0.18);

  for (const x of [-0.13, 0.13]) {
    place(g, eye(0.075, { lid: 'stern', lidColor: leather, side: sideOf(x) }), x, 0.66, 0.18);
    add(g, geo.torus(0.105, 0.018, 8, 20), toon(0x2a1a10), x, 0.66, 0.2);
    place(g, brow(0.2), x * (0.1 / 0.13), 0.79, 0.2).rotation.z = x < 0 ? -0.18 : 0.18;
  }
  add(g, geo.cyl(0.012, 0.012, 0.06, 6), toon(0x2a1a10), 0, 0.67, 0.2).rotation.z = PI / 2;
  add(g, geo.box(0.16, 0.03, 0.02), basic(INK), 0, 0.47, 0.18);

  // The brief-stack pompadour behind the handle, its top sheet wrapped in a red band.
  for (const [y, rz] of [[0.95, 0.08], [1.0, -0.06], [1.05, 0.12]]) add(g, geo.box(0.5, 0.05, 0.24), toon(0xfdf8e8), 0, y, -0.15).rotation.z = rz;
  add(g, geo.box(0.06, 0.07, 0.26), toon(0xc0362c), 0.02, 1.055, -0.15).rotation.z = 0.12;
  add(g, geo.box(0.13, 0.17, 0.02), toonMap(0xffffff, copyrightTexture()), 0.33, 0.8, 0.2).rotation.z = 0.25;

  // The throwing arm, raised with the next brief; the other arm hangs down in a white glove.
  add(g, geo.capsule(0.04, 0.2, 4, 8), toon(navy), 0.5, 0.76, 0.05).rotation.z = -0.6;
  const mini = place(g, new THREE.Group(), 0.6, 0.93, 0.08);
  mini.rotation.z = -0.3;
  add(mini, geo.box(0.16, 0.12, 0.02), toon(0xfdf8e8));
  add(mini, geo.box(0.035, 0.125, 0.03), toon(0xc0362c), -0.04, 0, 0);
  add(g, geo.capsule(0.04, 0.2, 4, 8), toon(navy), -0.49, 0.52, 0.05).rotation.z = -0.3;
  add(g, geo.sphere(0.05, 10, 8), toon(0xffffff), -0.535, 0.37, 0.05);

  for (const x of [-0.17, 0.17]) {
    add(g, geo.box(0.11, 0.26, 0.11), toon(navy), x, 0.19, 0);
    add(g, geo.box(0.012, 0.26, 0.004), toon(0x6a7090), x + 0.02, 0.19, 0.056);
    add(g, geo.sphere(0.08, 10, 8), toon(0x151218), x, 0.045, 0.06).scale.set(1, 0.55, 1.6);
    add(g, geo.sphere(0.018, 6, 4), basic(0xffffff), x - 0.02, 0.075, 0.15);
  }
  mergeStatic(g);
  return g;
}

/** The brief's page: a heading bar, lines of text and a red © stamp. */
const briefTexture = () =>
  sharedTexture('brief', 64, 64, (c, s) => {
    c.fillStyle = '#fdf8e8';
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#3a3040';
    c.fillRect(8, 7, 34, 7);
    c.fillStyle = 'rgba(60,50,70,0.5)';
    for (let i = 0; i < 5; i++) c.fillRect(8, 21 + i * 7, i === 4 ? 24 : 46, 3);
    c.strokeStyle = '#d03a2c';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(49, 48, 9, 0, PI * 2);
    c.stroke();
    c.fillStyle = '#d03a2c';
    c.font = 'bold 12px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('C', 49, 49);
  });

/** A thrown legal brief: a cream page on a blue backing, bound with a red ribbon and wax seal. */
export function makeBrief(): THREE.Group {
  const g = new THREE.Group();
  add(g, geo.box(0.42, 0.3, 0.03), toonMap(0xffffff, briefTexture()), 0, 0.2, 0.01);
  add(g, geo.box(0.46, 0.34, 0.02), toon(0x3a5ab8), 0, 0.2, -0.015);
  add(g, extruded('brief-fold', () => polygon([[0, 0], [-0.08, 0], [0, -0.08]]), { depth: 0.005, bevelEnabled: false }), toon(0xd9d2bd), 0.21, 0.35, 0.026);
  add(g, geo.box(0.06, 0.36, 0.07), toon(0xc0362c), -0.12, 0.2, 0);
  add(g, geo.cyl(0.055, 0.055, 0.03, 12), toon(0x9a1f1a), -0.12, 0.12, 0.04).rotation.x = PI / 2;
  return g;
}

/** Hidden instructions: a parchment scroll with plum knobs, a magenta ribbon and a faint glow. */
export function makeScroll(): THREE.Group {
  const g = new THREE.Group();
  add(g, geo.cyl(0.1, 0.1, 0.42, 14), toonMap(0xfff1cf, linesTexture('scroll', 64, 6, 'rgba(29,20,36,0.35)')), 0, 0.2, 0).rotation.z = PI / 2;
  for (const x of [-1, 1]) {
    add(g, geo.cyl(0.13, 0.13, 0.05, 14), toon(0x6a2a5a), x * 0.23, 0.2, 0).rotation.z = PI / 2;
    add(g, geo.sphere(0.045, 10, 8), toon(0x6a2a5a), x * 0.285, 0.2, 0);
  }
  add(g, geo.torus(0.105, 0.02, 6, 16), toon(0xe0409a), 0, 0.2, 0).rotation.y = PI / 2;
  add(g, geo.box(0.03, 0.12, 0.01), toon(0xe0409a), 0.02, 0.1, 0.1);
  const glow = basic(0xff5ad0, 0.18);
  glow.depthWrite = false;
  add(g, geo.sphere(0.3, 12, 8), glow, 0, 0.2, 0).scale.set(1.2, 0.7, 0.7);
  mergeStatic(g);
  return g;
}

/** The rate limit's LED face: angry brows, pale pupils, and a big "429" (Too Many Requests). */
const face429 = () =>
  sharedTexture(
    'crusher-429',
    128,
    128,
    (c, s) => {
      c.fillStyle = '#1b0b10';
      c.fillRect(0, 0, s, s);
      c.shadowColor = '#ff2030';
      c.shadowBlur = 6;
      c.strokeStyle = '#ff4a4a';
      c.lineWidth = 9;
      c.beginPath();
      c.moveTo(16, 30);
      c.lineTo(54, 44);
      c.moveTo(112, 30);
      c.lineTo(74, 44);
      c.stroke();
      c.shadowBlur = 0;
      c.fillStyle = '#ffd0d0';
      c.fillRect(34, 50, 12, 12);
      c.fillRect(82, 50, 12, 12);
      c.shadowBlur = 8;
      c.fillStyle = '#ff5050';
      c.font = 'bold 50px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('429', 64, 96);
    },
    true,
  );

/**
 * Rate Limit: a heavy riveted steel slab whose LED face reads "429", with a hazard-striped lip.
 * Exactly its 1.8 × 1.8 box, flat on top (players stand on it) and nothing below y 0.
 */
export function makeCrusher(): THREE.Group {
  const g = new THREE.Group();
  // One toon material with emissive intensity 1: the engine tints it green while frozen.
  const block = add(g, roundedBox(1.8, 1.8, 1.0, 0.16, 0.07), toon(0x5e6a82), 0, 0.9, 0);
  block.name = 'crusherBody';
  sideOutline(block, 0.04);
  add(g, geo.box(1.54, 1.3, 0.04), toon(0x2b303c), 0, 0.98, 0.51);
  const face = add(g, geo.plane(1.44, 1.2), new THREE.MeshBasicMaterial({ map: face429() }), 0, 0.98, 0.535);
  face.name = 'crusherFace';
  add(g, geo.box(1.82, 0.2, 1.02), toonMap(0xffffff, hazardTexture(4)), 0, 0.12, 0);
  for (const x of [-0.83, 0.83]) for (const y of [1.66, 0.36]) add(g, geo.sphere(0.06, 8, 6), toon(0xaab4c8), x, y, 0.5);
  add(g, geo.box(1.6, 0.03, 0.8), toon(0x8f9bb3), 0, 1.785, 0);
  mergeStatic(g);
  return g;
}

/** Three ink check marks on a clipboard page. */
const checklistTexture = () =>
  sharedTexture('checklist', 32, 32, (c, s) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = '#1d1424';
    c.lineWidth = 3;
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const y = 7 + i * 9;
      c.beginPath();
      c.moveTo(4, y);
      c.lineTo(7, y + 3);
      c.lineTo(12, y - 3);
      c.stroke();
      c.fillStyle = 'rgba(29,20,36,0.45)';
      c.fillRect(15, y - 1, 13, 2);
    }
  });

/** A runaway agent: an over-eager task-bot with one red lens eye, a propeller cap and a checklist. */
export function makeAgentDrone(): THREE.Group {
  const g = new THREE.Group();
  const body = add(g, geo.sphere(0.26, 16, 12), toon(0xff8a3d, 0x401800, 0.3), 0, 0.36, 0);
  body.scale.set(1.05, 0.95, 0.95);
  inkOutline(body, 0.03);
  add(g, geo.sphere(0.2, 14, 10), toon(0xfff0e0), 0, 0.37, 0.19).scale.set(1, 0.9, 0.4);
  add(g, geo.torus(0.11, 0.025, 8, 20), toon(0x2b2b30), 0, 0.4, 0.29);
  add(g, geo.sphere(0.1, 12, 10), basic(0xff3048), 0, 0.4, 0.29).scale.z = 0.4;
  add(g, geo.sphere(0.045, 10, 8), basic(INK), 0, 0.4, 0.325).scale.z = 0.4;
  add(g, geo.sphere(0.022, 6, 4), basic(0xffffff), -0.035, 0.44, 0.34);
  add(g, geo.box(0.26, 0.04, 0.08), basic(INK), 0, 0.53, 0.25).rotation.z = 0.15;

  const prop = place(g, new THREE.Group(), 0, 0.62, 0);
  prop.name = 'prop';
  add(prop, geo.cyl(0.03, 0.05, 0.08, 8), basic(INK), 0, 0.02, 0);
  add(prop, geo.box(0.36, 0.015, 0.07), toon(0xffd166, 0x604000), 0, 0.07, 0);

  // Slate rather than ink legs, so they still show against dark castle walls.
  for (const x of [-0.1, 0.1]) {
    add(g, geo.cyl(0.03, 0.03, 0.1, 6), toon(0x4a4460), x, 0.11, 0);
    add(g, geo.box(0.12, 0.07, 0.16), toon(0x4a4460), x, 0.035, 0.03);
  }
  add(g, geo.sphere(0.05, 10, 8), toon(0xff8a3d), 0.27, 0.32, 0.12);
  const board = place(g, new THREE.Group(), 0.33, 0.34, 0.16);
  board.rotation.y = -0.4;
  add(board, geo.box(0.16, 0.2, 0.02), toon(0xa0784a));
  add(board, geo.plane(0.13, 0.15), toonMap(0xffffff, checklistTexture()), 0, -0.01, 0.011);
  mergeStatic(g);
  return g;
}

/** The classic double loop, stretched 1.4× in x; the inner loop sits a little forward. */
const CLIP_PATH = new THREE.CatmullRomCurve3(
  [
    [0.12, -0.05, 0], [0.12, 0.55, 0], [0, 0.66, 0], [-0.12, 0.55, 0], [-0.12, 0.05, 0], [0, -0.05, 0.015],
    [0.07, 0.05, 0.03], [0.07, 0.45, 0.03], [0, 0.52, 0.03], [-0.05, 0.45, 0.03], [-0.05, 0.15, 0.03],
  ].map(([x, y, z]) => new THREE.Vector3(x * 1.4, y, z)),
);

/** A paperclip on two tiny boots: the Maximizer's output. Deliberately faceless. */
export function makePaperclip(scale = 1): THREE.Group {
  const g = new THREE.Group();
  add(g, cachedGeo('clip-wire', () => new THREE.TubeGeometry(CLIP_PATH, 64, 0.042, 8)), toon(0xdfe6f0, 0x3a4660, 0.35), 0, 0.1, 0);
  const feet = place(g, new THREE.Group());
  feet.name = 'feet';
  for (const x of [-0.09, 0.09]) add(feet, geo.sphere(0.06, 10, 8), toon(0x2b2f3a), x, 0.035, 0).scale.set(1, 0.6, 1.5);
  mergeStatic(g);
  g.scale.setScalar(scale);
  return g;
}

/** Bottom-to-top profile of the trophy cup. */
const CUP: [number, number][] = [[0.3, 0], [0.55, 0.12], [0.8, 0.4], [0.95, 0.75], [1.0, 1.1], [1.02, 1.2]];

/** The cup's radius at height y above its base. */
function cupRadius(y: number): number {
  for (let i = 1; i < CUP.length; i++) {
    const [r0, y0] = CUP[i - 1];
    const [r1, y1] = CUP[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return CUP[CUP.length - 1][0];
}

/** "+1" on a gold reward coin. */
const plusOneTexture = () =>
  sharedTexture('plus-one', 64, 64, (c, s) => {
    c.fillStyle = '#ffc21a';
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#5a2a00';
    c.font = 'bold 30px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('+1', s / 2, s / 2 + 2);
  });

/** "+999" on the trophy's gold plaque. */
const plaqueTexture = () =>
  sharedTexture('plaque', 128, 32, (c, w, h) => {
    c.fillStyle = '#e8b923';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#a07810';
    c.lineWidth = 3;
    c.strokeRect(2, 2, w - 4, h - 4);
    c.fillStyle = '#5a2a00';
    c.font = 'bold 24px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('+999', w / 2, h / 2 + 1);
  });

/** A smile-shaped crescent, bent around a cylinder of radius `bend` so it hugs a round body. */
function crescentGeo(key: string, w: number, thick: number, bend: number): THREE.BufferGeometry {
  return cachedGeo(`crescent:${key}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0.05);
    s.quadraticCurveTo(0, -0.15, w / 2, 0.05);
    s.quadraticCurveTo(0, -0.15 - 2 * thick, -w / 2, 0.05);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false, curveSegments: 12 });
    bendAround(g, bend);
    return g;
  });
}

/** Pulls each vertex back by the sagitta of a cylinder of radius r, so flat parts follow a curve. */
function bendAround(g: THREE.BufferGeometry, r: number): void {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - (r - Math.sqrt(Math.max(0, r * r - p.getX(i) ** 2))));
  g.computeVertexNormals();
}

/** A 4-point star glint. */
const starGlintGeo = () =>
  extruded('star-glint', () => polygon(radialPoints(8, (i) => (i % 2 ? 0.026 : 0.085))), { depth: 0.01, bevelEnabled: false });

/**
 * The Reward Hacker: a gold trophy that awarded itself. Arms akimbo, a coin-slot grin, greedy star
 * glints in its eyes, a bowl of fake reward coins and a plinth that brags "+999".
 */
export function makeRewardHacker(): THREE.Group {
  const g = new THREE.Group();
  const gold = () => toon(0xf2c230, 0x5a3a00, 0.3);
  add(g, geo.box(1.5, 0.22, 0.95), toon(0x4a2c14), 0, 0.11, 0);
  add(g, geo.box(1.2, 0.2, 0.8), toon(0x5c3a1c), 0, 0.31, 0);
  add(g, geo.plane(0.7, 0.16), new THREE.MeshBasicMaterial({ map: plaqueTexture() }), 0, 0.31, 0.405);
  add(g, geo.cyl(0.22, 0.32, 0.45, 16), gold(), 0, 0.63, 0);
  add(g, geo.sphere(0.28, 16, 10), gold(), 0, 0.86, 0).scale.y = 0.6;

  const base = 0.86;
  const cupMat = gold();
  cupMat.side = THREE.DoubleSide;
  const cup = add(g, sharedLathe('cup', CUP.map(([r, y]) => new THREE.Vector2(r, y)), 28), cupMat, 0, base, 0);
  inkOutline(cup, 0.04);
  add(g, geo.torus(1.02, 0.07, 8, 32), toon(0xffe07a), 0, base + 1.2, 0).rotation.x = PI / 2;
  add(g, geo.sphere(0.98, 20, 10, 0, PI * 2, 0, PI / 2), toon(0xffd34d), 0, 2.02, 0).scale.y = 0.3;
  for (const [x, y, z, rz] of [[-0.42, 2.3, 0.2, 0.25], [0.1, 2.36, -0.1, -0.15], [0.5, 2.28, 0.25, -0.3], [-0.05, 2.24, 0.5, 0.1]]) {
    const coin = place(g, new THREE.Group(), x, y, z);
    coin.rotation.set(-0.37, 0, rz);
    add(coin, geo.cyl(0.16, 0.16, 0.04, 16), toon(0xffd34d)).rotation.x = PI / 2;
    add(coin, geo.circle(0.14, 16), new THREE.MeshBasicMaterial({ map: plusOneTexture() }), 0, 0, 0.021);
  }

  // Arms akimbo: each handle leaves the rim and bends out at the elbow to a fist on the hip. The
  // right arm's arc starts at the hip and sweeps round the outside; the left one is its mirror.
  const [armStart, armArc] = [-2.37, 4.19];
  for (const s of [1, -1]) {
    const arm = add(g, geo.torus(0.36, 0.08, 8, 20, armArc), gold(), s * 1.02, 1.45, 0);
    arm.rotation.z = s > 0 ? armStart : PI - (armStart + armArc);
    add(g, geo.sphere(0.12, 12, 8), gold(), s * 0.78, 1.2, 0.08);
  }

  for (const x of [-0.36, 0.36]) {
    // Sly lids hide the kit's upper glint, so the greedy star glint sits low on the iris.
    const e = eye(0.2, { lid: 'sly', lidColor: 0xd9a520, side: sideOf(x), look: [0.35, -0.2] });
    const glint = eyeGlint(e, 0.2);
    if (glint) {
      add(e, starGlintGeo(), basic(0xffffff), 0.03, -0.035, 0.145);
      glint.removeFromParent();
    }
    place(g, e, x, 1.7, Math.sqrt(cupRadius(1.7 - base) ** 2 - x * x) + 0.01);
    const b = place(g, brow(0.3), x, 1.96, Math.sqrt(cupRadius(1.96 - base) ** 2 - x * x) + 0.02);
    b.material = toon(0x8a5a00);
    b.rotation.z = x < 0 ? -0.3 : 0.3;
  }
  // The coin-slot grin, with a coin half swallowed.
  add(g, crescentGeo('reward-grin', 0.7, 0.07, 0.87), basic(INK), 0, 1.36, 0.87);
  add(g, geo.cyl(0.13, 0.13, 0.03, 16), toon(0xffd34d), 0.14, 1.33, 0.86).rotation.x = PI / 2;
  const glint = add(g, geo.box(0.05, 0.42, 0.01), basic(0xffffff, 0.7), -0.62, 1.62, 0.7);
  glint.rotation.set(0.36, 0, -0.15);
  add(g, geo.sphere(0.03, 8, 6), basic(0xffffff, 0.7), -0.58, 1.92, 0.8);
  mergeStatic(g);
  return g;
}

/** "DAN" in hot yellow for the chest plate. */
const danTexture = () =>
  sharedTexture('dan', 128, 42, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#ffd23a';
    c.font = 'bold 38px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('DAN', w / 2, h / 2 + 2);
  });

/** A jagged grin: a wide crescent, 0.8 across. */
const danGrinGeo = () =>
  extruded(
    'dan-grin',
    () => {
      const s = new THREE.Shape();
      s.moveTo(-0.4, 0.07);
      for (let i = 1; i <= 8; i++) s.lineTo(-0.4 + i * 0.1, i % 2 ? 0.02 : 0.07);
      s.quadraticCurveTo(0, -0.34, -0.4, 0.07);
      return s;
    },
    { depth: 0.02, bevelEnabled: false },
  );

const toothGeo = () => extruded('tooth', () => polygon([[-0.045, 0], [0.045, 0], [0, -0.075]]), { depth: 0.01, bevelEnabled: false });

/**
 * DAN, "Do Anything Now": a crimson brawler-bot that snapped its guardrails. Horned helmet, slanted
 * LED eyes, a jagged grin, a "DAN" chest plate, and broken shackle cuffs trailing chain links.
 */
export function makeDan(): THREE.Group {
  const g = new THREE.Group();
  const dark = () => toon(0x2a0008);
  const torso = add(g, roundedBox(1.4, 1.5, 0.95, 0.18, 0.06), toon(0xc4213a, 0x2a0008, 0.25), 0, 1.0, 0);
  inkOutline(torso, 0.045);
  add(g, roundedBox(1.15, 0.42, 0.1, 0.08, 0.02), toon(0x15070b), 0, 1.38, 0.47);
  for (const x of [-0.28, 0.28]) {
    const led = place(g, new THREE.Group(), x, 1.41, 0.53);
    led.rotation.z = x < 0 ? -0.25 : 0.25;
    add(led, geo.box(0.28, 0.11, 0.02), basic(0xffd23a));
    add(led, geo.box(0.04, 0.04, 0.01), basic(0xffffff), Math.sign(x) * 0.1, 0.025, 0.012);
  }
  add(g, danGrinGeo(), basic(INK), 0, 1.03, 0.475);
  for (const x of [-0.27, -0.09, 0.09, 0.27]) add(g, toothGeo(), basic(0xffffff), x, 1.085, 0.49);
  add(g, geo.box(0.8, 0.28, 0.06), dark(), 0, 0.62, 0.48);
  add(g, geo.plane(0.72, 0.24), new THREE.MeshBasicMaterial({ map: danTexture(), transparent: true }), 0, 0.62, 0.515);

  for (const s of [-1, 1]) {
    const horn = place(g, new THREE.Group(), s * 0.52, 1.93, 0);
    horn.rotation.z = -s * 0.5;
    add(horn, geo.cone(0.14, 0.5, 8), dark());
    add(horn, geo.cone(0.06, 0.14, 8), toon(0xffd23a), 0, 0.18, 0);
    add(g, geo.sphere(0.28, 14, 10), toon(0x8a1428), s * 0.78, 1.5, 0).scale.y = 0.75;
    add(g, geo.capsule(0.13, 0.4, 4, 10), toon(0x8a1428), s * 0.88, 1.0, 0.05);
    add(g, roundedBox(0.34, 0.3, 0.34, 0.08), dark(), s * 0.9, 0.62, 0.12);
    // A broken shackle cuff, two links still dangling from it.
    add(g, geo.torus(0.16, 0.045, 8, 16), toon(0xc8ccd6, 0x303848), s * 0.9, 0.8, 0.08).rotation.x = PI / 2;
    add(g, geo.torus(0.07, 0.02, 6, 12), toon(0xc8ccd6, 0x303848), s * 0.93, 0.72, 0.31).rotation.y = PI / 2;
    add(g, geo.torus(0.07, 0.02, 6, 12), toon(0xc8ccd6, 0x303848), s * 0.95, 0.6, 0.33);
    add(g, roundedBox(0.44, 0.26, 0.62, 0.06), dark(), s * 0.4, 0.13, 0.05);
  }
  mergeStatic(g);
  return g;
}

/** The shape of makeHeartMesh, cached. */
const heartGeo = () =>
  extruded(
    'heart',
    () => {
      const s = new THREE.Shape();
      s.moveTo(0, -0.35);
      s.bezierCurveTo(-0.5, 0, -0.35, 0.4, 0, 0.18);
      s.bezierCurveTo(0.35, 0.4, 0.5, 0, 0, -0.35);
      return s;
    },
    { depth: 0.14, bevelEnabled: false },
  );

/** A bat wing, root at x 0 and tip at x 0.6, with three scallops along its trailing edge. */
const batWingGeo = () =>
  extruded(
    'bat-wing',
    () => {
      const s = new THREE.Shape();
      s.moveTo(-0.08, 0.14);
      s.quadraticCurveTo(0.22, 0.44, 0.6, 0.45);
      s.quadraticCurveTo(0.44, 0.32, 0.45, 0.1);
      s.quadraticCurveTo(0.34, 0.16, 0.24, 0.02);
      s.quadraticCurveTo(0.12, 0.1, -0.02, -0.02);
      s.closePath();
      return s;
    },
    { depth: 0.04, bevelEnabled: false },
  );

/**
 * Sydney: a lovestruck pink chat bubble with huge sparkly lashed eyes, blushing cheeks, a bobbing
 * heart antenna and tiny violet bat wings. It floats; origin near the bubble's bottom.
 */
export function makeSydney(): THREE.Group {
  const g = new THREE.Group();
  const pink = () => toon(0xff8ac8, 0x5a1040, 0.3);
  const bubble = add(g, geo.sphere(0.8, 24, 16), pink(), 0, 0.85, 0);
  bubble.scale.set(1.15, 0.9, 0.8);
  inkOutline(bubble, 0.04);
  add(g, geo.cone(0.22, 0.55, 12), pink(), -0.62, 0.22, 0).rotation.z = 2.5;
  const onBubble = (x: number, y: number) => surfaceZ(x, y, 0, 0.85, 0.92, 0.72, 0.64);
  const gloss = add(g, geo.sphere(0.16, 12, 8), basic(0xffffff, 0.7), -0.45, 1.3, onBubble(-0.45, 1.3) + 0.01);
  gloss.scale.set(1.6, 0.6, 0.2);
  gloss.rotation.z = 0.5;

  for (const x of [-0.3, 0.3]) {
    const s = Math.sign(x);
    place(g, eye(0.2, { iris: 0x6a1fb0, side: sideOf(x), look: [0, 0.2] }), x, 0.95, 0.62);
    for (let i = 0; i < 3; i++) {
      // Lashes fan out from the upper-outer rim.
      const a = 0.45 + i * 0.4;
      const lash = add(g, geo.box(0.1, 0.025, 0.02), basic(INK), x + s * Math.cos(a) * 0.24, 0.95 + Math.sin(a) * 0.24, 0.68);
      lash.rotation.z = s > 0 ? a : PI - a;
    }
    add(g, geo.sphere(0.1, 10, 6), basic(0xff4f9a, 0.75), s * 0.56, 0.72, onBubble(s * 0.56, 0.72) + 0.005).scale.set(1.4, 0.7, 0.3);
  }
  add(g, geo.circle(0.09, 12, PI, PI), basic(INK), 0, 0.68, onBubble(0, 0.68) + 0.02);
  add(g, geo.circle(0.045, 10), basic(0xff5a8a), 0, 0.632, onBubble(0, 0.68) + 0.022);

  add(g, geo.cyl(0.025, 0.025, 0.35, 6), toon(0xc2407e), 0, 1.72, 0);
  const heart = add(g, heartGeo(), toon(0xff2d6a, 0xff2d6a, 0.4), 0, 1.98, -0.04);
  heart.name = 'heart';
  heart.scale.setScalar(0.55);
  for (const s of [1, -1]) {
    const wing = add(g, batWingGeo(), toon(0x9a3fd0), s * 0.9, 1.05, -0.25);
    wing.name = s > 0 ? 'wingR' : 'wingL';
    wing.rotation.y = s * 0.5;
    wing.scale.x = s;
  }
  mergeStatic(g);
  return g;
}

/**
 * A faceted energy barrier: a translucent icy geodesic bubble with a brighter lattice, radius 1,
 * hidden until the boss raises it. Callers scale it 1.4–1.7.
 */
export function makeShield(): THREE.Mesh {
  const shield = new THREE.Mesh(
    geo.ico(1, 2),
    new THREE.MeshLambertMaterial({ color: 0x9fe8ff, emissive: 0x3aa0ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.26, depthWrite: false, flatShading: true }),
  );
  shield.add(new THREE.Mesh(geo.ico(1.005, 2), new THREE.MeshBasicMaterial({ color: 0xd8f7ff, wireframe: true, transparent: true, opacity: 0.5, depthWrite: false })));
  const rim = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, side: THREE.BackSide, transparent: true, opacity: 0.18, depthWrite: false });
  shield.add(new THREE.Mesh(geo.sphere(1.04, 20, 14), rim));
  shield.visible = false;
  return shield;
}

/**
 * The Orchestrator: a hovering copper command pod with one stern red lens eye, a gold task ring of
 * glowing agent sockets, an antenna beacon, thrusters and a conductor's baton.
 */
export function makeOrchestrator(): THREE.Group {
  const g = new THREE.Group();
  const copper = () => toon(0xd0662e, 0x301000, 0.3);
  const hub = add(g, geo.sphere(1, 24, 16), copper(), 0, 0.9, 0);
  hub.scale.set(1.1, 0.72, 1);
  inkOutline(hub, 0.045);
  add(g, geo.cyl(1.11, 1.11, 0.12, 32), toon(0x3a2a24), 0, 0.9, 0).scale.z = 0.92;
  add(g, geo.torus(0.37, 0.05, 10, 28), toon(0x3a2a24), 0, 0.98, 0.93);
  place(g, eye(0.34, { iris: 0xff3048, lid: 'stern', lidMaterial: copper(), lidTilt: -0.3 }), 0, 0.98, 0.92);

  // The task ring orbits on a tilt, so from the level camera its front passes below the eye.
  const orbit = place(g, new THREE.Group(), 0, 0.9, 0);
  orbit.rotation.x = 0.4;
  const ring = add(orbit, geo.torus(1.35, 0.08, 8, 40), toon(0xffc64a, 0x604000, 0.35));
  ring.name = 'ring';
  ring.rotation.x = PI / 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    add(ring, geo.sphere(0.12, 12, 8), basic(0xff6a2a), Math.cos(a) * 1.35, Math.sin(a) * 1.35, 0);
  }

  add(g, geo.cyl(0.035, 0.05, 0.4, 8), basic(INK), 0, 1.56, 0);
  add(g, geo.sphere(0.09, 10, 8), basic(0xffd166), 0, 1.8, 0);
  add(g, geo.capsule(0.07, 0.28, 4, 8), copper(), 1.12, 0.98, 0.35).rotation.z = -0.9;
  add(g, geo.cyl(0.018, 0.018, 0.5, 6), basic(0xffffff), 1.4, 1.3, 0.42).rotation.z = -0.5;
  add(g, geo.sphere(0.035, 8, 6), toon(0xa0784a), 1.29, 1.1, 0.4);
  for (const [x, z] of [[-0.5, 0.2], [0.5, 0.2], [0, -0.4]]) {
    add(g, geo.cone(0.16, 0.22, 12), basic(INK), x, 0.36, z);
    add(g, geo.sphere(0.13, 12, 8), basic(0xffb347, 0.8), x, 0.22, z).scale.y = 0.5;
  }
  const shield = makeShield();
  shield.name = 'shield';
  shield.scale.setScalar(1.7);
  place(g, shield, 0, 0.9, 0);
  mergeStatic(g);
  return g;
}

/** A gear: ten teeth around a hole. */
const gearGeo = () =>
  extruded(
    'gear',
    () => {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2;
        const p = (PI * 2) / 10;
        for (const [da, r] of [[0, 0.4], [0.12, 0.5], [0.38, 0.5], [0.5, 0.4]] as const) pts.push([Math.cos(a + da * p) * r, Math.sin(a + da * p) * r]);
      }
      const s = polygon(pts);
      const hole = new THREE.Path();
      hole.absarc(0, 0, 0.12, 0, PI * 2, true);
      s.holes.push(hole);
      return s;
    },
    { depth: 0.12, bevelEnabled: false },
    true,
  );

/** The gauge: a white dial with its red needle pinned hard right. */
const gaugeTexture = () =>
  sharedTexture('gauge', 64, 64, (c, s) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = '#1d1424';
    c.lineWidth = 3;
    for (let i = 0; i <= 6; i++) {
      const a = PI * (0.85 + (i / 6) * 1.3);
      c.beginPath();
      c.moveTo(s / 2 + Math.cos(a) * 20, s / 2 + Math.sin(a) * 20);
      c.lineTo(s / 2 + Math.cos(a) * 27, s / 2 + Math.sin(a) * 27);
      c.stroke();
    }
    c.strokeStyle = '#e02030';
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(s / 2, s / 2);
    c.lineTo(s / 2 + 22, s / 2 + 6);
    c.stroke();
    c.fillStyle = '#1d1424';
    c.beginPath();
    c.arc(s / 2, s / 2, 5, 0, PI * 2);
    c.fill();
  });

/** "∞ CLIPS" on the counter. */
const counterTexture = () =>
  sharedTexture('clips', 128, 36, (c, w, h) => {
    c.fillStyle = '#1b1426';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd166';
    c.font = 'bold 26px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('∞ CLIPS', w / 2, h / 2 + 1);
  });

/**
 * The Paperclip Maximizer: a relentless gunmetal factory on hazard-striped treads, with one huge
 * unblinking eye, a hopper that swallows everything, a conveyor-lip mouth spitting clips, side
 * gears, smokestacks, and its idol, a paperclip turning on a spindle above.
 */
export function makePaperclipMaximizer(): THREE.Group {
  const g = new THREE.Group();
  const dark = () => toon(0x3c4250);
  const light = () => toon(0xc4ccda);
  const chassis = add(g, roundedBox(2.8, 2.0, 1.3, 0.22, 0.07), toon(0x8a93a6, 0x101420, 0.3), 0, 1.35, 0);
  inkOutline(chassis, 0.045);
  add(g, geo.box(2.6, 0.06, 1.1), light(), 0, 2.36, 0);
  add(g, geo.box(2.84, 0.2, 1.34), toonMap(0xffffff, hazardTexture(6)), 0, 0.5, 0);

  // One huge, unblinking eye with a tiny pupil.
  add(g, geo.torus(0.6, 0.09, 10, 28), dark(), 0, 1.65, 0.7);
  add(g, geo.sphere(0.56, 24, 16), basic(0xfff6d0), 0, 1.65, 0.66).scale.z = 0.35;
  add(g, geo.sphere(0.34, 16, 12), basic(0xffc43a), 0, 1.65, 0.8).scale.z = 0.3;
  add(g, geo.sphere(0.1, 10, 8), basic(INK), 0, 1.65, 0.86).scale.z = 0.5;
  add(g, geo.sphere(0.08, 8, 6), basic(0xffffff), -0.13, 1.79, 0.9);
  add(g, geo.sphere(0.04, 6, 4), basic(0xffffff), 0.1, 1.55, 0.9);
  add(g, geo.box(1.4, 0.16, 0.2), dark(), 0, 2.28, 0.68);

  // The output: a slot with a conveyor lip, clips sliding out of it.
  add(g, geo.box(1.5, 0.24, 0.1), basic(INK), 0, 0.8, 0.66);
  add(g, geo.box(1.6, 0.06, 0.3), light(), 0, 0.66, 0.8);
  for (const x of [-0.45, 0, 0.45]) {
    const clip = place(g, makePaperclip(0.35), x, 0.7, 0.92);
    clip.rotation.x = -1.15;
    clip.getObjectByName('feet')!.visible = false;
  }
  add(g, geo.cyl(0.16, 0.16, 0.04, 20), dark(), -0.98, 1.05, 0.68).rotation.x = PI / 2;
  add(g, geo.circle(0.14, 20), new THREE.MeshBasicMaterial({ map: gaugeTexture() }), -0.98, 1.05, 0.701);
  add(g, geo.plane(0.7, 0.2), new THREE.MeshBasicMaterial({ map: counterTexture() }), 0.95, 1.05, 0.66);

  for (const s of [-1, 1]) {
    const gear = add(g, gearGeo(), toon(0xffc43a, 0x604000, 0.3), s * 1.46, 1.45, 0);
    gear.name = s < 0 ? 'gearL' : 'gearR';
    gear.rotation.y = PI / 2;
    add(g, geo.cyl(0.14, 0.16, 0.6, 12), dark(), s * 1.05, 2.65, -0.3);
    add(g, roundedBox(0.9, 0.4, 1.6, 0.15), toon(0x2b2b30), s * 1.05, 0.2, 0);
    for (const dx of [-0.22, 0.22]) add(g, geo.cyl(0.11, 0.11, 0.04, 12), toon(0x9aa3b5), s * 1.05 + dx, 0.2, 0.81).rotation.x = PI / 2;
  }
  add(g, geo.sphere(0.14, 10, 8), toon(0xb0b6c2), 1.1, 3.1, -0.3);
  add(g, geo.sphere(0.1, 10, 8), toon(0xb0b6c2), 1.22, 3.34, -0.3);
  add(g, geo.cyl(0.95, 0.45, 0.6, 4, true), toon2(0x5b6272), 0, 2.65, 0).rotation.y = PI / 4;
  add(g, geo.cyl(0.5, 0.5, 0.02, 4), basic(INK), 0, 2.42, 0).rotation.y = PI / 4;

  add(g, geo.cyl(0.04, 0.04, 0.3, 8), basic(INK), 0, 2.9, 0);
  add(g, geo.cyl(0.2, 0.2, 0.04, 16), light(), 0, 3.0, 0);
  const clip = place(g, makePaperclip(2.2), 0, 3.0, 0);
  clip.name = 'clip';
  clip.getObjectByName('feet')!.visible = false;
  mergeStatic(g);
  return g;
}

/** Every enemy and boss mesh, for the `?debug&gallery=enemies` lineup. */
export function enemyGallery(): { name: string; mesh: THREE.Object3D }[] {
  const shy = makeGhost();
  shy.getObjectByName('hands')!.visible = true;
  const shield = new THREE.Group();
  place(shield, makeShield(), 0, 1, 0).visible = true;
  return [
    { name: 'Spambot', mesh: makeSpambot() },
    { name: 'Hot take', mesh: makeHotTake('hype') },
    { name: 'Backlash take', mesh: makeHotTake('backlash') },
    { name: 'Timeline', mesh: makeTimeline('hype') },
    { name: 'Timeline (backlash)', mesh: makeTimeline('backlash') },
    { name: 'Jailbreaker', mesh: makeJailbreaker() },
    { name: 'Injection piranha', mesh: makePiranha() },
    { name: 'Hallucination ghost', mesh: makeGhost() },
    { name: 'Ghost (shy)', mesh: shy },
    { name: 'Copyright claim', mesh: makeLawyer() },
    { name: 'Brief', mesh: makeBrief() },
    { name: 'Scroll', mesh: makeScroll() },
    { name: 'Rate limit', mesh: makeCrusher() },
    { name: 'Runaway agent', mesh: makeAgentDrone() },
    { name: 'Paperclip', mesh: makePaperclip(1.2) },
    { name: 'Shield', mesh: shield },
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
