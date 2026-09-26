export interface Pad {
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
}

type KeyMap = Record<keyof Pad, string[]>;

const SOLO: KeyMap = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space', 'KeyW', 'ArrowUp', 'KeyZ', 'KeyK'],
  run: ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyJ'],
};
/** One keyboard, two players: GPT on the left hand, Claude on the arrows. */
const P1: KeyMap = { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW', 'Space'], run: ['ShiftLeft'] };
const P2: KeyMap = { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], run: ['ShiftRight', 'Slash', 'Enter'] };

const BLOCKED_DEFAULTS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const emptyPad = (): Pad => ({ left: false, right: false, jump: false, run: false });

/** Keyboard pads for 1–2 players, plus on-screen touch controls feeding player 1. */
export class Input {
  readonly pads: Pad[];
  private readonly maps: KeyMap[];
  private readonly keys = new Set<string>();
  private readonly touch = emptyPad();
  private pauseQueued = false;

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
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
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
    buttons.append(this.holdButton('B', 'run'), this.holdButton('A', 'jump'));

    wrap.append(dpad, buttons);
    overlay.append(wrap);
  }

  private holdButton(label: string, key: keyof Pad): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `touch-btn touch-${key}`;
    btn.textContent = label;
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
