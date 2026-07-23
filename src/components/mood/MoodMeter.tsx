'use client';

import { motion } from 'motion/react';
import { useState } from 'react';
import Card from '@/components/ui/Card';

export default function MoodMeter() {
  // Cortisol level (0-100). Default low (~20). 
  // Quiz evaluation will update this value.
  const [cortisolLevel] = useState(20);

  // SVG dimensions
  const width = 220;
  const height = 140;
  const cx = width / 2;  // center x = 110
  const cy = 120;         // center y near bottom
  const r = 80;           // radius of gauge arc

  const degToRad = (deg: number) => (deg * Math.PI) / 180;

  const polarToCartesian = (angleDeg: number) => ({
    x: cx + r * Math.cos(degToRad(angleDeg)),
    y: cy + r * Math.sin(degToRad(angleDeg)),
  });

  // Build an arc path from startDeg to endDeg
  const arcPath = (startDeg: number, endDeg: number) => {
    const s = polarToCartesian(startDeg);
    const e = polarToCartesian(endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  // 5 segments spanning 180° to 360° (top half of a circle in SVG coords)
  const segDeg = 36; // 180 / 5
  const segments = [
    { color: '#4CAF50' },  // green
    { color: '#CDDC39' },  // yellow-green
    { color: '#FFEB3B' },  // yellow
    { color: '#FF9800' },  // orange
    { color: '#F44336' },  // red
  ];

  // Needle rotation: 0% = -90° (pointing left), 100% = +90° (pointing right)
  // In CSS rotation terms: 0% maps to -90deg, 100% maps to +90deg
  const needleRotation = -90 + (cortisolLevel / 100) * 180;

  // Needle length
  const needleLen = r - 8;

  return (
    <Card padding="md" bgVariant="mint" className="w-full shadow-[0_6px_0_#7c6a75]">
      <div className="flex flex-col items-center gap-3">
        {/* Title */}
        <div className="text-lg font-black text-[#5d5770] uppercase tracking-widest border-b-2 border-[#7c6a75]/25 pb-2 w-full text-center font-fredoka">
          Cortisol Level
        </div>

        {/* Gauge */}
        <div className="relative" style={{ width, height }}>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="overflow-visible"
          >
            {/* Colored arc segments with small gaps */}
            {segments.map((seg, i) => (
              <path
                key={i}
                d={arcPath(180 + i * segDeg + 1, 180 + (i + 1) * segDeg - 1)}
                fill="none"
                stroke={seg.color}
                strokeWidth="26"
                strokeLinecap="butt"
              />
            ))}

            {/* Knob (dark circle at pivot) */}
            <circle cx={cx} cy={cy} r="10" fill="#2c3e6b" />

            {/* Needle – a line from the knob center outward */}
            <motion.line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy - needleLen}
              stroke="#2c3e6b"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              initial={{ rotate: -90 }}
              animate={{ rotate: needleRotation }}
              transition={{ type: 'spring', stiffness: 40, damping: 14 }}
            />

            {/* Small white dot at knob center */}
            <circle cx={cx} cy={cy} r="3" fill="#fff" />
          </svg>

          {/* Labels */}
          <span className="absolute left-[2px] bottom-[12px] text-[11px] font-black text-[#2c3e6b] uppercase font-fredoka">
            Low
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 top-[-2px] text-[11px] font-black text-[#2c3e6b] uppercase font-fredoka">
            Medium
          </span>
          <span className="absolute right-[2px] bottom-[12px] text-[11px] font-black text-[#2c3e6b] uppercase font-fredoka">
            High
          </span>
        </div>
      </div>
    </Card>
  );
}
