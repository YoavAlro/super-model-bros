import * as THREE from 'three';
import type { BodyPlan, CharacterSpec, PlanColors } from '../config/characters';
import { labelSprite, makeHeartMesh } from './meshes';
import {
  bakeColors,
  bubbleShape,
  earShape,
  eyePair,
  frontZ,
  geo,
  ghostShape,
  gradient,
  group,
  hinge,
  lidOf,
  merged,
  part,
  pennant,
  pivot,
  place,
  pointerShape,
  pupilOf,
  solidColor,
  starShape,
  taperedTube,
  type V3,
} from './mascotKit';
import { blinkScale, ease, flick, hold, idleMoment, landingSquint, nextBlink, phaseOf, popIn, springWobble, strideRate } from './mascotMotion';
import { prefs } from './prefs';
import { mergeStatic } from './staticMerge';
import { INK, basic, brow, cachedGeo, inkOutline, makeEye, roundedBox, toon } from './toonKit';

/**
 * Meshes for the playable characters and friends: the seven model mascots, the helper, the crowd,
 * the reasoning cape and the GPT-4o ghost, plus `animateCharacter`, their optional per-frame idle life.
 *
 * Each mascot is a body plan (chosen, with its colours, by the character's `look` in
 * `src/config/characters.ts`), drawn in the shared toon style: three-band shading, glossy eyes, ink
 * outlines. The engine contract: about 1 unit tall, feet at y = 0, facing +z; one mesh named `body`
 * whose own material has `emissive` (star, tool and think glows); every material per-instance (clones
 * turn see-through); geometry shared through `cachedGeo`; `userData.top` is the highest part; the
 * reasoning cape hangs from (0, 0.72, -0.3), so nothing pokes through the back there, at rest or in
 * motion. The root is the engine's (it sets its scale and turn every frame): a mascot's parts sit in
 * an inner group named `pose`, which `animateCharacter` breathes, bounces and leans. Every builder
 * ends in `finish()`, which merges the static parts (`staticMerge.ts`): give a part a name to keep
 * it moving on its own.
 */

const PI = Math.PI;
type Mascot = Pick<CharacterSpec, 'id' | 'color' | 'accent' | 'look'>;
type Builder<P extends BodyPlan> = (c: Mascot, col: PlanColors[P], iris: number) => THREE.Group;
type Side = 1 | -1;
const SIDES = [-1, 1] as const;

/** A material whose big second-colour mass should glow with the body (Player collects these). */
const glowing = <M extends THREE.Material>(m: M): M => {
  m.userData.glow = true;
  return m;
};

/** A vertex-coloured toon material: every geometry drawn with it must carry a `color` attribute. */
const painted = () => {
  const m = toon(0xffffff);
  m.vertexColors = true;
  return m;
};

/**
 * An arm nub hanging from its shoulder: the capsule's centre lands at `centre`, tilted by `rz`, and
 * the pivot (named armL/armR for the limb animation) sits at its top end.
 */
function arm(s: Side, g: THREE.CapsuleGeometry, mat: THREE.Material, centre: V3, rz: number, ...extra: THREE.Object3D[]): THREE.Group {
  const half = g.parameters.height / 2 + g.parameters.radius;
  const p = hinge(part(g, mat, { at: centre, rot: [0, 0, rz] }), half, s < 0 ? 'armL' : 'armR');
  for (const e of extra) {
    e.position.sub(p.position);
    p.add(e);
  }
  return p;
}

/** A leg (and whatever hangs off it) swinging from a hip pivot, named legL/legR. */
const leg = (s: Side, hip: V3, ...kids: THREE.Object3D[]) => pivot(s < 0 ? 'legL' : 'legR', hip, ...kids);

/** Groups whose children the idle life moves one by one (bouncing dots, chest lights, spout drops). */
const EACH_CHILD = ['dots', 'lights', 'spout'];

/** The mascots' merge scopes: every named part, and each child of a group animated child by child. */
const ownScope = (o: THREE.Object3D) => o.name !== '' || EACH_CHILD.includes(o.parent?.name ?? '');

/**
 * Tags a built mascot and moves its parts into an inner group named 'pose' (unless `pose` is false):
 * the engine owns the root's scale and turn, so breathing, bounces and leans move the pose instead.
 * Then its static parts merge (`staticMerge.ts`): every named part keeps its own transform.
 */
function finish(g: THREE.Group, plan: string, top: number, pose = true): THREE.Group {
  if (pose) g.add(group({ name: 'pose' }, ...g.children));
  g.userData.plan = plan;
  g.userData.top = top;
  mergeStatic(g, { scope: ownScope });
  return g;
}

// ---------------------------------------------------------------- GPT

/**
 * A walking speech bubble, the famous hero: an eager grin, a bubble pointer that wags like a happy
 * tail, a sideways cowlick, and text lines on his back for the kart chase view. When he idles or
 * thinks, a little "typing…" bubble of his own pops up beside his head.
 */
const chatBubble: Builder<'chatBubble'> = (c, col, iris) => {
  const g = new THREE.Group();
  const B = toon(c.color);
  const bubble = cachedGeo('char:chatBubble:bubble', () =>
    new THREE.ExtrudeGeometry(bubbleShape(), { depth: 0.36, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 7 }).translate(0, 0, -0.18),
  );
  const body = part(bubble, B, { at: [0, 0.6, 0], name: 'body' });
  inkOutline(body, 0.02);
  // The pointer wags from the bubble's lower-right corner (its root stays buried in the body).
  const pointerGeo = cachedGeo('char:chatBubble:pointer', () =>
    new THREE.ExtrudeGeometry(pointerShape(), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 2 }).translate(0, 0, -0.15),
  );
  const pointerMesh = part(pointerGeo, B, { at: [0, 0.6, 0] });
  inkOutline(pointerMesh, 0.02);
  const pointer = pivot('pointer', [0.16, 0.46, 0], pointerMesh);
  // What a bubble is for: three lines of text across its back.
  const lines = cachedGeo('char:chatBubble:lines', () =>
    merged(
      ([
        [0.72, 0.3],
        [0.62, 0.36],
        [0.52, 0.2],
      ] as const).map(([y, len]) => ({ g: geo.capsule(0.022, len, 2, 6), at: [0.19 - len / 2, y, -0.242] as V3, rot: [0, 0, PI / 2] as V3, scale: [1, 1, 0.5] as V3 })),
    ),
  );
  const eyes = eyePair(0.095, 0.14, 0.68, 0.212, () => ({ iris, look: [0.1, 0.08] }));
  const brows = group({ name: 'brows' }, ...SIDES.map((s) => place(brow(0.1), { at: [s * 0.14, 0.8, 0.245], rot: [0, 0, -s * 0.1] })));
  const mouth = group(
    { name: 'mouth', at: [0, 0.5, 0.242] },
    part(geo.disc(0.075, 16, PI, PI), basic(INK)),
    part(geo.disc(0.036, 12, PI, PI), basic(col.tongue), { at: [0, -0.03, 0.002] }),
  );
  // His own "typing…" bubble: a mint pill with a little pointer down to his head, and three dots.
  const pillGeo = cachedGeo('char:chatBubble:pill', () =>
    merged([
      { g: geo.capsule(0.07, 0.17, 4, 12), rot: [0, 0, PI / 2], scale: [1, 1, 0.55] },
      { g: geo.cone(0.035, 0.07, 6), at: [0.07, -0.075, 0], rot: [0, 0, -2.6], scale: [1, 1, 0.55] },
    ]),
  );
  const dotMat = basic(col.legs);
  const dots = group(
    { name: 'dots', at: [-0.24, 1.0, 0.12], rot: [0, 0.25, 0.08], hidden: true },
    part(pillGeo, toon(col.lines)),
    ...[-0.075, 0, 0.075].map((x) => part(geo.sphere(0.026, 10, 8), dotMat, { at: [x, 0, 0.045], scale: [1, 1, 0.6] })),
  );
  const curl = cachedGeo('char:chatBubble:cowlick', () =>
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0.03, 0.09, 0.01), new THREE.Vector3(0.09, 0.13, -0.02), new THREE.Vector3(0.14, 0.1, -0.07)]),
      12,
      0.04,
      6,
    ),
  );
  const C = toon(col.curl);
  const cowlick = group({ name: 'cowlick', at: [0, 0.87, 0.02] }, part(curl, C), part(geo.sphere(0.04, 8, 6), C, { at: [0.14, 0.1, -0.07] }));
  const L = toon(col.legs);
  const shoe = toon(col.sneakers);
  const legs = SIDES.map((s) =>
    leg(
      s,
      [s * 0.14, 0.3, 0],
      part(geo.cylinder(0.055, 0.06, 0.18, 10), L, { at: [s * 0.14, 0.21, 0] }),
      part(roundedBox(0.2, 0.1, 0.27, 0.05, 0.03), shoe, { at: [s * 0.14, 0.06, 0.04] }),
      part(geo.box(0.21, 0.03, 0.28), L, { at: [s * 0.14, 0.015, 0.04] }),
    ),
  );
  const arms = SIDES.map((s) => arm(s, geo.capsule(0.065, 0.1, 4, 8), B, [s * 0.395, 0.44, 0.02], s * 0.66));
  g.add(body, pointer, part(lines, toon(col.lines)), eyes, brows, mouth, dots, cowlick, ...legs, ...arms);
  return finish(g, 'chatBubble', 1.04);
};

// ---------------------------------------------------------------- Claude

/**
 * The thoughtful brother: the tallest block, an ink face on a cream page, a quill tucked behind his
 * "ear" like a writer's pencil, and a long cream scarf (long context) knotted at the front, its long
 * end thrown down his side so it streams out like a flag through his long float.
 */
