export type ThemeId = 'plains' | 'caves' | 'castle' | 'hills' | 'skies' | 'storm' | 'pipes' | 'ghost' | 'factory' | 'frontier' | 'finale';

export type Backdrop = 'hills' | 'crystals' | 'pillars' | 'cloudsea' | 'pipes' | 'ghost' | 'gears' | 'towers' | 'stars';

export interface Theme {
  skyTop: string;
  skyBottom: string;
  ground: number;
  grass: number;
  brick: number;
  hard: number;
  pipe: number;
  /** One-way platforms: clouds, planks, bridges. */
  platform: number;
  /** Distant decoration. */
  backdrop: Backdrop;
  clouds: boolean;
  /** Pits glow with lava instead of dropping into the void. */
  lavaPits?: boolean;
  /** Scene light level (ghost houses are dim). */
  light?: number;
}

export const THEMES: Record<ThemeId, Theme> = {
  plains: {
    skyTop: '#4f86f7',
    skyBottom: '#b8e2ff',
    ground: 0xa0612e,
    grass: 0x46c04a,
    brick: 0xc8602a,
    hard: 0x9c7a55,
    pipe: 0x2fae4a,
    platform: 0xf4f4f4,
    backdrop: 'hills',
    clouds: true,
  },
  caves: {
    skyTop: '#040817',
    skyBottom: '#11234f',
    ground: 0x35598c,
    grass: 0x5b8fd6,
    brick: 0x2f6fb0,
    hard: 0x4a6690,
    pipe: 0x2fae4a,
    platform: 0x8fb4ff,
    backdrop: 'crystals',
    clouds: false,
  },
  castle: {
    skyTop: '#140909',
    skyBottom: '#3d1a14',
    ground: 0x6d6d72,
    grass: 0x8f8f96,
    brick: 0x7d3b35,
    hard: 0x77777f,
    pipe: 0x2fae4a,
    platform: 0x9a8c7a,
    backdrop: 'pillars',
    clouds: false,
    lavaPits: true,
  },
  hills: {
    skyTop: '#ff9e6d',
    skyBottom: '#ffe3b0',
    ground: 0x8a5a32,
    grass: 0x7bc043,
    brick: 0xd0703a,
    hard: 0xa88a60,
    pipe: 0x3a9e5a,
    platform: 0xfff4e0,
    backdrop: 'hills',
    clouds: true,
  },
  skies: {
    skyTop: '#2f7cf6',
    skyBottom: '#d6f0ff',
    ground: 0xc9d8ff,
    grass: 0xffffff,
    brick: 0x6f8fe0,
    hard: 0xa0b4e8,
    pipe: 0x3aa0e8,
    platform: 0xffffff,
    backdrop: 'cloudsea',
    clouds: true,
  },
  storm: {
    skyTop: '#1b1f2e',
    skyBottom: '#4b5570',
    ground: 0x4c5064,
    grass: 0x7d88a8,
    brick: 0x5d4a6a,
    hard: 0x6a6f84,
    pipe: 0x4a7a8a,
    platform: 0xc8d0e8,
    backdrop: 'towers',
    clouds: true,
  },
  pipes: {
    skyTop: '#0f3b3a',
    skyBottom: '#3fa39a',
    ground: 0x3d5a4f,
    grass: 0x56c29a,
    brick: 0x2f8a78,
    hard: 0x557a70,
    pipe: 0x19b36b,
    platform: 0xd8fff0,
    backdrop: 'pipes',
    clouds: false,
  },
  ghost: {
    skyTop: '#0d0618',
    skyBottom: '#2c1640',
    ground: 0x4a3558,
    grass: 0x6d4f86,
    brick: 0x5c3a2a,
    hard: 0x55486a,
    pipe: 0x3a6a5a,
    platform: 0x8a6a4a,
    backdrop: 'ghost',
    clouds: false,
    light: 0.75,
  },
  factory: {
    skyTop: '#2a2622',
    skyBottom: '#6e5a48',
    ground: 0x5a5c62,
    grass: 0xd8a040,
    brick: 0x8a5a3a,
    hard: 0x74787f,
    pipe: 0xc07030,
    platform: 0xe8c070,
    backdrop: 'gears',
    clouds: false,
  },
  frontier: {
    skyTop: '#0a0714',
    skyBottom: '#3a1030',
    ground: 0x3e3448,
    grass: 0xc9a44a,
    brick: 0x6a2e3a,
    hard: 0x5a5068,
    pipe: 0x7a4ab0,
    platform: 0xd0b060,
    backdrop: 'towers',
    clouds: false,
    lavaPits: true,
  },
  finale: {
    skyTop: '#05061a',
    skyBottom: '#23306a',
    ground: 0x2c3150,
    grass: 0xffd166,
    brick: 0x5a5fa0,
    hard: 0x4a5080,
    pipe: 0x6a8ae0,
    platform: 0xfff0c0,
    backdrop: 'stars',
    clouds: false,
  },
};
