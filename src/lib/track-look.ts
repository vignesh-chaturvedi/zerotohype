// Each track's cover: a colour and a drawing of the thing the track is about.

export type Motif = "layers" | "book" | "sign" | "funding" | "flow" | "ladder" | "oracle" | "window" | "blocks" | "nodes";

export const trackLook: Record<string, { color: string; motif: Motif }> = {
  T1: { color: "#ecd98f", motif: "layers" },
  T2: { color: "#bcd0e6", motif: "book" },
  T3: { color: "#ebbfb3", motif: "sign" },
  T4: { color: "#c6d3ad", motif: "funding" },
  T5: { color: "#d5c8ea", motif: "flow" },
  T6: { color: "#f0c592", motif: "ladder" },
  T7: { color: "#a6d4ca", motif: "oracle" },
  T8: { color: "#e5a793", motif: "window" },
  T9: { color: "#bac2ec", motif: "blocks" },
  T10: { color: "#d2ccc0", motif: "nodes" },
};

export const lookOf = (code: string) => trackLook[code] ?? { color: "#d2ccc0", motif: "nodes" as Motif };

export const stageNotes: Record<string, string> = {
  Foundations: "How the exchange is put together, how to read it, and how to sign for it.",
  Trading: "How positions are priced, margined and funded, and how apps earn from the order flow.",
  "Deploying markets": "Launching spot tokens, running a HIP-3 perp DEX and settling HIP-4 outcome markets.",
  "Contracts and infra": "Contracts on HyperEVM that act on HyperCore, nodes, raw data and the explorer API.",
};
