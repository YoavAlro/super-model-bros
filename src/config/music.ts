import type { ThemeId } from './themes';

/**
 * Original background music, written as scale degrees over a chord progression and played by the
 * WebAudio sequencer in `src/game/music.ts`. No melody here is borrowed from another game.
 *
 * Melody notation, one token per eighth note (8 per bar): a number is a scale degree of the key
 * (0 = tonic, 7 = the tonic an octave up, negative = below), `~` holds the previous note, `.` rests,
 * and `|` separates bars (for reading only).
 */

export type Mode = 'major' | 'minor' | 'dorian' | 'phrygian' | 'mixolydian';

export interface Tune {
  bpm: number;
  /** MIDI note of the melody's tonic. */
  key: number;
  mode: Mode;
  /** The root of each bar's chord, as a scale degree. */
  chords: number[];
  melody: string;
  lead: OscillatorType;
  /** pulse: root and fifth on every beat; walk: a walking line; drone: one long root per bar. */
  bass: 'pulse' | 'walk' | 'drone';
  /** Soft chord arpeggio on the off-beats. */
  arp?: boolean;
}

export type TuneId = 'overworld' | 'underground' | 'castle' | 'sky' | 'storm' | 'ghost' | 'factory' | 'frontier' | 'finale' | 'boss' | 'kart';

export const TUNES: Record<TuneId, Tune> = {
  overworld: {
    bpm: 138,
    key: 72,
    mode: 'major',
    chords: [0, 4, 5, 3, 3, 4, 0, 0],
    melody: '0 2 4 7 ~ 4 5 4 | ~ 2 4 ~ 1 . -1 . | 5 ~ 4 2 4 ~ 5 7 | ~ 5 4 2 0 ~ ~ . | 3 ~ 5 7 ~ 5 3 2 | 1 ~ 4 ~ 6 ~ 4 2 | 4 5 7 ~ 9 ~ 7 5 | 7 ~ ~ . 0 . . .',
    lead: 'square',
    bass: 'walk',
    arp: true,
  },
  underground: {
    bpm: 118,
    key: 69,
    mode: 'minor',
    chords: [0, 0, 5, 4],
    melody: '0 . 2 . 3 . 2 . | 0 . -2 . -1 . . . | 5 . 4 . 2 . 0 . | -1 . 1 . 4 . . .',
    lead: 'square',
    bass: 'pulse',
  },
  castle: {
    bpm: 108,
    key: 62,
    mode: 'phrygian',
    chords: [0, 1, 0, 6],
    melody: '0 ~ 1 ~ 0 ~ -1 ~ | 0 ~ 3 ~ 1 ~ ~ . | 4 ~ 3 ~ 1 ~ 0 ~ | 1 ~ 0 ~ -1 ~ ~ .',
    lead: 'sawtooth',
    bass: 'drone',
  },
  sky: {
    bpm: 126,
    key: 77,
    mode: 'major',
    chords: [0, 3, 5, 4],
    melody: '4 ~ 7 ~ 9 ~ 7 4 | 5 ~ ~ 3 5 ~ 7 ~ | 9 ~ 7 5 4 ~ 2 ~ | 1 ~ 2 4 ~ . . .',
    lead: 'triangle',
    bass: 'walk',
    arp: true,
  },
  storm: {
    bpm: 150,
    key: 64,
    mode: 'minor',
    chords: [0, 5, 3, 4],
    melody: '0 2 0 3 0 4 3 2 | 5 4 5 3 5 2 4 1 | 3 2 3 0 3 -1 2 0 | 4 ~ 3 ~ 2 ~ 1 ~',
    lead: 'square',
    bass: 'pulse',
  },
  ghost: {
    bpm: 94,
    key: 67,
    mode: 'dorian',
    chords: [0, 3, 0, 4],
    melody: '4 ~ ~ 3 2 ~ ~ . | 3 ~ ~ 2 1 ~ ~ . | 4 ~ 6 ~ 5 ~ 3 ~ | 2 ~ ~ ~ . . . .',
    lead: 'sine',
    bass: 'drone',
    arp: true,
  },
  factory: {
    bpm: 134,
    key: 74,
    mode: 'mixolydian',
    chords: [0, 0, 6, 4],
    melody: '0 . 0 4 . 4 3 . | 2 . 2 6 . 6 4 . | 0 . 7 . 6 . 4 . | 3 4 3 2 1 . . .',
    lead: 'square',
    bass: 'walk',
  },
  frontier: {
    bpm: 122,
    key: 60,
    mode: 'minor',
    chords: [0, 5, 6, 4],
    melody: '0 ~ 2 3 4 ~ 3 2 | 5 ~ 4 3 2 ~ 0 ~ | 6 ~ 5 4 5 ~ 7 ~ | 4 ~ 3 2 1 ~ ~ .',
    lead: 'sawtooth',
    bass: 'pulse',
  },
  finale: {
    bpm: 128,
    key: 63,
    mode: 'major',
    chords: [0, 4, 5, 3, 0, 4, 3, 4],
    melody: '0 ~ 4 ~ 7 ~ 9 ~ | 8 ~ 7 ~ 4 ~ ~ . | 5 ~ 7 ~ 9 ~ 11 ~ | 10 ~ 9 ~ 7 ~ ~ . | 7 ~ 9 ~ 11 ~ 14 ~ | 13 ~ 11 ~ 8 ~ ~ . | 10 ~ 9 ~ 7 ~ 5 ~ | 4 ~ ~ ~ ~ . . .',
    lead: 'square',
    bass: 'walk',
    arp: true,
  },
  boss: {
    bpm: 156,
    key: 59,
    mode: 'minor',
    chords: [0, 0, 5, 4],
    melody: '0 1 0 -1 0 3 2 1 | 0 1 0 -1 0 4 3 2 | 5 4 3 4 5 7 6 5 | 4 3 2 1 0 . -1 .',
    lead: 'sawtooth',
    bass: 'pulse',
  },
  kart: {
    bpm: 150,
    key: 67,
    mode: 'major',
    chords: [0, 3, 4, 0],
    melody: '4 5 7 ~ 4 5 7 ~ | 8 7 5 ~ 3 ~ . . | 4 5 7 ~ 9 ~ 7 5 | 4 ~ 2 ~ 0 ~ . .',
    lead: 'square',
    bass: 'walk',
  },
};

/** Which tune plays in each level theme. */
export const THEME_TUNES: Record<ThemeId, TuneId> = {
  plains: 'overworld',
  hills: 'overworld',
  caves: 'underground',
  pipes: 'underground',
  castle: 'castle',
  skycastle: 'castle',
  skies: 'sky',
  storm: 'storm',
  ghost: 'ghost',
  factory: 'factory',
  frontier: 'frontier',
  finale: 'finale',
};
