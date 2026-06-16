// ============================================================
// Character Expression Configuration
// Visual state definitions for animated Dazai sprite
// ============================================================

import type { EmotionState } from '@/types';

// --- Expression visual config ---

export interface ExpressionConfig {
  eyes: string;
  mouth: string;
  eyebrows: string;
  effect: string | null;
  color: string;          // Accent color for the expression
  description: string;    // For accessibility / fallback
}

export const EXPRESSIONS: Record<EmotionState, ExpressionConfig> = {
  happy: {
    eyes: 'curved',
    mouth: 'smile',
    eyebrows: 'relaxed',
    effect: 'blush',
    color: '#f59e0b',
    description: 'Dazai with a warm, genuine smile',
  },
  proud: {
    eyes: 'confident',
    mouth: 'smirk',
    eyebrows: 'raised-one',
    effect: 'sparkle',
    color: '#8b5cf6',
    description: 'Dazai looking impressed with a knowing smirk',
  },
  excited: {
    eyes: 'wide',
    mouth: 'open-smile',
    eyebrows: 'raised',
    effect: 'stars',
    color: '#ec4899',
    description: 'Dazai genuinely excited and animated',
  },
  neutral: {
    eyes: 'half-lidded',
    mouth: 'flat',
    eyebrows: 'neutral',
    effect: null,
    color: '#6b7280',
    description: 'Dazai with his usual bored, enigmatic expression',
  },
  concerned: {
    eyes: 'soft',
    mouth: 'slight-frown',
    eyebrows: 'worried',
    effect: 'sweatdrop',
    color: '#3b82f6',
    description: 'Dazai showing subtle concern beneath his cool exterior',
  },
  annoyed: {
    eyes: 'narrow',
    mouth: 'frown',
    eyebrows: 'angry',
    effect: 'vein',
    color: '#ef4444',
    description: 'Dazai clearly irritated, patience wearing thin',
  },
  disappointed: {
    eyes: 'downcast',
    mouth: 'flat-down',
    eyebrows: 'drooped',
    effect: 'shadow',
    color: '#64748b',
    description: 'Dazai looking away with quiet disappointment',
  },
  motivated: {
    eyes: 'sharp',
    mouth: 'determined-smile',
    eyebrows: 'focused',
    effect: 'glow',
    color: '#10b981',
    description: 'Dazai with a rare determined, inspiring look',
  },
};

// --- Idle animation configs ---

export interface IdleAnimation {
  type: string;
  interval: number;      // ms between cycles
  duration: number;      // ms per animation
  variance: number;      // random variance in ms
}

export const IDLE_ANIMATIONS: IdleAnimation[] = [
  {
    type: 'breathing',
    interval: 3000,
    duration: 2000,
    variance: 500,
  },
  {
    type: 'blink',
    interval: 4000,
    duration: 200,
    variance: 2000,
  },
  {
    type: 'head-tilt',
    interval: 8000,
    duration: 1000,
    variance: 3000,
  },
  {
    type: 'hair-sway',
    interval: 6000,
    duration: 1500,
    variance: 2000,
  },
];

// --- Transition timing ---

/** Duration in seconds for emotion transitions */
export const TRANSITION_DURATION = 0.5;

/** Easing function name for transitions */
export const TRANSITION_EASING = 'easeInOut';

/**
 * Get the expression config for a given emotion, with fallback to neutral.
 */
export function getExpression(emotion: EmotionState): ExpressionConfig {
  return EXPRESSIONS[emotion] ?? EXPRESSIONS.neutral;
}

/**
 * Get a random idle animation with variance applied.
 */
export function getRandomIdleAnimation(): IdleAnimation & { actualInterval: number } {
  const anim = IDLE_ANIMATIONS[Math.floor(Math.random() * IDLE_ANIMATIONS.length)];
  const actualInterval =
    anim.interval + Math.floor(Math.random() * anim.variance * 2) - anim.variance;
  return { ...anim, actualInterval: Math.max(500, actualInterval) };
}
