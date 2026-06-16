// ============================================================
// Hybrid Voice / TTS Engine (Client-Side)
// Pre-recorded clips → Web Speech API fallback
// ============================================================

import type { EmotionState, VoiceClipCategory } from '@/types';
import {
  getVoiceParamsForEmotion,
  VOICE_CLIP_MANIFEST,
  getClipUrl,
  type ClipManifest,
} from './voice-config';

let engineInstance: VoiceEngine | null = null;
export const getVoiceEngine = () => {
  if (typeof window === 'undefined') return null;
  if (!engineInstance) {
    engineInstance = new VoiceEngine();
  }
  return engineInstance;
};

export class VoiceEngine {
  private currentAudio: HTMLAudioElement | null = null;
  private volume: number = 0.85;
  private clipManifest: ClipManifest;
  private isSpeaking: boolean = false;

  constructor() {
    this.clipManifest = { ...VOICE_CLIP_MANIFEST };
  }

  /**
   * Register available clips for an emotion at runtime.
   * Call this if you know which clips exist (e.g., from an API or config).
   */
  registerClips(emotion: VoiceClipCategory, filenames: string[]): void {
    this.clipManifest[emotion] = filenames;
  }

  /**
   * Play a random pre-recorded voice clip for the given emotion.
   * Falls back to Web Speech API if no clips are available.
   */
  async playVoiceClip(
    emotion: VoiceClipCategory,
    onEnd?: () => void
  ): Promise<void> {
    // Stop any current playback
    this.stop();

    const clips = this.clipManifest[emotion];
    if (clips && clips.length > 0) {
      const randomClip = clips[Math.floor(Math.random() * clips.length)];
      const url = getClipUrl(emotion, randomClip);

      try {
        await this.playAudioFile(url, onEnd);
        return;
      } catch {
        // Clip failed to load — fall through to speech fallback
        console.warn(`Voice clip failed: ${url}, falling back to TTS`);
      }
    }

    // Fallback: no clips available, use a short spoken cue
    const fallbackLines: Record<string, string> = {
      happy: 'Hmm~',
      proud: 'Not bad.',
      excited: 'Oh!',
      neutral: 'Hmm.',
      concerned: 'Hey...',
      annoyed: 'Tch.',
      disappointed: 'Sigh...',
      motivated: "Let's go.",
      greeting: 'Oh, you came.',
      distraction: 'Oi.',
    };

    const line = fallbackLines[emotion] ?? 'Hmm.';
    await this.speakText(line, emotion as EmotionState);
    onEnd?.();
  }

  /**
   * Speak arbitrary text using Web Speech API.
   * Adjusts rate/pitch/volume based on emotion.
   */
  async speakText(text: string, emotion?: EmotionState): Promise<void> {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('Web Speech API not available');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);

      // Apply emotion-based voice params
      const params = emotion
        ? getVoiceParamsForEmotion(emotion)
        : { rate: 1, pitch: 1, volume: 0.85 };

      utterance.rate = params.rate;
      utterance.pitch = params.pitch;
      utterance.volume = Math.min(params.volume, this.volume);

      // Try to use a deeper/more masculine voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.toLowerCase().includes('male') ||
            v.name.toLowerCase().includes('daniel') ||
            v.name.toLowerCase().includes('james'))
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      } else if (voices.length > 0) {
        // Fallback to first English voice
        const englishVoice = voices.find((v) => v.lang.startsWith('en'));
        if (englishVoice) utterance.voice = englishVoice;
      }

      this.isSpeaking = true;
      utterance.onend = () => {
        this.isSpeaking = false;
        resolve();
      };
      utterance.onerror = () => {
        this.isSpeaking = false;
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Stop all audio playback (clips and speech).
   */
  stop(): void {
    // Stop audio element
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    // Stop speech synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    this.isSpeaking = false;
  }

  /**
   * Set the master volume for all voice output.
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
  }

  /**
   * Check which emotions have clips registered in the manifest.
   */
  getAvailableClips(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [emotion, clips] of Object.entries(this.clipManifest)) {
      if (clips.length > 0) {
        result[emotion] = clips.length;
      }
    }
    return result;
  }

  /**
   * Whether the engine is currently producing audio.
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  // --- Private helpers ---

  private playAudioFile(url: string, onEnd?: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.volume = this.volume;
      this.currentAudio = audio;
      this.isSpeaking = true;

      audio.onended = () => {
        this.isSpeaking = false;
        this.currentAudio = null;
        onEnd?.();
        resolve();
      };

      audio.onerror = () => {
        this.isSpeaking = false;
        this.currentAudio = null;
        reject(new Error(`Failed to load audio: ${url}`));
      };

      audio.play().catch(reject);
    });
  }
}
