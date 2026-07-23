'use client';

import { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import Card from '@/components/ui/Card';
import { useCortisolStore } from '@/stores/useCortisolStore';

export default function MoodMeter() {
  // Read cortisol level from shared store (updated by quiz answers)
  const cortisolLevel = useCortisolStore((s) => s.level);

  // SVG layout
  const width = 240;
  const height = 150;
  const cx = width / 2;   // 120 – knob center X
  const cy = 130;          // knob center Y (near bottom)
  const r = 85;            // arc radius
  const needleLen = 70;    // how far needle reaches from knob

  const degToRad = (deg: number) => (deg * Math.PI) / 180;

  // Convert polar (angle in degrees) to SVG cartesian coords
  const polar = (angleDeg: number, radius: number) => ({
    x: cx + radius * Math.cos(degToRad(angleDeg)),
    y: cy + radius * Math.sin(degToRad(angleDeg)),
  });

  // Build SVG arc path
  const arcPath = (startDeg: number, endDeg: number) => {
    const s = polar(startDeg, r);
    const e = polar(endDeg, r);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  // 5 colored segments, each 36° across the top semicircle (180° → 360°)
  const segDeg = 36;
  const segments = [
    '#4CAF50', // green (LOW)
    '#CDDC39', // yellow-green
    '#FFEB3B', // yellow (MEDIUM)
    '#FF9800', // orange
    '#F44336', // red (HIGH)
  ];

  // Needle angle: cortisol 0 → 180° (pointing left = LOW), cortisol 100 → 360° (pointing right = HIGH)
  // In SVG coords: 180° = left, 270° = straight up, 360° = right
  const needleAngle = 180 + (cortisolLevel / 100) * 180;

  // Calculate the tapered needle as a polygon (triangle with base at knob, tip at arc)
  // Tip point = endpoint along needleAngle
  const tip = polar(needleAngle, needleLen);
  // Two base points = perpendicular to needle direction, offset ±3px from knob center
  const perpAngle = needleAngle + 90;
  const baseOffset = 4;
  const base1 = {
    x: cx + baseOffset * Math.cos(degToRad(perpAngle)),
    y: cy + baseOffset * Math.sin(degToRad(perpAngle)),
  };
  const base2 = {
    x: cx - baseOffset * Math.cos(degToRad(perpAngle)),
    y: cy - baseOffset * Math.sin(degToRad(perpAngle)),
  };

  const needlePoints = `${base1.x.toFixed(2)},${base1.y.toFixed(2)} ${base2.x.toFixed(2)},${base2.y.toFixed(2)} ${tip.x.toFixed(2)},${tip.y.toFixed(2)}`;

  // Animated needle using spring for the angle
  const springAngle = useSpring(needleAngle, { stiffness: 40, damping: 14 });

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
            {/* Colored arc segments with small gaps between them */}
            {segments.map((color, i) => (
              <path
                key={i}
                d={arcPath(180 + i * segDeg + 1, 180 + (i + 1) * segDeg - 1)}
                fill="none"
                stroke={color}
                strokeWidth="28"
                strokeLinecap="butt"
              />
            ))}

            {/* Animated needle (tapered triangle) */}
            <AnimatedNeedle
              cx={cx}
              cy={cy}
              needleLen={needleLen}
              targetAngle={needleAngle}
            />

            {/* Knob circle on top of needle base */}
            <circle cx={cx} cy={cy} r="11" fill="#1e2d52" />
            <circle cx={cx} cy={cy} r="4" fill="#4a5a8a" />
          </svg>

          {/* Labels – pushed further out so they don't overlap the gauge */}
          <span className="absolute left-[-8px] bottom-[-4px] text-[11px] font-black text-[#1e2d52] uppercase font-fredoka tracking-wide">
            Low
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 top-[-6px] text-[11px] font-black text-[#1e2d52] uppercase font-fredoka tracking-wide">
            Medium
          </span>
          <span className="absolute right-[-10px] bottom-[-4px] text-[11px] font-black text-[#1e2d52] uppercase font-fredoka tracking-wide">
            High
          </span>
        </div>
      </div>
    </Card>
  );
}

/**
 * Animated needle sub-component.
 * Calculates the tapered triangle points from a spring-animated angle value
 * so the needle smoothly swings to its target position.
 */
function AnimatedNeedle({
  cx,
  cy,
  needleLen,
  targetAngle,
}: {
  cx: number;
  cy: number;
  needleLen: number;
  targetAngle: number;
}) {
  const degToRad = (deg: number) => (deg * Math.PI) / 180;

  // Spring-animated angle – smooth like a clock hand
  const springAngle = useSpring(targetAngle, { stiffness: 30, damping: 20 });

  // Update the spring target whenever cortisolLevel changes
  useEffect(() => {
    springAngle.set(targetAngle);
  }, [targetAngle, springAngle]);

  // Derive the polygon points string from the animated angle
  const points = useTransform(springAngle, (angle) => {
    const baseOffset = 4;
    const perpAngle = angle + 90;

    // Tip of the needle (far end)
    const tipX = cx + needleLen * Math.cos(degToRad(angle));
    const tipY = cy + needleLen * Math.sin(degToRad(angle));

    // Two base corners (perpendicular to needle at the knob center)
    const b1x = cx + baseOffset * Math.cos(degToRad(perpAngle));
    const b1y = cy + baseOffset * Math.sin(degToRad(perpAngle));
    const b2x = cx - baseOffset * Math.cos(degToRad(perpAngle));
    const b2y = cy - baseOffset * Math.sin(degToRad(perpAngle));

    return `${b1x.toFixed(2)},${b1y.toFixed(2)} ${b2x.toFixed(2)},${b2y.toFixed(2)} ${tipX.toFixed(2)},${tipY.toFixed(2)}`;
  });

  return <motion.polygon points={points} fill="#1e2d52" />;
}
