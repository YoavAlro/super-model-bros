import type { Mode, Tune } from '../config/music';

/** Pure music helpers for the sequencer (unit tested): scales, note numbers, and melody parsing. */

export const SCALES: Record<Mode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

/** The MIDI note of a scale degree (any integer: 7 is the octave, -1 the leading tone below). */
export function degreeToMidi(key: number, mode: Mode, degree: number): number {
  const scale = SCALES[mode];
  const octave = Math.floor(degree / 7);
  return key + 12 * octave + scale[((degree % 7) + 7) % 7];
}

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export interface NoteEvent {
  /** Eighth-note step where it starts. */
  step: number;
  degree: number;
  /** In eighth notes, including held `~` steps. */
  length: number;
}

/** Parses the melody notation into notes; `steps` is the loop length in eighths. */
export function parseMelody(melody: string): { notes: NoteEvent[]; steps: number } {
  const tokens = melody.split(/\s+/).filter((t) => t && t !== '|');
  const notes: NoteEvent[] = [];
  tokens.forEach((t, step) => {
    if (t === '~') {
      const last = notes[notes.length - 1];
      if (last && last.step + last.length === step) last.length++;
    } else if (t !== '.') {
      const degree = Number(t);
      if (Number.isNaN(degree)) throw new Error(`Bad melody token "${t}"`);
      notes.push({ step, degree, length: 1 });
    }
  });
  return { notes, steps: tokens.length };
}

/** Seconds per eighth note. */
export const eighth = (tune: Pick<Tune, 'bpm'>): number => 30 / tune.bpm;
