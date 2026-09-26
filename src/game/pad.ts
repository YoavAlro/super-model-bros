/** One player's controller state for a single simulation step. The sim reads only this. */
export interface Pad {
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
  /** The power button: fire tool calls, think, switch size, or use a character trait. */
  action: boolean;
}

export const emptyPad = (): Pad => ({ left: false, right: false, jump: false, run: false, action: false });
