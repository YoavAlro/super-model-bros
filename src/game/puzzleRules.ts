/** Pure puzzle rules (unit tested). The Puzzles module wires them to blocks, pipes and bars. */

/** Letters: how many times the letter really appears. */
export const letterCount = (word: string, letter: string): number => [...word].filter((c) => c === letter).length;

/** Tokens: how many tokens contain the letter. This is what a model that reads tokens "counts". */
export const tokenCount = (tokens: readonly string[], letter: string): number => tokens.filter((t) => t.includes(letter)).length;

export interface OrderStep {
  label: string;
  /** Release order; equal numbers came out on the same day (either order). null = never released. */
  order: number | null;
}

export type OrderResult = 'sealed' | 'wrong' | 'ok' | 'solved' | 'repeat';

/**
 * One landing in the Naming Maze. `done` holds the labels already entered; returns what happened,
 * and mutates `done` (cleared on a wrong step).
 */
export function enterInOrder(steps: readonly OrderStep[], done: Set<string>, label: string): OrderResult {
  const step = steps.find((s) => s.label === label);
  if (!step) return 'wrong';
  if (step.order === null) return 'sealed';
  if (done.has(label)) return 'repeat';
  const orders = steps.map((s) => s.order).filter((o): o is number => o !== null);
  const expected = Math.min(...orders.filter((o) => steps.some((s) => s.order === o && !done.has(s.label))));
  if (step.order !== expected) {
    done.clear();
    return 'wrong';
  }
  done.add(label);
  const remaining = steps.filter((s) => s.order !== null && !done.has(s.label));
  return remaining.length === 0 ? 'solved' : 'ok';
}
