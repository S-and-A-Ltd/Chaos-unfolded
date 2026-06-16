// ============================================================
// Dazai Study Companion — Core Type Definitions
// ============================================================

// --- Character & Emotion Types ---

export type EmotionState =
  | 'happy'
  | 'proud'
  | 'excited'
  | 'neutral'
  | 'concerned'
  | 'annoyed'
  | 'disappointed'
  | 'motivated';

export type MoodCategory =
  | 'frustrated'    // 0–20
  | 'disappointed'  // 21–40
  | 'neutral'       // 41–60
  | 'happy'         // 61–80
  | 'proud';        // 81–100

export type RelationshipLevel =
  | 'new_user'          // More teasing, less trust
  | 'consistent_student' // More respect, personal encouragement
  | 'high_achiever';    // Trusted partner, deeper motivation

export interface CharacterState {
  currentEmotion: EmotionState;
  moodScore: number;          // 0–100
  moodCategory: MoodCategory;
  relationshipLevel: RelationshipLevel;
  relationshipXP: number;
  currentDialogue: string;
  isTyping: boolean;
  isSpeaking: boolean;
  playVoiceTrigger: number;
}

// --- Quiz Types ---

export type QuestionType = 'mcq' | 'short_answer' | 'concept_explanation' | 'recall';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];        // For MCQs
  correctAnswer: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizResult {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  aiExplanation: string;
  characterReaction: EmotionState;
  xpEarned: number;
  timestamp: number;
}

// --- Study Session Types ---

export type TimerMode = 'pomodoro' | 'deep_work' | 'custom';

export interface TimerPreset {
  mode: TimerMode;
  label: string;
  studyMinutes: number;
  breakMinutes: number;
}

export interface StudySession {
  id: string;
  startTime: number;
  endTime?: number;
  timerMode: TimerMode;
  totalStudyTime: number;     // in seconds
  totalBreakTime: number;     // in seconds
  distractedTime: number;     // in seconds
  focusScore: number;         // 0–100
  questionsAnswered: number;
  correctAnswers: number;
  xpEarned: number;
  topicsCovered: string[];
  isActive: boolean;
}

// --- Focus Types ---

export interface FocusState {
  isWindowFocused: boolean;
  isIdle: boolean;
  idleSeconds: number;
  tabSwitchCount: number;
  focusScore: number;
  activeStudyTime: number;    // in seconds
  distractedTime: number;     // in seconds
  lastActivityTimestamp: number;
}

// --- Document & RAG Types ---

export type DocumentType = 'pdf' | 'docx' | 'txt' | 'pptx' | 'youtube';

export interface StudyDocument {
  id: string;
  name: string;
  type: DocumentType;
  uploadedAt: number;
  extractedText: string;
  topics: string[];
  summary: string;
  isProcessed: boolean;
}

export interface DocumentTopic {
  id: string;
  documentId: string;
  name: string;
  description: string;
  keyTerms: string[];
  questionsGenerated: number;
  mastery: number;            // 0–100
}

// --- Gamification Types ---

export interface UserProfile {
  id: string;
  displayName: string;
  level: number;
  currentXP: number;
  totalXP: number;
  xpToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string;      // ISO date string
  totalStudyHours: number;
  totalQuestionsAnswered: number;
  totalCorrectAnswers: number;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: number;
  isUnlocked: boolean;
  requirement: {
    type: 'streak' | 'study_hours' | 'correct_answers' | 'focus_score' | 'level' | 'no_distractions';
    value: number;
  };
}

export interface XPEvent {
  type: 'correct_answer' | 'wrong_answer' | 'session_complete' | 'streak_bonus' | 'focus_bonus' | 'achievement';
  amount: number;
  description: string;
  timestamp: number;
}

// --- Voice Types ---

export type VoiceClipCategory =
  | 'happy'
  | 'proud'
  | 'excited'
  | 'neutral'
  | 'concerned'
  | 'annoyed'
  | 'disappointed'
  | 'motivated'
  | 'greeting'
  | 'distraction';

export interface VoiceConfig {
  enableVoiceClips: boolean;
  enableWebSpeech: boolean;
  voiceClipVolume: number;      // 0–1
  webSpeechRate: number;        // 0.1–10
  webSpeechPitch: number;      // 0–2
  webSpeechVoice?: string;     // voice name
}

// --- Music Types ---

export type MusicCategory = 'focused' | 'victory' | 'motivation' | 'warning' | 'relaxation';

export interface MusicTrack {
  id: string;
  name: string;
  category: MusicCategory;
  url: string;
}

// --- Dashboard Types ---

export interface DailyStats {
  date: string;
  studyMinutes: number;
  focusScore: number;
  questionsAnswered: number;
  correctAnswers: number;
  streak: number;
  xpEarned: number;
}

export interface WeeklyStats {
  weekStart: string;
  dailyStats: DailyStats[];
  totalStudyHours: number;
  averageFocusScore: number;
  strongTopics: string[];
  weakTopics: string[];
  improvementRate: number;     // percentage
}

// --- Settings Types ---

export interface AppSettings {
  // Timer
  defaultTimerMode: TimerMode;
  customStudyMinutes: number;
  customBreakMinutes: number;
  
  // Quiz
  quizIntervalMinutes: number;   // How often to quiz (5, 10, 15)
  quizDifficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  
  // Voice
  voice: VoiceConfig;
  
  // Music
  enableBGM: boolean;
  bgmVolume: number;             // 0–1
  bgmCategory?: MusicCategory;
  
  // Focus
  idleTimeoutSeconds: number;    // How long before considered idle
  enableFocusWarnings: boolean;
  
  // Character
  selectedCharacter: string;     // 'dazai' for now
  
  // AI
  openaiApiKey?: string;
}

// --- AI Message Types ---

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  dialogue: string;
  emotion: EmotionState;
  moodDelta: number;           // How much to change mood (-20 to +20)
  voiceCategory: VoiceClipCategory;
  shouldQuiz: boolean;
}
