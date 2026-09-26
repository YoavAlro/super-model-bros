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

/** Token silhouettes (see makeToken). */
export type ChipShape = 'book' | 'octagon' | 'page' | 'hex' | 'bubble' | 'shield' | 'photo' | 'triangle' | 'gear' | 'arrow' | 'diamond' | 'torn';

export interface DataType {
  id: DataTypeId;
  label: string;
  color: number;
  /** Printed on the token face, so types are told apart by shape as well as color. */
  glyph: string;
  /** Token silhouette: data has corners; only traps are plain discs. */
  chip: ChipShape;
}

export const DATA_TYPES: Record<DataTypeId, DataType> = {
  books: { id: 'books', label: 'Books', color: 0x4da3ff, glyph: 'B', chip: 'book' },
  web: { id: 'web', label: 'Web', color: 0x3dff9a, glyph: 'W', chip: 'octagon' },
  wiki: { id: 'wiki', label: 'Wikipedia', color: 0xe8ecff, glyph: 'Wi', chip: 'page' },
  code: { id: 'code', label: 'Code', color: 0xffa640, glyph: '{}', chip: 'hex' },
  feedback: { id: 'feedback', label: 'Human Feedback', color: 0xffd84d, glyph: 'HF', chip: 'bubble' },
  principles: { id: 'principles', label: 'Principles', color: 0xff7eb6, glyph: '§', chip: 'shield' },
  images: { id: 'images', label: 'Images', color: 0x7ef0ff, glyph: '▣', chip: 'photo' },
  reasoning: { id: 'reasoning', label: 'Reasoning', color: 0xb07cff, glyph: '∴', chip: 'triangle' },
  tools: { id: 'tools', label: 'Tool use', color: 0x1fd1b0, glyph: 'fn', chip: 'gear' },
  agentic: { id: 'agentic', label: 'Agent tasks', color: 0xff6b4a, glyph: '▶', chip: 'arrow' },
  audio: { id: 'audio', label: 'Audio', color: 0xd7a6ff, glyph: '♪', chip: 'diamond' },
  shadow: { id: 'shadow', label: 'Shadow library', color: 0x8a8a9a, glyph: '☠', chip: 'torn' },
};

export const DATA_TYPE_IDS = Object.keys(DATA_TYPES) as DataTypeId[];
