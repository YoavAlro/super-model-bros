/**
 * Accessibility preferences that rendering code reads every frame (set from the player's settings by
 * `applySettings` in `src/ui/Settings.ts`). The simulation never reads these, so replays stay identical.
 */
export const prefs = {
  /** No screen shake, no strobing blinks or pulsing lights. */
  reduceMotion: false,
};

/**
 * Blinking for a hit or an expiring platform: a quick strobe normally, or a steady half-visible state
 * with reduced motion (visible on even blink phases only when motion is allowed).
 */
export function blinkVisible(t: number, rate: number): boolean {
  return prefs.reduceMotion || Math.floor(t * rate) % 2 === 0;
}
