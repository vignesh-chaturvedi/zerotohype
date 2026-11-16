// Each track is a line on the map: a colour, the colour of text set on it, and a drawing of the thing
// the track is about. The colours are RAL Classic shades, as signs and trains are painted (approximate
// screen values from W3Schools' RAL list). `on` is the text colour that reads at 4.5:1 or more on the line.

export type Motif = "layers" | "book" | "sign" | "funding" | "flow" | "ladder" | "oracle" | "window" | "blocks" | "nodes" | "ticks" | "liq";

export type Look = { color: string; on: string; ral: string; motif: Motif };

const white = "#ffffff", black = "#1e1e1e";

export const trackLook: Record<string, Look> = {
  T1: { color: "#f0ca00", on: black, ral: "1023 Traffic yellow", motif: "layers" },
  T2: { color: "#0e518d", on: white, ral: "5017 Traffic blue", motif: "book" },
  T3: { color: "#c1121c", on: white, ral: "3020 Traffic red", motif: "sign" },
  T4: { color: "#008754", on: white, ral: "6024 Traffic green", motif: "funding" },
  T5: { color: "#992572", on: white, ral: "4006 Traffic purple", motif: "flow" },
  T6: { color: "#e15501", on: "#000000", ral: "2009 Traffic orange", motif: "ladder" },
  T7: { color: "#07737a", on: white, ral: "5021 Water blue", motif: "oracle" },
  T8: { color: "#a65e2f", on: white, ral: "8023 Orange brown", motif: "window" },
  T9: { color: "#83639d", on: white, ral: "4005 Blue lilac", motif: "blocks" },
  T10: { color: "#4e5451", on: white, ral: "7043 Traffic grey B", motif: "nodes" },
};

export const lookOf = (code: string): Look => trackLook[code] ?? { color: "#4e5451", on: white, ral: "7043 Traffic grey B", motif: "nodes" };

/** Inline style for an element drawn in a track's colours: --c is the line, --on the text set on it. */
export const lineStyle = (code: string) => {
  const { color, on } = lookOf(code);
  return `--c: ${color}; --on: ${on}`;
};

export const stageNotes: Record<string, string> = {
  Foundations: "How the exchange is put together, how to read it, and how to sign for it.",
  Trading: "How positions are priced, margined and funded, and how apps earn from the order flow.",
  "Deploying markets": "Launching spot tokens, running a HIP-3 perp DEX and settling HIP-4 outcome markets.",
  "Contracts and infra": "Contracts on HyperEVM that act on HyperCore, nodes, raw data and the explorer API.",
};
