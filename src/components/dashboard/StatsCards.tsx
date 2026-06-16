'use client';

import { useUserStore } from '@/stores/useUserStore';
import Card from '@/components/ui/Card';

export default function StatsCards() {
  const {
    totalStudyHours,
    totalQuestionsAnswered,
    totalCorrectAnswers,
    currentStreak,
    dailyStats,
  } = useUserStore();

  // Calculate average focus score from daily stats
  const totalFocusScore = dailyStats.reduce((acc, curr) => acc + curr.focusScore, 0);
  const avgFocusScore = dailyStats.length > 0 ? Math.round(totalFocusScore / dailyStats.length) : 0;

  const accuracy =
    totalQuestionsAnswered > 0
      ? Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100)
      : 0;

  const stats = [
    {
      id: 'hours',
      label: 'Study Hours',
      value: `${totalStudyHours.toFixed(1)}h`,
      icon: '⏱️',
      color: 'purple',
      trend: totalStudyHours > 0 ? 'Hours recorded' : 'No study logged',
    },
    {
      id: 'focus',
      label: 'Avg Focus Score',
      value: `${avgFocusScore}%`,
      icon: '🎯',
      color: 'teal',
      trend: dailyStats.length > 0 ? 'Based on sessions' : 'No sessions logged',
    },
    {
      id: 'questions',
      label: 'Quizzes Taken',
      value: totalQuestionsAnswered.toString(),
      icon: '📝',
      color: 'amber',
      trend: `${totalCorrectAnswers} correct`,
    },
    {
      id: 'streak',
      label: 'Study Streak',
      value: `${currentStreak} Days`,
      icon: '🔥',
      color: 'red',
      trend: currentStreak > 0 ? 'Active streak!' : 'Start studying today',
    },
    {
      id: 'accuracy',
      label: 'Quiz Accuracy',
      value: `${accuracy}%`,
      icon: '💡',
      color: 'green',
      trend: totalQuestionsAnswered > 0 ? 'Overall accuracy' : 'Take a quiz',
    },
  ];

  const bgVariants: Record<string, 'blue' | 'pink' | 'lavender' | 'yellow' | 'mint'> = {
    purple: 'lavender',
    teal: 'blue',
    amber: 'yellow',
    red: 'pink',
    green: 'mint',
  };

  const colorClasses: Record<string, string> = {
    purple: 'text-[#7181c8] bg-white/45 border-[#7c6a75]/30',
    teal: 'text-[#76c8c0] bg-white/45 border-[#7c6a75]/30',
    amber: 'text-[#e2b761] bg-white/45 border-[#7c6a75]/30',
    red: 'text-[#f98e8b] bg-white/45 border-[#7c6a75]/30',
    green: 'text-[#76c8c0] bg-white/45 border-[#7c6a75]/30',
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full">
      {stats.map((stat) => (
        <Card key={stat.id} padding="md" bgVariant={bgVariants[stat.color]} hover={true} className="flex flex-col gap-2 shadow-[0_4px_0_#7c6a75]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#5d5770]/70 font-semibold">{stat.label}</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colorClasses[stat.color]}`}>
              <span className="text-sm">{stat.icon}</span>
            </div>
          </div>
          
          <div className="flex flex-col mt-1">
            <span className="text-2xl font-black text-[#5d5770] tracking-tight">
              {stat.value}
            </span>
            <span className="text-[10px] text-[#5d5770]/60 font-semibold mt-1">
              {stat.trend}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