const scarfBlock: Builder<'scarfBlock'> = (c, col, iris) => {
  const g = new THREE.Group();
  const B = toon(c.color);
  const body = part(roundedBox(0.6, 0.88, 0.48, 0.16, 0.05), B, { at: [0, 0.57, 0], name: 'body' });
  inkOutline(body, 0.02);
  const P = toon(col.page);
  const page = part(roundedBox(0.46, 0.34, 0.04, 0.14, 0.015), P, { at: [0, 0.75, 0.25] });
  const eyes = eyePair(0.085, 0.12, 0.76, 0.245, () => ({ iris, look: [0.05, 0.1] }));
  const ink = basic(INK);
  const brows = group({ name: 'brows' }, ...SIDES.map((s) => part(geo.torus(0.045, 0.011, 4, 10, 0.8 * PI), ink, { at: [s * 0.12, 0.855, 0.275], rot: [0, 0, 0.1 * PI] })));
  const smile = part(geo.torus(0.05, 0.012, 6, 12, PI), ink, { at: [0, 0.665, 0.275], rot: [0, 0, PI], name: 'mouth' });
  const blushGeo = cachedGeo('char:scarfBlock:blush', () => merged(SIDES.map((s) => ({ g: new THREE.CircleGeometry(0.035, 12), at: [s * 0.19, 0, 0] as V3 }))));
  const blush = part(blushGeo, basic(col.blush), { at: [0, 0.69, 0.272] });
  // The scarf: a band wrapped round the block (a torus would be pierced by its corners), knotted at
  // the front right, with its long end thrown down his left side (clear of the cape).
  const band = part(roundedBox(0.68, 0.54, 0.12, 0.1, 0.03), P, { at: [0, 0.5, 0], rot: [PI / 2, 0, 0] });
  const stripe = toon(col.stripe);
  const tailLong = group(
    { name: 'tailLong', at: [-0.345, 0.54, -0.14] },
    part(roundedBox(0.035, 0.4, 0.13, 0.04, 0.012), P, { at: [-0.005, -0.2, 0] }),
    part(geo.box(0.04, 0.03, 0.135), stripe, { at: [-0.005, -0.32, 0] }),
  );
  const knotGeo = cachedGeo('char:scarfBlock:knot', () =>
    merged([
      { g: roundedBox(0.1, 0.18, 0.035, 0.035, 0.012), at: [0.01, -0.1, 0.01], rot: [0, 0, 0.12] },
      { g: new THREE.SphereGeometry(0.058, 10, 8).toNonIndexed(), scale: [1, 0.85, 0.7] },
    ]),
  );
  const tailShort = group({ name: 'tailShort', at: [0.19, 0.5, 0.28], rot: [0, 0, -0.12] }, part(knotGeo, P));
  // The quill behind his ear: it pokes up past the flat top at the right corner, a writer's pencil.
  const quill = group(
    { name: 'quill', at: [0.22, 0.91, -0.03], rot: [-0.3, 0, -0.78] },
    part(geo.sphere(0.06, 10, 6), toon(col.vane), { at: [0.01, 0.15, 0], scale: [1, 2.3, 0.35] }),
    part(geo.cylinder(0.016, 0.016, 0.3, 6), toon(col.spine), { at: [0, 0.1, 0] }),
  );
  const legMat = toon(col.legs);
  const legs = SIDES.map((s) => leg(s, [s * 0.14, 0.15, 0.02], part(roundedBox(0.15, 0.15, 0.2, 0.05, 0.03), legMat, { at: [s * 0.14, 0.075, 0.02] })));
  const arms = SIDES.map((s) => arm(s, geo.capsule(0.06, 0.1, 4, 8), B, [s * 0.34, 0.4, 0.04], s * 0.9));
  g.add(body, page, eyes, brows, smile, blush, band, tailLong, tailShort, quill, ...legs, ...arms);
  return finish(g, 'scarfBlock', 1.14);
};

// ---------------------------------------------------------------- Gemini

/**
 * The Gemini twins: two domes side by side, two personalities in one body. Each twin has one big
 * eye of its own colour (the multimodal eyes that spot hidden blocks), its own mouth and a five-point
 * star bobble on a curled stalk: the blue twin wide-eyed and chattering, the violet one calm and
 * content. The body blends from one twin's colour into the other's, with a bow at the back tying
 * them together. The twins bob out of step, blink a beat apart, and lean in to chat.
 */
const twinDomes: Builder<'twinDomes'> = (c, col, iris) => {
  const g = new THREE.Group();
  const M = painted();
  const blend = (x: number) => THREE.MathUtils.smoothstep(x * 1.08, -0.1, 0.1);
  const a = new THREE.Color(c.color);
  const b = new THREE.Color(col.twin);
  const key = `${c.color}:${col.twin}`;
  const bodyGeo = cachedGeo(`char:twinDomes:body:${key}`, () => bakeColors(new THREE.SphereGeometry(0.38, 24, 16), (p, out) => out.copy(a).lerp(b, blend(p.x))));
  const body = part(bodyGeo, M, { at: [0, 0.38, 0], scale: [1.08, 0.84, 0.78], name: 'body' });
  inkOutline(body, 0.02);
  const freckleMat = basic(col.freckles);
  const ink = basic(INK);
  // Each twin hinges at the base of its dome, so the chat moment leans the whole head in.
  const DOME_Y = 0.2;
  const twins = SIDES.map((s) => {
    const hex = s < 0 ? c.color : col.twin;
    const dome = part(cachedGeo(`char:twinDomes:dome:${hex}`, () => solidColor(new THREE.SphereGeometry(0.24, 20, 14), hex)), M, { at: [0, DOME_Y, 0], scale: [1, 1, 0.9] });
    inkOutline(dome, 0.02);
    // A few star freckles on each twin's outer cheek (round: no four-point sparkles).
    const freckles = cachedGeo(`char:twinDomes:freckles:${s}`, () =>
      merged(
        ([
          [0.15, 0.1, 0.016],
          [0.18, 0.02, 0.012],
          [0.1, 0.16, 0.012],
        ] as const).map(([x, y, r]) => ({ g: geo.sphere(r, 6, 4), at: [s * x, y, frontZ(s * x, y, [0, 0, 0], [0.24, 0.24, 0.216]) - 0.004] as V3 })),
      ),
    );
    // The blue twin is wide-eyed; the violet twin looks on with calm, content half-lids.
    const eyeOpts = s < 0 ? { iris, look: [0.12, 0.05] as [number, number] } : { iris: col.twinIris, lid: 'sleepy' as const, lidColor: col.twin, look: [-0.12, 0.05] as [number, number] };
    const eye = place(makeEye(0.092, { side: s > 0 ? -1 : 1, ...eyeOpts }), { at: [0, DOME_Y - 0.03, 0.188], name: 'eye' });
    const lid = lidOf(eye);
    if (lid) lid.rotation.x = 0.72;
    // Its own mouth under its eye: an excited 'o' for the blue twin, a small smile for the violet one.
    const mouth =
      s < 0
        ? part(geo.disc(0.038, 14), ink, { at: [0.01, DOME_Y - 0.16, 0.222], scale: [1, 1.2, 1], name: 'mouthL' })
        : part(geo.torus(0.045, 0.013, 4, 12, PI), ink, { at: [-0.01, DOME_Y - 0.13, 0.222], rot: [0, 0, PI], name: 'mouthR' });
    // A five-point star bobble on a curled stalk, leaning out from the top of the dome.
    const bobble = cachedGeo(`char:twinDomes:bobble:${hex}`, () =>
      merged([
        {
          g: solidColor(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0.02, 0.04, 0), new THREE.Vector3(-0.005, 0.08, 0), new THREE.Vector3(0, 0.1, 0)]), 8, 0.018, 5).toNonIndexed(),
            hex,
          ),
        },
        {
          g: solidColor(new THREE.ExtrudeGeometry(starShape(0.062), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 }).translate(0, 0, -0.015), col.freckles),
          at: [0, 0.14, 0],
        },
      ]),
    );
    const star = group({ at: [0, DOME_Y + 0.225, 0], rot: [0, 0, -s * 0.3] }, part(bobble, M, { name: s < 0 ? 'starL' : 'starR' }));
    return group({ name: s < 0 ? 'twinL' : 'twinR', at: [s * 0.19, 0.7 - DOME_Y, 0] }, dome, part(freckles, freckleMat, { at: [0, DOME_Y, 0] }), eye, mouth, star);
  });
  const blushGeo = cachedGeo('char:twinDomes:blush', () => merged(SIDES.map((s) => ({ g: geo.sphere(0.04, 8, 6), at: [s * 0.24, 0, 0] as V3, scale: [1.3, 0.7, 0.3] as V3 }))));
  const blush = part(blushGeo, basic(col.blush), { at: [0, 0.51, 0.225] });
  const arms = SIDES.map((s) => {
    const hex = s < 0 ? c.color : col.twin;
    const capsule = cachedGeo(`char:twinDomes:arm:${hex}`, () => solidColor(new THREE.CapsuleGeometry(0.06, 0.09, 4, 8), hex));
    return arm(s, capsule, M, [s * 0.405, 0.34, 0.03], s * 0.6);
  });
  const feetMat = toon(col.feet);
  const legs = SIDES.map((s) => leg(s, [s * 0.16, 0.16, 0.05], part(geo.sphere(0.1, 12, 8), feetMat, { at: [s * 0.16, 0.05, 0.05], scale: [1.1, 0.5, 1.3] })));
  // A bow at the back ties the twins together; the cape's clasp lands on its knot.
  const bow = cachedGeo('char:twinDomes:bow', () =>
    merged([
      { g: geo.sphere(0.06, 10, 8), at: [0, 0, 0], scale: [1, 0.85, 0.9] },
      ...SIDES.map((s) => ({ g: geo.sphere(0.07, 10, 8), at: [s * 0.085, 0.01, 0.01] as V3, rot: [0, 0, s * 0.35] as V3, scale: [1.2, 0.7, 0.55] as V3 })),
    ]),
  );
  g.add(body, ...twins, blush, ...arms, ...legs, part(bow, toon(col.bow), { at: [0, 0.73, -0.19] }));
  return finish(g, 'twinDomes', 1.12);
};

// ---------------------------------------------------------------- Llama

/**
 * An upright plush llama, unbothered: a low purple wool body, a long cream "bottle neck", a big
 * cream head with a long snout under a too-cool wool fringe, splayed banana ears, and a gold
 * dumbbell charm on its collar (open weights). Friends stand on its woolly top-knot when it leaves
 * a copy of itself behind. It chews while it waits, lets its lids droop, and now and then a puff of
 * its wool floats off to share.
 */
