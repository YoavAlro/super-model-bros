import { emptyPad, type Pad } from './pad';

export type { Pad } from './pad';

type KeyMap = Record<keyof Pad, string[]>;

const SOLO: KeyMap = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space', 'KeyW', 'ArrowUp', 'KeyZ', 'KeyK'],
  run: ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyJ'],
  action: ['KeyS', 'ArrowDown', 'KeyC', 'KeyL'],
};
/** One keyboard, two players: player 1 on the left hand, player 2 on the arrows. */
const P1: KeyMap = { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW', 'Space'], run: ['ShiftLeft'], action: ['KeyS'] };
const P2: KeyMap = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  jump: ['ArrowUp'],
  run: ['ShiftRight', 'Slash', 'Enter'],
  action: ['ArrowDown'],
};

const BLOCKED_DEFAULTS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * Keyboard pads for 1–2 players, plus on-screen touch controls feeding player 1. The game reads
 * only `pads`, sampled once per frame, so a network or replay source could stand in for this class.
 */
export class Input {
  readonly pads: Pad[];
  private readonly maps: KeyMap[];
  private readonly keys = new Set<string>();
  private readonly touch = emptyPad();
  private pauseQueued = false;
  private touchWrap: HTMLDivElement | null = null;
  private powerBtn: HTMLButtonElement | null = null;

  constructor(players: 1 | 2, overlay: HTMLElement, isTouch: boolean) {
    this.maps = players === 2 ? [P1, P2] : [SOLO];
    this.pads = this.maps.map(emptyPad);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    if (isTouch) this.buildTouchControls(overlay);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.touchWrap?.remove();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    // Let menus and cards use the keyboard normally.
    if ((e.target as HTMLElement | null)?.closest?.('.modal-backdrop')) return;
    if (BLOCKED_DEFAULTS.has(e.code)) e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyP') this.pauseQueued = true;
    this.keys.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
  };

  /** Drops held keys (after a modal card, so a held key doesn't keep running). */
  clear(): void {
    this.keys.clear();
    for (const k of Object.keys(this.touch) as (keyof Pad)[]) this.touch[k] = false;
    for (const pad of this.pads) for (const k of Object.keys(pad) as (keyof Pad)[]) pad[k] = false;
  }

  static isTouchDevice(): boolean {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  update(): void {
    this.maps.forEach((map, i) => {
      const pad = this.pads[i];
      for (const k of Object.keys(map) as (keyof Pad)[]) {
        pad[k] = map[k].some((code) => this.keys.has(code)) || (i === 0 && this.touch[k]);
      }
    });
  }

  consumePause(): boolean {
    const queued = this.pauseQueued;
    this.pauseQueued = false;
    return queued;
  }

  requestPause(): void {
    this.pauseQueued = true;
  }

  /** Labels the touch power button with what it does right now (or hides it). */
  setPowerLabel(label: string | null): void {
    if (!this.powerBtn) return;
    this.powerBtn.style.visibility = label ? 'visible' : 'hidden';
    if (label && this.powerBtn.textContent !== label) this.powerBtn.textContent = label;
  }

  private buildTouchControls(overlay: HTMLElement): void {
    const wrap = document.createElement('div');
    wrap.className = 'touch-controls';

    const dpad = document.createElement('div');
    dpad.className = 'dpad';
    dpad.innerHTML = '<span>◀</span><span>▶</span>';
    // Sliding a thumb across the d-pad switches direction without lifting.
    const steer = (e: PointerEvent) => {
      const r = dpad.getBoundingClientRect();
      const left = e.clientX < r.left + r.width / 2;
      this.touch.left = left;
      this.touch.right = !left;
    };
    dpad.addEventListener('pointerdown', (e) => {
      dpad.setPointerCapture(e.pointerId);
      steer(e);
    });
    dpad.addEventListener('pointermove', (e) => {
      if (dpad.hasPointerCapture(e.pointerId)) steer(e);
    });
    const release = () => {
      this.touch.left = false;
      this.touch.right = false;
    };
    dpad.addEventListener('pointerup', release);
    dpad.addEventListener('pointercancel', release);

    const buttons = document.createElement('div');
    buttons.className = 'action-buttons';
    this.powerBtn = this.holdButton('✦', 'action');
    this.powerBtn.style.visibility = 'hidden';
    buttons.append(this.powerBtn, this.holdButton('B', 'run'), this.holdButton('A', 'jump'));

    wrap.append(dpad, buttons);
    overlay.append(wrap);
    this.touchWrap = wrap;
  }

  private holdButton(label: string, key: keyof Pad): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `touch-btn touch-${key}`;
    btn.textContent = label;
    btn.setAttribute('aria-label', key);
    btn.addEventListener('pointerdown', (e) => {
      btn.setPointerCapture(e.pointerId);
      this.touch[key] = true;
    });
    for (const evt of ['pointerup', 'pointercancel'] as const) {
      btn.addEventListener(evt, () => (this.touch[key] = false));
    }
    return btn;
  }
}
