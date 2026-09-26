import { describe, expect, it } from 'vitest';
import { blocksDoubleTap, DOUBLE_TAP_MS } from './zoomLock';

describe('zoom lock', () => {
  it('cancels a quick second tap on game controls, never on menu buttons', () => {
    expect(blocksDoubleTap(120, false)).toBe(true);
    expect(blocksDoubleTap(120, true)).toBe(false);
    expect(blocksDoubleTap(DOUBLE_TAP_MS + 1, false)).toBe(false);
  });
});
