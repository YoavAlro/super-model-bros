export type ThemeId = 'plains' | 'caves' | 'castle' | 'hills' | 'skies' | 'skycastle' | 'storm' | 'pipes' | 'ghost' | 'factory' | 'frontier' | 'finale';

/** Tile families (painted in src/game/tileArt.ts). Each style is a craft that suits its world. */
export type CapStyle = 'felt' | 'moss' | 'stone' | 'cotton' | 'slate' | 'rubber' | 'carpet' | 'walkway' | 'trim';
export type SoilStyle = 'soil' | 'rock' | 'ashlar' | 'cardboard' | 'papier' | 'hexmould' | 'wainscot' | 'plates' | 'resin' | 'starfield';
export type HardStyle = 'rings' | 'facets' | 'bands' | 'creases' | 'veins' | 'strap' | 'screws' | 'corners' | 'crate' | 'star';
export type ShelfStyle = 'rope' | 'gills' | 'brackets' | 'scallops' | 'news' | 'holes' | 'books' | 'slots' | 'rivets' | 'glow';
export type DecorStyle = 'daisies' | 'shrooms' | 'tufts' | 'papers' | 'screws' | 'candles' | 'bolts' | 'shards' | 'twinkles';
export interface TileStyle {
  /** Top of walkable ground. */
  cap: CapStyle;
  soil: SoilStyle;
  /** Unbreakable blocks. */
  hard: HardStyle;
  /** One-way platforms. */
  shelf: ShelfStyle;
  /** Little cut-outs standing on some caps (null: none). */
  decor: DecorStyle | null;
}

/** A flat cardboard layer behind the play plane: a long strip with a shaped top edge. */
export type Edge = 'rolling' | 'scallop' | 'jagged' | 'crenel' | 'skyline' | 'roofs' | 'drip';
export interface Strip {
  edge: Edge;
  z: number;
  /** Edge height (world y) before the profile is added. */
  top: number;
  amp: number;
  period: number;
  color: number;
  /** 0..1: how far the colour is mixed toward skyBottom. */
  haze: number;
  /** Hangs down from above (a ceiling) instead of standing up. */
  hang?: boolean;
  /** Colour of the thin rim ribbon along the edge (default: the colour lightened). */
  rim?: number;
  /** A printed surface instead of flat card: sewn patches or newsprint. */
  texture?: 'patchwork' | 'newsprint';
}
export type PieceId = 'trees' | 'books' | 'prisms' | 'towers' | 'islands' | 'spires' | 'stacks' | 'wall' | 'torches' | 'gears' | 'tubes';
export type WallPattern = 'stone' | 'damask' | 'pegboard';
/** A repeated backdrop set piece. */
export interface Scenery {
  piece: PieceId;
  z: number;
  /** Spacing in tiles. */
  every: number;
  y?: number;
  colors: number[];
  haze: number;
  pattern?: WallPattern;
  /** Window holes in a wall. */
  hole?: { w: number; h: number; y: number };
}
export type LifeId = 'birds' | 'planes' | 'lanterns' | 'pages' | 'smoke' | 'motes' | 'embers' | 'fireflies' | 'stars' | 'rain' | 'shootingStar';
/** Ambient backdrop motion. */
export interface Life {
  kind: LifeId;
  count: number;
  color: number;
  z: number;
  y?: [number, number];
}
export interface Celestial {
  kind: 'sun' | 'sunset' | 'moon' | 'crescent' | 'ringed';
  color: number;
  accent: number;
  r: number;
  /** Offset from the camera's x. */
  dx: number;
  y: number;
}
/**
 * Signature set pieces beyond the standard kit, one or two per world (built in src/game/backdrop.ts):
 * fairy-light strands, kites, hot-air balloons, marbles in the tube run, felt pennants, moonbeams
 * with gilt frames and a chalkboard, lightning, an aurora and a brass orrery.
 */
export type ExtraId = 'fairyLights' | 'kites' | 'balloons' | 'marbles' | 'pennants' | 'moonbeams' | 'lightning' | 'aurora' | 'orrery';
/** Light colours only; intensities are the same in every theme. Keep every sun channel ≥ 0xa0. */
export interface Lights {
  sun: number;
  sky: number;
  ground: number;
}