const openLlama: Builder<'openLlama'> = (c, col, iris) => {
  const g = new THREE.Group();
  const W = toon(c.color);
  const C = glowing(toon(col.cream));
  const body = part(geo.sphere(0.3, 18, 12), W, { at: [0, 0.28, 0], scale: [1.05, 0.76, 0.9], name: 'body' });
  inkOutline(body, 0.02);
  // Lumpy wool round the edge of the body, and a mane up the back of the neck (the cape clasp lands on it).
  const woolGeo = cachedGeo('char:openLlama:wool', () =>
    merged(
      ([
        [-0.27, 0.3, 0.02, 0.115, 1],
        [0.27, 0.3, 0.02, 0.115, 1],
        [-0.16, 0.44, 0, 0.11, 1],
        [0.16, 0.44, 0, 0.11, 1],
        [0, 0.64, -0.115, 0.115, 1.8],
        [0, 0.38, 0.17, 0.1, 1],
        [-0.19, 0.13, 0.1, 0.095, 1],
        [0.19, 0.13, 0.1, 0.095, 1],
      ] as const).map(([x, y, z, r, tall]) => ({ g: geo.sphere(r, 10, 7), at: [x, y, z] as V3, scale: [1, tall, 0.95] as V3 })),
    ),
  );
  const collar = part(geo.torus(0.1, 0.03, 6, 16), toon(col.collar), { at: [0, 0.53, 0.04], rot: [PI / 2 + 0.12, 0, 0] });
  // Round plates so the charm reads as a dumbbell at play size, not a letter H.
  const bell = cachedGeo('char:openLlama:dumbbell', () =>
    merged([
      { g: geo.cylinder(0.014, 0.014, 0.14, 6), rot: [0, 0, PI / 2] },
      ...SIDES.map((s) => ({ g: geo.sphere(0.042, 10, 8), at: [s * 0.075, 0, 0] as V3, scale: [0.8, 1, 1] as V3 })),
    ]),
  );
  const charm = pivot('charm', [0, 0.525, 0.14], part(bell, toon(col.charm), { at: [0, 0.455, 0.275] }));
  // The long cream "bottle neck" that makes it a llama, then a big head with a long snout.
  const neck = part(geo.capsule(0.09, 0.24, 4, 10), C, { at: [0, 0.64, 0.05], rot: [0.12, 0, 0] });
  const head = part(geo.sphere(0.195, 16, 12), C, { at: [0, 0.83, 0.1], scale: [1.05, 0.85, 1.05] });
  inkOutline(head, 0.02);
  // The top-knot and a shaggy fringe falling over the forehead (over the top of the left eye).
  const tuftGeo = cachedGeo('char:openLlama:tuft', () =>
    merged(
      ([
        [0, 0, 0, 0.1, [1.35, 0.5, 1.1]],
        [-0.085, -0.025, 0.2, 0.068, [1, 0.9, 1]],
        [0, -0.005, 0.15, 0.064, [1, 0.9, 0.8]],
        [0.075, 0.005, 0.12, 0.058, [1, 0.9, 0.8]],
      ] as const).map(([x, y, z, r, sc]) => ({ g: geo.sphere(r, 10, 7), at: [x, y, z] as V3, scale: sc as V3 })),
    ),
  );
  // Kept low: riders stand on a copy's head at 0.95 (HeadPlatform), so the knot only just pokes above it.
  const tuft = part(tuftGeo, W, { at: [0, 0.975, 0.08], name: 'tuft' });
  const ink = basic(INK);
  const nostrils = cachedGeo('char:openLlama:nostrils', () => merged(SIDES.map((s) => ({ g: geo.sphere(0.017, 6, 4), at: [s * 0.04, 0.03, 0.128] as V3 }))));
  const snout = group(
    { name: 'snout', at: [0, 0.76, 0.27] },
    part(geo.sphere(0.12, 14, 10), toon(col.snout), { scale: [1.05, 0.72, 1.1] }),
    part(nostrils, ink),
    part(geo.torus(0.038, 0.011, 4, 10, PI), ink, { at: [0, -0.025, 0.126], rot: [0, 0, PI], name: 'mouth' }),
  );
  // Eyes open at rest; the sleepy lids only droop in its unbothered idle moments.
  const eyes = eyePair(0.075, 0.105, 0.875, 0.252, () => ({ iris, lid: 'sleepy', lidColor: col.cream, look: [0.05, 0] }));
  for (const e of eyes.children) place(lidOf(e)!, { name: 'lid', hidden: true });
  // Banana ears, splayed out: they lean out, then curve back in to a point.
  const earCurve = (dz: number, top: number) =>
    new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.03, dz), new THREE.Vector3(0.045, 0.06, dz), new THREE.Vector3(0.06, top * 0.6, dz), new THREE.Vector3(0.03, top, dz + 0.005)]);
  const earGeo = cachedGeo('char:openLlama:ear', () =>
    mergeTip(new THREE.TubeGeometry(earCurve(0, 0.16), 10, 0.05, 8), new THREE.SphereGeometry(0.05, 8, 6).scale(1, 1.5, 1).rotateZ(0.45).translate(0.012, 0.17, 0.005)),
  );
  const innerGeo = cachedGeo('char:openLlama:innerEar', () => new THREE.TubeGeometry(earCurve(0.035, 0.15), 10, 0.022, 6));
  const inner = toon(col.innerEar);
  const ears = SIDES.map((s) =>
    group({ name: s < 0 ? 'earL' : 'earR', at: [s * 0.12, 0.915, 0.06], rot: [-0.1, 0, -s * 0.32], scale: [s, 1, 0.5] }, part(earGeo, C), part(innerGeo, inner)),
  );
  // Open weights: a puff of wool that floats off its flank now and then, shared with the world.
  const puff = part(geo.sphere(0.06, 10, 7), W, { at: [0.23, 0.4, 0.14], name: 'puff' });
  const hoof = toon(col.hooves);
  const legs = SIDES.map((s) =>
    leg(s, [s * 0.12, 0.16, 0.03], part(geo.cylinder(0.06, 0.065, 0.12, 10), C, { at: [s * 0.12, 0.1, 0.03] }), part(geo.cylinder(0.068, 0.078, 0.08, 10), hoof, { at: [s * 0.12, 0.04, 0.04], scale: [1, 1, 1.2] })),
  );
  g.add(body, part(woolGeo, W), collar, charm, neck, head, tuft, snout, eyes, ...ears, puff, ...legs);
  return finish(g, 'openLlama', 1.15);
};

// ---------------------------------------------------------------- DeepSeek

