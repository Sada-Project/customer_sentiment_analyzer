import React from 'react';

/**
 * SadaLogo — inline SVG, transparent background, scales perfectly.
 *
 * Props:
 *   size      — height in px (default 36)
 *   variant   — 'full' (icon + wordmark) | 'icon' (icon only)
 */
const SadaLogo = ({ size = 36, variant = 'full' }) => {
  const iconSize  = size;
  const textSize  = size * 0.52;
  const gap       = size * 0.28;
  const totalW    = variant === 'full' ? iconSize + gap + textSize * 2.6 : iconSize;

  return (
    <svg
      width={totalW}
      height={iconSize}
      viewBox={`0 0 ${totalW} ${iconSize}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="SADA logo"
    >
      <defs>
        <linearGradient id="sada-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>

      {/* ── Icon: rounded square with waveform ── */}
      <rect
        x="0" y="0"
        width={iconSize} height={iconSize}
        rx={iconSize * 0.22}
        fill="url(#sada-grad)"
      />

      {/* Sound-wave / sentiment bars — 5 vertical bars centred in the icon */}
      {[0.28, 0.42, 0.56, 0.70, 0.84].map((xRatio, i) => {
        const heights = [0.35, 0.60, 0.80, 0.55, 0.38];
        const h       = iconSize * heights[i];
        const x       = iconSize * xRatio;
        const y       = (iconSize - h) / 2;
        const w       = iconSize * 0.065;
        return (
          <rect
            key={i}
            x={x - w / 2} y={y}
            width={w} height={h}
            rx={w / 2}
            fill="white"
            opacity={0.92}
          />
        );
      })}

      {/* ── Wordmark: SADA ── */}
      {variant === 'full' && (
        <text
          x={iconSize + gap}
          y={iconSize * 0.72}
          fontSize={textSize}
          fontWeight="800"
          fontFamily="Inter, -apple-system, sans-serif"
          letterSpacing="-0.04em"
          fill="#F8FAFC"
        >
          SADA
        </text>
      )}
    </svg>
  );
};

export default SadaLogo;
