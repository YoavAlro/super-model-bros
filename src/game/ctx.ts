import type * as THREE from 'three';
import type { Enemy } from './Enemies';
import type { Trap } from './Items';
import type { LevelGrid } from './level';
import type { PlayerActor } from './Player';

/** What actors may read and do during a simulation step. Implemented by the Stage. */
export interface StageCtx {
  readonly grid: LevelGrid;
  readonly scene: THREE.Scene;
  /** Seeded: the simulation stays deterministic for replays and future online play. */
  rng(): number;
  /** Living players, clones included. */
  players(): PlayerActor[];
  /** The living player furthest to the right. */
  lead(): PlayerActor | undefined;
  readonly camLeft: number;
  readonly camRight: number;
  /** Seconds since the level started. */
  readonly time: number;
  toast(message: string, kind?: 'info' | 'good' | 'bad'): void;
  shake(amount: number): void;
  addEnemy(e: Enemy): void;
  addTrap(t: Trap): void;
  traps(): Trap[];
}
