import { create } from 'zustand';
import type { AppSettings, TimerMode, VoiceConfig, MusicCategory } from '@/types';
import { getMusicEngine } from '@/lib/music/music-engine';

const defaultVoice: VoiceConfig = {
  enableVoiceClips: true,
  enableWebSpeech: true,
  voiceClipVolume: 0.8,
  webSpeechRate: 1.0,
  webSpeechPitch: 1.0,
};

interface SettingsStore extends AppSettings {
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateVoice: (updates: Partial<VoiceConfig>) => void;
  setApiKey: (key: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  // Timer
  defaultTimerMode: 'pomodoro' as TimerMode,
  customStudyMinutes: 45,
  customBreakMinutes: 10,

  // Quiz
  quizIntervalMinutes: 10,
  quizDifficulty: 'adaptive',

  // Voice
  voice: defaultVoice,

  // Music
  enableBGM: false,
  bgmVolume: 0.3,
  bgmCategory: 'focused' as MusicCategory,

  // Focus
  idleTimeoutSeconds: 120,
  enableFocusWarnings: true,

  // Character
  selectedCharacter: 'dazai',

  // AI
  openaiApiKey: typeof window !== 'undefined' ? (localStorage.getItem('dazai_openai_api_key') || undefined) : undefined,

  // Actions
  updateSettings: (updates) =>
    set((state) => {
      if (updates.openaiApiKey !== undefined && typeof window !== 'undefined') {
        localStorage.setItem('dazai_openai_api_key', updates.openaiApiKey);
      }

      // Synchronously trigger BGM engine actions in response to setting changes
      // to preserve the user click event handler call stack (preventing browser autoplay blocks).
      if (typeof window !== 'undefined') {
        const engine = getMusicEngine();
        if (engine) {
          // 1. Sync Volume
          if (updates.bgmVolume !== undefined) {
            engine.setVolume(updates.bgmVolume);
          }

          // 2. Sync Category Change
          const targetCategory = updates.bgmCategory ?? state.bgmCategory ?? 'focused';
          const isCategoryChanging = updates.bgmCategory !== undefined && updates.bgmCategory !== state.bgmCategory;
          const isBGMCurrentlyEnabled = updates.enableBGM !== undefined ? updates.enableBGM : state.enableBGM;

          if (isCategoryChanging && isBGMCurrentlyEnabled) {
            const current = engine.getCurrentTrack();
            if (current && current.isPlaying) {
              engine.crossfadeTo(targetCategory);
            } else {
              engine.play(targetCategory);
            }
          }

          // 3. Sync Play/Pause state
          if (updates.enableBGM !== undefined && updates.enableBGM !== state.enableBGM) {
            if (updates.enableBGM) {
              const current = engine.getCurrentTrack();
              if (!current) {
                engine.play(targetCategory);
              } else if (current.track.category !== targetCategory) {
                engine.play(targetCategory);
              } else {
                engine.resume();
              }
            } else {
              engine.pause();
            }
          }
        }
      }

      return updates;
    }),

  updateVoice: (updates) =>
    set((state) => ({
      voice: { ...state.voice, ...updates },
    })),

  setApiKey: (key) =>
    set(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('dazai_openai_api_key', key);
      }
      return { openaiApiKey: key };
    }),
}));
