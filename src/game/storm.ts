/** Pure storm rules. */

/** Which day of a multi-day storm it is, from how far the camera has scrolled through the level. */
export function stormDay(scrolled: number, span: number, days: number): number {
  if (span <= 0 || days <= 1) return 0;
  return Math.min(days - 1, Math.max(0, Math.floor((scrolled / span) * days)));
}
