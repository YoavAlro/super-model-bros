/**
 * The finale recap: how a finished run is summed up against real history. Ranks are playful
 * titles for the player, never claims about any real model or person.
 */

export interface RecapRank {
  /** Lowest score (0–1) that earns this rank. */
  min: number;
  title: string;
  line: string;
}

/** Highest first. The score mixes history stars and hype calls (see `src/game/recap.ts`). */
export const RECAP_RANKS: RecapRank[] = [
  { min: 0.9, title: 'Frontier historian', line: 'Your run matched history almost perfectly.' },
  { min: 0.7, title: 'Senior researcher', line: 'You know this history well. A few calls went the other way.' },
  { min: 0.45, title: 'Research intern', line: 'A solid run. History had a few surprises for you.' },
  { min: 0, title: 'Base model', line: 'Plenty left to learn. Every run is more training data.' },
];

/** How much each part counts toward the recap score. */
export const RECAP_WEIGHTS = { stars: 0.6, calls: 0.4 };

/** The very last line of every run. */
export const RECAP_CLOSING = 'Thank you for playing! But AGI is in another castle. (It is always next year.)';
