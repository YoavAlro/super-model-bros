export type DataTypeId =
  | 'books'
  | 'web'
  | 'wiki'
  | 'code'
  | 'feedback'
  | 'principles'
  | 'images'
  | 'reasoning'
  | 'tools'
  | 'agentic'
  | 'audio'
  | 'shadow';

export interface DataType {
  id: DataTypeId;
  label: string;
  color: number;
  /** Printed on the token face, so types are told apart by shape as well as color. */
  glyph: string;
}

export const DATA_TYPES: Record<DataTypeId, DataType> = {
  books: { id: 'books', label: 'Books', color: 0x4da3ff, glyph: 'B' },
  web: { id: 'web', label: 'Web', color: 0x3dff9a, glyph: 'W' },
  wiki: { id: 'wiki', label: 'Wikipedia', color: 0xe8ecff, glyph: 'Wi' },
  code: { id: 'code', label: 'Code', color: 0xffa640, glyph: '{}' },
  feedback: { id: 'feedback', label: 'Human Feedback', color: 0xffd84d, glyph: 'HF' },
  principles: { id: 'principles', label: 'Principles', color: 0xff7eb6, glyph: '§' },
  images: { id: 'images', label: 'Images', color: 0x7ef0ff, glyph: '▣' },
  reasoning: { id: 'reasoning', label: 'Reasoning', color: 0xb07cff, glyph: '∴' },
  tools: { id: 'tools', label: 'Tool use', color: 0x1fd1b0, glyph: 'fn' },
  agentic: { id: 'agentic', label: 'Agent tasks', color: 0xff6b4a, glyph: '▶' },
  audio: { id: 'audio', label: 'Audio', color: 0xd7a6ff, glyph: '♪' },
  shadow: { id: 'shadow', label: 'Shadow library', color: 0x8a8a9a, glyph: '☠' },
};

export const DATA_TYPE_IDS = Object.keys(DATA_TYPES) as DataTypeId[];
