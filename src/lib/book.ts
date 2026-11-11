// Reading an order book the way the API sends it: two lists of levels, bids then asks, each best first,
// and each level a price, the total size resting there and how many orders make it up.

export type Level = { px: string; sz: string; n: number };

/** Running totals of size, best level first. */
export function totals(levels: Level[]) {
  let t = 0;
  return levels.map((l) => (t += Number(l.sz)));
}

/** What a market order for `size` would do against one side of the book: how many levels it reaches,
 *  its average and last fill prices, and how much the levels shown can't fill. */
export function sweep(levels: Level[], size: number) {
  let left = size;
  let cost = 0;
  let used = 0;
  let last: string | null = null;
  for (const l of levels) {
    if (left <= size * 1e-12) break;
    const take = Math.min(left, Number(l.sz));
    cost += take * Number(l.px);
    left -= take;
    used++;
    last = l.px;
  }
  const unfilled = left <= size * 1e-12 ? 0 : left;
  const filled = size - unfilled;
  return { used, last, unfilled, filled, avg: filled > 0 ? cost / filled : NaN, cost };
}

/** The price step a grouping gives near `price`: nSigFigs keeps that many significant figures, and a
 *  mantissa of 2 or 5 makes steps of 2 or 5 in the last of them. */
export function groupStep(price: number, nSigFigs: number, mantissa?: number) {
  const e = Math.floor(Math.log10(price));
  return 10 ** (e + 1 - nSigFigs) * (mantissa ?? 1);
}

/** The groupings the server offers, as subscription settings. Anything else closes the connection. */
export const GROUPINGS: { nSigFigs?: number; mantissa?: number }[] = [
  {},
  { nSigFigs: 5 },
  { nSigFigs: 5, mantissa: 2 },
  { nSigFigs: 5, mantissa: 5 },
  { nSigFigs: 4 },
  { nSigFigs: 3 },
  { nSigFigs: 2 },
];