/** DeepSeek's gumdrop profile (radius, height), smoothed; its surface helpers live on it. */
const WHALE = (() => {
  const curve = new THREE.SplineCurve(
    ([
      [0, 0.05],
      [0.3, 0.12],
      [0.38, 0.3],
      [0.42, 0.52],
      [0.4, 0.66],
      [0.3, 0.82],
      [0.15, 0.9],
      [0, 0.93],
    ] as const).map(([r, y]) => new THREE.Vector2(r, y)),
  );
  const dense = curve.getPoints(160);
  /** The body's radius at height y (before its 0.72 depth squash). */
  const radius = (y: number) => {
    for (let i = 1; i < dense.length; i++) {
      const a = dense[i - 1];
      const b = dense[i];
      if (y <= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / Math.max(1e-6, b.y - a.y);
    }
    return 0;
  };
  /** A point on the body's surface at (azimuth phi from the front, height y), pushed out by `lift`. */
  const at = (phi: number, y: number, lift = 0, out = new THREE.Vector3()) => {
    const r = radius(y) + lift;
    return out.set(r * Math.sin(phi), y, 0.03 + 0.72 * r * Math.cos(phi));
  };
  /** The throat's top edge: a long whale mouth line, low at the chin and rising to the cheeks. */
  const PHI = 1.2;
  const mouthY = (phi: number) => 0.45 + 0.15 * (phi / PHI) ** 2;
  return { profile: curve.getPoints(16), radius, at, PHI, mouthY };
})();

/**
 * An upright whale calf, cheerful and quietly quick: a cobalt gumdrop with a long whale mouth line
 * from cheek to cheek over a pale grooved throat, wide-set eyes, flippers, its tail curled round its
 * hip with the flukes standing up by its foot, and a three-droplet spout that puffs faster as it
 * sprints (more speed on less compute).
 */
const whaleCalf: Builder<'whaleCalf'> = (c, col, iris) => {
  const g = new THREE.Group();
  const lathe = cachedGeo('char:whaleCalf:body', () => new THREE.LatheGeometry(WHALE.profile, 28));
  const body = part(lathe, toon(c.color), { at: [0, 0, 0.03], scale: [1, 1, 0.72], name: 'body' });
  inkOutline(body, 0.02);
  // The pale belly, a skin laid exactly over the body's front below the smile.
  const BELLY_PHI = 0.95;
  const throatGeo = cachedGeo('char:whaleCalf:throat', () => {
    const cols = 18;
    const rows = 10;
    const pos: number[] = [];
    const index: number[] = [];
    const v = new THREE.Vector3();
    for (let i = 0; i <= cols; i++) {
      const phi = -BELLY_PHI + (2 * BELLY_PHI * i) / cols;
      // The top edge follows the smile a little below it, leaving a blue lip between them.
      const top = WHALE.mouthY(phi * (WHALE.PHI / BELLY_PHI) * 0.9) - 0.07;
      for (let j = 0; j <= rows; j++) {
        WHALE.at(phi, 0.1 + ((top - 0.1) * j) / rows, 0.006, v);
        pos.push(v.x, v.y, v.z);
        if (i < cols && j < rows) {
          const a = i * (rows + 1) + j;
          const b = a + rows + 1;
          index.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const t = new THREE.BufferGeometry();
    t.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    t.setIndex(index);
    t.computeVertexNormals();
    return t;
  });
  const throat = part(throatGeo, glowing(toon(col.belly)));
  const surfaceCurve = (pts: [number, number][], lift: number) => new THREE.CatmullRomCurve3(pts.map(([phi, y]) => WHALE.at(phi, y, lift)));
  // The long mouth line along the throat's top edge, and the grooves striping a whale's pale belly.
  const mouthGeo = cachedGeo('char:whaleCalf:mouth', () =>
    new THREE.TubeGeometry(surfaceCurve(Array.from({ length: 13 }, (_, i) => { const phi = -1.12 + (2.24 * i) / 12; return [phi, WHALE.mouthY(phi) + 0.004]; }), 0.012), 36, 0.013, 5),
  );
  const mouth = part(mouthGeo, basic(INK), { name: 'mouth' });
  const grooveGeo = cachedGeo('char:whaleCalf:grooves', () =>
    merged(
      ([
        [0.32, 0.62],
        [0.245, 0.66],
        [0.17, 0.6],
      ] as const).map(([y, w]) => ({
        g: new THREE.TubeGeometry(surfaceCurve(Array.from({ length: 7 }, (_, i) => [-w + (2 * w * i) / 6, y] as [number, number]), 0.01), 16, 0.011, 4),
      })),
    ),
  );
  const grooves = part(grooveGeo, toon(col.pleats));
  // Wide-set eyes just above the mouth's ends, as a whale's are.
  const eyes = eyePair(0.08, 0.19, 0.64, 0.262, () => ({ iris, look: [0.1, 0.05] }));
  const brows = group({ name: 'brows' }, ...SIDES.map((s) => place(brow(0.08), { at: [s * 0.19, 0.755, 0.252], rot: [0, s * 0.3, -s * 0.1] })));
  const D = toon(col.dark);
  const blowhole = part(geo.torus(0.045, 0.015, 6, 14), D, { at: [0, 0.915, 0.01], rot: [PI / 2, 0, 0] });
  const drop = basic(col.droplets);
  const spout = group(
    { name: 'spout', at: [0, 0.92, 0.01] },
    ...([
      [0, 0.145, 0],
      [-0.075, 0.1, 0.65],
      [0.075, 0.1, -0.65],
    ] as const).map(([x, y, rz], i) => part(geo.sphere(0.042, 10, 8), drop, { at: [x, y, 0], rot: [0, 0, rz], scale: [0.85, 1.3, 0.85], name: `drop${i}` })),
  );
  const F = glowing(toon(col.fins));
  const fins = SIDES.map((s) => hinge(part(geo.sphere(0.13, 12, 8), F, { at: [s * 0.38, 0.38, 0.06], rot: [0, 0, s * 0.66], scale: [0.4, 1, 0.28] }), 0.13, s < 0 ? 'armL' : 'armR'));
  // The tail wraps round the right hip from behind; the flukes stand up by the right foot.
  const stockGeo = cachedGeo('char:whaleCalf:stock', () =>
    taperedTube(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.11, -0.1),
        new THREE.Vector3(0.22, 0.1, -0.18),
        new THREE.Vector3(0.36, 0.1, 0),
        new THREE.Vector3(0.34, 0.11, 0.19),
        new THREE.Vector3(0.29, 0.14, 0.28),
      ]),
      20,
      0.075,
      0.04,
      8,
      (_, out) => out.setHex(0xffffff),
    ),
  );
  const stock = part(stockGeo, F);
  const flukeGeo = cachedGeo('char:whaleCalf:flukes', () => merged(SIDES.map((s) => ({ g: geo.sphere(0.11, 12, 8), at: [s * 0.09, 0, 0] as V3, rot: [0, s * 0.55, 0] as V3, scale: [1.1, 0.28, 0.6] as V3 }))));
  const flukeMesh = part(flukeGeo, F, { at: [0.29, 0.21, 0.3], rot: [1.3, -0.35, -0.12], scale: 0.9 });
  flukeMesh.rotation.order = 'ZYX'; // stand the flukes up first, then turn and lean them
  inkOutline(flukeMesh, 0.016);
  const flukes = pivot('flukes', [0.29, 0.14, 0.28], flukeMesh);
  const legs = SIDES.map((s) => leg(s, [s * 0.14, 0.14, 0.1], part(geo.sphere(0.09, 10, 8), D, { at: [s * 0.14, 0.045, 0.1], scale: [1.1, 0.5, 1.3] })));
  g.add(body, throat, grooves, mouth, eyes, brows, blowhole, spout, ...fins, stock, flukes, ...legs);
  return finish(g, 'whaleCalf', 1.12);
};

// ---------------------------------------------------------------- Mistral

/**
 * A breezy cat in a smooth sunset gradient (the mistral is a wind; Le Chat is French for the cat):
 * a forehead tuft, cheek ruffs and ears all swept back by its own breeze, a red neckerchief, and a
 * long tapering tail that runs low behind its heels and winds up into a little whirlwind with wisps
 * of wind circling it. The tail swishes while it waits and streams flat when it air-dashes.
 */
const galeCat: Builder<'galeCat'> = (c, col, iris) => {
  const g = new THREE.Group();
  const M = painted();
  const key = `${c.color}:${col.mid}:${col.crown}`;
  const tone = gradient([
    [0.1, c.color],
    [0.6, col.mid],
    [0.95, col.crown],
  ]);
  const byHeight = (name: string, make: () => THREE.BufferGeometry, at: Parameters<typeof bakeColors>[2]) =>
    cachedGeo(`char:galeCat:${name}:${key}`, () => bakeColors(make(), (p, out) => tone(p.y, out), at));
  const headAt = { at: [0, 0.68, 0.02] as V3, scale: [1.1, 0.92, 0.85] as V3 };
  const body = part(byHeight('head', () => new THREE.SphereGeometry(0.31, 22, 16), headAt), M, { ...headAt, name: 'body' });
  inkOutline(body, 0.02);
  const torsoAt = { at: [0, 0.26, 0] as V3, scale: [1, 1, 0.85] as V3 };
  const torso = part(byHeight('torso', () => new THREE.CapsuleGeometry(0.18, 0.1, 4, 12), torsoAt), M, torsoAt);
  const K = toon(col.cream);
  const innerGeo = cachedGeo('char:galeCat:innerEar', () => new THREE.ExtrudeGeometry(earShape(0.11, 0.12), { depth: 0.01, bevelEnabled: false }));
  const ears = SIDES.map((s) => {
    const at = { at: [s * 0.18, 0.86, -0.05] as V3, rot: [-0.3, 0, -s * 0.22] as V3 };
    const earGeo = byHeight(`ear${s}`, () => new THREE.ExtrudeGeometry(earShape(0.22, 0.22), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), at);
    const ear = part(earGeo, M, { ...at, name: s < 0 ? 'earL' : 'earR' });
    ear.add(part(innerGeo, K, { at: [0, 0.03, 0.085] }));
    return ear;
  });
  const muzzle = part(geo.sphere(0.11, 14, 10), K, { at: [0, 0.58, 0.25], scale: [1.35, 0.8, 0.55] });
  const nose = part(geo.cone(0.028, 0.03, 3), basic(col.nose), { at: [0, 0.615, 0.305], rot: [0, PI, PI] });
  const ink = basic(INK);
  const mouthGeo = cachedGeo('char:galeCat:mouth', () => merged(SIDES.map((s) => ({ g: geo.torus(0.02, 0.007, 4, 8, PI), at: [s * 0.02, 0, 0] as V3, rot: [0, 0, PI] as V3 }))));
  const mouth = part(mouthGeo, ink, { at: [0, 0.57, 0.305], name: 'mouth' });
  const eyes = eyePair(0.09, 0.13, 0.72, 0.235, () => ({ iris, look: [0.15, 0.05] }));
  // A soft oval cat pupil (never a slit: that reads sly).
  for (const e of eyes.children) pupilOf(e)?.scale.set(0.6, 1, 0.35);
  // Fur swept back by its own breeze: a three-spike forehead tuft and cheek ruffs.
  const furGeo = cachedGeo(`char:galeCat:fur:${key}`, () =>
    bakeColors(
      merged([
        ...([
          [-0.04, 0.1, 0.25],
          [0, 0.13, 0],
          [0.04, 0.1, -0.25],
        ] as const).map(([x, h, rz]) => ({ g: geo.cone(0.04, h, 8), at: [0.02 + x, 0.96 + h * 0.3, 0.02] as V3, rot: [-0.6, 0, 0.3 + rz] as V3 })),
        ...SIDES.flatMap((s) =>
          ([
            [0.35, 0.63, 0.15],
            [0.32, 0.55, 0.6],
          ] as const).map(([x, y, down]) => ({ g: geo.cone(0.05, 0.1, 8), at: [s * x, y, 0] as V3, rot: [0, s * 0.5, -s * (PI / 2 + down)] as V3, scale: [1, 1, 0.5] as V3 })),
        ),
      ]),
      (p, out) => tone(p.y, out),
    ),
  );
  const fur = part(furGeo, M);
  const whiskers = cachedGeo('char:galeCat:whiskers', () =>
    merged(SIDES.flatMap((s) => ([[0.575, -0.08], [0.605, 0.08]] as const).map(([y, r]) => ({ g: geo.box(0.13, 0.008, 0.008), at: [s * 0.21, y, 0.225] as V3, rot: [0, 0, s * r] as V3 })))),
  );
  const kerchiefGeo = cachedGeo('char:galeCat:kerchief', () => new THREE.ExtrudeGeometry(pennant(0.22, 0.14), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 }));
  const kerchief = part(kerchiefGeo, toon(col.scarf), { at: [0, 0.44, 0.15], name: 'kerchief' });
  // The gust tail, painted from the body's colour to its bright tip and tapering: low along the
  // ground (under the cape's lowest swing), then winding up into a whirlwind behind the cape's reach.
  const along = gradient([
    [0, c.color],
    [0.3, col.mid],
    [0.65, col.crown],
    [0.9, col.tail],
    [1, col.tailTip],
  ]);
  const tailGeo = cachedGeo(`char:galeCat:tail:${key}`, () => taperedTube(new THREE.CatmullRomCurve3(tailPoints()), 80, 0.046, 0.024, 7, (u, out) => along(u, out)));
  // Wisps of wind circling the curl (they turn at rest; see TAIL_WHIRL_Z for why radius 0.17).
  const wispGeo = cachedGeo('char:galeCat:wisps', () =>
    merged([
      { g: geo.torus(0.17, 0.011, 4, 18, 2.1), rot: [0, PI / 2, 0] },
      { g: geo.torus(0.17, 0.011, 4, 18, 0.9), rot: [PI, PI / 2, 0] },
    ]),
  );
  const wisps = part(wispGeo, basic(0xffffff), { at: [0, TAIL_WHIRL_Y, TAIL_WHIRL_Z], name: 'wisps' });
  const tail = group({ name: 'tail', at: [0, 0.14, -0.12] }, part(tailGeo, M), wisps);
  const arms = SIDES.map((s) => pivot(s < 0 ? 'armL' : 'armR', [s * 0.19, 0.38, 0.06], part(geo.sphere(0.065, 10, 8), K, { at: [s * 0.23, 0.3, 0.08] })));
  const legs = SIDES.map((s) => leg(s, [s * 0.11, 0.15, 0.05], part(geo.sphere(0.085, 10, 8), K, { at: [s * 0.11, 0.047, 0.05], scale: [1, 0.55, 1.3] })));
  const windGeo = cachedGeo('char:galeCat:wind', () =>
    merged([
      { g: geo.torus(0.1, 0.012, 4, 12, 2.4), at: [0, 0.84, -0.42] },
      { g: geo.torus(0.1, 0.012, 4, 12, 2.4), at: [0, 1.0, -0.34], rot: [0, 0, 0.6] },
    ]),
  );
  const wind = part(windGeo, basic(0xffffff), { name: 'wind', hidden: true });
  g.add(body, torso, ...ears, fur, muzzle, nose, mouth, eyes, part(whiskers, ink), kerchief, tail, ...arms, ...legs, wind);
  return finish(g, 'galeCat', 1.08);
};

/** A tube with a rounded point on its end, as one geometry (both are indexed with the same attributes). */
function mergeTip(tube: THREE.BufferGeometry, tip: THREE.BufferGeometry): THREE.BufferGeometry {
  return merged([{ g: tube }, { g: tip }]);
}

/**
 * Where Mistral's tail curl stands, back along the tail from its root (world z -0.92). Its wind wisp
 * circles it at radius 0.17: the orbit's nearest point stays about 0.61 from the cape pivot, beyond
 * the cloth's reach (0.6 with its curved hem) at every swing.
 */
const TAIL_WHIRL_Z = -0.8;

/** The height of the curl's centre above the tail root. */
const TAIL_WHIRL_Y = 0.08;

/**
 * Mistral's tail, relative to its root behind the torso: out low along -z, then a gust curl that
 * rolls back, up and over, winding inward. The curl stands in the side (yz) plane, so at the
 * engine's ±0.55 yaw it is seen at the same slant either way: a curling tail, never a flat numeral.
 */
