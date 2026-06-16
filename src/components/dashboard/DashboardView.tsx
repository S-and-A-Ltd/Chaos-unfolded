'use client';

import StatsCards from './StatsCards';
import ProgressCharts from './ProgressCharts';
import { useUserStore } from '@/stores/useUserStore';
import Card from '@/components/ui/Card';
import { motion } from 'motion/react';

export default function DashboardView() {
  const { achievements, dailyStats } = useUserStore();

  // Filter unlocked/locked achievements
  const unlockedAchievements = achievements.filter((a) => a.isUnlocked);
  const lockedAchievements = achievements.filter((a) => !a.isUnlocked);

  // Format date utility
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 w-full max-h-[85vh] overflow-y-auto pr-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#5d5770] tracking-tight">Dashboard</h1>
        <p className="text-xs text-[#5d5770]/60 mt-1">
          Review your learning trajectory and milestones with Dazai.
        </p>
      </div>

      {/* Stats Cards Row */}
      <StatsCards />

      {/* Charts section */}
      <ProgressCharts />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Achievements Gallery */}
        <Card padding="lg" bgVariant="lavender" hover={false} className="md:col-span-2 flex flex-col gap-4 shadow-[0_6px_0_#7c6a75]">
          <div>
            <h3 className="text-sm font-semibold text-[#5d5770]">
              Milestone Badges ({unlockedAchievements.length} / {achievements.length})
            </h3>
            <p className="text-xs text-[#5d5770]/60 mt-0.5">Earned from study sessions</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[220px] overflow-y-auto pr-1">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className={`relative p-3 rounded-xl border flex flex-col items-center text-center gap-1.5 transition-all ${
                  ach.isUnlocked
                    ? 'bg-[#ababdc]/10 border-[#ababdc]/30 text-[#5d5770] font-semibold'
                    : 'bg-white/10 border-[#ababdc]/10 opacity-40 text-[#5d5770]/50'
                }`}
              >
                <span className="text-2xl mb-1">{ach.icon}</span>
                <span className="text-[10px] font-bold truncate w-full">
                  {ach.name}
                </span>
                <span className="text-[8px] text-[#5d5770]/70 leading-tight">
                  {ach.description}
                </span>
                {ach.isUnlocked && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Recent sessions */}
        <Card padding="lg" bgVariant="pink" hover={false} className="flex flex-col gap-4 shadow-[0_6px_0_#7c6a75]">
          <div>
            <h3 className="text-sm font-semibold text-[#5d5770]">Recent Sessions</h3>
            <p className="text-xs text-[#5d5770]/60 mt-0.5">Your study activity log</p>
          </div>

          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
            {dailyStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-[#5d5770]/60 font-bold italic gap-1">
                <span>📓 No study sessions recorded yet.</span>
                <span>Your completed sessions will be logged here.</span>
              </div>
            ) : (
              dailyStats.map((s, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white/30 border border-[#ababdc]/20 flex items-center justify-between text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#5d5770] font-bold">{formatDate(s.date)}</span>
                    <span className="text-[10px] text-[#5d5770]/60">{s.studyMinutes} mins focus</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-emerald-600 font-bold">{s.focusScore}% focus</span>
                    <span className="text-[10px] text-[#7181c8] font-bold">+{s.xpEarned} XP</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
