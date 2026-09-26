import { describe, expect, it } from 'vitest';
import { THEME_TUNES, TUNES } from '../config/music';
import { THEMES } from '../config/themes';
import { degreeToMidi, eighth, midiToHz, parseMelody } from './musicTheory';

describe('music', () => {
  it('maps scale degrees to notes, across octaves', () => {
    expect(degreeToMidi(60, 'major', 0)).toBe(60);
    expect(degreeToMidi(60, 'major', 2)).toBe(64);
    expect(degreeToMidi(60, 'minor', 2)).toBe(63);
    expect(degreeToMidi(60, 'major', 7)).toBe(72);
    expect(degreeToMidi(60, 'major', -1)).toBe(59);
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(eighth({ bpm: 120 })).toBeCloseTo(0.25);
  });

  it('parses held notes and rests', () => {
    const { notes, steps } = parseMelody('0 ~ ~ . | 4 . 7 ~');
    expect(steps).toBe(8);
    expect(notes).toEqual([
      { step: 0, degree: 0, length: 3 },
      { step: 4, degree: 4, length: 1 },
      { step: 6, degree: 7, length: 2 },
    ]);
  });

  it('ships tunes whose melodies fill every bar of their chord progression', () => {
    for (const [id, tune] of Object.entries(TUNES)) {
      const { steps, notes } = parseMelody(tune.melody);
      expect(steps, id).toBe(tune.chords.length * 8);
      expect(notes.length, id).toBeGreaterThan(8);
      expect(tune.bpm, id).toBeGreaterThanOrEqual(80);
    }
  });

  it('gives every level theme a tune', () => {
    for (const theme of Object.keys(THEMES)) expect(TUNES[THEME_TUNES[theme as keyof typeof THEME_TUNES]], theme).toBeDefined();
  });
});
