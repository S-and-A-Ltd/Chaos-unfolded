'use client';

import { useSessionStore } from '@/stores/useSessionStore';

export default function FocusScore() {
  const { focus } = useSessionStore();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50';
    if (score >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-red-500 bg-red-50';
  };

  return (
    <div className="w-full glass-card-blue-static p-8 shadow-[0_6px_0_#7c6a75] flex flex-col gap-5 font-fredoka">
      {/* Title */}
      <div className="text-lg font-black uppercase tracking-widest text-[#5d5770] border-b-2 border-[#7c6a75]/25 pb-3 text-center">
        Focus Analytics
      </div>

      {/* Focus Score Circle / Large badge */}
      <div className="flex items-center justify-between gap-3 bg-white/50 p-4.5 rounded-2xl border-2 border-[#7c6a75]/20 shadow-inner">
        <span className="text-sm font-black text-[#5d5770] uppercase tracking-wider">Efficiency</span>
        <span className={`text-base font-black px-4 py-2 rounded-full border-2 border-[#7c6a75]/25 shadow-sm ${getScoreColor(focus.focusScore)}`}>
          🎯 {focus.focusScore}%
        </span>
      </div>

      {/* Vertical grid of stats */}
      <div className="flex flex-col gap-4 text-sm font-black text-[#5d5770]">
        {/* Stat 1 */}
        <div className="flex justify-between items-center bg-white/50 px-5 py-4 rounded-2xl border-2 border-[#7c6a75]/15 shadow-sm">
          <span className="flex items-center gap-2">
            <span className="text-base">⏱️</span>
            <span>Active Study</span>
          </span>
          <span className="font-black text-[#7181c8] text-base">{formatTime(focus.activeStudyTime)}</span>
        </div>

        {/* Stat 2 */}
        <div className="flex justify-between items-center bg-white/50 px-5 py-4 rounded-2xl border-2 border-[#7c6a75]/15 shadow-sm">
          <span className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>Distracted</span>
          </span>
          <span className="font-black text-rose-500 text-base">{formatTime(focus.distractedTime)}</span>
        </div>

        {/* Stat 3 */}
        <div className="flex justify-between items-center bg-white/50 px-5 py-4 rounded-2xl border-2 border-[#7c6a75]/15 shadow-sm">
          <span className="flex items-center gap-2">
            <span className="text-base">🔄</span>
            <span>Tab Switches</span>
          </span>
          <span className="font-black text-amber-600 text-base">{focus.tabSwitchCount} times</span>
        </div>
      </div>
    </div>
  );
}
