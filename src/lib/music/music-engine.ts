// ============================================================
// Background Music Engine (Client-Side)
// Howler.js-based with mood-adaptive category selection
// ============================================================

import { Howl } from 'howler';
import type { MusicCategory, MusicTrack } from '@/types';

// --- Default track catalog (placeholder URLs — replace with real files) ---

const DEFAULT_TRACKS: MusicTrack[] = [
  // Lofi
  { id: 'lofi', name: 'Lofi Study Stream', category: 'focused', url: '/audio/bgm/lofi.mp3' },
  { id: 'lofi_warning', name: 'Lofi Study Stream', category: 'warning', url: '/audio/bgm/lofi.mp3' },

  // Amb
  { id: 'amb', name: 'Ambient Sleep Space', category: 'relaxation', url: '/audio/bgm/amb.mp3' },

  // Beat
  { id: 'beat', name: 'Motivation Beat', category: 'motivation', url: '/audio/bgm/beat.mp3' },
  { id: 'beat_victory', name: 'Motivation Beat', category: 'victory', url: '/audio/bgm/beat.mp3' },
];

export class MusicEngine {
  private tracks: MusicTrack[];
  private currentHowl: Howl | null = null;
  private currentTrack: MusicTrack | null = null;
  private volume: number = 0.3;
  private isPlaying: boolean = false;
  private crossfadeDuration: number = 2000; // ms

  constructor(customTracks?: MusicTrack[]) {
    this.tracks = customTracks ?? DEFAULT_TRACKS;
  }

  /**
   * Play a track from the specified category, or auto-select.
   */
  play(category?: MusicCategory): void {
    const cat = category ?? 'focused';
    const categoryTracks = this.tracks.filter((t) => t.category === cat);

    if (categoryTracks.length === 0) {
      console.warn(`No tracks available for category: ${cat}`);
      return;
    }

    // Pick a random track from the category
    const track = categoryTracks[Math.floor(Math.random() * categoryTracks.length)];
    this.playTrack(track);
  }

  /**
   * Pause the current track.
   */
  pause(): void {
    if (this.currentHowl && this.isPlaying) {
      this.currentHowl.pause();
      this.isPlaying = false;
    }
  }

  /**
   * Resume playback if paused.
   */
  resume(): void {
    if (this.currentHowl && !this.isPlaying) {
      this.currentHowl.play();
      this.isPlaying = true;
    }
  }

  /**
   * Stop playback entirely.
   */
  stop(): void {
    if (this.currentHowl) {
      this.currentHowl.stop();
      this.currentHowl.unload();
      this.currentHowl = null;
      this.currentTrack = null;
      this.isPlaying = false;
    }
  }

  /**
   * Set volume (0–1).
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.currentHowl) {
      this.currentHowl.volume(this.volume);
    }
  }

  /**
   * Smoothly transition to a new music category.
   */
  crossfadeTo(category: MusicCategory): void {
    const categoryTracks = this.tracks.filter((t) => t.category === category);
    if (categoryTracks.length === 0) return;

    const nextTrack = categoryTracks[Math.floor(Math.random() * categoryTracks.length)];

    // If same track, skip
    if (this.currentTrack?.id === nextTrack.id) return;

    const oldHowl = this.currentHowl;
    const steps = 20;
    const stepDuration = this.crossfadeDuration / steps;

    // Create new track
    this.playTrack(nextTrack, 0); // Start at volume 0

    // Fade old out, new in
    let step = 0;
    const fadeInterval = setInterval(() => {
      step++;
      const progress = step / steps;

      if (oldHowl) {
        oldHowl.volume(this.volume * (1 - progress));
      }
      if (this.currentHowl) {
        this.currentHowl.volume(this.volume * progress);
      }

      if (step >= steps) {
        clearInterval(fadeInterval);
        if (oldHowl) {
          oldHowl.stop();
          oldHowl.unload();
        }
      }
    }, stepDuration);
  }

  /**
   * Get info about the currently playing track.
   */
  getCurrentTrack(): { track: MusicTrack; isPlaying: boolean } | null {
    if (!this.currentTrack) return null;
    return {
      track: this.currentTrack,
      isPlaying: this.isPlaying,
    };
  }

  /**
   * Get the current seek position of the track (in seconds).
   */
  getCurrentPosition(): number {
    if (this.currentHowl && this.isPlaying) {
      const pos = this.currentHowl.seek();
      return typeof pos === 'number' ? pos : 0;
    }
    return 0;
  }

  /**
   * Get the duration of the current track (in seconds).
   */
  getDuration(): number {
    if (this.currentHowl) {
      const duration = this.currentHowl.duration();
      return isFinite(duration) ? duration : 0;
    }
    return 0;
  }

  /**
   * Auto-select music category based on mood score.
   */
  setMoodBasedCategory(moodScore: number): void {
    let category: MusicCategory;

    if (moodScore <= 30) {
      category = 'warning';
    } else if (moodScore <= 50) {
      category = 'relaxation';
    } else if (moodScore <= 80) {
      category = 'focused';
    } else {
      // 81-100: randomly pick victory or motivation
      category = Math.random() > 0.5 ? 'victory' : 'motivation';
    }

    // Only crossfade if category actually changes
    if (this.currentTrack?.category !== category) {
      if (this.isPlaying) {
        this.crossfadeTo(category);
      } else {
        this.play(category);
      }
    }
  }

  /**
   * Add custom tracks at runtime.
   */
  addTracks(tracks: MusicTrack[]): void {
    this.tracks = [...this.tracks, ...tracks];
  }

  // --- Private ---

  private playTrack(track: MusicTrack, initialVolume?: number): void {
    // Stop current track (without crossfade)
    if (this.currentHowl && initialVolume === undefined) {
      this.currentHowl.stop();
      this.currentHowl.unload();
    }

    const howl = new Howl({
      src: [track.url],
      volume: initialVolume ?? this.volume,
      loop: true,
      html5: true, // Use HTML5 Audio for streaming large background music tracks immediately
      onplay: () => {
        this.isPlaying = true;
      },
      onpause: () => {
        this.isPlaying = false;
      },
      onstop: () => {
        this.isPlaying = false;
      },
      onend: () => {
        if (!howl.loop()) {
          this.isPlaying = false;
        }
      },
      onloaderror: (_id: number, error: unknown) => {
        console.warn(`Failed to load track "${track.name}":`, error);
        this.isPlaying = false;
      },
      onplayerror: (_id: number, error: unknown) => {
        console.warn(`Failed to play track "${track.name}":`, error);
        this.isPlaying = false;
      },
    });

    this.currentHowl = howl;
    this.currentTrack = track;
    this.isPlaying = true;

    howl.play();
  }
}

// Client-side singleton for music engine to avoid multiple audio contexts
let engineInstance: MusicEngine | null = null;
export const getMusicEngine = (): MusicEngine | null => {
  if (typeof window === 'undefined') return null;
  if (!engineInstance) {
    engineInstance = new MusicEngine();
  }
  return engineInstance;
};
