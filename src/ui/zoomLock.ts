/**
 * iOS Safari ignores `user-scalable=no`, so two thumbs on the d-pad and the jump button can pinch
 * or double-tap the page into a zoom that the game has no way out of. This blocks Safari's pinch
 * gestures, multi-finger moves and double-taps on game controls, and snaps the page back if a zoom
 * slips through anyway.
 */

/** Two taps this close together (ms) read as a double-tap zoom. */
export const DOUBLE_TAP_MS = 350;

/**
 * Should this touchend be cancelled to stop a double-tap zoom? Only a quick second tap, and never on
 * a card or menu button (cancelling touchend there would swallow its click).
 */
export function blocksDoubleTap(sinceLastTap: number, onMenuButton: boolean): boolean {
  return sinceLastTap < DOUBLE_TAP_MS && !onMenuButton;
}

const BASE_VIEWPORT = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

/** Rewriting the viewport tag makes iOS re-apply its limits, which undoes a zoom. */
function resetZoom(): void {
  const vv = window.visualViewport;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!vv || !meta || vv.scale <= 1.01) return;
  meta.setAttribute('content', BASE_VIEWPORT.replace('initial-scale=1.0', 'initial-scale=0.99'));
  requestAnimationFrame(() => meta.setAttribute('content', BASE_VIEWPORT));
}

export function lockZoom(): void {
  const block = (e: Event) => e.preventDefault();
  // Safari's own pinch events.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, block, { passive: false });
  // More than one finger moving is never a scroll in this game.
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
  let lastTap = -Infinity;
  document.addEventListener(
    'touchend',
    (e) => {
      // Clickable things keep their click; the hold-to-use game controls (touch buttons, d-pad) do not need one.
      const onMenuButton = !!(e.target as Element | null)?.closest?.('button:not(.touch-btn), a, summary, input, select, textarea, label');
      if (blocksDoubleTap(e.timeStamp - lastTap, onMenuButton)) e.preventDefault();
      lastTap = e.timeStamp;
    },
    { passive: false },
  );
  window.visualViewport?.addEventListener('resize', resetZoom);
  window.addEventListener('orientationchange', () => setTimeout(resetZoom, 300));
}
