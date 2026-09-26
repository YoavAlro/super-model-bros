import { describe, expect, it } from 'vitest';
import { blocksPinch, isZoomedIn } from './zoomLock';

describe('zoom lock', () => {
  it('blocks a pinch at normal scale but lets a zoomed page pinch back out', () => {
    expect(blocksPinch(2, 1)).toBe(true);
    expect(blocksPinch(2, undefined)).toBe(true);
    expect(blocksPinch(1, 1)).toBe(false);
    expect(blocksPinch(2, 1.6)).toBe(false);
  });

  it('treats only a real zoom as zoomed', () => {
    expect(isZoomedIn(undefined)).toBe(false);
    expect(isZoomedIn(1.005)).toBe(false);
    expect(isZoomedIn(1.3)).toBe(true);
  });
});
