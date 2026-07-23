'use client';

import { useUserStore } from '@/stores/useUserStore';
import { useSessionStore } from '@/stores/useSessionStore';
import Card from '@/components/ui/Card';
import ProgressBar from '@/components/ui/ProgressBar';

export default function ProfileCard() {
  const {
    displayName,
    level,
    currentXP,
    xpToNextLevel,
    currentStreak,
    totalStudyHours,
  } = useUserStore();

  const { focus } = useSessionStore();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const xpProgress = xpToNextLevel > 0 ? (currentXP / xpToNextLevel) * 100 : 0;

  return (
    <Card padding="lg" bgVariant="lavender" className="w-full shadow-[0_6px_0_#7c6a75] p-8">
      <div className="flex items-center gap-5">
        {/* Level Avatar Badge - Larger */}
        <div className="relative flex-shrink-0 w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-primary-light flex items-center justify-center font-black text-white shadow-md border-3 border-white/40">
          <span className="text-xs absolute -top-1.5 -right-1.5 bg-amber-500 text-black px-2 py-0.5 rounded-full font-black scale-90 border-2 border-[#7c6a75]">
            Lvl
          </span>
          <span className="text-3xl">{level}</span>
        </div>

        {/* User Details */}
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-black text-[#5d5770] truncate">
            {displayName}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-base text-[#5d5770]/70 flex items-center gap-1.5 font-bold">
              🔥 <span className="text-[#5d5770] font-black text-lg">{currentStreak} day streak</span>
            </span>
          </div>
        </div>
      </div>

      {/* XP Progress Section */}
      <div className="mt-6 space-y-2.5">
        <div className="flex justify-between text-sm text-[#5d5770]/70 font-black">
          <span>XP to Level {level + 1}</span>
          <span className="text-[#5d5770] font-black text-sm">
            {currentXP} / {xpToNextLevel}
          </span>
        </div>
        <ProgressBar value={xpProgress} color="purple" size="lg" showValue={false} />
      </div>

      <div className="w-full border-t-2 border-[#ababdc]/40 my-5" />

      {/* Total hours */}
      <div className="flex items-center justify-between text-base font-fredoka">
        <span className="text-[#5d5770]/70 font-black flex items-center gap-2">
          <span>📚</span> Total Study Time
        </span>
        <span className="text-[#5d5770] font-black text-lg">
          {totalStudyHours.toFixed(1)} hrs
        </span>
      </div>

      {/* Distracted Time */}
      <div className="flex items-center justify-between text-base font-fredoka mt-3">
        <span className="text-[#5d5770]/70 font-black flex items-center gap-2">
          <span>⚠️</span> Distracted
        </span>
        <span className="text-rose-500 font-black text-lg">
          {formatTime(focus.distractedTime)}
        </span>
      </div>

      {/* Tab Switches */}
      <div className="flex items-center justify-between text-base font-fredoka mt-3">
        <span className="text-[#5d5770]/70 font-black flex items-center gap-2">
          <span>🔄</span> Tab Switches
        </span>
        <span className="text-amber-600 font-black text-lg">
          {focus.tabSwitchCount} times
        </span>
      </div>
    </Card>
  );
}
