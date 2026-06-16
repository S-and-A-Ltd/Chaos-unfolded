import { NextRequest, NextResponse } from 'next/server';
import type { WeeklyStats, DailyStats } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const today = new Date();
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Generate daily stats for the last 7 days
    const dailyStats: DailyStats[] = [];
    let totalStudyMinutes = 0;
    let totalFocusScore = 0;
    let totalQuestionsAnswered = 0;
    let totalCorrectAnswers = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      // Mock stats with some variations
      const studyMinutes = [60, 150, 45, 180, 90, 240, 120][d.getDay() % 7];
      const focusScore = [85, 92, 78, 95, 88, 90, 84][d.getDay() % 7];
      const questionsAnswered = [2, 5, 1, 8, 4, 10, 5][d.getDay() % 7];
      const correctAnswers = [2, 4, 1, 7, 3, 9, 4][d.getDay() % 7];
      const xpEarned = studyMinutes * 2 + correctAnswers * 25;

      dailyStats.push({
        date: dateStr,
        studyMinutes,
        focusScore,
        questionsAnswered,
        correctAnswers,
        streak: i === 0 ? 3 : 0, // Mock current streak
        xpEarned,
      });

      totalStudyMinutes += studyMinutes;
      totalFocusScore += focusScore;
      totalQuestionsAnswered += questionsAnswered;
      totalCorrectAnswers += correctAnswers;
    }

    const totalStudyHours = parseFloat((totalStudyMinutes / 60).toFixed(1));
    const averageFocusScore = Math.round(totalFocusScore / 7);

    const stats: WeeklyStats = {
      weekStart: dailyStats[0].date,
      dailyStats,
      totalStudyHours,
      averageFocusScore,
      strongTopics: ['React Hooks', 'CSS Grids', 'Next.js App Router'],
      weakTopics: ['TypeScript Generics', 'Webpack Bundlers'],
      improvementRate: 15, // 15% increase compared to previous week
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error generating mock stats:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve stats.' },
      { status: 500 }
    );
  }
}
