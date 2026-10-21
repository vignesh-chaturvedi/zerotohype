// The three ways to average a window of prices, as hyperkeeper computes them.
// Samples are [ms from window start, price] or, for trades, [ms, price, size].

export type Sample = [number, number] | [number, number, number];

/**
 * Time-weighted average over [0, length): each price holds until the next sample. The window
 * needs a sample at or before its start, so the opening price is known.
 */
export function timeWeighted(samples: Sample[], length: number): number | null {
  const opening = samples.findLastIndex((s) => s[0] <= 0);
  if (opening < 0) return null;
  let total = 0;
  let at = 0;
  let price = samples[opening][1];
  for (const s of samples.slice(opening + 1)) {
    if (s[0] >= length) break;
    total += price * (s[0] - at);
    at = s[0];
    price = s[1];
  }
  total += price * (length - at);
  return total / length;
}

/** Plain mean of the samples inside [0, length), each counted once. */
export function plainMean(samples: Sample[], length: number): number | null {
  const inside = samples.filter((s) => s[0] >= 0 && s[0] < length);
  return inside.length ? inside.reduce((sum, s) => sum + s[1], 0) / inside.length : null;
}

/** Volume-weighted average of the trades inside [0, length). */
export function volumeWeighted(samples: Sample[], length: number): number | null {
  let notional = 0;
  let volume = 0;
  for (const s of samples) {
    if (s.length < 3 || s[0] < 0 || s[0] >= length) continue;
    notional += s[1] * s[2]!;
    volume += s[2]!;
  }
  return volume > 0 ? notional / volume : null;
}
