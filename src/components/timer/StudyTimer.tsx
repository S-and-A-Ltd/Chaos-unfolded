'use client';

import { motion } from 'motion/react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCallback } from 'react';

const MODES: ('pomodoro' | 'deep_work' | 'custom')[] = ['pomodoro', 'deep_work', 'custom'];

export default function StudyTimer() {
  const {
    remainingSeconds,
    isRunning,
    isBreak,
    studyMinutes,
    breakMinutes,
    timerMode,
    sessionsCompleted,
    setTimerMode,
    startTimer,
    pauseTimer,
    resetTimer,
    startSession,
  } = useSessionStore();

  const { enableBGM, updateSettings } = useSettingsStore();

  const totalSeconds = isBreak ? breakMinutes * 60 : studyMinutes * 60;
  const progress = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const modeLabel = isBreak ? 'Break Time' : `${timerMode.replace('_', ' ').toUpperCase()}`;

  // Actions
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

  const handleAdjustStudy = useCallback((delta: number) => {
    const nextStudy = Math.max(1, studyMinutes + delta);
    setTimerMode(timerMode, nextStudy, breakMinutes);
  }, [studyMinutes, timerMode, breakMinutes, setTimerMode]);

  const handleAdjustSeconds = useCallback((delta: number) => {
    const currentSeconds = useSessionStore.getState().remainingSeconds;
    const nextSeconds = Math.max(0, currentSeconds + delta);
    useSessionStore.setState({ remainingSeconds: nextSeconds });
  }, []);

  const handleSelectMode = useCallback(() => {
    const currentIndex = MODES.indexOf(timerMode);
    const nextIndex = (currentIndex + 1) % MODES.length;
    const nextMode = MODES[nextIndex];
    setTimerMode(nextMode);
  }, [timerMode, setTimerMode]);

  const handleToggleBGM = useCallback(() => {
    updateSettings({ enableBGM: !enableBGM });
  }, [enableBGM, updateSettings]);

  return (
    <div className="w-full max-w-[420px] mx-auto retro-gameboy p-8 pb-10 flex flex-col items-center gap-6">
      {/* Screen area */}
      <div className="w-full gameboy-screen-frame p-6 pb-5 flex flex-col items-center">
        {/* Screen Header indicator lights */}
        <div className="w-full flex items-center justify-between px-1 mb-2.5">
          <div className="flex gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-red-500 animate-pulse' : 'bg-red-950'}`} />
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Power</span>
          </div>
          <div className="h-[2.5px] w-24 bg-slate-600 rounded" />
        </div>

        {/* The screen itself */}
        <div className="w-full gameboy-screen p-6 py-8 flex flex-col items-center justify-center min-h-[160px] relative">
          {/* LCD Grid reflection effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded" />
          
          {/* Timer Mode Label */}
          <span className="text-xs font-black uppercase tracking-widest text-[#3e3835]/70 mb-2">
            {modeLabel}
          </span>

          {/* Time text */}
          <motion.span
            className="text-5xl font-extrabold tracking-widest text-[#1e1c1a] font-mono tabular-nums leading-none"
            animate={isRunning ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
            transition={isRunning ? { duration: 2, repeat: Infinity } : {}}
          >
            {timeStr}
          </motion.span>

          {/* Progress bar in pixels */}
          <div className="w-40 h-3 bg-[#7c6a75]/20 rounded-md border border-[#3e3835]/30 overflow-hidden mt-4 relative">
            <motion.div
              className="h-full bg-[#3e3835]/80"
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Status logs */}
          <div className="flex items-center gap-1.5 mt-4 text-[11px] font-bold text-[#3e3835]/70 uppercase tracking-wider">
            <span>{isRunning ? '• RUNNING' : '■ PAUSED'}</span>
            <span>|</span>
            <span>{sessionsCompleted} done</span>
          </div>
        </div>
      </div>

      {/* Dazai study companion text under screen */}
      <div className="text-center font-sans text-xs font-black text-[#5d5770] tracking-widest uppercase my-1">
        Dazai Companion
      </div>

      {/* Controls Grid */}
      <div className="w-full grid grid-cols-2 gap-4 mt-3 px-1 items-center">
        {/* Left Side: Clickable D-pad Grid */}
        <div className="grid grid-cols-3 grid-rows-3 w-32 h-32 bg-[#7c6a75] rounded-2xl p-1.5 border-3 border-[#5d5770] shadow-md mx-auto items-center justify-center">
          {/* Row 1 */}
          <div />
          <button
            onClick={() => handleAdjustSeconds(30)}
            className="flex items-center justify-center text-sm font-black text-white hover:text-pink-200 active:scale-90 cursor-pointer select-none h-7 w-7"
            title="Add 30 Seconds"
          >
            ▲
          </button>
          <div />

          {/* Row 2 */}
          <button
            onClick={() => handleAdjustStudy(-5)}
            className="flex items-center justify-center text-sm font-black text-white hover:text-pink-200 active:scale-90 cursor-pointer select-none h-7 w-7"
            title="Decrease 5 Min"
          >
            ◀
          </button>
          <div className="bg-[#5d5770] rounded-full w-5 h-5 mx-auto shadow-inner border border-black/20" />
          <button
            onClick={() => handleAdjustStudy(5)}
            className="flex items-center justify-center text-sm font-black text-white hover:text-pink-200 active:scale-90 cursor-pointer select-none h-7 w-7"
            title="Increase 5 Min"
          >
            ▶
          </button>

          {/* Row 3 */}
          <div />
          <button
            onClick={() => handleAdjustSeconds(-30)}
            className="flex items-center justify-center text-sm font-black text-white hover:text-pink-200 active:scale-90 cursor-pointer select-none h-7 w-7"
            title="Subtract 30 Seconds"
          >
            ▼
          </button>
          <div />
        </div>

        {/* Right Side: Red round A and B buttons */}
        <div className="flex gap-5 items-center justify-center">
          {/* Button B - Reset */}
          <div className="flex flex-col items-center">
            <button
              onClick={resetTimer}
              className="w-16 h-16 rounded-full bg-[#f98e8b] border-3 border-[#7c6a75] shadow-[0_5px_0_#c26563] active:translate-y-[5px] active:shadow-none transition-all cursor-pointer flex items-center justify-center font-heading font-black text-lg text-[#7c6a75]"
            >
              B
            </button>
            <span className="text-[11px] font-black text-[#5d5770] uppercase mt-2 tracking-wider">Reset</span>
          </div>

          {/* Button A - Start/Pause */}
          <div className="flex flex-col items-center">
            <button
              onClick={handleStartPause}
              className="w-16 h-16 rounded-full bg-[#76c8c0] border-3 border-[#7c6a75] shadow-[0_5px_0_#58a8a0] active:translate-y-[5px] active:shadow-none transition-all cursor-pointer flex items-center justify-center font-heading font-black text-lg text-[#7c6a75]"
            >
              A
            </button>
            <span className="text-[11px] font-black text-[#5d5770] uppercase mt-2 tracking-wider">Start</span>
          </div>
        </div>
      </div>

      {/* Select & Start Pill Buttons at the bottom */}
      <div className="w-full flex justify-center gap-10 mt-3">
        {/* Select Mode */}
        <div className="flex flex-col items-center">
          <button
            onClick={handleSelectMode}
            className="w-14 h-4.5 bg-[#8a7c85] border-2 border-[#5d5770] rounded-full shadow-[0_2px_0_#5d5770] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer rotate-[-12deg]"
          />
          <span className="text-[9px] font-black text-[#5d5770] uppercase mt-1.5 tracking-wider">Select Mode</span>
        </div>

        {/* Toggle Music */}
        <div className="flex flex-col items-center">
          <button
            onClick={handleToggleBGM}
            className="w-14 h-4.5 bg-[#8a7c85] border-2 border-[#5d5770] rounded-full shadow-[0_2px_0_#5d5770] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer rotate-[-12deg]"
          />
          <span className="text-[9px] font-black text-[#5d5770] uppercase mt-1.5 tracking-wider">Music BGM</span>
        </div>
      </div>
    </div>
  );
}
