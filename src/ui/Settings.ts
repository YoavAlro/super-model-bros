import { music } from '../game/music';
import { prefs } from '../game/prefs';
import { setMuted } from '../game/sfx';
import type { Settings } from '../save';
import { el } from './dom';

type Toggle = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const TOGGLES: { key: Toggle; label: string; help: string }[] = [
  { key: 'music', label: 'Music', help: 'Background music' },
  { key: 'sfx', label: 'Sound effects', help: 'Jumps, tokens and bumps' },
  { key: 'reduceMotion', label: 'Reduce motion', help: 'No screen shake, no flashing or strobing' },
  { key: 'assist', label: 'Assist mode', help: 'The game runs a little slower, and a new run starts with 9 lives' },
  { key: 'largeText', label: 'Large text', help: 'Bigger cards, HUD and messages' },
];

/** Applies the settings that live outside the simulation: audio, motion, text size. */
export function applySettings(s: Settings): void {
  setMuted(!s.sfx);
  music.setEnabled(s.music);
  prefs.reduceMotion = s.reduceMotion;
  document.body.classList.toggle('large-text', s.largeText);
}

/** A toggle button for every setting. Changes apply at once; `onChange` saves them. */
export function settingsPanel(s: Settings, onChange: () => void): HTMLElement {
  const box = el('div', 'settings');
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Settings');
  for (const { key, label, help } of TOGGLES) {
    const btn = el('button', 'btn toggle');
    btn.title = help;
    const render = () => {
      btn.textContent = `${label}: ${s[key] ? 'on' : 'off'}`;
      btn.setAttribute('aria-pressed', String(s[key]));
      btn.classList.toggle('on', s[key]);
    };
    btn.addEventListener('click', () => {
      s[key] = !s[key];
      render();
      applySettings(s);
      onChange();
    });
    render();
    box.append(btn);
  }
  return box;
}