function tailPoints(): THREE.Vector3[] {
  const pts = [new THREE.Vector3(0, 0, 0.03), new THREE.Vector3(0, -0.065, -0.16), new THREE.Vector3(0, -0.092, -0.36), new THREE.Vector3(0, -0.092, -0.56), new THREE.Vector3(0, -0.08, -0.7)];
  const n = 30;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const a = -PI / 2 + u * 2.5 * PI;
    const r = 0.125 - 0.085 * u;
    pts.push(new THREE.Vector3(0.03 * u, TAIL_WHIRL_Y + r * Math.sin(a), TAIL_WHIRL_Z - r * Math.cos(a)));
  }
  return pts;
}

// ---------------------------------------------------------------- Grok

/**
 * A cheeky space cadet (Heinlein's word for deep understanding; the Hitchhiker's Guide): a big grey
 * bubble helmet whose glossy black visor holds a little galaxy, one raised brow, a sly wink and a
 * lopsided smirk, one jaunty cyan-tipped antenna, and a towel slung over his shoulder. Now and then
 * he sticks out a thumb, hitching a ride. Playful, never mean.
 */
const spaceCadet: Builder<'spaceCadet'> = (c, col, iris) => {
  const g = new THREE.Group();
  const body = part(geo.sphere(0.34, 22, 16), toon(c.color), { at: [0, 0.68, 0.03], scale: [1.04, 0.95, 0.82], name: 'body' });
  inkOutline(body, 0.02);
  const visor = part(geo.sphere(0.3, 20, 12), toon(col.visor), { at: [0, 0.69, 0.175], scale: [1, 0.72, 0.5] });
  const glintGeo = cachedGeo('char:spaceCadet:glint', () => new THREE.TorusGeometry(0.24, 0.014, 4, 14, 0.8).rotateZ(1.95));
  const white = basic(0xffffff);
  const glint = part(glintGeo, white, { at: [0, 0.69, 0.272], scale: [1, 0.75, 1], name: 'visorGlint' });
  // The galaxy in his visor: a scatter of white and cyan stars and one ringed planet, clear of the face.
  const visorAt: V3 = [0, 0.69, 0.175];
  const visorR: V3 = [0.3, 0.216, 0.15];
  const onVisor = (x: number, y: number): V3 => [x, y, frontZ(x, y, visorAt, visorR) + 0.004];
  const galaxyGeo = cachedGeo(`char:spaceCadet:galaxy:${col.light}`, () =>
    merged([
      ...([
        [-0.23, 0.72, 0.011, 0xffffff],
        [-0.19, 0.62, 0.008, col.light],
        [-0.02, 0.84, 0.009, 0xffffff],
        [0.08, 0.86, 0.008, col.light],
        [0.23, 0.76, 0.012, 0xffffff],
        [0.25, 0.66, 0.008, col.light],
        [-0.13, 0.57, 0.009, 0xffffff],
      ] as const).map(([x, y, r, hex]) => ({ g: solidColor(new THREE.SphereGeometry(r, 6, 4), hex), at: onVisor(x, y) })),
      { g: solidColor(new THREE.SphereGeometry(0.022, 10, 8), 0xffc07a), at: onVisor(0.18, 0.585) },
      { g: solidColor(new THREE.TorusGeometry(0.036, 0.006, 4, 16), 0xffe2b0), at: onVisor(0.18, 0.585), rot: [1.2, 0.3, 0.4] },
    ]),
  );
  const galaxyMat = basic(0xffffff);
  galaxyMat.vertexColors = true;
  const galaxy = part(galaxyGeo, galaxyMat);
  const eyes = eyePair(0.075, 0.11, 0.72, 0.29, (s) => (s < 0 ? { iris, look: [0.1, 0.05] } : { iris, lid: 'sly', lidColor: col.visor, look: [0.1, 0.05] }));
  const browGeo = geo.box(0.08, 0.018, 0.015);
  const brows = group({ name: 'brows' }, part(browGeo, white, { at: [-0.11, 0.82, 0.288], rot: [0, 0, 0.2], name: 'browUp' }), part(browGeo, white, { at: [0.11, 0.8, 0.29], rot: [0, 0, -0.06] }));
  const smirk = part(geo.torus(0.055, 0.012, 4, 10, 1.5), white, { at: [0.03, 0.625, 0.305], rot: [0, 0, PI + 0.5], name: 'mouth' });
  const S = glowing(toon(col.suit));
  const antenna = hinge(
    group({ at: [0.12, 1.0, -0.02], rot: [0, 0, -0.35] }, part(geo.cylinder(0.014, 0.014, 0.16, 6), S), part(geo.sphere(0.04, 10, 8), basic(col.light), { at: [0, 0.09, 0], name: 'antennaTip' })),
    -0.08,
    'antenna',
  );
  const T = toon(col.trim);
  const seal = part(geo.torus(0.2, 0.045, 8, 22), T, { at: [0, 0.42, 0.01], rot: [PI / 2, 0, 0] });
  const suit = part(roundedBox(0.48, 0.34, 0.4, 0.13, 0.04), S, { at: [0, 0.26, 0] });
  const lights = group(
    { name: 'lights' },
    ...[col.light, 0xffffff, c.color].map((hex, i) => part(geo.sphere(0.022, 8, 6), basic(hex), { at: [-0.12 + i * 0.06, 0.3, 0.205] })),
  );
  // The towel, slung over his right shoulder: a fringed front drop that flaps, and a back drop
  // lying flat on the suit (inside the cape's keep-out).
  const fringe = (y: number, z: number) => [-0.045, -0.015, 0.015, 0.045].map((x) => ({ g: new THREE.BoxGeometry(0.022, 0.045, 0.02).toNonIndexed(), at: [x, y, z] as V3 }));
  const towelMat = toon(col.towel);
  const frontGeo = cachedGeo('char:spaceCadet:towelFront', () => merged([{ g: roundedBox(0.14, 0.26, 0.03, 0.03, 0.01) }, ...fringe(-0.15, 0)]));
  const bandGeo = cachedGeo('char:spaceCadet:bands', () => merged([-0.06, 0.05].map((y) => ({ g: geo.box(0.145, 0.028, 0.035), at: [0, y, 0] as V3 }))));
  const towel = hinge(group({ at: [0.14, 0.3, 0.215], rot: [0, 0, -0.1] }, part(frontGeo, towelMat), part(bandGeo, toon(col.bands))), 0.13, 'towel');
  const backGeo = cachedGeo('char:spaceCadet:towelBack', () => merged([{ g: roundedBox(0.14, 0.2, 0.03, 0.03, 0.01) }, ...fringe(-0.12, 0)]));
  const towelBack = part(backGeo, towelMat, { at: [0.14, 0.34, -0.215], rot: [0, 0, 0.05] });
  const mitt = toon(col.mitts);
  // Hitching a ride: a thumb that pops up from the right mitt in his idle moment.
  const thumb = part(geo.capsule(0.024, 0.05, 4, 6), mitt, { at: [0.4, 0.26, 0.04], rot: [0, 0, -1.0], name: 'thumb', hidden: true });
  const arms = SIDES.map((s) =>
    arm(s, geo.capsule(0.06, 0.1, 4, 8), S, [s * 0.29, 0.28, 0.02], s * 0.55, part(geo.sphere(0.065, 10, 8), mitt, { at: [s * 0.34, 0.2, 0.04] }), ...(s > 0 ? [thumb] : [])),
  );
  const legs = SIDES.map((s) => leg(s, [s * 0.12, 0.14, 0.03], part(roundedBox(0.2, 0.12, 0.27, 0.06, 0.03), T, { at: [s * 0.12, 0.06, 0.03] })));
  const patch = part(geo.disc(0.035, 12), toon(col.patch), { at: [-0.17, 0.33, 0.203] });
  g.add(body, visor, glint, galaxy, eyes, brows, smirk, antenna, seal, suit, lights, towel, towelBack, patch, ...arms, ...legs);
  return finish(g, 'spaceCadet', 1.12);
};

const BUILDERS: { [P in BodyPlan]: Builder<P> } = { chatBubble, scarfBlock, twinDomes, openLlama, whaleCalf, galeCat, spaceCadet };

/** A playable model's mascot, drawn from its `look` (see the file comment for the engine contract). */
export function makeCharacter(c: Mascot): THREE.Group {
  const build = BUILDERS[c.look.plan] as Builder<BodyPlan>;
  return build(c, c.look.colors, c.look.iris);
}

/** What a look-alike copy still moves: its pose (bounce and breath), its limbs (the trot) and its eyes (blinks). */
const COPY_SCOPES = ['pose', 'legL', 'legR', 'armL', 'armR', 'eye'];

/**
 * A cheaper look-alike of a mascot, for crowds of copies that are never a player (Sora's cameos):
 * the same parts and colours, but everything except its pose, limbs and eyes is merged into one mesh
 * per material kind, outlines included, so a copy costs a handful of draw calls. Its tail, ears and
 * props hold still; nothing on it is glowed or tinted by the engine.
 */
export function makeLookalike(c: Mascot): THREE.Group {
  const g = makeCharacter(c);
  mergeStatic(g, { copy: true, scope: (o) => COPY_SCOPES.includes(o.name) });
  return g;
}

// ---------------------------------------------------------------- friends

/**
 * The open-source helper: a friendly open cardboard box (open lid, open source) with a Y-shaped
 * sprout growing out of it (a fork that keeps growing) and a shipping label, waving from the castle.
 */
