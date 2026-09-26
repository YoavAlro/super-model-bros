/**
 * Events: storm levels (short, timed danger pinned to real incidents). Hype power-ups and
 * Moments join this file in the event-system milestone. See `docs/events.md`.
 */

export type StormId = 'boardCrisis' | 'pauseLetter';

export interface StormSpec {
  id: StormId;
  name: string;
  /** The camera scrolls on its own at this many tiles per second. */
  autoscroll?: number;
  /** Day labels, shown as the camera crosses each equal slice of the level. */
  days?: string[];
  /** Conveyor belts reverse at the start of every new day: the ground shifts. */
  flipConveyors?: boolean;
  /** Collecting this many heart tokens ends the storm early. */
  hearts?: number;
  /** Toast when the hearts end it. */
  heartsDone?: string;
  /** A fog wall that rolls in from the left and slows anyone it catches. */
  fog?: { speed: number; slow: number; start: number };
}

export const STORMS: Record<StormId, StormSpec> = {
  boardCrisis: {
    id: 'boardCrisis',
    name: 'Five Days in November',
    autoscroll: 4.2,
    days: ['Day 1 · Friday, Nov 17', 'Day 2 · Saturday, Nov 18', 'Day 3 · Sunday, Nov 19', 'Day 4 · Monday, Nov 20', 'Day 5 · Tuesday, Nov 21'],
    flipConveyors: true,
    hearts: 12,
    heartsDone: 'Nothing without its people! The storm ends early.',
  },
  pauseLetter: {
    id: 'pauseLetter',
    name: 'The Pause Letter',
    fog: { speed: 3.4, slow: 0.55, start: -14 },
  },
};
