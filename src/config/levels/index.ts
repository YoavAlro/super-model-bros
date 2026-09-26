import type { LevelSpec } from '../levelSpec';
import { WORLD_1 } from './world1';
import { WORLD_2 } from './world2';

export const ALL_LEVELS: LevelSpec[] = [...WORLD_1, ...WORLD_2];

export const LEVELS: Record<string, LevelSpec> = Object.fromEntries(ALL_LEVELS.map((l) => [l.id, l]));
