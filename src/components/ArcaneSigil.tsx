/**
 * Arcane magic-circle motif for the card-backs — a Frieren-flavoured summoning
 * sigil. Gold ornament + element-coloured runes (driven by the `--lvl` custom
 * property on an ancestor). The runic ring rotates slowly and the inner
 * hexagram counter-rotates; both stop under reduced motion (see index.css).
 */
export function ArcaneSigil() {
  return (
    <svg className="arcane-sigil" viewBox="0 0 200 200" fill="none" aria-hidden="true">
      {/* Concentric outer rings */}
      <circle cx="100" cy="100" r="94" stroke="#d6b26e" strokeOpacity="0.7" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="88" stroke="var(--lvl, #62aef0)" strokeOpacity="0.45" strokeWidth="1" />

      {/* Static cardinal ticks */}
      <g stroke="#d6b26e" strokeOpacity="0.7" strokeWidth="1.5">
        <line x1="100" y1="6" x2="100" y2="18" />
        <line x1="194" y1="100" x2="182" y2="100" />
        <line x1="100" y1="194" x2="100" y2="182" />
        <line x1="6" y1="100" x2="18" y2="100" />
      </g>

      {/* Slowly rotating runic ring */}
      <g className="arcane-spin">
        <circle
          cx="100"
          cy="100"
          r="80"
          stroke="var(--lvl, #62aef0)"
          strokeOpacity="0.6"
          strokeWidth="2.5"
          strokeDasharray="2 9"
        />
      </g>

      {/* Counter-rotating hexagram */}
      <g className="arcane-spin-rev" stroke="var(--lvl, #62aef0)" strokeOpacity="0.4" strokeWidth="1.3">
        <polygon points="100,46 147,127 53,127" />
        <polygon points="100,154 53,73 147,73" />
      </g>

      {/* Inner ring + central sparkle */}
      <circle cx="100" cy="100" r="34" stroke="#d6b26e" strokeOpacity="0.6" strokeWidth="1" />
      <path
        d="M100 76 C102 94 106 98 124 100 C106 102 102 106 100 124 C98 106 94 102 76 100 C94 98 98 94 100 76 Z"
        fill="#d6b26e"
        fillOpacity="0.88"
      />
    </svg>
  );
}
