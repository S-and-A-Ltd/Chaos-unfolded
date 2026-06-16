import { create } from 'zustand';
import type { StudySession, TimerMode, FocusState } from '@/types';
import { useUserStore } from './useUserStore';

interface SessionStore {
  // Timer State
  timerMode: TimerMode;
  studyMinutes: number;
  breakMinutes: number;
  remainingSeconds: number;
  isRunning: boolean;
  isBreak: boolean;
  sessionsCompleted: number;

  // Current Session
  currentSession: StudySession | null;

  // Focus State
  focus: FocusState;

  // Timer Actions
  setTimerMode: (mode: TimerMode, study?: number, brk?: number) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  tick: () => void;
  switchToBreak: () => void;
  switchToStudy: () => void;

  // Session Actions
  startSession: () => void;
  endSession: () => void;
  updateSession: (updates: Partial<StudySession>) => void;

  // Focus Actions
  setWindowFocused: (focused: boolean) => void;
  setIdle: (idle: boolean, idleSeconds?: number) => void;
  incrementTabSwitch: () => void;
  updateFocusScore: () => void;
  recordActivity: () => void;
}

const TIMER_PRESETS: Record<TimerMode, { study: number; break: number }> = {
  pomodoro: { study: 25, break: 5 },
  deep_work: { study: 50, break: 10 },
  custom: { study: 45, break: 10 },
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  // Timer State
  timerMode: 'pomodoro',
  studyMinutes: 25,
  breakMinutes: 5,
  remainingSeconds: 25 * 60,
  isRunning: false,
  isBreak: false,
  sessionsCompleted: 0,

  // Current Session
  currentSession: null,

  // Focus State
  focus: {
    isWindowFocused: true,
    isIdle: false,
    idleSeconds: 0,
    tabSwitchCount: 0,
    focusScore: 100,
    activeStudyTime: 0,
    distractedTime: 0,
    lastActivityTimestamp: Date.now(),
  },

  // Timer Actions
  setTimerMode: (mode, study, brk) => {
    const state = get();
    if (state.currentSession) {
      state.endSession();
    }
    const preset = TIMER_PRESETS[mode];
    const studyMins = study ?? preset.study;
    const breakMins = brk ?? preset.break;
    set({
      timerMode: mode,
      studyMinutes: studyMins,
      breakMinutes: breakMins,
      remainingSeconds: studyMins * 60,
      isRunning: false,
      isBreak: false,
    });
  },

  startTimer: () => set({ isRunning: true }),
  pauseTimer: () => set({ isRunning: false }),

  resetTimer: () => {
    const state = get();
    if (state.currentSession) {
      state.endSession();
    }
    set({
      remainingSeconds: state.studyMinutes * 60,
      isRunning: false,
      isBreak: false,
    });
  },

  tick: () =>
    set((state) => {
      if (!state.isRunning || state.remainingSeconds <= 0) return state;

      const newRemaining = state.remainingSeconds - 1;

      // Update focus tracking
      const focusUpdates = { ...state.focus };
      if (focusUpdates.isWindowFocused && !focusUpdates.isIdle && !state.isBreak) {
        focusUpdates.activeStudyTime += 1;
      } else if (!state.isBreak) {
        focusUpdates.distractedTime += 1;
      }

      return {
        remainingSeconds: newRemaining,
        focus: focusUpdates,
      };
    }),

  switchToBreak: () =>
    set((state) => {
      const studyMins = state.studyMinutes;
      const userStore = useUserStore.getState();
      
      const totalFocusTime = state.focus.activeStudyTime + state.focus.distractedTime;
      const focusScore = totalFocusTime > 0 ? Math.round((state.focus.activeStudyTime / totalFocusTime) * 100) : 100;
      const xpEarned = 100 + Math.round((focusScore / 100) * 50);

      // Award XP
      userStore.addXP({
        type: 'session_complete',
        amount: xpEarned,
        description: `Completed study session (${studyMins}m)`,
        timestamp: Date.now()
      });

      // Update study hours
      useUserStore.setState({
        totalStudyHours: userStore.totalStudyHours + (studyMins / 60)
      });

      // Update daily stats study minutes
      userStore.updateTodayStats({
        studyMinutes: (userStore.dailyStats.find(s => s.date === new Date().toISOString().split('T')[0])?.studyMinutes || 0) + studyMins,
        focusScore: focusScore
      });

      userStore.updateStreak();
      userStore.checkAchievements();

      return {
        isBreak: true,
        remainingSeconds: state.breakMinutes * 60,
        sessionsCompleted: state.sessionsCompleted + 1,
      };
    }),

  switchToStudy: () =>
    set((state) => ({
      isBreak: false,
      remainingSeconds: state.studyMinutes * 60,
    })),

  // Session Actions
  startSession: () => {
    const state = get();
    const session: StudySession = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      timerMode: state.timerMode,
      totalStudyTime: 0,
      totalBreakTime: 0,
      distractedTime: 0,
      focusScore: 100,
      questionsAnswered: 0,
      correctAnswers: 0,
      xpEarned: 0,
      topicsCovered: [],
      isActive: true,
    };
    set({
      currentSession: session,
      focus: {
        isWindowFocused: true,
        isIdle: false,
        idleSeconds: 0,
        tabSwitchCount: 0,
        focusScore: 100,
        activeStudyTime: 0,
        distractedTime: 0,
        lastActivityTimestamp: Date.now(),
      },
    });
  },

  endSession: () =>
    set((state) => {
      if (!state.currentSession) return state;

      const studySeconds = state.focus.activeStudyTime;
      const studyMins = parseFloat((studySeconds / 60).toFixed(2));

      if (studyMins > 0.1) {
        const userStore = useUserStore.getState();
        const xpEarned = Math.round(studyMins * 2);

        if (xpEarned > 0) {
          userStore.addXP({
            type: 'session_complete',
            amount: xpEarned,
            description: `Studied for ${studyMins.toFixed(1)} mins`,
            timestamp: Date.now()
          });
        }

        useUserStore.setState({
          totalStudyHours: userStore.totalStudyHours + (studyMins / 60)
        });

        userStore.updateTodayStats({
          studyMinutes: (userStore.dailyStats.find(s => s.date === new Date().toISOString().split('T')[0])?.studyMinutes || 0) + studyMins,
          focusScore: state.focus.focusScore
        });

        userStore.updateStreak();
        userStore.checkAchievements();
      }

      return {
        currentSession: {
          ...state.currentSession,
          endTime: Date.now(),
          totalStudyTime: state.focus.activeStudyTime,
          distractedTime: state.focus.distractedTime,
          focusScore: state.focus.focusScore,
          isActive: false,
        },
        isRunning: false,
      };
    }),

  updateSession: (updates) =>
    set((state) => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, ...updates }
        : null,
    })),

  // Focus Actions
  setWindowFocused: (focused) =>
    set((state) => ({
      focus: { ...state.focus, isWindowFocused: focused },
    })),

  setIdle: (idle, idleSeconds) =>
    set((state) => ({
      focus: {
        ...state.focus,
        isIdle: idle,
        idleSeconds: idleSeconds ?? (idle ? state.focus.idleSeconds : 0),
      },
    })),

  incrementTabSwitch: () =>
    set((state) => ({
      focus: {
        ...state.focus,
        tabSwitchCount: state.focus.tabSwitchCount + 1,
      },
    })),

  updateFocusScore: () =>
    set((state) => {
      const total = state.focus.activeStudyTime + state.focus.distractedTime;
      if (total === 0) return state;
      const score = Math.round((state.focus.activeStudyTime / total) * 100);
      return {
        focus: { ...state.focus, focusScore: Math.max(0, Math.min(100, score)) },
      };
    }),

  recordActivity: () =>
    set((state) => ({
      focus: {
        ...state.focus,
        lastActivityTimestamp: Date.now(),
        isIdle: false,
        idleSeconds: 0,
      },
    })),
}));
