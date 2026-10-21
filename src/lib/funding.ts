// Funding maths for main-DEX perps, from https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding.
// Rates are fractions: 0.0001 means 0.01%.

/** Interest component: 0.01% per 8 hours. */
export const INTEREST_8H = 0.0001;
/** How far funding may move from the interest rate, either way, per 8 hours. */
export const CLAMP_8H = 0.0005;

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

/** Premium from impact prices, as the exchange computes it for main-DEX perps. */
export function premium(oracle: number, impactBid: number, impactAsk: number): number {
  return (Math.max(impactBid - oracle, 0) - Math.max(oracle - impactAsk, 0)) / oracle;
}

/** Hourly funding rate for a given hour-average premium. */
export function hourlyFunding(avgPremium: number): number {
  return (avgPremium + clamp(INTEREST_8H - avgPremium, -CLAMP_8H, CLAMP_8H)) / 8;
}

/**
 * The hour-average premium that produces a given hourly rate. Inside the flat zone, where the
 * clamp cancels the premium, any premium in the zone gives the same rate, so there's no answer.
 */
export function impliedAvgPremium(hourly: number): number | null {
  const f = hourly * 8;
  if (Math.abs(f - INTEREST_8H) < 1e-12) return null;
  return f < INTEREST_8H ? f - CLAMP_8H : f + CLAMP_8H;
}
