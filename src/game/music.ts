import { TUNES, type Tune, type TuneId } from '../config/music';
import { degreeToMidi, eighth, midiToHz, parseMelody, type NoteEvent } from './musicTheory';
import { audioContext } from './sfx';

/**
 * Background music: a small WebAudio step sequencer that plays the tunes in `src/config/music.ts`
 * (a lead line, a bass line, and an optional soft arpeggio). It schedules a little ahead of the
 * audio clock, so the game loop's frame rate never makes it stutter.
 */

const LOOKAHEAD = 0.3;
const TICK_MS = 80;
const VOLUME = 0.55;

interface Playing {
  id: TuneId;
  tune: Tune;
  notes: NoteEvent[];
  steps: number;
  step: number;
  next: number;
}

class MusicPlayer {
  private enabled = true;
  private wanted: TuneId | null = null;
  private playing: Playing | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private master: GainNode | null = null;

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.halt();
    else if (this.wanted) this.play(this.wanted);
  }

  /** Starts a tune from the top (or keeps it going if it is already playing). */
  play(id: TuneId): void {
    this.wanted = id;
    if (!this.enabled || this.playing?.id === id) return;
    const ctx = audioContext();
    if (!ctx) return;
    this.halt();
    this.master = ctx.createGain();
    this.master.gain.value = VOLUME;
    this.master.connect(ctx.destination);
    const tune = TUNES[id];
    const { notes, steps } = parseMelody(tune.melody);
    this.playing = { id, tune, notes, steps, step: 0, next: ctx.currentTime + 0.1 };
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop(): void {
    this.wanted = null;
    this.halt();
  }

  /** Quieter while paused or while a card is up. */
  duck(on: boolean): void {
    const ctx = audioContext();
    if (ctx && this.master) this.master.gain.setTargetAtTime(on ? VOLUME * 0.3 : VOLUME, ctx.currentTime, 0.1);
  }

  get current(): TuneId | null {
    return this.playing?.id ?? null;
  }

  private halt(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = null;
    const ctx = audioContext();
    if (ctx && this.master) {
      const m = this.master;
      m.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => m.disconnect(), 400);
    }
    this.master = null;
  }

  private schedule(): void {
    const ctx = audioContext();
    const p = this.playing;
    if (!ctx || !p || !this.master) return;
    if (ctx.state !== 'running') {
      // Hold the clock until audio is unlocked by a tap or key press.
      p.next = ctx.currentTime + 0.1;
      return;
    }
    const e = eighth(p.tune);
    while (p.next < ctx.currentTime + LOOKAHEAD) {
      this.playStep(p, p.step % p.steps, p.next, e);
      p.step++;
      p.next += e;
    }
  }

  private playStep(p: Playing, step: number, t: number, e: number): void {
    const { tune } = p;
    const bar = Math.floor(step / 8) % tune.chords.length;
    const root = tune.chords[bar];
    const beat = step % 8;
    for (const n of p.notes) if (n.step === step) this.note(degreeToMidi(tune.key, tune.mode, n.degree), t, n.length * e * 0.92, tune.lead, 0.09);
    const bassKey = tune.key - 24;
    if (tune.bass === 'pulse' && beat % 2 === 0) {
      this.note(degreeToMidi(bassKey, tune.mode, beat % 4 === 0 ? root : root + 4), t, e * 1.6, 'triangle', 0.16);
    } else if (tune.bass === 'walk' && beat % 2 === 0) {
      this.note(degreeToMidi(bassKey, tune.mode, root + [0, 2, 4, 5][beat / 2]), t, e * 1.8, 'triangle', 0.16);
    } else if (tune.bass === 'drone' && beat === 0) {
      this.note(degreeToMidi(bassKey, tune.mode, root), t, e * 7.5, 'triangle', 0.14);
    }
    if (tune.arp && beat % 2 === 1) this.note(degreeToMidi(tune.key - 12, tune.mode, root + [0, 2, 4, 2][(beat - 1) / 2]), t, e * 0.7, 'triangle', 0.05);
  }

  private note(midi: number, t: number, length: number, type: OscillatorType, volume: number): void {
    const ctx = audioContext();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(midiToHz(midi), t);
    const v = type === 'square' || type === 'sawtooth' ? volume * 0.5 : volume;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(v, t + 0.01);
    gain.gain.setTargetAtTime(v * 0.6, t + 0.02, 0.08);
    gain.gain.setTargetAtTime(0.0001, t + length, 0.03);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + length + 0.2);
  }
}

export const music = new MusicPlayer();
