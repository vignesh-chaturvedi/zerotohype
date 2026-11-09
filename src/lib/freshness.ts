/**
 * How fresh a check made at `at` (ms since the epoch) is: "fresh" up to `fresh` days old, "aging" up
 * to `aging` days, and "stale" after that. Used at build time and again in the browser.
 */
export function freshness(at: number, fresh = 14, aging = 30, now = Date.now()) {
  const days = (now - at) / 864e5;
  return days <= fresh ? "fresh" : days <= aging ? "aging" : "stale";
}