export interface Theme {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  ground: number;
  grass: number;
  brick: number;
  hard: number;
  pipe: number;
  /** One-way platforms: shelves, planks, bridges. */
  platform: number;
  lights: Lights;
  tiles: TileStyle;
  /** Distant cardboard layers, far to near. */
  strips: Strip[];
  scenery: Scenery[];
  life: Life[];
  celestial?: Celestial;
  /** Cardboard clouds on threads. */
  clouds: boolean;
  /** Default 0xffffff. */
  cloudColor?: number;
  extras?: ExtraId[];
  /** Pits glow with lava instead of dropping into the void. */
  lavaPits?: boolean;
  /** Scene light level (ghost houses are dim). */
  light?: number;
}

export const THEMES: Record<ThemeId, Theme> = {
  // "Pop-up book" (BookCorpus): felt and paper folding up out of an open book.
  plains: {
    skyTop: '#4f86f7',
    skyMid: '#7fb4ff',
    skyBottom: '#d4f0ff',
    ground: 0xa0612e,
    grass: 0x46c04a,
    brick: 0xc8602a,
    hard: 0xb8864a,
    pipe: 0x2a9d8f,
    platform: 0xc98a4b,
    lights: { sun: 0xfff4e0, sky: 0xffffff, ground: 0x6a5a3a },
    tiles: { cap: 'felt', soil: 'soil', hard: 'rings', shelf: 'rope', decor: 'daisies' },
    strips: [
      { edge: 'rolling', z: -70, top: 8, amp: 3, period: 44, color: 0x9cc8e6, haze: 0.6 },
      { edge: 'rolling', z: -34, top: 5, amp: 2.5, period: 26, color: 0xa8dca0, haze: 0.45 },
    ],
    scenery: [
      { piece: 'trees', z: -18, every: 9, colors: [0x8fcf8a, 0xd8c0a0], haze: 0.5 },
      { piece: 'books', z: -20, every: 23, colors: [0xf0b8a8, 0xa8c8f0, 0xf0e0a0], haze: 0.5 },
    ],
    life: [{ kind: 'birds', count: 6, color: 0x5a6a8a, z: -26 }],
    celestial: { kind: 'sun', color: 0xfff1a8, accent: 0xffd84a, r: 5, dx: 26, y: 26 },
    clouds: true,
    cloudColor: 0xffffff,
  },
  // "Geode" (WebText): dark slate with glowing crystal flecks.
  caves: {
    skyTop: '#040817',
    skyMid: '#0b1636',
    skyBottom: '#1a2f63',
    ground: 0x35598c,
    grass: 0x6fb8e8,
    brick: 0x3f86d0,
    hard: 0x8a6ad8,
    pipe: 0x2a8fa8,
    platform: 0x3fc1b0,
    lights: { sun: 0xa8c0ff, sky: 0x8aa0ff, ground: 0x201040 },
    tiles: { cap: 'moss', soil: 'rock', hard: 'facets', shelf: 'gills', decor: 'shrooms' },
    strips: [
      { edge: 'drip', z: -30, top: 14, amp: 3, period: 5, color: 0x0a1430, haze: 0.25, hang: true },
      { edge: 'jagged', z: -40, top: 2, amp: 5, period: 9, color: 0x0f1f46, haze: 0.5 },
    ],
    scenery: [{ piece: 'prisms', z: -20, every: 11, colors: [0x1c2a6a, 0x4a5ac0], haze: 0.35 }],
    life: [{ kind: 'motes', count: 40, color: 0x7ad8ff, z: -12 }],
    clouds: false,
    extras: ['fairyLights'],
  },
  // "Toy fort" (Common Crawl Castle, the RLHF Keep, HHH Keep).
  castle: {
    skyTop: '#140909',
    skyMid: '#2a0f0c',
    skyBottom: '#4a1d14',
    ground: 0x6d6d72,
    grass: 0x9a9aa2,
    brick: 0x9a4a40,
    hard: 0x80808a,
    pipe: 0x5a6a78,
    platform: 0xb08a5a,
    lights: { sun: 0xffc9a0, sky: 0xffd0c0, ground: 0x6a2010 },
    tiles: { cap: 'stone', soil: 'ashlar', hard: 'bands', shelf: 'brackets', decor: null },
    strips: [{ edge: 'crenel', z: -60, top: 9, amp: 1.5, period: 3, color: 0x3a1a16, haze: 0.3 }],
    scenery: [
      { piece: 'wall', z: -10, every: 12, colors: [0x2a1210, 0x3a1a16], haze: 0.25, pattern: 'stone', hole: { w: 2, h: 4.5, y: 6.5 } },
      { piece: 'torches', z: -9.5, every: 12, y: 7, colors: [0xffb040, 0xff6a1a], haze: 0 },
    ],
    life: [{ kind: 'embers', count: 30, color: 0xffb040, z: -4 }],
    clouds: false,
    extras: ['pennants'],
    lavaPits: true,
  },
  // "Patchwork sunset" (GitHub Hills, Constitution Hills).
  hills: {
    skyTop: '#ff9e6d',
    skyMid: '#ffc38a',
    skyBottom: '#ffe9c2',
    ground: 0x8a5a32,
    grass: 0x7bc043,
    brick: 0xd0703a,
    hard: 0xc8965a,
    pipe: 0x3a9e8a,
    platform: 0xb87a48,
    lights: { sun: 0xffcaa0, sky: 0xffe0c0, ground: 0x6a4030 },
    tiles: { cap: 'felt', soil: 'soil', hard: 'rings', shelf: 'rope', decor: 'tufts' },
    strips: [
      { edge: 'rolling', z: -70, top: 7, amp: 3, period: 40, color: 0xe8a0a8, haze: 0.6 },
      { edge: 'rolling', z: -34, top: 4, amp: 2.5, period: 24, color: 0xf0c8a0, haze: 0.45, texture: 'patchwork' },
      { edge: 'rolling', z: -16, top: 1.5, amp: 1.2, period: 12, color: 0xc8d8a0, haze: 0.35 },
    ],
    scenery: [{ piece: 'trees', z: -20, every: 13, colors: [0xf4c8a0, 0xe0c8a8], haze: 0.4 }],
    life: [{ kind: 'birds', count: 4, color: 0x8a5a6a, z: -30 }],
    celestial: { kind: 'sunset', color: 0xfff2b0, accent: 0xffc38a, r: 8, dx: -18, y: 4 },
    clouds: true,
    extras: ['kites'],
    cloudColor: 0xffffff,
  },
  // "Cloud sea" (Launch Day, 100K Skies): pale blue banks, so white tiles always read as solid.
  skies: {
    skyTop: '#2f7cf6',
    skyMid: '#7fbaff',
    skyBottom: '#bfe0ff',
    ground: 0x8f9fe0,
    grass: 0xffffff,
    brick: 0x5a78d8,
    hard: 0x7a8ad0,
    pipe: 0x3aa0e8,
    platform: 0xffffff,
    lights: { sun: 0xfffaf0, sky: 0xffffff, ground: 0x8aa0e0 },
    tiles: { cap: 'cotton', soil: 'cardboard', hard: 'creases', shelf: 'scallops', decor: null },
    strips: [
      { edge: 'scallop', z: -60, top: 2, amp: 3, period: 9, color: 0x90bdf0, haze: 0.3 },
      { edge: 'scallop', z: -26, top: 0.5, amp: 2.5, period: 6, color: 0x9cc6f2, haze: 0.35 },
      { edge: 'scallop', z: -12, top: -0.5, amp: 1.8, period: 4, color: 0xa8cff5, haze: 0.5 },
    ],
    scenery: [],
    life: [{ kind: 'planes', count: 5, color: 0xffffff, z: -10 }],
    celestial: { kind: 'sun', color: 0xfffbe8, accent: 0xffe9a0, r: 3, dx: 22, y: 30 },
    clouds: false,
    extras: ['balloons'],
  },
  // "Lantern keep" (Vision Keep, 200K Keep): dusk silhouettes against a bright sky.
  skycastle: {
    skyTop: '#3b2a6b',
    skyMid: '#b0568a',
    skyBottom: '#f7a86b',
    ground: 0xbdb6d6,
    grass: 0xf0ecff,
    brick: 0x9c8cd0,
    hard: 0xe8e4f4,
    pipe: 0x6a8ae0,
    platform: 0xffffff,
    lights: { sun: 0xffc7a0, sky: 0xe0d0ff, ground: 0x8a5a6a },
    tiles: { cap: 'stone', soil: 'ashlar', hard: 'veins', shelf: 'scallops', decor: null },
    strips: [{ edge: 'scallop', z: -60, top: 0, amp: 2.5, period: 8, color: 0x5a3a78, haze: 0.45 }],
    scenery: [
      { piece: 'islands', z: -50, every: 30, y: 9, colors: [0x4a3068, 0x6a4a8a], haze: 0.35 },
      { piece: 'towers', z: -22, every: 14, colors: [0x3a2a5a, 0x5a3a78, 0xffc46a], haze: 0.3 },
    ],
    life: [
      { kind: 'lanterns', count: 12, color: 0xffb050, z: -16 },
      { kind: 'stars', count: 40, color: 0xfff0d8, z: -85, y: [18, 45] },
    ],
    celestial: { kind: 'crescent', color: 0xfff0d8, accent: 0xffe0b0, r: 2.5, dx: -24, y: 30 },
    clouds: true,
    cloudColor: 0x5a3a78,
  },
  // "News cycle": every storm level. Papier-mâché weather.
  storm: {
    skyTop: '#1b1f2e',
    skyMid: '#2e3448',
    skyBottom: '#4b5570',
    ground: 0x6a7088,
    grass: 0x98a4c4,
    brick: 0x8a6a9a,
    hard: 0x8a92aa,
    pipe: 0x4a7a8a,
    platform: 0xe8e0c8,
    lights: { sun: 0xc8d0ff, sky: 0xc0c8e0, ground: 0x2a3040 },
    tiles: { cap: 'slate', soil: 'papier', hard: 'strap', shelf: 'news', decor: 'papers' },
    strips: [
      { edge: 'skyline', z: -60, top: 4, amp: 6, period: 5, color: 0x343c56, haze: 0.6 },
      { edge: 'scallop', z: -40, top: 16, amp: 2.5, period: 7, color: 0x2a3046, haze: 0.3, hang: true, texture: 'newsprint' },
      { edge: 'roofs', z: -26, top: 3, amp: 3, period: 4, color: 0x1e2436, haze: 0.3 },
    ],
    scenery: [],
    life: [
      { kind: 'rain', count: 80, color: 0xa8b8d8, z: -3 },
      { kind: 'pages', count: 6, color: 0xe8e0c8, z: -8 },
    ],
    clouds: false,
    extras: ['lightning'],
  },
  // "Shadow board" (Tool Pipes): a workshop pegboard that hangs tools.
  pipes: {
    skyTop: '#0f3b3a',
    skyMid: '#17564f',
    skyBottom: '#1f6f68',
    ground: 0x4f7a6a,
    grass: 0x7fe0b8,
    brick: 0x3fb0a0,
    hard: 0x9aaab0,
    pipe: 0x20b89a,
    platform: 0xffd23a,
    lights: { sun: 0xe0fff4, sky: 0xc0fff0, ground: 0x1a3a34 },
    tiles: { cap: 'rubber', soil: 'hexmould', hard: 'screws', shelf: 'holes', decor: 'screws' },
    strips: [],
    scenery: [
      { piece: 'wall', z: -24, every: 10, colors: [0x0e3a36, 0x0a2e2a, 0x1c5a52], haze: 0.3, pattern: 'pegboard' },
      { piece: 'tubes', z: -14, every: 16, colors: [0x124a44, 0x1c5a52], haze: 0.3 },
    ],
    life: [{ kind: 'motes', count: 30, color: 0x3fffc8, z: -10 }],
    clouds: false,
    extras: ['marbles'],
  },
  // "Puppet theatre" (Reasoning Ghost House): velvet, with the moon seen through the windows.
  ghost: {
    skyTop: '#0d0618',
    skyMid: '#1c0f2e',
    skyBottom: '#2c1640',
    ground: 0x4a3558,
    grass: 0x8a5aa8,
    brick: 0x7c5238,
    hard: 0x7a6890,
    pipe: 0x3a6a5a,
    platform: 0xa87a50,
    lights: { sun: 0xb8c0ff, sky: 0xc0b0ff, ground: 0x2a1830 },
    tiles: { cap: 'carpet', soil: 'wainscot', hard: 'corners', shelf: 'books', decor: 'candles' },
    strips: [{ edge: 'roofs', z: -60, top: 5, amp: 4, period: 7, color: 0x120a20, haze: 0.6 }],
    scenery: [
      { piece: 'wall', z: -10, every: 11, colors: [0x241238, 0x2e1a46], haze: 0.3, pattern: 'damask', hole: { w: 2, h: 5, y: 6 } },
      { piece: 'torches', z: -9.5, every: 11, y: 6.5, colors: [0xffd27a, 0xff9a3a], haze: 0 },
    ],
    life: [{ kind: 'fireflies', count: 30, color: 0xd8ff7a, z: -6 }],
    celestial: { kind: 'moon', color: 0xf4ecd0, accent: 0xd8cfb0, r: 3.5, dx: 10, y: 10 },
    clouds: false,
    extras: ['moonbeams'],
    light: 0.75,
  },
  // "Clockwork" (Swarm Factory): tin and brass.
  factory: {
    skyTop: '#2a2622',
    skyMid: '#3e342c',
    skyBottom: '#6e5a48',
    ground: 0x74767e,
    grass: 0xe0a840,
    brick: 0xa86e46,
    hard: 0x9a9ea6,
    pipe: 0xc07030,
    platform: 0xe8c070,
    lights: { sun: 0xffd9a0, sky: 0xffe8c8, ground: 0x4a3424 },
    tiles: { cap: 'walkway', soil: 'plates', hard: 'crate', shelf: 'slots', decor: 'bolts' },
    strips: [{ edge: 'skyline', z: -65, top: 3, amp: 5, period: 6, color: 0x4a3e34, haze: 0.5 }],
    scenery: [
      { piece: 'stacks', z: -40, every: 16, colors: [0x3a302a, 0x6a5040], haze: 0.35 },
      { piece: 'gears', z: -24, every: 9, colors: [0x2e2622], haze: 0.25 },
    ],
    life: [{ kind: 'smoke', count: 24, color: 0x8a7a6a, z: -40 }],
    clouds: false,
  },
  // "Brass frontier" (Three Tiers, Glasswing): black glass, brass and resin.
  frontier: {
    skyTop: '#0a0714',
    skyMid: '#1f0c24',
    skyBottom: '#3a1030',
    ground: 0x4a4058,
    grass: 0xd8b458,
    brick: 0x9a4458,
    hard: 0x7a7088,
    pipe: 0x7a4ab0,
    platform: 0xd8b060,
    lights: { sun: 0xffd8a8, sky: 0xe0b0ff, ground: 0x6a1a3a },
    tiles: { cap: 'trim', soil: 'resin', hard: 'star', shelf: 'rivets', decor: 'shards' },
    strips: [{ edge: 'jagged', z: -60, top: 6, amp: 6, period: 8, color: 0x2a0e28, haze: 0.6, rim: 0xc9a44a }],
    scenery: [
      { piece: 'spires', z: -24, every: 10, colors: [0x1a0c20, 0xff4fd8], haze: 0.25 },
      { piece: 'prisms', z: -14, every: 17, colors: [0x14081a, 0xc9a44a], haze: 0.3 },
    ],
    life: [{ kind: 'embers', count: 40, color: 0xffb040, z: -4 }],
    clouds: false,
    extras: ['aurora'],
    lavaPits: true,
  },
  // "Orrery" (Frontier Castle, the finale): the lid of the box is open to the stars.
  finale: {
    skyTop: '#05061a',
    skyMid: '#0e1440',
    skyBottom: '#23306a',
    ground: 0x3a4068,
    grass: 0xffd166,
    brick: 0x7a80c8,
    hard: 0x6a70a8,
    pipe: 0x6a8ae0,
    platform: 0xfff0c0,
    lights: { sun: 0xfff0c0, sky: 0xb8c8ff, ground: 0x6a5020 },
    tiles: { cap: 'trim', soil: 'starfield', hard: 'star', shelf: 'glow', decor: 'twinkles' },
    strips: [{ edge: 'rolling', z: -50, top: -1, amp: 1.5, period: 60, color: 0x141c50, haze: 0.25 }],
    scenery: [],
    life: [
      { kind: 'stars', count: 300, color: 0xffffff, z: -80, y: [-10, 45] },
      { kind: 'shootingStar', count: 1, color: 0xfff0c0, z: -70 },
    ],
    celestial: { kind: 'ringed', color: 0x6a8ae0, accent: 0xffd166, r: 4, dx: -28, y: 22 },
    clouds: false,
    extras: ['orrery'],
  },
};
