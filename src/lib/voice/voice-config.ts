// ============================================================
// Voice Configuration
// Maps emotions → speech params & manages clip manifest
// ============================================================

import type { EmotionState, VoiceClipCategory } from '@/types';

// --- Speech parameters per emotion ---

export interface VoiceParams {
  rate: number;    // 0.1–10, default 1
  pitch: number;   // 0–2, default 1
  volume: number;  // 0–1, default 1
}

export const EMOTION_VOICE_MAP: Record<EmotionState, VoiceParams> = {
  happy: { rate: 1.1, pitch: 1.1, volume: 0.9 },
  proud: { rate: 1.0, pitch: 1.0, volume: 0.95 },
  excited: { rate: 1.2, pitch: 1.2, volume: 1.0 },
  neutral: { rate: 1.0, pitch: 1.0, volume: 0.85 },
  concerned: { rate: 0.85, pitch: 0.9, volume: 0.8 },
  annoyed: { rate: 0.9, pitch: 0.8, volume: 0.95 },
  disappointed: { rate: 0.8, pitch: 0.85, volume: 0.75 },
  motivated: { rate: 1.15, pitch: 1.05, volume: 1.0 },
};

export function getVoiceParamsForEmotion(emotion: EmotionState): VoiceParams {
  return EMOTION_VOICE_MAP[emotion] ?? EMOTION_VOICE_MAP.neutral;
}

// --- Voice clip manifest ---
// Users drop their own .mp3 files into public/audio/voice/dazai/{emotion}/
// This manifest tracks what's available. Empty by default.

export interface ClipManifest {
  [emotion: string]: string[]; // Array of filenames
}

/**
 * Default manifest — empty. The VoiceEngine will attempt to load clips
 * dynamically and update this at runtime.
 */
export const VOICE_CLIP_MANIFEST: ClipManifest = {
  happy: [],
  proud: [],
  excited: [],
  neutral: [],
  concerned: [],
  annoyed: [],
  disappointed: [],
  motivated: [],
  greeting: [],
  distraction: [],
};

/**
 * Builds the audio URL for a voice clip.
 */
export function getClipUrl(
  emotion: VoiceClipCategory,
  filename: string
): string {
  return `/audio/voice/dazai/${emotion}/${filename}`;
}

// --- Extended voice params for clip categories ---

export const CLIP_CATEGORY_VOICE_MAP: Record<VoiceClipCategory, VoiceParams> = {
  ...EMOTION_VOICE_MAP,
  greeting: { rate: 1.05, pitch: 1.05, volume: 0.9 },
  distraction: { rate: 0.95, pitch: 0.85, volume: 1.0 },
};
