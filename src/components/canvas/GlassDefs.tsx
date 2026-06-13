/**
 * Shared SVG gradient definitions for the Glass surface mode. Mounted once;
 * piano keys reference these by id (#mtp-key-hi / #mtp-key-lit) via CSS when
 * `[data-surfaces='glass']` is active. Stops use theme CSS vars, so a single
 * def serves every piano in both themes. The axis runs top-left → lower-right
 * at ~60°, adding a faint lighter point that never darkens the base colour.
 */
export function GlassDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
      <defs>
        <linearGradient id="mtp-key-hi" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--key-highlight) 80%, #fff)' }} />
          <stop offset="1" style={{ stopColor: 'var(--key-highlight)' }} />
        </linearGradient>
        <linearGradient id="mtp-key-lit" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--key-lit) 80%, #fff)' }} />
          <stop offset="1" style={{ stopColor: 'var(--key-lit)' }} />
        </linearGradient>
      </defs>
    </svg>
  );
}
