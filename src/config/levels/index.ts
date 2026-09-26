import type { LevelSpec } from '../levelSpec';
import { WORLD_1 } from './world1';
import { WORLD_2 } from './world2';
import { WORLD_3 } from './world3';
import { WORLD_4 } from './world4';
import { WORLD_5 } from './world5';

export const ALL_LEVELS: LevelSpec[] = [...WORLD_1, ...WORLD_2, ...WORLD_3, ...WORLD_4, ...WORLD_5];

export const LEVELS: Record<string, LevelSpec> = Object.fromEntries(ALL_LEVELS.map((l) => [l.id, l]));