export function makeHelper(): THREE.Group {
  const g = new THREE.Group();
  const body = part(roundedBox(0.52, 0.42, 0.44, 0.05, 0.04), toon(0xd9a066), { at: [0, 0.29, 0], name: 'body' });
  inkOutline(body, 0.018);
  const flapMat = toon(0xc98a4e);
  const front = geo.box(0.5, 0.02, 0.18);
  const side = geo.box(0.18, 0.02, 0.42);
  const flaps = [
    group({ name: 'flapF', at: [0, 0.5, 0.22], rot: [-1, 0, 0] }, part(front, flapMat, { at: [0, 0, 0.09] })),
    group({ name: 'flapB', at: [0, 0.5, -0.22], rot: [1, 0, 0] }, part(front, flapMat, { at: [0, 0, -0.09] })),
    ...SIDES.map((s) => group({ name: s < 0 ? 'flapL' : 'flapR', at: [s * 0.26, 0.5, 0], rot: [0, 0, s * 1] }, part(side, flapMat, { at: [s * 0.09, 0, 0] }))),
  ];
  const eyes = eyePair(0.068, 0.1, 0.34, 0.2, () => ({ look: [0, 0.1] }));
  const ink = basic(INK);
  const smile = part(geo.torus(0.05, 0.012, 6, 12, PI), ink, { at: [0, 0.24, 0.225], rot: [0, 0, PI] });
  const blushMat = basic(0xffb3a0);
  const blush = SIDES.map((s) => part(geo.disc(0.028, 10), blushMat, { at: [s * 0.17, 0.27, 0.222] }));
  const stem = cachedGeo('char:helper:stem', () =>
    merged([
      { g: geo.cylinder(0.014, 0.014, 0.14, 6), at: [0, 0.07, 0] },
      ...SIDES.map((s) => ({ g: geo.cylinder(0.012, 0.012, 0.08, 6), at: [s * 0.025, 0.17, 0] as V3, rot: [0, 0, -s * 0.5] as V3 })),
    ]),
  );
  const leaves = cachedGeo('char:helper:leaves', () =>
    merged(SIDES.map((s) => ({ g: geo.sphere(0.06, 10, 6), at: [s * 0.065, 0.225, 0] as V3, rot: [0, 0, -s * 0.35] as V3, scale: [1.1, 0.45, 0.9] as V3 }))),
  );
  const sprout = group({ name: 'sprout', at: [0, 0.49, 0] }, part(stem, toon(0x3fae4a)), part(leaves, toon(0x6ad06a)));
  const hand = toon(0xfff1d6);
  const wave = group({ name: 'wave', at: [0.27, 0.33, 0.1] }, part(geo.sphere(0.065, 10, 8), hand, { at: [0.12, 0.1, 0.02] }));
  const feet = toon(0x6b4a2e);
  // A shipping label with a '</>' on the side panel: it came in the mail, open source.
  const strokes = cachedGeo('char:helper:glyph', () =>
    merged(
      ([
        [0.075, 0.2, 0.045, 0.225],
        [0.075, 0.2, 0.045, 0.175],
        [0.035, 0.175, 0.005, 0.225],
        [-0.035, 0.2, -0.005, 0.225],
        [-0.035, 0.2, -0.005, 0.175],
      ] as const).map(([z0, y0, z1, y1]) => ({
        g: geo.box(0.004, 0.012, Math.hypot(z1 - z0, y1 - y0) + 0.01),
        at: [0.268, (y0 + y1) / 2, (z0 + z1) / 2] as V3,
        rot: [Math.atan2(-(y1 - y0), z1 - z0), 0, 0] as V3,
      })),
    ),
  );
  g.add(
    body,
    ...flaps,
    eyes,
    smile,
    ...blush,
    sprout,
    part(geo.sphere(0.06, 10, 8), hand, { at: [-0.3, 0.28, 0.05] }),
    wave,
    ...SIDES.map((s) => part(geo.sphere(0.06, 8, 6), feet, { at: [s * 0.12, 0.045, 0.04], scale: [1, 0.6, 1.3] })),
    part(geo.box(0.006, 0.09, 0.15), toon(0xfdf8ec), { at: [0.263, 0.2, 0.02] }),
    part(strokes, ink),
  );
  // A third bigger than the box it was drawn as, so it stands head to head with the hero it thanks.
  g.scale.setScalar(1.3);
  return finish(g, 'helper', 0.74);
}

/**
 * The reasoning cape: a cloth panel hanging from the shoulders, flaring from 0.56 wide at the clasp
 * to 0.8 at the hem so its corners show past the mascots' sides (see CAPE for its size).
 */
export function makeCape(color: number): THREE.Group {
  const g = new THREE.Group();
  const clothGeo = cachedGeo('char:cape:cloth', () => {
    const s = new THREE.Shape();
    s.moveTo(-CAPE.top, 0);
    s.lineTo(CAPE.top, 0);
    s.lineTo(CAPE.hem, -CAPE.length);
    s.quadraticCurveTo(0, -CAPE.length - 0.05, -CAPE.hem, -CAPE.length);
    s.lineTo(-CAPE.top, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 6 }).translate(0, 0, -0.01);
  });
  const cloth = new THREE.Mesh(clothGeo, toon(0x7a3cff, 0x3a1080, 0.6));
  const pivotGroup = new THREE.Group();
  pivotGroup.position.set(0, 0.72, -0.3);
  pivotGroup.add(cloth);
  const clasp = new THREE.Mesh(geo.sphere(0.05, 8, 6), toon(color, color, 0.5));
  clasp.position.set(0, 0.72, -0.28);
  g.add(pivotGroup, clasp);
  // Player.updateMesh swings the cloth through this pivot.
  g.userData.pivot = pivotGroup;
  return g;
}

/** The cape's cloth, hung from (0, 0.72, -0.3): half-widths at the clasp and the hem, and its length. */
export const CAPE = { top: 0.28, hem: 0.4, length: 0.55 } as const;

/** The crowd of new users that follows a viral star: little round figures, one draw call each. */
export function makeCrowd(n: number): THREE.Group {
  const g = new THREE.Group();
  const colors = [0xffd166, 0x06d6a0, 0x118ab2, 0xef476f, 0xf78c6b, 0xc3a6ff];
  const bodyGeo = geo.capsule(0.12, 0.14, 4, 8);
  const headGeo = geo.sphere(0.11, 8, 6);
  for (let i = 0; i < n; i++) {
    const person = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, toon(colors[i % colors.length]));
    body.position.y = 0.2;
    const head = new THREE.Mesh(headGeo, toon(0xffe0bd));
    head.position.y = 0.46;
    person.add(body, head);
    mergeStatic(person);
    g.add(person);
  }
  return g;
}

/**
 * The GPT-4o ghost (#keep4o): GPT's own bubble outline turned mint and see-through, with a scalloped
 * ghost hem, closed happy eyes, faint typing dots, a heart it hugs, and a halo that is also the 'o'.
 */
export function makeGhost4o(): THREE.Group {
  const g = new THREE.Group();
  // Bright enough to glow mint in the dark castles it haunts.
  const G = toon(0xe8fff6, 0x6affc8, 0.9);
  G.setValues({ transparent: true, opacity: 0.8, depthWrite: false });
  const shell = cachedGeo('char:ghost:body', () =>
    new THREE.ExtrudeGeometry(ghostShape(), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 10 }).translate(0, 0, -0.15),
  );
  const ink = basic(INK);
  const eyes = cachedGeo('char:ghost:eyes', () => merged(SIDES.map((s) => ({ g: geo.torus(0.045, 0.014, 4, 10, PI), at: [s * 0.12, 0, 0] as V3 }))));
  const blushMat = basic(0xffb3c7);
  const dotMat = basic(0x0b7a5f, 0.85);
  const heart = makeHeartMesh(0xf0507c);
  place(heart, { at: [0, 0.42, 0.24], scale: 0.22, name: 'heart' });
  const float = group(
    { name: 'float' },
    part(shell, G, { at: [0, 0.62, 0], name: 'body' }),
    part(eyes, ink, { at: [0, 0.7, 0.21] }),
    ...SIDES.map((s) => part(geo.disc(0.03, 10), blushMat, { at: [s * 0.2, 0.6, 0.205] })),
    group({ name: 'dots' }, ...[-0.06, 0, 0.06].map((x) => part(geo.sphere(0.022, 8, 6), dotMat, { at: [x, 0.56, 0.21] }))),
    heart,
    ...SIDES.map((s) => part(geo.capsule(0.04, 0.06, 4, 8), G, { at: [s * 0.14, 0.45, 0.2], rot: [0, 0, -s * 1.2] })),
    group({ name: 'halo', at: [0, 1.03, 0] }, part(geo.torus(0.16, 0.022, 8, 24), basic(0xfff3b0), { rot: [PI / 2 - 0.3, 0, 0] })),
  );
  const tag = labelSprite('GPT-4o', '#063', 'rgba(230,255,245,0.8)');
  tag.scale.multiplyScalar(0.35);
  tag.position.y = 1.35;
  g.add(float, tag);
  return finish(g, 'ghost', 1.05, false);
}

/** Every character mesh, for the `?debug&gallery=characters` lineup. */
export function characterGallery(roster: readonly Pick<CharacterSpec, 'id' | 'name' | 'color' | 'accent' | 'look'>[]): { name: string; mesh: THREE.Object3D }[] {
  return [
    ...roster.map((c) => ({ name: c.name, mesh: makeCharacter(c) })),
    { name: 'Helper', mesh: makeHelper() },
    { name: 'GPT-4o ghost', mesh: makeGhost4o() },
  ];
}

// ---------------------------------------------------------------- idle life

/** What a mascot is doing this frame, for `animateCharacter`. */
export interface CharacterMotion {
  /** Horizontal speed, world units per second. */
  speed: number;
  airborne: boolean;
  /** Vertical speed (positive is up). */
  vy: number;
  /** Holding Think with the reasoning cape. */
  thinking?: boolean;
  /** Just air-dashed. */
  dashing?: boolean;
  dead?: boolean;
  /** Sitting in a kart: no steps, but the wind still blows. */
  seated?: boolean;
}

/** Standing still (gallery, helper, ghost). */
export const IDLE: Readonly<CharacterMotion> = { speed: 0, airborne: false, vy: 0 };
/** Trotting along (Sora cameos, the race rival). */
export const TROT: Readonly<CharacterMotion> = { speed: 4.5, airborne: false, vy: 0 };

interface Rig {
  parts: Record<string, THREE.Object3D | undefined>;
  eyes: THREE.Object3D[];
  /** Eyelids that only show in an idle moment (the Llama's droop). */
  lids: THREE.Object3D[];
  /** Rest pose of every named part: position, rotation and scale as 9 numbers. */
  rest: Map<THREE.Object3D, number[]>;
}

const rigs = new WeakMap<THREE.Object3D, Rig>();

function rigOf(root: THREE.Object3D): Rig {
  let rig = rigs.get(root);
  if (!rig) {
    const r: Rig = { parts: {}, eyes: [], lids: [], rest: new Map() };
    root.traverse((o) => {
      if (!o.name || o.name === 'outline') return;
      if (o.name === 'eye') r.eyes.push(o);
      if (o.name === 'lid') r.lids.push(o);
      if (!r.parts[o.name]) r.parts[o.name] = o;
      r.rest.set(o, [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z]);
    });
    for (const d of EACH_CHILD) for (const k of r.parts[d]?.children ?? []) r.rest.set(k, [k.position.x, k.position.y, k.position.z, 0, 0, 0, k.scale.x, k.scale.y, k.scale.z]);
    rigs.set(root, r);
    rig = r;
  }
  return rig;
}

/** Per-mascot clocks, kept as plain numbers in `userData` (it must stay JSON-clonable). */
interface Clocks {
  aT: number;
  idle: number;
  air: number;
  land: number;
  jump: number;
  stride: number;
  blinkAt: number;
  blinkT: number;
  winkAt: number;
  winkT: number;
  puff: number;
  /** A turning prop's angle (Gemini's star bobbles, Mistral's wind wisps). */
  spin: number;
  /** 0..1 progress of something popping in (GPT's typing bubble). */
  pop: number;
  /** How much the body breathes (1 at rest, 0 while running or airborne). */
  bw: number;
  /** This mascot's own breathing phase. */
  phase: number;
}

