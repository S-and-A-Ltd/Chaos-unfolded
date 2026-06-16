'use client';

import { motion } from 'motion/react';
import { useCharacterStore } from '@/stores/useCharacterStore';

const MOOD_COLORS: Record<string, { color: string; label: string; emoji: string }> = {
  frustrated:    { color: '#ff3b30', label: 'Frustrated', emoji: '😤' },
  disappointed:  { color: '#ff9500', label: 'Disappointed', emoji: '😔' },
  neutral:       { color: '#3f51b5', label: 'Neutral', emoji: '😐' },
  happy:         { color: '#00bfa5', label: 'Happy', emoji: '😊' },
  proud:         { color: '#d500f9', label: 'Proud', emoji: '💜' },
};

export default function MoodMeter() {
  const { moodScore, moodCategory } = useCharacterStore();
  const info = MOOD_COLORS[moodCategory] || MOOD_COLORS.neutral;

  // Arc parameters
  const cx = 80;
  const cy = 80;
  const r = 60;
  const startAngle = 135;
  const endAngle = 405; // 270 degree arc
  const totalDeg = endAngle - startAngle;

  const degToRad = (deg: number) => (deg * Math.PI) / 180;

  const polarToCartesian = (deg: number) => {
    const x = cx + r * Math.cos(degToRad(deg));
    const y = cy + r * Math.sin(degToRad(deg));
    return {
      x: parseFloat(x.toFixed(3)),
      y: parseFloat(y.toFixed(3)),
    };
  };

  // Background arc
  const bgStart = polarToCartesian(startAngle);
  const bgEnd = polarToCartesian(endAngle);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;

  // Value arc
  const valueDeg = startAngle + (moodScore / 100) * totalDeg;
  const valEnd = polarToCartesian(valueDeg);
  const largeArc = (valueDeg - startAngle) > 180 ? 1 : 0;
  const valuePath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${largeArc} 1 ${valEnd.x} ${valEnd.y}`;

  return (
    <div className="glass-card-yellow-static p-8 shadow-[0_6px_0_#7c6a75] flex flex-col items-center gap-5 w-full">
      <div className="text-lg font-black text-[#5d5770] uppercase tracking-widest border-b-2 border-[#7c6a75]/25 pb-3 w-full text-center">
        Dazai's Mood
      </div>

      <div className="relative w-[200px] h-[120px]">
        <svg width="200" height="120" viewBox="0 0 160 100" className="overflow-visible">
          {/* Background arc */}
          <path
            d={bgPath}
            fill="none"
            stroke="rgba(124, 106, 117, 0.25)"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Value arc */}
          <motion.path
            d={valuePath}
            fill="none"
            stroke={info.color}
            strokeWidth="12"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 12px ${info.color}a0)` }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <motion.span
            key={moodScore}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-3xl font-extrabold"
            style={{ color: info.color }}
          >
            {moodScore}%
          </motion.span>
        </div>
      </div>

      {/* Label + emoji */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-2xl">{info.emoji}</span>
        <span className="text-base font-black uppercase tracking-wider" style={{ color: info.color }}>
          {info.label}
        </span>
      </div>
    </div>
  );
}
