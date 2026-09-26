/** Every level map is this many rows tall. */
export const MAP_HEIGHT = 14;

/**
 * Joins map chunks left to right. Each chunk is a list of rows; short rows are padded with
 * spaces and short chunks are padded at the top, so chunks can be written at their natural size.
 */
export function stitch(...chunks: string[][]): string[] {
  const rows = Array.from({ length: MAP_HEIGHT }, () => '');
  for (const chunk of chunks) {
    if (chunk.length > MAP_HEIGHT) throw new Error(`Chunk is ${chunk.length} rows tall; max ${MAP_HEIGHT}`);
    const width = Math.max(...chunk.map((r) => r.length));
    const padded = [...Array.from({ length: MAP_HEIGHT - chunk.length }, () => ''), ...chunk];
    padded.forEach((row, i) => (rows[i] += row.padEnd(width, ' ')));
  }
  return rows;
}

/** A chunk of flat ground `n` tiles wide, two rows deep. */
export const flat = (n: number): string[] => ['#'.repeat(n), '#'.repeat(n)];

/** A pit `n` tiles wide. */
export const pit = (n: number): string[] => [' '.repeat(n), ' '.repeat(n)];

/**
 * Fills token placeholders in a shared chunk: `Q`, `V` and `Y` become this level's token letters,
 * so one chunk can carry Tool tokens in one level and Reasoning tokens in another.
 */
export function fill(chunk: string[], tokens: { Q: string; V?: string; Y?: string }): string[] {
  return chunk.map((row) =>
    row.replace(/Q/g, tokens.Q).replace(/V/g, tokens.V ?? tokens.Q).replace(/Y/g, tokens.Y ?? tokens.V ?? tokens.Q),
  );
}
