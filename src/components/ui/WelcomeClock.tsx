'use client';

import { useState, useEffect } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import { useSessionStore } from '@/stores/useSessionStore';

export default function WelcomeClock() {
  const { displayName, level, currentXP, xpToNextLevel, currentStreak, totalStudyHours } = useUserStore();
  const { focus } = useSessionStore();
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!time) {
    return (
      <div className="w-full bg-white/30 border-3 border-[#7c6a75] rounded-2xl p-4 flex flex-col gap-4 animate-pulse min-h-[120px]">
        <div className="h-4 bg-slate-300 rounded w-2/3" />
        <div className="h-10 bg-slate-300 rounded" />
      </div>
    );
  }

  // Formatting hours, minutes, am/pm
  let hours = time.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour '0' should be '12'
  const minutesStr = String(time.getMinutes()).padStart(2, '0');
  const hoursStr = String(hours).padStart(2, '0');

  // Sliders XP progress
  const xpProgress = xpToNextLevel > 0 ? Math.min(100, (currentXP / xpToNextLevel) * 100) : 0;
  // Focus score progress
  const focusProgress = focus.focusScore;
  // Streak progress (clamped up to 30 days)
  const streakProgress = Math.min(100, (currentStreak / 30) * 100);
  // Total hours progress (clamped up to 100 hours)
  const hoursProgress = Math.min(100, (totalStudyHours / 100) * 100);

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Clock card widget - Cozy Blue */}
      <div className="w-full glass-card-blue-static p-8 shadow-[0_6px_0_#7c6a75] flex flex-col gap-6">
        {/* Title */}
        <div className="text-center text-lg font-black uppercase tracking-widest text-[#5d5770] border-b-2 border-[#7c6a75]/25 pb-3 font-fredoka">
          ★ welcome {displayName || 'student'} ★
        </div>

        {/* Large digital blocks */}
        <div className="flex gap-4 justify-center items-center py-2 font-fredoka">
          {/* Hours block */}
          <div className="bg-[#b7d3f4] border-3 border-[#7c6a75] rounded-2xl px-8 py-5 flex flex-col items-center relative shadow-[0_4px_0_#7c6a75]">
            <span className="text-6xl font-black text-[#5d5770]">{hoursStr}</span>
            <span className="text-xs font-black text-[#5d5770]/60 absolute bottom-1.5 right-2.5">{ampm}</span>
          </div>

          <span className="text-5xl font-black text-[#7c6a75] animate-pulse select-none">:</span>

          {/* Minutes block */}
          <div className="bg-[#f1cfed] border-3 border-[#7c6a75] rounded-2xl px-8 py-5 flex flex-col items-center shadow-[0_4px_0_#7c6a75]">
            <span className="text-6xl font-black text-[#5d5770]">{minutesStr}</span>
          </div>
        </div>

        {/* Quote placeholder */}
        <div className="text-sm text-[#5d5770]/90 font-bold text-center italic leading-relaxed bg-white/50 border-2 border-[#7c6a75]/15 rounded-xl p-4 mt-1">
          &ldquo;Tell the computer what you want, not what to do.&rdquo;
        </div>
      </div>

      {/* System info slider widget - Cozy Pink */}
      <div className="w-full glass-card-pink-static p-8 shadow-[0_6px_0_#7c6a75] flex flex-col gap-6 font-fredoka">
        <div className="text-center text-lg font-black uppercase tracking-widest text-[#5d5770] border-b-2 border-[#7c6a75]/25 pb-3">
          System Info
        </div>

        <div className="flex flex-col gap-5 mt-1">
          {/* Slider 1: microphone / focus score */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-black text-[#5d5770] uppercase tracking-wider">
              <span>🎤 microphone (focus)</span>
              <span>{focusProgress}%</span>
            </div>
            <div className="w-full h-6 bg-white border-3 border-[#7c6a75] rounded-full overflow-hidden p-0.5 shadow-inner">
              <div className="h-full bg-[#b7d3f4] rounded-full border-2 border-[#7c6a75]/20" style={{ width: `${focusProgress}%` }} />
            </div>
          </div>

          {/* Slider 2: speaker / streak */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-black text-[#5d5770] uppercase tracking-wider">
              <span>🔊 speaker (streak)</span>
              <span>{currentStreak} d</span>
            </div>
            <div className="w-full h-6 bg-white border-3 border-[#7c6a75] rounded-full overflow-hidden p-0.5 shadow-inner">
              <div className="h-full bg-[#f1cfed] rounded-full border-2 border-[#7c6a75]/20" style={{ width: `${streakProgress}%` }} />
            </div>
          </div>

          {/* Slider 3: brightness / xp level */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-black text-[#5d5770] uppercase tracking-wider">
              <span>☀️ brightness (xp lvl)</span>
              <span>Lvl {level}</span>
            </div>
            <div className="w-full h-6 bg-white border-3 border-[#7c6a75] rounded-full overflow-hidden p-0.5 shadow-inner">
              <div className="h-full bg-[#ababdc] rounded-full border-2 border-[#7c6a75]/20" style={{ width: `${xpProgress}%` }} />
            </div>
          </div>

          {/* Slider 4: battery / hours */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-black text-[#5d5770] uppercase tracking-wider">
              <span>🔋 battery (study hrs)</span>
              <span>{totalStudyHours.toFixed(1)} h</span>
            </div>
            <div className="w-full h-6 bg-white border-3 border-[#7c6a75] rounded-full overflow-hidden p-0.5 shadow-inner">
              <div className="h-full bg-[#76c8c0] rounded-full border-2 border-[#7c6a75]/20" style={{ width: `${hoursProgress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}