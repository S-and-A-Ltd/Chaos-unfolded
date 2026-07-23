'use client';

import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

export default function MoodMeter() {
  // Cortisol level (0-100). Default low (~20). 
  // In a real implementation this would tie into quiz evaluation results.
  const [cortisolLevel, setCortisolLevel] = useState(20);

  // Map cortisol to colors
  let boxClass = 'glass-card-green-static';
  if (cortisolLevel > 80) boxClass = 'glass-card-red-static';
  else if (cortisolLevel > 60) boxClass = 'glass-card-orange-static';
  else if (cortisolLevel > 40) boxClass = 'glass-card-yellow-static';

  const cx = 100;
  const cy = 110;
  const r = 80;

  const degToRad = (deg: number) => (deg * Math.PI) / 180;

  const polarToCartesian = (deg: number) => {
    const x = cx + r * Math.cos(degToRad(deg));
    const y = cy + r * Math.sin(degToRad(deg));
    return {
      x: parseFloat(x.toFixed(3)),
      y: parseFloat(y.toFixed(3)),
    };
  };

  const createArc = (startDeg: number, endDeg: number) => {
    const start = polarToCartesian(startDeg);
    const end = polarToCartesian(endDeg);
    // Because SVG y-axis points down, we need to be careful with angles. 
    // We want a semi-circle from left (180 deg) to right (360/0 deg) but arc is drawn clockwise.
    return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
  };

  // 5 segments (36 degrees each from 180 to 360)
  const segments = [
    { color: '#82c942', label: 'LOW' },
    { color: '#d2df3d', label: '' },
    { color: '#f3e648', label: 'MEDIUM' },
    { color: '#f09140', label: '' },
    { color: '#da3c44', label: 'HIGH' }
  ];

  // Map 0-100 cortisol to 180-360 degrees
  const needleDeg = 180 + (cortisolLevel / 100) * 180;

  return (
    <div className={`${boxClass} p-6 border-[3px] border-[#8DAF9B] shadow-[0_6px_0_#7c6a75] flex flex-col items-center w-full transition-colors duration-500`}>
      <div className="text-lg font-black text-[#5d5770] uppercase tracking-widest border-b-2 border-[#7c6a75]/25 pb-2 w-full text-center">
        Cortisol Level
      </div>

      <div className="relative w-[200px] h-[130px] mt-4">
        <svg width="200" height="130" viewBox="0 0 200 130" className="overflow-visible">
          {/* Draw the 5 segments */}
          {segments.map((seg, i) => (
            <path
              key={i}
              d={createArc(180 + i * 36, 180 + (i + 1) * 36)}
              fill="none"
              stroke={seg.color}
              strokeWidth="28"
            />
          ))}

          {/* Needle Base */}
          <circle cx={cx} cy={cy} r="12" fill="#3b4b81" />
          
          {/* Needle stick - rotates from center */}
          <motion.g
            initial={{ rotate: 180 }}
            animate={{ rotate: needleDeg }}
            style={{ transformOrigin: '100px 110px' }}
            transition={{ type: "spring", stiffness: 40, damping: 15 }}
          >
            <polygon points="100,105 100,115 170,110" fill="#3b4b81" />
          </motion.g>
        </svg>

        {/* Labels positioned absolutely over SVG */}
        <div className="absolute top-[45px] left-[-20px] -rotate-[60deg] text-xs font-black text-[#1a234f]">LOW</div>
        <div className="absolute top-[-10px] left-[75px] text-xs font-black text-[#1a234f]">MEDIUM</div>
        <div className="absolute top-[45px] right-[-25px] rotate-[60deg] text-xs font-black text-[#1a234f]">HIGH</div>
      </div>
    </div>
  );
}
