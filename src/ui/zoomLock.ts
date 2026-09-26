/**
 * Keeps an accidental pinch from zooming the page on iOS Safari, and leaves a way back out if one gets
 * through anyway.
 *
 * Safari ignores `user-scalable=no`. During play every surface is `touch-action: none`, which WebKit
 * honours, but WebKit resets `touch-action` to `auto` inside scroll containers, and the fact cards, pause
 * panel, recap and title screen all scroll. A card that opens mid-run under the player's thumbs is
 * therefore pinchable: sliding on the d-pad with the other thumb on a button zooms the page. Back in the
 * game, `touch-action: none` then blocks the pinch that would zoom out, and no script can reset a user
 * zoom (Safari keeps it through viewport-tag changes).
 *
 * So at normal scale this cancels Safari's pinch gestures, multi-finger moves and double-taps on the game
 * controls. Once zoomed it stops blocking and marks `<html class="zoomed">`, which style.css uses to let
 * the game view take a pinch or double-tap back out.
 */

/** `visualViewport.scale` above this counts as zoomed in (it reads 1 at rest). */
export const ZOOMED_SCALE = 1.01;

export function isZoomedIn(scale: number | undefined): boolean {
  return (scale ?? 1) > ZOOMED_SCALE;
}

/** Should a touch move with this many fingers down be cancelled? Only at rest: zoomed in, a pinch is the way out. */
export function blocksPinch(fingers: number, scale: number | undefined): boolean {
  return fingers > 1 && !isZoomedIn(scale);
}

/** Hold-to-use controls: they read pointer events only, so cancelling their touch events costs nothing. */
const GAME_CONTROLS = '.touch-btn, .dpad';

export function lockZoom(): void {
  const scale = () => window.visualViewport?.scale;
  const atRest = () => !isZoomedIn(scale());

  // Safari's own pinch events.
  for (const type of ['gesturestart', 'gesturechange']) {
    document.addEventListener(
      type,
      (e) => {
        if (atRest()) e.preventDefault();
      },
      { passive: false },
    );
  }
  // Two fingers moving is a pinch, even when one of them is only resting on the d-pad.
  document.addEventListener(
    'touchmove',
    (e) => {
      if (blocksPinch(e.touches.length, scale())) e.preventDefault();
    },
    { passive: false },
  );
  // No double-tap zoom off the controls. Only the controls: menus, cards and links keep their clicks.
  document.addEventListener(
    'touchend',
    (e) => {
      if (atRest() && (e.target as Element | null)?.closest?.(GAME_CONTROLS)) e.preventDefault();
    },
    { passive: false },
  );

  // Zoomed in anyway (or Safari restored a zoom on reload): stop blocking and let style.css open the way out.
  const mark = () => document.documentElement.classList.toggle('zoomed', !atRest());
  window.visualViewport?.addEventListener('resize', mark);
  mark();
}
