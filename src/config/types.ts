import type { DataTypeId } from './dataTypes';

export type Mix = Partial<Record<DataTypeId, number>>;

export interface FactCard {
  title: string;
  date: string;
  lines: string[];
}
