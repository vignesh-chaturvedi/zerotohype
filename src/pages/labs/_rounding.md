Each function rounds once, to the nearest value the exchange accepts, and returns the text to send. That text has no trailing zeros, which is also the form to sign ([T3](/tracks/t03-signing-and-sending/)).

```python
import math


def round_price(px: float, sz_decimals: int, perp: bool = True) -> str:
    max_decimals = (6 if perp else 8) - sz_decimals
    # 5 significant figures, but no more decimals than the market allows. Whole numbers
    # are always allowed, so from 100,000 up this gives a whole number.
    decimals = max(0, min(max_decimals, 4 - math.floor(math.log10(px))))
    return to_wire(px, decimals)


def round_size(sz: float, sz_decimals: int) -> str:
    return to_wire(sz, sz_decimals)


def to_wire(x: float, decimals: int) -> str:
    """Fixed decimals, then no trailing zeros: "73796", not "73796.0"."""
    s = f"{x:.{decimals}f}"
    return s.rstrip("0").rstrip(".") if "." in s else s
```

```ts
export function roundPrice(px: number, szDecimals: number, perp = true): string {
  const maxDecimals = (perp ? 6 : 8) - szDecimals;
  // 5 significant figures, but no more decimals than the market allows. Whole numbers
  // are always allowed, so from 100,000 up this gives a whole number.
  const decimals = Math.max(0, Math.min(maxDecimals, 4 - Math.floor(Math.log10(px))));
  return toWire(px, decimals);
}

export function roundSize(sz: number, szDecimals: number): string {
  return toWire(sz, szDecimals);
}

/** Fixed decimals, then no trailing zeros: "73796", not "73796.0". */
function toWire(x: number, decimals: number): string {
  const s = x.toFixed(decimals);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}
```

```rust
pub fn round_price(px: f64, sz_decimals: i32, perp: bool) -> String {
    let most: i32 = if perp { 6 } else { 8 };
    // 5 significant figures, but no more decimals than the market allows. Whole numbers
    // are always allowed, so from 100,000 up this gives a whole number.
    let decimals = (4 - px.log10().floor() as i32).min(most - sz_decimals).max(0);
    to_wire(px, decimals as usize)
}

pub fn round_size(sz: f64, sz_decimals: i32) -> String {
    to_wire(sz, sz_decimals as usize)
}

/// Fixed decimals, then no trailing zeros: "73796", not "73796.0".
fn to_wire(x: f64, decimals: usize) -> String {
    let s = format!("{:.*}", decimals, x);
    if s.contains('.') { s.trim_end_matches('0').trim_end_matches('.').to_string() } else { s }
}
```
