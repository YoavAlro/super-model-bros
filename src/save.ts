export interface SaveData {
  /** Index into LEVELS of the next level to play. */
  levelIndex: number;
  players: 1 | 2;
}

const KEY = 'super-model-bros.save.v1';

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (typeof d.levelIndex === 'number' && (d.players === 1 || d.players === 2)) {
      return { levelIndex: d.levelIndex, players: d.players };
    }
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  return null;
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable: progress just isn't kept.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