/** Blink length per plan: the calm ones blink slowly. */
const BLINK: Record<string, number> = { scarfBlock: 0.18, openLlama: 0.22 };

interface Frame {
  rig: Rig;
  rest: (o: THREE.Object3D, i: number) => number;
  t: number;
  dt: number;
  m: CharacterMotion;
  c: Clocks;
  /** 0 under reduced motion (secondary motion off), else 1. */
  k: number;
  air: boolean;
  running: boolean;
  /** Extra brow height a plan asks for this frame (a ponder, a waggle). */
  browLift: number;
  /** How far a plan tips the whole body back this frame (radians, a ponder). */
  lean: number;
}

/**
 * Optional idle life for a mascot, the helper or the ghost: blinks, breathing and a bounce in the
 * step, limbs that swing and lift, and each one's own signature motion (a typing bubble and a
 * wagging pointer, a streaming scarf, twin chat, ear flicks and shared wool, a puffing spout, a
 * whirlwind tail, a hitchhiking cadet). Call it once per frame; rotation, scale, visibility and a
 * few small offsets only, from the rest pose, with no per-frame allocation. Under reduced motion
 * only the blinks stay.
 */
export function animateCharacter(root: THREE.Object3D, t: number, m: Readonly<CharacterMotion>): void {
  const plan = root.userData.plan as string | undefined;
  if (!plan) return;
  const rig = rigOf(root);
  const c = root.userData as Clocks;
  if (c.aT === undefined || t < c.aT - 0.5) {
    const phase = phaseOf(plan);
    Object.assign(c, { aT: t, idle: 0, air: 0, land: 9, jump: 9, stride: 0, blinkAt: t + 0.5 + phase * 2.5, blinkT: -9, winkAt: t + 4, winkT: -9, puff: 0, spin: 0, pop: 0, bw: 1, phase: phase * 2 * PI });
  }
  // Clamped so a paused tab does not jump every clock, but loose enough for slow phones.
  const dt = Math.min(0.25, Math.max(0, t - c.aT));
  c.aT = t;
  const k = prefs.reduceMotion ? 0 : 1;
  const air = m.airborne && !m.seated;
  const running = !air && !m.seated && !m.dead && m.speed > 0.8;
  if (air && !c.air && m.vy > 0) c.jump = 0;
  else c.jump += dt;
  if (!air && c.air) c.land = 0;
  else c.land += dt;
  c.air = air ? 1 : 0;
  // Driving is not idling: no typing, pondering or chatting at full race speed.
  c.idle = running || air || m.thinking || m.dead || (m.seated && m.speed > 0.8) ? 0 : c.idle + dt;
  if (running) c.stride += dt * strideRate(m.speed);
  if (t >= c.blinkAt) {
    c.blinkT = t;
    c.blinkAt = t + nextBlink(Math.random());
  }
  const f: Frame = frameScratch;
  f.rig = rig;
  f.t = t;
  f.dt = dt;
  f.m = m;
  f.c = c;
  f.k = k;
  f.air = air;
  f.running = running;
  f.browLift = 0;
  f.lean = 0;

  // Eyes: blinks for everyone; wide open in the air, a happy squint on landing, squeezed shut when out.
  const dur = BLINK[plan] ?? 0.12;
  const wide = 1 + k * (air ? 0.08 : 0);
  const squint = m.dead ? 0.15 : k ? landingSquint(c.land) : 1;
  const lag = plan === 'twinDomes' ? 0.09 : 0;
  for (let i = 0; i < rig.eyes.length; i++) {
    rig.eyes[i].scale.set(wide, wide * Math.min(blinkScale(t - c.blinkT - i * lag, dur), squint), wide);
  }

  limbs(f);
  ANIMATORS[plan]?.(f);
  const brows = rig.parts.brows;
  if (brows) brows.position.y = ease(brows.position.y, k * ((air ? 0.02 : 0) + f.browLift), 12, dt);

  // The whole body breathes at rest, bounces in its step and rumbles in a kart. This moves the
  // inner pose group: the engine keeps the root's own scale and turn. Nothing here grows the
  // body's depth, and a lean back slides it forward, so the back never pushes into the cape.
  const pose = rig.parts.pose;
  if (pose) {
    c.bw = ease(c.bw, running || air ? 0 : 1, 6, dt);
    const breathe = 0.035 * c.bw * Math.sin(t * 2.4 + c.phase);
    const step = running ? 0.03 * Math.abs(Math.cos(c.stride)) : 0;
    const rumble = m.seated ? 0.012 * Math.sin(t * 31) * Math.min(1, m.speed / 10) : 0;
    pose.scale.set(1 - k * breathe * 0.5, 1 + k * breathe, 1);
    pose.position.y = k * (step + rumble);
    pose.position.z = -k * f.lean * 0.62;
    pose.rotation.x = k * f.lean;
  }
}

/** Reused every frame, so animating allocates nothing. */
const frameScratch = {} as Frame;
// A part's rest pose value (position xyz, rotation xyz, scale xyz) in the rig being animated.
frameScratch.rest = (o, i) => frameScratch.rig.rest.get(o)?.[i] ?? 0;

/** Arms swing against the legs while running, fly up in the air, and sway a little at rest. */
function limbs({ rig, t, dt, m, c, k, air, running }: Frame): void {
  const sw = Math.sin(c.stride);
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    const a = i ? rig.parts.armR : rig.parts.armL;
    if (a) {
      const swing = running ? -s * sw * 0.7 : m.seated ? -0.5 : 0;
      const raise = air ? 1.1 + 0.15 * Math.sin(t * 10 + s) : running ? 0.15 : 0.05 * Math.sin(t * 2.1 + s);
      a.rotation.x = k * ease(a.rotation.x, swing, 16, dt);
      a.rotation.z = k * ease(a.rotation.z, s * raise, 12, dt);
    }
    const l = i ? rig.parts.legR : rig.parts.legL;
    if (l) l.rotation.x = k * ease(l.rotation.x, running ? s * sw * 0.6 : air ? (s < 0 ? -0.35 : 0.25) : 0, 18, dt);
  }
}

type Animator = (f: Frame) => void;

const TURN = 2 * PI;

