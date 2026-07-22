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
      <div className="relative w-full aspect-[1.6/1] bg-[#ffd1dc] rounded-2xl border-4 border-[#7c6a75] p-3 sm:p-4 flex flex-col justify-between overflow-hidden shadow-inner">
        {/* Corner Screws */}
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#7c6a75]" />
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#7c6a75]" />
        <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-[#7c6a75]" />
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-[#7c6a75]" />

        {/* Inner Label Area */}
        <div className="flex-1 bg-white/50 rounded-xl border-2 border-[#7c6a75] mx-2 sm:mx-4 mt-2 mb-6 flex flex-col p-2 relative shadow-sm">
          {/* Header */}
          <div className="flex justify-between items-center px-2 mb-2 text-[#5d5770] font-bold text-[10px] sm:text-xs">
            <span>SIDE A</span>
            <span>{currentInfo.label}</span>
          </div>

          {/* Center Window Area */}
          <div className="flex justify-center items-center gap-2 sm:gap-6 flex-1 bg-[#ffd1dc]/30 rounded-lg py-2">
            {/* Left Reel */}
            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-[#7c6a75] flex items-center justify-center p-1" style={{ animation: reelAnimation }}>
              <div className="w-full h-full rounded-full border-[3px] sm:border-[4px] border-[#ababdc] flex items-center justify-center relative">
                <div className="w-1/2 h-1/2 bg-[#ababdc] rounded-full" />
                {/* Spokes */}
                <div className="absolute w-full h-[2px] bg-[#ababdc]" />
                <div className="absolute h-full w-[2px] bg-[#ababdc]" />
              </div>
            </div>

            {/* Artwork Window */}
            <div className="w-16 h-10 sm:w-24 sm:h-16 bg-white border-2 sm:border-4 border-[#7c6a75] rounded-md overflow-hidden relative">
              <img 
                src={currentInfo.cover} 
                alt="Track Cover" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.style.background = 'linear-gradient(45deg, #ffd1dc, #ababdc)';
                }}
              />
            </div>

            {/* Right Reel */}
            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-[#7c6a75] flex items-center justify-center p-1" style={{ animation: reelAnimation }}>
              <div className="w-full h-full rounded-full border-[3px] sm:border-[4px] border-[#ababdc] flex items-center justify-center relative">
                <div className="w-1/2 h-1/2 bg-[#ababdc] rounded-full" />
                {/* Spokes */}
                <div className="absolute w-full h-[2px] bg-[#ababdc]" />
                <div className="absolute h-full w-[2px] bg-[#ababdc]" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Ridges */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/2 h-3 sm:h-4 flex flex-col justify-between">
          <div className="w-full h-[2px] bg-[#e8a0b0]" />
          <div className="w-full h-[2px] bg-[#e8a0b0]" />
          <div className="w-full h-[2px] bg-[#e8a0b0]" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 text-[#5d5770]">
        <div className="text-center font-bold text-lg">{currentInfo.label} Stream</div>
        
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

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-6">
          <button 
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
            className="p-2 text-2xl hover:bg-white/50 rounded-full transition-colors text-[#7c6a75] hover:text-[#5d5770]"
          >
            ⏭
          </button>
        </div>

        {/* Bottom Row: Vol & Categories */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-between mt-2 pt-4 border-t-2 border-white/40">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔊</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01"
              value={bgmVolume}
              onChange={handleVolume}
              className="w-20 sm:w-24 accent-[#7c6a75] h-1.5 bg-white rounded-full appearance-none cursor-pointer outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {(['focused', 'relaxation', 'motivation'] as MusicCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  bgmCategory === cat 
                    ? 'bg-[#7c6a75] text-white shadow-sm' 
                    : 'bg-white/60 text-[#7c6a75] hover:bg-white'
                }`}
              >
                {CATEGORY_MAP[cat]?.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
