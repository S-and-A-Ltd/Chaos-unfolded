'use client';

import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getMusicEngine } from '@/lib/music/music-engine';
import type { MusicCategory } from '@/types';

export default function MusicControls() {
  const { enableBGM, bgmVolume, bgmCategory = 'focused', updateSettings } = useSettingsStore();
  
  const getCategoryTrackName = (cat: MusicCategory) => {
    if (cat === 'focused') return 'Lofi Study Stream';
    if (cat === 'relaxation') return 'Ambient Sleep Space';
    if (cat === 'motivation') return 'Motivation Beat';
    return 'BGM Loop Track';
  };

  const isPlaying = enableBGM;
  const currentCategory = bgmCategory;
  const trackName = getCategoryTrackName(bgmCategory);
  const [volume, setVolume] = useState(bgmVolume);
  const [isLiked, setIsLiked] = useState(false);

  // Scrubber state
  const [scrubberPercent, setScrubberPercent] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState('0:00');
  const [durationTimeStr, setDurationTimeStr] = useState('0:00');

  // Cover photo loading state
  const [coverSrc, setCoverSrc] = useState(`/images/bgm_lofi.png`);
  const [hasCoverError, setHasCoverError] = useState(false);

  const engine = getMusicEngine();

  // Sync cover photo when category changes
  useEffect(() => {
    const fileSuffix = currentCategory === 'focused' ? 'lofi' : currentCategory === 'relaxation' ? 'amb' : 'beat';
    setCoverSrc(`/images/bgm_${fileSuffix}.png`);
    setHasCoverError(false);
  }, [currentCategory]);

  // Sync volume with settings
  useEffect(() => {
    if (engine) {
      engine.setVolume(volume);
      updateSettings({ bgmVolume: volume });
    }
  }, [volume, engine, updateSettings]);

  // Scrubber timer tick
  useEffect(() => {
    if (!isPlaying || !engine) {
      setScrubberPercent(0);
      setCurrentTimeStr('0:00');
      return;
    }

    const formatTime = (secs: number) => {
      const minutes = Math.floor(secs / 60) || 0;
      const seconds = Math.floor(secs % 60) || 0;
      return `${minutes}:${String(seconds).padStart(2, '0')}`;
    };

    const updateProgress = () => {
      const current = engine.getCurrentPosition();
      const duration = engine.getDuration();
      
      if (duration > 0) {
        setScrubberPercent((current / duration) * 100);
        setCurrentTimeStr(formatTime(current));
        setDurationTimeStr(formatTime(duration));
      }
    };

    // Update immediately and then set interval
    updateProgress();
    const interval = setInterval(updateProgress, 250);

    return () => clearInterval(interval);
  }, [isPlaying, engine]);

  const handlePlayPause = () => {
    updateSettings({ enableBGM: !enableBGM });
  };

  const handleCategoryChange = (category: MusicCategory) => {
    updateSettings({ bgmCategory: category, enableBGM: true });
  };

  return (
    <div className="w-full max-w-[420px] mx-auto uwustagram-card p-6 flex flex-col gap-5 shadow-[0_6px_0_#7c6a75]">
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#7c6a75]/35 text-xl font-black font-fredoka">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📷</span>
          <span>uwustagram</span>
        </div>
        <span className="px-3 py-1 rounded-full bg-[#7181c8] text-white text-xs font-black uppercase tracking-wider shadow-sm">
          save.track
        </span>
      </div>

      {/* 2. Cover image or animated record placeholder */}
      <div className="w-full aspect-square rounded-2xl border-3 border-[#7c6a75] bg-[#ababdc]/10 flex items-center justify-center relative overflow-hidden shadow-inner group">
        {hasCoverError ? (
          /* Spinning vinyl disc fallback */
          <div className={`w-36 h-36 rounded-full border-4 border-[#7c6a75] bg-[#7c6a75]/10 flex items-center justify-center transition-transform ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }}>
            <div className="w-14 h-14 rounded-full bg-[#ababdc] border-4 border-[#7c6a75]" />
          </div>
        ) : (
          <img
            src={coverSrc}
            alt={`${currentCategory} cover`}
            onError={() => {
              if (coverSrc.endsWith('.png')) {
                const fileSuffix = currentCategory === 'focused' ? 'lofi' : currentCategory === 'relaxation' ? 'amb' : 'beat';
                setCoverSrc(`/images/bgm_${fileSuffix}.jpg`);
              } else {
                setHasCoverError(true);
              }
            }}
            className="w-full h-full object-cover rounded-xl transition-transform duration-500 hover:scale-105"
          />
        )}
        <span className="absolute bottom-3 left-3 text-sm bg-white/90 border-2 border-[#7c6a75]/25 rounded-lg px-2.5 py-1 text-[#5d5770] font-black uppercase tracking-widest select-none shadow-sm">
          {currentCategory === 'focused' ? 'LOFI' : currentCategory === 'relaxation' ? 'AMB' : 'BEAT'}
        </span>
      </div>

      {/* 3. Social actions & Category pills */}
      <div className="flex items-center justify-between px-0.5 mt-0.5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className="text-3xl cursor-pointer hover:scale-110 active:scale-95 transition-all"
          >
            {isLiked ? '❤️' : '♡'}
          </button>
          <span className="text-3xl cursor-pointer hover:scale-115 transition-transform">💬</span>
          <span className="text-3xl cursor-pointer hover:scale-115 transition-transform">☁️</span>
        </div>
        
        {/* Categories */}
        <div className="flex items-center gap-1.5">
          {(['focused', 'relaxation', 'motivation'] as MusicCategory[]).map((cat) => {
            const labels: Record<string, string> = {
              focused: 'Lofi',
              relaxation: 'Amb',
              motivation: 'Beat',
            };
            const isActive = currentCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-3 py-1.5 text-sm font-black rounded border cursor-pointer transition-all select-none ${
                  isActive
                    ? 'bg-[#7181c8] text-white border-[#7c6a75]'
                    : 'text-[#5d5770]/60 border-transparent hover:bg-[#ababdc]/15'
                }`}
              >
                {labels[cat]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Track details */}
      <div className="flex flex-col px-0.5 mt-1">
        <span className="text-2xl font-black text-[#5d5770] truncate leading-tight">
          {trackName}
        </span>
        <span className="text-sm text-[#5d5770]/60 font-bold mt-0.5">
          @dazai.study.companion
        </span>
      </div>

      {/* 5. Progress slider */}
      <div className="w-full flex items-center justify-between gap-3 mt-1 px-0.5 font-fredoka font-black text-xs text-[#5d5770]/60">
        <span className="select-none min-w-[28px] text-left">{currentTimeStr}</span>
        <div className="flex-1 h-3 rounded-full bg-[#ababdc]/20 overflow-hidden relative border border-[#7c6a75]/15">
          <div
            className="h-full bg-[#7181c8] rounded-full transition-all duration-300"
            style={{ width: `${scrubberPercent}%` }}
          />
        </div>
        <span className="select-none min-w-[28px] text-right">{durationTimeStr}</span>
      </div>

      {/* 6. Media buttons and Volume slider */}
      <div className="flex items-center justify-between px-0.5 mt-1.5">
        {/* Volume slider */}
        <div className="flex items-center gap-2">
          <span className="text-base select-none">🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 h-1.5 bg-[#ababdc]/30 rounded-lg appearance-none cursor-pointer accent-[#7181c8]"
          />
        </div>

        {/* Play/Pause controls */}
        <div className="flex items-center gap-4">
          <button className="text-lg text-[#5d5770]/70 hover:text-[#5d5770] active:scale-90 transition-transform cursor-pointer">⏮</button>
          <button
            onClick={handlePlayPause}
            className="w-14 h-14 rounded-full bg-[#7181c8]/10 border-2 border-[#7c6a75] flex items-center justify-center text-lg text-[#5d5770] hover:bg-[#7181c8]/25 active:scale-90 transition-all cursor-pointer shadow-sm"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="text-lg text-[#5d5770]/70 hover:text-[#5d5770] active:scale-90 transition-transform cursor-pointer">⏭</button>
        </div>
      </div>
    </div>
  );
}
