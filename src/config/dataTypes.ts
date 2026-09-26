export type DataTypeId = 'books' | 'web' | 'wiki' | 'code' | 'feedback';

export interface DataType {
  id: DataTypeId;
  label: string;
  color: number;
  /** Shown the first time the player eats this type. */
  blurb: string;
}

export const DATA_TYPES: Record<DataTypeId, DataType> = {
  books: {
    id: 'books',
    label: 'Books',
    color: 0x4da3ff,
    blurb: 'Books: long, coherent text. Great for learning how ideas connect across pages.',
  },
  web: {
    id: 'web',
    label: 'Web',
    color: 0x3dff9a,
    blurb: 'Web pages: huge and varied, but noisy. Quality filtering matters.',
  },
  wiki: {
    id: 'wiki',
    label: 'Wikipedia',
    color: 0xe8ecff,
    blurb: 'Wikipedia: small but clean and factual. A staple of almost every training mix.',
  },
  code: {
    id: 'code',
    label: 'Code',
    color: 0xffa640,
    blurb: 'Code: public repositories. Teaches precise, structured reasoning.',
  },
  feedback: {
    id: 'feedback',
    label: 'Human Feedback',
    color: 0xffd84d,
    blurb: 'Human feedback: people ranking answers. The fuel of RLHF and alignment.',
  },
};

export const DATA_TYPE_IDS = Object.keys(DATA_TYPES) as DataTypeId[];
