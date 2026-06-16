import { create } from 'zustand';
import type { UserProfile, Achievement, XPEvent, DailyStats } from '@/types';

// XP required for each level (exponential growth)
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_session',
    name: 'First Steps',
    description: 'Complete your first study session',
    icon: '🎯',
    isUnlocked: false,
    requirement: { type: 'study_hours', value: 0.01 },
  },
  {
    id: 'streak_3',
    name: 'Getting Consistent',
    description: '3-day study streak',
    icon: '🔥',
    isUnlocked: false,
    requirement: { type: 'streak', value: 3 },
  },
  {
    id: 'streak_7',
    name: 'Weekly Warrior',
    description: '7-day study streak',
    icon: '⚔️',
    isUnlocked: false,
    requirement: { type: 'streak', value: 7 },
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: '30-day study streak',
    icon: '👑',
    isUnlocked: false,
    requirement: { type: 'streak', value: 30 },
  },
  {
    id: 'correct_10',
    name: 'Quick Learner',
    description: 'Answer 10 questions correctly',
    icon: '💡',
    isUnlocked: false,
    requirement: { type: 'correct_answers', value: 10 },
  },
  {
    id: 'correct_50',
    name: 'Knowledge Seeker',
    description: 'Answer 50 questions correctly',
    icon: '📚',
    isUnlocked: false,
    requirement: { type: 'correct_answers', value: 50 },
  },
  {
    id: 'correct_100',
    name: 'Scholar',
    description: 'Answer 100 questions correctly',
    icon: '🎓',
    isUnlocked: false,
    requirement: { type: 'correct_answers', value: 100 },
  },
  {
    id: 'study_1h',
    name: 'Hour of Power',
    description: 'Study for 1 hour total',
    icon: '⏰',
    isUnlocked: false,
    requirement: { type: 'study_hours', value: 1 },
  },
  {
    id: 'study_10h',
    name: 'Dedicated',
    description: 'Study for 10 hours total',
    icon: '📖',
    isUnlocked: false,
    requirement: { type: 'study_hours', value: 10 },
  },
  {
    id: 'study_50h',
    name: 'Study Machine',
    description: 'Study for 50 hours total',
    icon: '🏆',
    isUnlocked: false,
    requirement: { type: 'study_hours', value: 50 },
  },
  {
    id: 'focus_90',
    name: 'Laser Focus',
    description: 'Achieve 90%+ focus score in a session',
    icon: '🎯',
    isUnlocked: false,
    requirement: { type: 'focus_score', value: 90 },
  },
  {
    id: 'no_distractions',
    name: 'Untouchable',
    description: 'Complete a session with zero distractions',
    icon: '🛡️',
    isUnlocked: false,
    requirement: { type: 'no_distractions', value: 1 },
  },
  {
    id: 'level_5',
    name: 'Rising Star',
    description: 'Reach Level 5',
    icon: '⭐',
    isUnlocked: false,
    requirement: { type: 'level', value: 5 },
  },
  {
    id: 'level_10',
    name: "Dazai's Favorite",
    description: 'Reach Level 10',
    icon: '💜',
    isUnlocked: false,
    requirement: { type: 'level', value: 10 },
  },
];

interface UserStore extends UserProfile {
  // XP & Level
  addXP: (event: XPEvent) => void;
  xpEvents: XPEvent[];
  recentAchievement: Achievement | null;

  // Stats
  dailyStats: DailyStats[];
  addDailyStats: (stats: DailyStats) => void;
  updateTodayStats: (updates: Partial<DailyStats>) => void;

  // Streak
  updateStreak: () => void;

  // Profile
  setDisplayName: (name: string) => void;

  // Achievement check
  checkAchievements: () => void;
  clearRecentAchievement: () => void;
}

const today = new Date().toISOString().split('T')[0];

