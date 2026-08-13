/**
 * Highlight-colour presets cycled with the R key. Index 0 is the theme
 * default (copper in dark, teal in light) — left as `null` so the piano keeps
 * using the --key-highlight / --key-lit tokens. Indices 1–6 are a rainbow that
 * harmonises with the warm default while spanning the spectrum. Ordered as a
 * descending-hue loop (coral→rose→violet→teal→green→gold, wrapping back to
 * coral), so gold sits between green and coral. `lit` is the brighter
 * playback-flash variant of each.
 */
export const HIGHLIGHT_PRESETS: Array<{ hi: string; lit: string } | null> = [
  null, // theme default
  { hi: '#d97455', lit: '#ee9d82' }, // coral
  { hi: '#c56a96', lit: '#de96b9' }, // rose
  { hi: '#8a7ec9', lit: '#b2a8e2' }, // violet
  { hi: '#3fa9cc', lit: '#76cce5' }, // teal
  { hi: '#6fae5a', lit: '#9cce87' }, // green
  { hi: '#d9a92b', lit: '#f0c54e' }, // gold (matches the pitch-axis dominant)
];

export const HIGHLIGHT_COUNT = HIGHLIGHT_PRESETS.length;
