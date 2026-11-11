// The exchange's precision rules for prices and sizes, from the docs' "Tick and lot size" page:
// - a price has at most 5 significant figures, unless it is a whole number, which is always allowed;
// - a price has at most 6 − szDecimals decimals on a perp, or 8 − szDecimals on spot;
// - a size has at most szDecimals decimals.
// On 11 Nov 2026 every price resting in mainnet's books fitted these rules: 9,800 levels across 179 perps
// and 73 spot pairs. Everything here works on the digits as text, so no rounding error creeps in.

export type Kind = "perp" | "spot";

export const maxPriceDecimals = (kind: Kind, szDecimals: number) => Math.max(0, (kind === "perp" ? 6 : 8) - szDecimals);

/** A number as typed: "73,692.50" becomes "73692.50". Null if it isn't a plain positive decimal. */
export function parseDecimal(input: string): string | null {
  const s = input.trim().replace(/[,_\s]/g, "");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return s.startsWith(".") ? `0${s}` : s.endsWith(".") ? s.slice(0, -1) : s;
}

/** The form to send, and to sign: no trailing zeros after the point, no point with nothing after it, and
 *  no leading zeros. Signing "0.50" where the exchange reads "0.5" recovers the wrong address (T3). */
export const wire = (s: string) => (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s).replace(/^0+(?=\d)/, "");

export function decimalsOf(s: string) {
  const w = wire(s);
  const i = w.indexOf(".");
  return i < 0 ? 0 : w.length - i - 1;
}

/** Significant figures: leading zeros don't count, and a whole number's trailing zeros don't either. */
export function sigFigs(s: string) {
  const w = wire(s);
  const digits = w.replace(".", "").replace(/^0+/, "");
  return w.includes(".") ? digits.length : digits.replace(/0+$/, "").length;
}

const isZero = (s: string) => /^[0.]*$/.test(s);

/** The power of ten of the number's first significant digit: 2 for 123.4, -3 for 0.00123. */
function magnitude(w: string) {
  const [whole, frac = ""] = w.split(".");
  if (whole !== "0") return whole.length - 1;
  return -((frac.match(/^0*/)?.[0].length ?? 0) + 1);
}

const scaled = (w: string) => BigInt(w.replace(".", ""));
function unscale(n: bigint, decimals: number) {
  if (decimals <= 0) return wire(n.toString());
  const s = n.toString().padStart(decimals + 1, "0");
  return wire(`${s.slice(0, -decimals)}.${s.slice(-decimals)}`);
}

export type PriceCheck = { ok: boolean; problems: string[]; decimals: number; sig: number; whole: boolean; maxDecimals: number };

export function checkPrice(px: string, kind: Kind, szDecimals: number): PriceCheck {
  const maxDecimals = maxPriceDecimals(kind, szDecimals);
  const decimals = decimalsOf(px);
  const sig = sigFigs(px);
  const whole = decimals === 0;
  const problems: string[] = [];
  if (isZero(px)) problems.push("A price has to be more than zero.");
  else {
    if (decimals > maxDecimals) problems.push(`It has ${decimals} decimal${decimals === 1 ? "" : "s"}; this market allows ${maxDecimals}.`);
    if (!whole && sig > 5) problems.push(`It has ${sig} significant figures; only whole numbers may have more than 5.`);
  }
  return { ok: problems.length === 0, problems, decimals, sig, whole, maxDecimals };
}

/** The price steps where `px` sits: one step is 10^(magnitude − 4), for 5 significant figures, but no finer
 *  than the market's decimals allow, and 1 from 100,000 up, where whole numbers are allowed. */
export function stepExponent(px: string, kind: Kind, szDecimals: number) {
  const e = magnitude(wire(px));
  return e >= 5 ? 0 : Math.max(e - 4, -maxPriceDecimals(kind, szDecimals));
}

/** The nearest valid prices at or below and at or above `px`, in wire form, and the step between them. */
export function nearestPrices(px: string, kind: Kind, szDecimals: number) {
  const w = wire(px);
  const d = decimalsOf(w);
  const k = stepExponent(w, kind, szDecimals);
  const step = k >= 0 ? `1${"0".repeat(k)}` : `0.${"0".repeat(-k - 1)}1`;
  if (k + d <= 0) return { down: w, up: w, step };
  const unit = 10n ** BigInt(k + d);
  const n = scaled(w);
  const down = (n / unit) * unit;
  const up = down === n ? n : down + unit;
  return { down: unscale(down, d), up: unscale(up, d), step };
}

export type SizeCheck = { ok: boolean; problems: string[]; decimals: number; down: string; nearest: string };

/** A size has at most szDecimals decimals. Round down when it mustn't exceed what you hold. */
export function checkSize(sz: string, szDecimals: number): SizeCheck {
  const w = wire(sz);
  const decimals = decimalsOf(w);
  const problems: string[] = [];
  let down = w;
  let nearest = w;
  if (decimals > szDecimals) {
    const unit = 10n ** BigInt(decimals - szDecimals);
    const n = scaled(w);
    const d = (n / unit) * unit;
    down = unscale(d, decimals);
    nearest = unscale(n - d >= unit / 2n ? d + unit : d, decimals);
    problems.push(`It has ${decimals} decimal${decimals === 1 ? "" : "s"}; this market's sizes have ${szDecimals}.`);
  }
  if (isZero(down) && !problems.length) problems.push("A size has to be more than zero.");
  return { ok: problems.length === 0, problems, decimals, down, nearest };
}
