'use client';

import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import { getMusicEngine } from '@/lib/music/music-engine';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { MusicCategory } from '@/types';

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const CATEGORY_MAP: Partial<Record<MusicCategory, { label: string; cover: string }>> = {
  focused: { label: 'Lofi', cover: '/images/bgm_lofi.png' },
  relaxation: { label: 'Amb', cover: '/images/bgm_amb.png' },
  motivation: { label: 'Beat', cover: '/images/bgm_beat.png' },
};

export default function CassettePlayer() {
  const { enableBGM, bgmVolume, bgmCategory, updateSettings } = useSettingsStore();
  const engine = getMusicEngine();
  
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(enableBGM);

  useEffect(() => {
    setIsPlaying(enableBGM);
  }, [enableBGM]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setPosition(engine?.getCurrentPosition?.() || 0);
        setDuration(engine?.getDuration?.() || 0);
      }, 250);
    } else {
      setPosition(engine?.getCurrentPosition?.() || 0);
      setDuration(engine?.getDuration?.() || 0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, engine]);

  useEffect(() => {
    engine?.setVolume?.(bgmVolume);
  }, [bgmVolume, engine]);

  const handlePlayPause = () => {
    updateSettings({ enableBGM: !enableBGM });
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    engine?.seek?.(val);
    setPosition(val);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    updateSettings({ bgmVolume: val });
  };

  const handleCategory = (cat: MusicCategory) => {
    updateSettings({ bgmCategory: cat, enableBGM: true });
  };

  const handlePlayNext = () => {
    const cats: MusicCategory[] = ['focused', 'relaxation', 'motivation'];
    const idx = cats.indexOf(bgmCategory as MusicCategory);
    const nextIdx = (idx + 1) % cats.length;
    handleCategory(cats[nextIdx]);
  };

  const handlePlayPrevious = () => {
    const cats: MusicCategory[] = ['focused', 'relaxation', 'motivation'];
    const idx = cats.indexOf(bgmCategory as MusicCategory);
    const prevIdx = (idx - 1 + cats.length) % cats.length;
    handleCategory(cats[prevIdx]);
  };

  const currentInfo = CATEGORY_MAP[bgmCategory as MusicCategory] || CATEGORY_MAP.focused!;

  const reelAnimation = isPlaying ? 'spin 3s linear infinite' : 'none';

  return (
    <Card padding="md" bgVariant="pink" className="w-full shadow-[0_6px_0_#7c6a75] font-fredoka flex flex-col gap-6">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
      
      {/* Cassette Illustration */}
      <div className="relative w-full aspect-[1.6/1] bg-[#416799] rounded-2xl border-4 border-[#7c6a75] p-3 sm:p-4 flex flex-col justify-between overflow-hidden shadow-inner">
        {/* Corner Screws */}
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#7c6a75]" />
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#7c6a75]" />
        <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-[#7c6a75]" />
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-[#7c6a75]" />

        {/* Inner Label Area */}
        <div className="flex-1 rounded-xl border-2 border-[#7c6a75] mx-2 sm:mx-4 mt-2 mb-6 flex flex-col relative shadow-sm overflow-hidden bg-white/20">
          
          {/* Picture Layer (Bottom) */}
          <div className="absolute inset-0 z-0 bg-white">
            <img 
              src={currentInfo.cover} 
              alt="Track Cover" 
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.style.background = 'linear-gradient(45deg, rgba(255,209,220,0.8), rgba(171,171,220,0.8))';
              }}
            />
          </div>

          {/* Reels Layer (On top of picture) */}
          <div className="absolute inset-0 flex justify-center items-center gap-12 sm:gap-20 z-10 bg-white/10 backdrop-blur-[1px]">
            {/* Left Reel */}
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-[#7c6a75] flex items-center justify-center p-1" style={{ animation: reelAnimation }}>
              <div className="w-full h-full rounded-full border-[3px] sm:border-[4px] border-[#ababdc] flex items-center justify-center relative">
                <div className="w-1/2 h-1/2 bg-[#ababdc] rounded-full" />
                <div className="absolute w-full h-[2px] bg-[#ababdc]" />
                <div className="absolute h-full w-[2px] bg-[#ababdc]" />
              </div>
            </div>

            {/* Right Reel */}
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-[#7c6a75] flex items-center justify-center p-1" style={{ animation: reelAnimation }}>
              <div className="w-full h-full rounded-full border-[3px] sm:border-[4px] border-[#ababdc] flex items-center justify-center relative">
                <div className="w-1/2 h-1/2 bg-[#ababdc] rounded-full" />
                <div className="absolute w-full h-[2px] bg-[#ababdc]" />
                <div className="absolute h-full w-[2px] bg-[#ababdc]" />
              </div>
            </div>
          </div>

          {/* Header (On top of everything) */}
          <div className="relative z-20 flex justify-between items-center px-3 py-2 text-[#5d5770] font-bold text-[10px] sm:text-xs">
            <span className="bg-white/70 backdrop-blur-sm px-2 py-0.5 rounded-md border border-[#7c6a75]/20">SIDE A</span>
            <span className="bg-white/70 backdrop-blur-sm px-2 py-0.5 rounded-md border border-[#7c6a75]/20">{currentInfo.label}</span>
          </div>

        </div>

        {/* Pinch Rollers */}
        <div className="absolute z-40 bottom-2 sm:bottom-3 left-[20%] sm:left-[25%] w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-[#333] border-2 border-[#7c6a75] shadow-md" />
        <div className="absolute z-40 bottom-2 sm:bottom-3 right-[20%] sm:right-[25%] w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-[#333] border-2 border-[#7c6a75] shadow-md" />

        {/* Bottom Ridges */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-3 sm:h-4 flex flex-col justify-between">
          <div className="w-full h-[2px] bg-[#2a4569]" />
          <div className="w-full h-[2px] bg-[#2a4569]" />
          <div className="w-full h-[2px] bg-[#2a4569]" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 text-[#5d5770]">
        {/* Scrubber */}
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="w-10 text-right">{formatTime(position)}</span>
          <input 
            type="range" 
            min="0" 
            max={duration || 100} 
            value={position}
            onChange={handleSeek}
            className="flex-1 accent-[#7181c8] h-2 bg-white rounded-full appearance-none cursor-pointer outline-none shadow-inner"
          />
          <span className="w-10 text-left">{formatTime(duration)}</span>
        </div>

        {/* Playback Controls & Volume Row */}
        <div className="flex flex-row items-center justify-between w-full">
          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <span className="text-lg">🔊</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01"
              value={bgmVolume}
              onChange={handleVolume}
              className="w-16 sm:w-20 accent-[#7c6a75] h-1.5 bg-white rounded-full appearance-none cursor-pointer outline-none"
            />
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <button 
              onClick={handlePlayPrevious}
              className="p-2 text-2xl hover:bg-white/50 rounded-full transition-colors text-[#7c6a75] hover:text-[#5d5770]"
            >
              ⏮
            </button>
            
            <button 
              onClick={handlePlayPause}
              className="w-14 h-14 bg-[#7181c8] text-white text-xl rounded-full flex items-center justify-center shadow-[0_4px_0_#5a67a0] hover:translate-y-[2px] hover:shadow-[0_2px_0_#5a67a0] transition-all"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            
            <button 
              onClick={handlePlayNext}
              className="p-2 text-2xl hover:bg-white/50 rounded-full transition-colors text-[#7c6a75] hover:text-[#5d5770]"
            >
              ⏭
            </button>
          </div>

          {/* Spacer for centering */}
          <div className="w-[100px] hidden sm:block"></div>
        </div>
      </div>
    </Card>
  );
}
