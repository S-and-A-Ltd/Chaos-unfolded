import { create } from 'zustand';
import type {
  CharacterState,
  EmotionState,
  MoodCategory,
  RelationshipLevel,
} from '@/types';

function getMoodCategory(score: number): MoodCategory {
  if (score <= 20) return 'frustrated';
  if (score <= 40) return 'disappointed';
  if (score <= 60) return 'neutral';
  if (score <= 80) return 'happy';
  return 'proud';
}

function getRelationshipLevel(xp: number): RelationshipLevel {
  if (xp < 500) return 'new_user';
  if (xp < 2000) return 'consistent_student';
  return 'high_achiever';
}

interface CharacterStore extends CharacterState {
  setEmotion: (emotion: EmotionState) => void;
  adjustMood: (delta: number) => void;
  setMood: (score: number) => void;
  addRelationshipXP: (amount: number) => void;
  setDialogue: (text: string) => void;
  setIsTyping: (typing: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  triggerVoice: () => void;
  reset: () => void;
}

const initialState: CharacterState = {
  currentEmotion: 'neutral',
  moodScore: 60,
  moodCategory: 'neutral',
  relationshipLevel: 'new_user',
  relationshipXP: 0,
  currentDialogue: "Ah, hello there! Ready to do some study? Don't leave me bored, okay~",
  isTyping: false,
  isSpeaking: false,
  playVoiceTrigger: 0,
};

export const useCharacterStore = create<CharacterStore>((set) => ({
  ...initialState,

  setEmotion: (emotion) => set({ currentEmotion: emotion }),

  adjustMood: (delta) =>
    set((state) => {
      const newScore = Math.max(0, Math.min(100, state.moodScore + delta));
      return {
        moodScore: newScore,
        moodCategory: getMoodCategory(newScore),
      };
    }),

  setMood: (score) =>
    set({
      moodScore: Math.max(0, Math.min(100, score)),
      moodCategory: getMoodCategory(Math.max(0, Math.min(100, score))),
    }),

  addRelationshipXP: (amount) =>
    set((state) => {
      const newXP = state.relationshipXP + amount;
      return {
        relationshipXP: newXP,
        relationshipLevel: getRelationshipLevel(newXP),
      };
    }),

  setDialogue: (text) => set({ currentDialogue: text }),
  setIsTyping: (typing) => set({ isTyping: typing }),
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  triggerVoice: () => set((state) => ({ playVoiceTrigger: state.playVoiceTrigger + 1 })),
  reset: () => set(initialState),
}));
