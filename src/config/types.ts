import type { DataTypeId } from './dataTypes';

export type Mix = Partial<Record<DataTypeId, number>>;

/**
 * One line of a fact card. A fact names at least one source id from `SOURCES`;
 * a tip is gameplay advice and needs none. Unit tests enforce both.
 */
export interface FactLine {
  text: string;
  src?: string[];
  tip?: boolean;
}

export interface FactCard {
  title: string;
  date: string;
  lines: FactLine[];
}

/** A sourced fact line. */
export const fact = (text: string, ...src: string[]): FactLine => ({ text, src });

/** A gameplay tip: not a claim about history, so no source. */
export const tip = (text: string): FactLine => ({ text, tip: true });

export interface Source {
  title: string;
  publisher: string;
  url: string;
}