const ANIMATORS: Record<string, Animator> = {
  chatBubble({ rig, rest, t, dt, m, c, k, air, running }) {
    // Idle or thinking, his own little "typing…" bubble pops up beside his head, dots bouncing.
    const typing = ((k > 0 && c.idle > 2.5) || !!m.thinking) && !m.dead;
    const { dots, mouth, cowlick, pointer } = rig.parts;
    if (dots) {
      dots.visible = typing;
      c.pop = typing ? Math.min(1, c.pop + dt * 4) : 0;
      dots.scale.setScalar(k ? popIn(c.pop) : 1);
      dots.position.y = rest(dots, 1) + k * 0.03 * Math.sin(t * 3);
      const rate = m.thinking ? 12 : 7;
      for (let i = 1; i < dots.children.length; i++) {
        const d = dots.children[i];
        d.position.y = rest(d, 1) + k * 0.03 * Math.max(0, Math.sin(t * rate - i * 0.9));
      }
    }
    if (mouth) mouth.scale.setScalar(1 + k * 0.3 * flick(c.land, 0.3));
    // The bubble's pointer wags like a happy tail, perks up while he types, and trails on the run.
    if (pointer) {
      const wag = typing ? 0.14 : running ? 0.12 * Math.sin(c.stride * 2) : air ? -0.2 : 0.2 * Math.sin(t * 6);
      pointer.rotation.z = k * (ease(pointer.rotation.z, wag, 14, dt) + springWobble(c.land, 0.02));
    }
    if (cowlick) {
      const target = (air ? -0.2 : 0) + (running ? 0.1 * Math.sin(c.stride * 2) : 0);
      cowlick.rotation.x = k * ease(cowlick.rotation.x, target, 10, dt);
      cowlick.rotation.z = k * springWobble(c.land, 0.35);
    }
  },

  scarfBlock(f) {
    const { rig, rest, t, dt, m, c, k, air, running } = f;
    const { tailLong, tailShort, quill } = rig.parts;
    const run = Math.min(1, m.speed / 8);
    // The long scarf end streams out sideways like a flag through his long float, and trails back
    // on the run or in a kart; the knotted end lifts and flutters.
    if (tailLong) {
      const flag = air ? Math.min(0.95, 0.35 + Math.abs(m.vy) * 0.05) : m.seated ? 0.45 * run : running ? 0.25 * run : 0;
      const flutter = air || m.seated || running ? 0.09 * Math.sin(t * 11) : 0.04 * Math.sin(t * 1.7);
      tailLong.rotation.z = k * ease(tailLong.rotation.z, -(flag + flutter), 9, dt);
      tailLong.rotation.x = k * ease(tailLong.rotation.x, air ? 0.25 : running || m.seated ? 0.35 * run : 0, 8, dt);
    }
    if (tailShort) {
      tailShort.rotation.x = k * ease(tailShort.rotation.x, air ? 0.6 + 0.08 * Math.sin(t * 13) : running || m.seated ? 0.3 * run + 0.06 * Math.sin(t * 12) : 0, 9, dt);
      tailShort.rotation.z = rest(tailShort, 5) + k * 0.06 * Math.sin(t * 2.2);
    }
    // Pondering: every so often he tips back, looks up with raised brows, and taps his quill.
    const p = idleMoment(c.idle, 7, 2);
    const ponder = m.thinking ? 1 : hold(p, 0.25);
    for (let i = 0; i < rig.eyes.length; i++) rig.eyes[i].rotation.x = -0.35 * ponder * k;
    f.browLift = 0.04 * ponder;
    f.lean = -0.07 * ponder;
    if (quill) quill.rotation.z = rest(quill, 5) + k * ponder * 0.16 * Math.sin(t * 16);
  },

  twinDomes({ rig, rest, t, dt, m, c, k, running }) {
    const { twinL, twinR, mouthL, mouthR, starL, starR } = rig.parts;
    // Now and then the twins lean in for a chat, taking turns to talk; otherwise their eyes scan
    // around (fast while thinking: the multimodal eyes searching for hidden blocks).
    const chat = hold(idleMoment(c.idle, 6, 2.2), 0.2);
    const scan = m.thinking ? 4 : 1.3;
    for (let i = 0; i < rig.eyes.length; i++) {
      const toward = i === 0 ? 0.45 : -0.45;
      rig.eyes[i].rotation.y = k * ((1 - chat) * 0.3 * Math.sin(t * scan + i * 0.6) + chat * toward);
    }
    const bob = running ? 12 : 3.2;
    for (let i = 0; i < 2; i++) {
      const twin = i ? twinR : twinL;
      if (!twin) continue;
      twin.position.y = rest(twin, 1) + k * 0.03 * Math.sin(t * bob + i * PI);
      twin.rotation.z = k * (i ? 1 : -1) * 0.25 * chat;
    }
    const talk = chat > 0.5 ? 0.6 : 0;
    if (mouthL) mouthL.scale.y = rest(mouthL, 7) * (1 + k * talk * Math.sin(t * 14));
    if (mouthR) mouthR.scale.y = rest(mouthR, 7) * (1 + k * talk * Math.sin(t * 14 + PI));
    // The star bobbles spin while thinking, and always finish their turn.
    if (m.thinking || c.spin > 0) {
      c.spin += dt * 6;
      if (c.spin >= TURN) c.spin = m.thinking ? c.spin - TURN : 0;
    }
    if (starL) starL.rotation.y = k * c.spin;
    if (starR) starR.rotation.y = -k * c.spin;
  },

  openLlama({ rig, rest, t, dt, m, c, k, air, running }) {
    const { earL, earR, snout, charm, tuft, puff } = rig.parts;
    // One ear flicks every 3.5 s (they take turns); ears bob on the run, dip on landing, perk up thinking.
    const n = Math.floor(t / 3.5);
    const since = t - n * 3.5;
    for (let i = 0; i < 2; i++) {
      const ear = i ? earR : earL;
      if (!ear) continue;
      const s = i ? 1 : -1;
      const flickZ = n % 2 === i ? -s * 0.35 * flick(since, 0.35) : 0;
      const dip = -s * 0.25 * flick(c.land, 0.35);
      const perk = m.thinking ? s * 0.2 : 0;
      ear.rotation.z = rest(ear, 5) + k * (flickZ + dip + perk);
      ear.rotation.x = rest(ear, 3) + k * ease(ear.rotation.x - rest(ear, 3), running ? 0.1 * Math.sin(t * 9 + i * PI) : air ? 0.25 : 0, 12, dt);
    }
    // Waiting, it chews: the snout grinds side to side, as llamas do; and every so often its lids droop.
    const chew = c.idle > 1.5 ? 1 : 0;
    if (snout) {
      snout.rotation.y = k * chew * 0.16 * Math.sin(t * 5);
      snout.scale.y = 1 + k * chew * 0.06 * Math.sin(t * 10);
    }
    const droop = k > 0 && hold(idleMoment(c.idle, 9, 2.6)) > 0.3;
    for (let i = 0; i < rig.lids.length; i++) rig.lids[i].visible = droop;
    if (charm) {
      charm.rotation.z = k * (running ? 0.35 * Math.sin(c.stride) : 0.08 * Math.sin(t * 2));
      charm.rotation.x = k * ease(charm.rotation.x, air ? -0.5 : 0, 10, dt);
    }
    if (tuft) {
      tuft.scale.y = rest(tuft, 7) * (1 + k * 0.3 * flick(c.land, 0.3));
      tuft.rotation.z = k * springWobble(c.land, 0.12);
    }
    // Open weights: a puff of its wool floats up and away, shrinking, then grows back on its flank.
    if (puff) {
      const u = k ? idleMoment(c.idle + 3, 7, 1.8) : -1;
      const grown = u < 0 ? 1 : u < 0.8 ? 1 - u / 0.8 : popIn((u - 0.8) / 0.2);
      const away = u < 0 || u >= 0.8 ? 0 : u / 0.8;
      puff.position.set(rest(puff, 0) + 0.18 * away, rest(puff, 1) + 0.55 * away + 0.05 * Math.sin(away * 9), rest(puff, 2) + 0.06 * away);
      puff.scale.setScalar(rest(puff, 6) * grown);
    }
  },

  whaleCalf({ rig, rest, t, dt, m, c, k, air, running }) {
    const { spout, armL, armR, flukes } = rig.parts;
    // The spout puffs: slow at rest, quick on the run, and a big puff now and then.
    c.puff += dt * ((2 * PI) / (running ? 0.5 : m.thinking ? 0.7 : 1.5));
    const big = Math.max(0, flick(idleMoment(c.idle, 6, 1.1), 1));
    if (spout) {
      spout.scale.y = k ? 1.025 + 0.2 * Math.sin(c.puff) + 0.4 * big : 1;
      for (let i = 0; i < spout.children.length; i++) {
        const d = spout.children[i];
        const f = 1 + k * 0.2 * Math.sin(c.puff * 2 - i);
        d.scale.set(rest(d, 6) * f, rest(d, 7) * f, rest(d, 8) * f);
      }
    }
    // Flippers paddle while running and spread in the air; the flukes wave, and flick on every jump.
    for (let i = 0; i < 2; i++) {
      const fin = i ? armR : armL;
      const s = i ? 1 : -1;
      if (fin) fin.rotation.z = k * ease(fin.rotation.z, air ? s * 0.6 : running ? s * 0.3 * Math.sin(c.stride * 2) : s * 0.08 * Math.sin(t * 2), 14, dt);
    }
    if (flukes) {
      flukes.rotation.x = k * (-0.45 * flick(c.jump, 0.25) + (running ? 0.1 * Math.sin(c.stride * 2) : 0));
      flukes.rotation.z = k * (running ? 0 : 0.14 * Math.sin(t * 2.2));
    }
  },

  galeCat({ rig, rest, t, dt, m, c, k, air, running }) {
    const { tail, wind, wisps, earL, earR, kerchief } = rig.parts;
    const dash = k > 0 && !!m.dashing;
    if (tail) {
      const gust = flick(idleMoment(c.idle, 5, 1.2), 1);
      tail.rotation.y = k * (0.12 * Math.sin(t * (running || m.thinking ? 8 : 4)) + 0.3 * gust * Math.sin(t * 9));
      tail.rotation.z = k * 0.1 * Math.sin(t * 2.3);
      // In a kart the tail would run through the seat: it stands up behind the shoulders instead.
      tail.rotation.x = m.seated ? 0.9 : 0;
      tail.scale.y = ease(tail.scale.y, dash ? 0.6 : 1, 14, dt);
      tail.scale.z = ease(tail.scale.z, dash ? 1.15 : 1, 14, dt);
    }
    if (wind) wind.visible = dash;
    // The wisps circle the whirlwind, faster on the run.
    c.spin = (c.spin + dt * (running || dash ? 7 : 2.2)) % TURN;
    if (wisps) wisps.rotation.x = -k * c.spin;
    // Ears sweep further back with speed, and one twitches now and then.
    const sweep = -0.22 * Math.min(1, m.speed / 10) - (air ? 0.1 : 0);
    const twitch = flick(idleMoment(c.idle + 2, 4.5, 0.25), 1);
    for (let i = 0; i < 2; i++) {
      const ear = i ? earR : earL;
      if (ear) ear.rotation.x = rest(ear, 3) + k * ease(ear.rotation.x - rest(ear, 3), sweep + (i === 1 ? -0.3 * twitch : 0), 25, dt);
    }
    // The kerchief streams back on the move and flutters in its own breeze at rest.
    if (kerchief) {
      kerchief.rotation.x = k * (running || air ? -0.12 - 0.06 * Math.sin(t * 16) : 0);
      kerchief.rotation.z = k * (running || air ? 0 : 0.15 * Math.sin(t * 6));
    }
  },

  spaceCadet({ rig, rest, t, dt, c, k, air, running }) {
    const { antenna, antennaTip, towel, visorGlint, browUp, lights, armR, thumb } = rig.parts;
    // The sly eye winks slowly every six seconds or so.
    if (t >= c.winkAt) {
      c.winkT = t;
      c.winkAt = t + 5 + 2 * Math.random();
    }
    const sly = rig.eyes[1];
    if (sly) sly.scale.y *= blinkScale(t - c.winkT, 0.45);
    if (antennaTip) antennaTip.scale.setScalar(k && Math.floor(t * 2) % 2 ? 0.7 : 1);
    if (antenna) antenna.rotation.z = k * (springWobble(c.land, 0.45) + (running ? 0.14 * Math.sin(c.stride * 2) : 0.06 * Math.sin(t * 1.6)));
    // The towel's front drop flaps on the run and flies up in the air.
    if (towel) {
      towel.rotation.z = k * (running ? 0.06 * Math.sin(t * 5) : 0);
      towel.rotation.x = k * ease(towel.rotation.x, air ? -0.6 : running ? -0.25 - 0.12 * Math.sin(t * 14) : 0, 10, dt);
    }
    if (visorGlint) visorGlint.rotation.z = k * 0.3 * flick(c.land, 0.25);
    // Cheeky: the raised brow waggles; the chest lights run their little pattern.
    if (browUp) browUp.position.y = rest(browUp, 1) + k * 0.05 * Math.abs(Math.sin(Math.max(0, idleMoment(c.idle, 5.5, 0.8)) * 2 * PI));
    if (lights) {
      const on = Math.floor(t * 3) % 3;
      for (let i = 0; i < lights.children.length; i++) lights.children[i].scale.setScalar(k && i === on ? 1.35 : 1);
    }
    // Hitching a ride (don't panic): his arm swings out level and a thumb pops up.
    const hitch = k ? hold(idleMoment(c.idle + 4, 8, 2.2)) : 0;
    if (armR) armR.rotation.z += (1.0 - armR.rotation.z) * hitch;
    if (thumb) {
      thumb.visible = hitch > 0.5;
      thumb.scale.setScalar(rest(thumb, 6) * (hitch > 0.5 ? popIn((hitch - 0.5) * 4) : 1));
    }
  },

  helper({ rig, rest, t, k }) {
    const { wave, sprout, flapL, flapR, flapF } = rig.parts;
    if (wave) wave.rotation.z = k * 0.5 * Math.sin(t * 9);
    if (sprout) sprout.rotation.z = k * 0.15 * Math.sin(t * 2.2);
    if (flapL) flapL.rotation.z = rest(flapL, 5) - k * 0.15 * Math.sin(t * 6);
    if (flapR) flapR.rotation.z = rest(flapR, 5) + k * 0.15 * Math.sin(t * 6 + 1);
    if (flapF) flapF.rotation.x = rest(flapF, 3) - k * 0.12 * Math.sin(t * 5);
  },

  ghost({ rig, rest, t, k }) {
    const { halo, heart, dots, float } = rig.parts;
    if (float) float.position.y = k * 0.06 * Math.sin(t * 2 * PI * 0.8);
    if (halo) {
      halo.rotation.z = k * 0.12 * Math.sin(t * 1.4);
      halo.position.y = rest(halo, 1) + k * 0.02 * Math.sin(t * 2.6);
    }
    if (heart) heart.scale.setScalar(rest(heart, 6) * (1 + k * 0.14 * Math.max(0, Math.sin(t * 7))));
    if (dots) for (let i = 0; i < dots.children.length; i++) {
      const d = dots.children[i];
      d.position.y = rest(d, 1) + k * 0.015 * Math.max(0, Math.sin(t * 6 - i * 0.9));
    }
  },
};
