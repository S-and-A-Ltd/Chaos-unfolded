// ============================================================
// XP & Gamification System
// XP rewards, leveling, and achievement checking
// ============================================================

import type { StudySession, UserProfile, Achievement, XPEvent } from '@/types';

// --- XP reward constants ---

export const XP_VALUES = {
  correct_answer: 25,
  wrong_answer: 5,         // Participation XP
  session_complete: 100,
  streak_bonus: 50,        // Per streak day
  focus_bonus_max: 50,     // Up to 50 based on focus score
  achievement_unlock: 200,
  document_upload: 30,
  quiz_perfect: 75,        // All correct in a quiz batch
} as const;

// --- Session XP calculation ---

export function calculateSessionXP(session: StudySession): XPEvent[] {
  const events: XPEvent[] = [];
  const now = Date.now();

  // Correct answers
  if (session.correctAnswers > 0) {
    events.push({
      type: 'correct_answer',
      amount: session.correctAnswers * XP_VALUES.correct_answer,
      description: `${session.correctAnswers} correct answer${session.correctAnswers > 1 ? 's' : ''}`,
      timestamp: now,
    });
  }

  // Wrong answers (participation)
  const wrongAnswers = session.questionsAnswered - session.correctAnswers;
  if (wrongAnswers > 0) {
    events.push({
      type: 'wrong_answer',
      amount: wrongAnswers * XP_VALUES.wrong_answer,
      description: `${wrongAnswers} attempted answer${wrongAnswers > 1 ? 's' : ''}`,
      timestamp: now,
    });
  }

  // Session completion
  events.push({
    type: 'session_complete',
    amount: XP_VALUES.session_complete,
    description: 'Session completed',
    timestamp: now,
  });

  // Focus bonus (proportional to focus score)
  if (session.focusScore > 0) {
    const focusXP = Math.round(
      (session.focusScore / 100) * XP_VALUES.focus_bonus_max
    );
    if (focusXP > 0) {
      events.push({
        type: 'focus_bonus',
        amount: focusXP,
        description: `Focus bonus (${session.focusScore}% focus)`,
        timestamp: now,
      });
    }
  }

  return events;
}

// --- Level calculation (exponential curve) ---

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function calculateLevel(totalXP: number): {
  level: number;
  currentXP: number;
  xpToNextLevel: number;
} {
  let level = 1;
  let remainingXP = totalXP;

  while (remainingXP >= xpForLevel(level + 1)) {
    remainingXP -= xpForLevel(level + 1);
    level++;
  }

  return {
    level,
    currentXP: remainingXP,
    xpToNextLevel: xpForLevel(level + 1),
  };
}

// --- Achievement checking ---

export function checkAchievements(
  profile: UserProfile
): Achievement[] {
  const newlyUnlocked: Achievement[] = [];

  for (const achievement of profile.achievements) {
    if (achievement.isUnlocked) continue;

    let shouldUnlock = false;
    const { type, value } = achievement.requirement;

    switch (type) {
      case 'streak':
        shouldUnlock = profile.currentStreak >= value;
        break;
      case 'study_hours':
        shouldUnlock = profile.totalStudyHours >= value;
        break;
      case 'correct_answers':
        shouldUnlock = profile.totalCorrectAnswers >= value;
        break;
      case 'level':
        shouldUnlock = profile.level >= value;
        break;
      case 'focus_score':
        // This is checked per-session, not from profile aggregate
        break;
      case 'no_distractions':
        // This is checked per-session, not from profile aggregate
        break;
    }

    if (shouldUnlock) {
      newlyUnlocked.push({
        ...achievement,
        isUnlocked: true,
        unlockedAt: Date.now(),
      });
    }
  }

  return newlyUnlocked;
}

/**
 * Calculate total XP from an array of XP events.
 */
export function sumXPEvents(events: XPEvent[]): number {
  return events.reduce((sum, e) => sum + e.amount, 0);
}
