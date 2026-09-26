/**
 * Pure rules for fork agents (the fork cherry). Each player can run a small team of forks that copy
 * its moves. Forks never cost a life; they vanish when they fall or get hit.
 */

/** Forks one player can run at once. */
export const MAX_FORKS = 2;

/** Can a player with `current` forks take one more? */
export const canFork = (current: number): boolean => current < MAX_FORKS;

/** Forks line up this many tiles apart behind their owner (two-key plates sit this far apart). */
export const FORK_SPACING = 2;

/** Where the i-th fork starts (and regroups to): in a line behind its owner. */
export const forkOffset = (i: number, facing: number): number => -facing * FORK_SPACING * (i + 1);
