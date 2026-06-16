/**
 * Arcane magic-circle motif for the card-backs — a Frieren-flavoured summoning
 * sigil. Gold ornament + element-coloured runes (driven by the `--lvl` custom
 * property on an ancestor). The runic ring rotates slowly and the inner
 * hexagram counter-rotates; both stop under reduced motion (see index.css).
 *
 * Pass a `seed` (e.g. a hash of a paper's uuid) to nudge the static rotation,
 * scale and runic dash offset so no two sigils look identical while keeping the
 * same family. Omit it for the canonical card-back look.
 */
export function ArcaneSigil({ seed, className }: { seed?: number; className?: string }) {
  // Deterministic per-seed variation. Kept subtle so the family stays coherent.
  const rot = seed === undefined ? 0 : seed % 360;
  const scale = seed === undefined ? 1 : 0.9 + ((seed >> 3) % 18) / 100; // 0.90–1.07
  const dashOffset = seed === undefined ? 0 : seed % 11;

  return (
    <svg
      className={className ? `arcane-sigil ${className}` : 'arcane-sigil'}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      style={seed === undefined ? undefined : { transform: `rotate(${rot}deg) scale(${scale})` }}
    >
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
          strokeDashoffset={dashOffset}
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
