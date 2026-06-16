// ============================================================
// Relationship Progression System
// Tracks how the student's bond with Dazai evolves
// ============================================================

import type { RelationshipLevel } from '@/types';

// --- XP values for various student actions ---

const RELATIONSHIP_XP_VALUES: Record<string, number> = {
  correct_answer: 10,
  wrong_answer: 2,       // Participation matters
  session_complete: 50,
  streak_day: 25,
  upload_document: 15,
  quiz_perfect: 30,      // All questions correct in a quiz
  long_session: 20,      // 45+ minute session
  return_after_break: 10, // Came back after being idle
};

export function calculateRelationshipXP(
  action: string
): number {
  return RELATIONSHIP_XP_VALUES[action] ?? 0;
}

// --- Dialogue personality modifiers per level ---

interface DialogueModifiers {
  sarcasticIntensity: number;    // 0-1, how sarcastic
  affectionDisplay: number;     // 0-1, how openly caring
  testingBehavior: number;      // 0-1, how much they test the student
  personalReferences: number;   // 0-1, how often they reference past interactions
  exclusiveContent: boolean;    // Whether they share "exclusive" observations
  nicknames: string[];          // What Dazai might call the student
}

const LEVEL_MODIFIERS: Record<RelationshipLevel, DialogueModifiers> = {
  new_user: {
    sarcasticIntensity: 0.9,
    affectionDisplay: 0.1,
    testingBehavior: 0.8,
    personalReferences: 0.0,
    exclusiveContent: false,
    nicknames: ['newcomer', 'you there', 'student-kun', 'fresh face'],
  },
  consistent_student: {
    sarcasticIntensity: 0.6,
    affectionDisplay: 0.4,
    testingBehavior: 0.4,
    personalReferences: 0.6,
    exclusiveContent: false,
    nicknames: ['my diligent student', 'study buddy', 'not-so-hopeless one'],
  },
  high_achiever: {
    sarcasticIntensity: 0.4,
    affectionDisplay: 0.7,
    testingBehavior: 0.2,
    personalReferences: 0.8,
    exclusiveContent: true,
    nicknames: ['partner', 'my favorite human', 'worthy one', 'brilliant idiot'],
  },
};

export function getDialogueModifiers(
  level: RelationshipLevel
): DialogueModifiers {
  return LEVEL_MODIFIERS[level];
}

// --- Relationship level thresholds ---

export const RELATIONSHIP_THRESHOLDS: Record<RelationshipLevel, number> = {
  new_user: 0,
  consistent_student: 500,
  high_achiever: 2000,
};

export function getRelationshipLevel(xp: number): RelationshipLevel {
  if (xp >= RELATIONSHIP_THRESHOLDS.high_achiever) return 'high_achiever';
  if (xp >= RELATIONSHIP_THRESHOLDS.consistent_student) return 'consistent_student';
  return 'new_user';
}

export function getProgressToNextLevel(
  currentXP: number,
  currentLevel: RelationshipLevel
): { progress: number; xpNeeded: number; xpRemaining: number } {
  if (currentLevel === 'high_achiever') {
    return { progress: 1, xpNeeded: 0, xpRemaining: 0 };
  }

  const nextLevel =
    currentLevel === 'new_user' ? 'consistent_student' : 'high_achiever';
  const threshold = RELATIONSHIP_THRESHOLDS[nextLevel];
  const currentThreshold = RELATIONSHIP_THRESHOLDS[currentLevel];
  const range = threshold - currentThreshold;
  const progress = (currentXP - currentThreshold) / range;

  return {
    progress: Math.min(1, Math.max(0, progress)),
    xpNeeded: threshold,
    xpRemaining: Math.max(0, threshold - currentXP),
  };
}
