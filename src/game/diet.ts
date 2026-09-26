import { DATA_TYPE_IDS, DATA_TYPES, type DataTypeId } from '../config/dataTypes';

export type Mix = Partial<Record<DataTypeId, number>>;
export type Counts = Record<DataTypeId, number>;

export const emptyCounts = (): Counts =>
  Object.fromEntries(DATA_TYPE_IDS.map((id) => [id, 0])) as Counts;

export const total = (c: Counts) => DATA_TYPE_IDS.reduce((s, id) => s + c[id], 0);

export function shares(c: Counts): Counts {
  const n = total(c);
  const out = emptyCounts();
  if (n > 0) for (const id of DATA_TYPE_IDS) out[id] = c[id] / n;
  return out;
}

/** 1 = the tokens you collected match the real training mix exactly; 0 = no overlap. */
export function dietMatch(c: Counts, recipe: Mix): number {
  if (total(c) === 0) return 0;
  const s = shares(c);
  const distance = DATA_TYPE_IDS.reduce((sum, id) => sum + Math.abs(s[id] - (recipe[id] ?? 0)), 0);
  return 1 - distance / 2;
}

/** History stars awarded at the flag: how faithfully you trained. */
export function historyStars(match: number): 1 | 2 | 3 {
  if (match >= 0.9) return 3;
  if (match >= 0.65) return 2;
  return 1;
}

/** Advice on the biggest gap between the collected mix and the real one. */
export function dietHint(c: Counts, recipe: Mix, model: string): string | null {
  if (total(c) === 0) return null;
  const s = shares(c);
  const gaps = DATA_TYPE_IDS.map((id) => ({ id, gap: (recipe[id] ?? 0) - s[id] }));
  const deficit = gaps.reduce((a, b) => (b.gap > a.gap ? b : a));
  if (deficit.gap < 0.05) return null;
  return `${model} needs more ${DATA_TYPES[deficit.id].label}`;
}