export const useUserStore = create<UserStore>((set, get) => ({
  // Profile
  id: 'local-user',
  displayName: 'Student',
  level: 1,
  currentXP: 0,
  totalXP: 0,
  xpToNextLevel: xpForLevel(2),
  currentStreak: 0,
  longestStreak: 0,
  lastStudyDate: '',
  totalStudyHours: 0,
  totalQuestionsAnswered: 0,
  totalCorrectAnswers: 0,
  achievements: DEFAULT_ACHIEVEMENTS,
  xpEvents: [],
  recentAchievement: null,
  dailyStats: [],

  addXP: (event) =>
    set((state) => {
      const newTotalXP = state.totalXP + event.amount;
      let newCurrentXP = state.currentXP + event.amount;
      let newLevel = state.level;
      let newXPToNext = state.xpToNextLevel;

      // Level up check
      while (newCurrentXP >= newXPToNext) {
        newCurrentXP -= newXPToNext;
        newLevel++;
        newXPToNext = xpForLevel(newLevel + 1);
      }

      // Quiz counts
      let newTotalQuestions = state.totalQuestionsAnswered;
      let newTotalCorrect = state.totalCorrectAnswers;

      if (event.type === 'correct_answer') {
        newTotalQuestions += 1;
        newTotalCorrect += 1;
      } else if (event.type === 'wrong_answer') {
        newTotalQuestions += 1;
      }

      // Update today's daily stats
      const todayStr = new Date().toISOString().split('T')[0];
      const existingToday = state.dailyStats.find((s) => s.date === todayStr);
      
      let updatedDailyStats = [...state.dailyStats];
      if (existingToday) {
        updatedDailyStats = state.dailyStats.map((s) => {
          if (s.date === todayStr) {
            return {
              ...s,
              xpEarned: s.xpEarned + event.amount,
              questionsAnswered: s.questionsAnswered + (event.type === 'correct_answer' || event.type === 'wrong_answer' ? 1 : 0),
              correctAnswers: s.correctAnswers + (event.type === 'correct_answer' ? 1 : 0),
            };
          }
          return s;
        });
      } else {
        const newTodayStats: DailyStats = {
          date: todayStr,
          studyMinutes: 0,
          focusScore: 100, // default
          questionsAnswered: event.type === 'correct_answer' || event.type === 'wrong_answer' ? 1 : 0,
          correctAnswers: event.type === 'correct_answer' ? 1 : 0,
          streak: state.currentStreak,
          xpEarned: event.amount,
        };
        updatedDailyStats.push(newTodayStats);
      }

      return {
        currentXP: newCurrentXP,
        totalXP: newTotalXP,
        level: newLevel,
        xpToNextLevel: newXPToNext,
        totalQuestionsAnswered: newTotalQuestions,
        totalCorrectAnswers: newTotalCorrect,
        dailyStats: updatedDailyStats,
        xpEvents: [...state.xpEvents.slice(-50), event],
      };
    }),

  addDailyStats: (stats) =>
    set((state) => ({
      dailyStats: [...state.dailyStats, stats],
    })),

  updateTodayStats: (updates) =>
    set((state) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const existing = state.dailyStats.find((s) => s.date === todayStr);
      if (existing) {
        return {
          dailyStats: state.dailyStats.map((s) =>
            s.date === todayStr ? { ...s, ...updates } : s
          ),
        };
      }
      const newStats: DailyStats = {
        date: todayStr,
        studyMinutes: 0,
        focusScore: 0,
        questionsAnswered: 0,
        correctAnswers: 0,
        streak: state.currentStreak,
        xpEarned: 0,
        ...updates,
      };
      return { dailyStats: [...state.dailyStats, newStats] };
    }),

  updateStreak: () =>
    set((state) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak = state.currentStreak;
      if (state.lastStudyDate === yesterdayStr) {
        newStreak += 1;
      } else if (state.lastStudyDate !== todayStr) {
        newStreak = 1;
      }

      return {
        currentStreak: newStreak,
        longestStreak: Math.max(state.longestStreak, newStreak),
        lastStudyDate: todayStr,
      };
    }),

  setDisplayName: (name) => set({ displayName: name }),

  checkAchievements: () =>
    set((state) => {
      const updatedAchievements = state.achievements.map((achievement) => {
        if (achievement.isUnlocked) return achievement;

        let unlocked = false;
        const { type, value } = achievement.requirement;

        switch (type) {
          case 'streak':
            unlocked = state.currentStreak >= value;
            break;
          case 'study_hours':
            unlocked = state.totalStudyHours >= value;
            break;
          case 'correct_answers':
            unlocked = state.totalCorrectAnswers >= value;
            break;
          case 'level':
            unlocked = state.level >= value;
            break;
          case 'focus_score':
            // Checked externally when session ends
            break;
          case 'no_distractions':
            // Checked externally when session ends
            break;
        }

        if (unlocked) {
          return { ...achievement, isUnlocked: true, unlockedAt: Date.now() };
        }
        return achievement;
      });

      // Find newly unlocked achievements
      const newlyUnlocked = updatedAchievements.find(
        (a) => a.isUnlocked && !state.achievements.find((b) => b.id === a.id)?.isUnlocked
      );

      return {
        achievements: updatedAchievements,
        recentAchievement: newlyUnlocked || state.recentAchievement,
      };
    }),

  clearRecentAchievement: () => set({ recentAchievement: null }),
}));
