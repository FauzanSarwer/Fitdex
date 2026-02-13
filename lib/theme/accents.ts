export type AccentName =
  | "indigo"
  | "cyan"
  | "violet"
  | "fuchsia"
  | "lime"
  | "amber"
  | "rose";

export type AccentTone = {
  solid: string;
  gradient: string;
  softGlow: string;
  borderGlow: string;
};

export const accents: Record<AccentName, AccentTone> = {
  indigo: {
    solid: "rgba(99, 102, 241, 0.92)",
    gradient: "linear-gradient(120deg, rgba(99,102,241,0.92) 0%, rgba(56,189,248,0.84) 100%)",
    softGlow: "radial-gradient(circle at center, rgba(99,102,241,0.3) 0%, rgba(99,102,241,0) 72%)",
    borderGlow: "linear-gradient(120deg, rgba(99,102,241,0.8) 0%, rgba(56,189,248,0.65) 100%)",
  },
  cyan: {
    solid: "rgba(6, 182, 212, 0.92)",
    gradient: "linear-gradient(120deg, rgba(6,182,212,0.9) 0%, rgba(59,130,246,0.8) 100%)",
    softGlow: "radial-gradient(circle at center, rgba(6,182,212,0.28) 0%, rgba(6,182,212,0) 72%)",
    borderGlow: "linear-gradient(120deg, rgba(6,182,212,0.8) 0%, rgba(59,130,246,0.65) 100%)",
  },
  violet: {
    solid: "rgba(139, 92, 246, 0.94)",
    gradient: "linear-gradient(120deg, rgba(139,92,246,0.92) 0%, rgba(99,102,241,0.84) 100%)",
    softGlow: "radial-gradient(circle at center, rgba(139,92,246,0.3) 0%, rgba(139,92,246,0) 72%)",
    borderGlow: "linear-gradient(120deg, rgba(139,92,246,0.8) 0%, rgba(99,102,241,0.7) 100%)",
  },
  fuchsia: {
    solid: "rgba(217, 70, 239, 0.9)",
    gradient: "linear-gradient(120deg, rgba(217,70,239,0.9) 0%, rgba(139,92,246,0.84) 100%)",
    softGlow: "radial-gradient(circle at center, rgba(217,70,239,0.28) 0%, rgba(217,70,239,0) 72%)",
    borderGlow: "linear-gradient(120deg, rgba(217,70,239,0.76) 0%, rgba(139,92,246,0.66) 100%)",
  },
  lime: {
    solid: "rgba(132, 204, 22, 0.9)",
    gradient: "linear-gradient(120deg, rgba(132,204,22,0.9) 0%, rgba(16,185,129,0.82) 100%)",
    softGlow: "radial-gradient(circle at center, rgba(132,204,22,0.3) 0%, rgba(132,204,22,0) 72%)",
    borderGlow: "linear-gradient(120deg, rgba(132,204,22,0.74) 0%, rgba(16,185,129,0.62) 100%)",
  },
  amber: {
    solid: "rgba(245, 158, 11, 0.92)",
    gradient: "linear-gradient(120deg, rgba(245,158,11,0.9) 0%, rgba(251,113,133,0.78) 100%)",
    softGlow: "radial-gradient(circle at center, rgba(245,158,11,0.3) 0%, rgba(245,158,11,0) 72%)",
    borderGlow: "linear-gradient(120deg, rgba(245,158,11,0.78) 0%, rgba(251,113,133,0.66) 100%)",
  },
  rose: {
    solid: "rgba(244, 63, 94, 0.9)",
    gradient: "linear-gradient(120deg, rgba(244,63,94,0.88) 0%, rgba(236,72,153,0.82) 100%)",
    softGlow: "radial-gradient(circle at center, rgba(244,63,94,0.28) 0%, rgba(244,63,94,0) 72%)",
    borderGlow: "linear-gradient(120deg, rgba(244,63,94,0.74) 0%, rgba(236,72,153,0.64) 100%)",
  },
};

export const accentOrder: AccentName[] = [
  "indigo",
  "cyan",
  "violet",
  "fuchsia",
  "lime",
  "amber",
  "rose",
];

export const accentRgb: Record<AccentName, string> = {
  indigo: "99, 102, 241",
  cyan: "6, 182, 212",
  violet: "139, 92, 246",
  fuchsia: "217, 70, 239",
  lime: "132, 204, 22",
  amber: "245, 158, 11",
  rose: "244, 63, 94",
};

export const accentByIndex = (index: number): AccentName => {
  const idx = Math.abs(index) % accentOrder.length;
  return accentOrder[idx];
};
