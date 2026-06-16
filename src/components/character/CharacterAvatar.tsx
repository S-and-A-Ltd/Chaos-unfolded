'use client';

import { useCharacterStore } from '@/stores/useCharacterStore';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

export default function CharacterAvatar() {
  const currentEmotion = useCharacterStore((s) => s.currentEmotion);
  const [imgSrc, setImgSrc] = useState(`/images/dazai_${currentEmotion}.png`);
  const [hasError, setHasError] = useState(false);
  const [attemptStep, setAttemptStep] = useState(1);

  // Sync image source when emotion changes
  useEffect(() => {
    // Random variation suffix (e.g. '', '_2', '_3', '_4') to pick between multiple uploaded photos
    const rand = Math.floor(Math.random() * 4) + 1; // 1 to 4
    const suffix = rand === 1 ? '' : `_${rand}`;
    setImgSrc(`/images/dazai_${currentEmotion}${suffix}.png`);
    setAttemptStep(1);
    setHasError(false);
  }, [currentEmotion]);

  const handleError = () => {
    if (attemptStep === 1) {
      // Step 1: Variation photo failed, try base emotion photo (e.g. dazai_happy.png)
      setImgSrc(`/images/dazai_${currentEmotion}.png`);
      setAttemptStep(2);
    } else if (attemptStep === 2) {
      // Step 2: Base emotion photo failed, try generic fallback variation (e.g. dazai_2.png)
      const rand = Math.floor(Math.random() * 3) + 1; // 1 to 3
      const suffix = rand === 1 ? '' : `_${rand}`;
      setImgSrc(`/images/dazai${suffix}.png`);
      setAttemptStep(3);
    } else if (attemptStep === 3) {
      // Step 3: Generic variation failed, try base generic fallback (dazai.png)
      if (imgSrc !== '/images/dazai.png') {
        setImgSrc('/images/dazai.png');
        setAttemptStep(4);
      } else {
        setHasError(true);
      }
    } else {
      // All fallback routes failed
      setHasError(true);
    }
  };

  return (
    <motion.div
      className="relative flex items-center justify-center w-[280px] h-[360px] rounded-[32px] border-3 border-[#7c6a75] bg-white/60 p-3 shadow-[0_6px_0_#7c6a75] overflow-hidden"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {hasError ? (
        // Beautiful fallback placeholder silhouette (Kawaii/Pastel)
        <div className="flex flex-col items-center justify-center text-center p-3 w-full h-full bg-[#f1e5f6]/50 rounded-2xl">
          <span className="text-4xl animate-bounce mb-1">🎭</span>
          <span className="text-xs font-heading text-[#7181c8] font-bold tracking-widest uppercase">
            Dazai
          </span>
          <span className="text-[10px] text-[#ababdc] italic mt-0.5">({currentEmotion})</span>
          
          <div className="mt-3 p-1.5 bg-white/80 rounded-lg border border-[#ababdc]/30 text-[8px] text-slate-500 leading-tight">
            Place your images at:<br />
            <code className="text-purple-600 block mt-0.5">dazai.png, dazai_2.png, dazai_3.png</code>
            or emotion-specific:<br />
            <code className="text-purple-600 block mt-0.5">dazai_{currentEmotion}.png</code>
            <code className="text-purple-600 block mt-0.5">dazai_{currentEmotion}_2.png, dazai_{currentEmotion}_3.png</code>
          </div>
        </div>
      ) : (
        <img
          src={imgSrc}
          alt={`Dazai - ${currentEmotion}`}
          onError={handleError}
          className="w-full h-full object-contain rounded-2xl transition-all duration-500 hover:scale-105"
        />
      )}

      {/* Heart Sparkle Overlay based on happy/proud/excited emotions */}
      {(currentEmotion === 'happy' || currentEmotion === 'proud' || currentEmotion === 'excited') && (
        <div className="absolute top-2 right-2 text-sm text-[#f1cfed] animate-pulse">🌸</div>
      )}
      {(currentEmotion === 'excited' || currentEmotion === 'motivated') && (
        <div className="absolute bottom-2 left-2 text-sm text-[#f9d48b] animate-bounce">✦</div>
      )}
    </motion.div>
  );
}
