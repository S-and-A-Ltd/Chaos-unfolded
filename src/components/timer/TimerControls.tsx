'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import Button from '@/components/ui/Button';
import { useSessionStore } from '@/stores/useSessionStore';
import type { TimerMode } from '@/types';

const MODES: { mode: TimerMode; label: string }[] = [
  { mode: 'pomodoro', label: 'Pomodoro' },
  { mode: 'deep_work', label: 'Deep Work' },
  { mode: 'custom', label: 'Custom' },
];

export default function TimerControls() {
  const {
    timerMode,
    isRunning,
    isBreak,
    sessionsCompleted,
    remainingSeconds,
    setTimerMode,
    startTimer,
    pauseTimer,
    resetTimer,
    tick,
    switchToBreak,
    switchToStudy,
    startSession,
    updateFocusScore,
  } = useSessionStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer tick
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        tick();
        updateFocusScore();
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, tick, updateFocusScore]);

  // Timer completion
  useEffect(() => {
    if (isRunning && remainingSeconds <= 0) {
      pauseTimer();
      if (isBreak) {
        switchToStudy();
      } else {
        switchToBreak();
      }
    }
  }, [remainingSeconds, isRunning, isBreak, pauseTimer, switchToBreak, switchToStudy]);

  const handleStartPause = useCallback(() => {
    if (isRunning) {
      pauseTimer();
    } else {
      if (!useSessionStore.getState().currentSession) {
        startSession();
      }
      startTimer();
    }
  }, [isRunning, pauseTimer, startTimer, startSession]);

  return null;
}
