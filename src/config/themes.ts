export type ThemeId = 'plains' | 'caves' | 'castle';

export interface Theme {
  skyTop: string;
  skyBottom: string;
  ground: number;
  grass: number;
  brick: number;
  hard: number;
  pipe: number;
  /** Distant decoration: rolling hills, glowing data columns, or castle pillars. */
  backdrop: 'hills' | 'crystals' | 'pillars';
  clouds: boolean;
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
    backdrop: 'pillars',
    clouds: false,
  },
};
