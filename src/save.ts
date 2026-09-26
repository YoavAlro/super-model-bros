import type { CharacterId } from './config/characters';
import type { PathId } from './config/paths';
import { emptyProgress, type LevelResult, type Progress } from './game/progress';

/** A player's call on a hype power-up, and whether history agreed. */
export interface HypeCall {
  call: 'lasting' | 'passing';
  correct: boolean;
}

/** One run through a path. */
export interface RunState {
  path: PathId;
  players: 1 | 2;
  chars: CharacterId[];
  /** Index into the path's steps of the next level to play. */
  step: number;
  results: Record<string, LevelResult>;
  hypes: Record<string, HypeCall>;
  /** Lasting-hype upgrades earned on this run. */
  perks: string[];
  /** Choices that change later levels (e.g. grabbing shadow-library books). */
  flags: string[];
  deaths: number;
  /** Benchmark Kart finishing places, by race id. */
  karts: Record<string, number>;
}

export interface Settings {
  music: boolean;
  sfx: boolean;
  /** No screen shake, fewer flashes. */
  reduceMotion: boolean;
  /** Assist mode: more lives and a slower game. */
  assist: boolean;
  /** Bigger HUD and card text. */
  largeText: boolean;
}

export interface SaveData {
  v: 2;
  runs: Partial<Record<PathId, RunState>>;
  progress: Progress;
  settings: Settings;
}

const KEY = 'super-model-bros.save.v2';
const OLD_KEY = 'super-model-bros.save.v1';

export const defaultSettings = (): Settings => ({ music: true, sfx: true, reduceMotion: false, assist: false, largeText: false });

export const newRun = (path: PathId, players: 1 | 2, chars: CharacterId[]): RunState => ({
  path,
  players,
  chars,
  step: 0,
  results: {},
  hypes: {},
  perks: [],
  flags: [],
  deaths: 0,
  karts: {},
});

const fresh = (): SaveData => ({ v: 2, runs: {}, progress: emptyProgress(), settings: defaultSettings() });

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<SaveData>;
      if (d.v === 2) {
        return {
          v: 2,
          runs: d.runs ?? {},
          progress: { ...emptyProgress(), ...d.progress },
          settings: { ...defaultSettings(), ...d.settings },
        };
      }
    }
    // Version 1 kept one GPT-path level index.
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const d = JSON.parse(old) as { levelIndex?: number; players?: 1 | 2 };
      const save = fresh();
      if (typeof d.levelIndex === 'number' && (d.players === 1 || d.players === 2)) {
        const run = newRun('gpt', d.players, d.players === 2 ? ['gpt', 'claude'] : ['gpt']);
        run.step = d.levelIndex;
        save.runs.gpt = run;
      }
      return save;
    }
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  return fresh();
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable: progress just isn't kept.
  }
}
