'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { getVoiceEngine } from '@/lib/voice/tts-engine';
import { useSettingsStore } from '@/stores/useSettingsStore';

export default function CharacterDialogue() {
  const { currentDialogue, isTyping, currentEmotion, playVoiceTrigger } = useCharacterStore();
  const [displayedText, setDisplayedText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const prevDialogue = useRef('');

  // 1. Initialize custom voice manifest from public directory
  useEffect(() => {
    const initVoice = async () => {
      try {
        const res = await fetch('/api/voice/manifest');
        if (res.ok) {
          const manifest = await res.json();
          const engine = getVoiceEngine();
          if (engine) {
            for (const [emotion, files] of Object.entries(manifest)) {
              engine.registerClips(emotion as any, files as string[]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load voice manifest:', err);
      }
    };
    initVoice();
  }, []);

  // 2. Trigger voice clip or speech synthesis on explicit trigger
  useEffect(() => {
    if (playVoiceTrigger === 0 || !currentDialogue) return;
    const engine = getVoiceEngine();
    if (!engine) return;

    const settings = useSettingsStore.getState();
    const voiceSettings = settings.voice;

    // Apply active volume setting
    engine.setVolume(voiceSettings.voiceClipVolume);

    const availableClips = engine.getAvailableClips();
    const hasClips = availableClips[currentEmotion] && availableClips[currentEmotion] > 0;

    if (voiceSettings.enableVoiceClips && hasClips) {
      engine.playVoiceClip(currentEmotion).catch((err) => console.error(err));
    } else if (voiceSettings.enableWebSpeech) {
      engine.speakText(currentDialogue, currentEmotion).catch((err) => console.error(err));
    }
  }, [playVoiceTrigger]);

  // Typing animation effect
  useEffect(() => {
    if (currentDialogue === prevDialogue.current) return;
    prevDialogue.current = currentDialogue;

    if (!currentDialogue) {
      setDisplayedText('');
      return;
    }

    setIsAnimating(true);
    setDisplayedText('');

    let index = 0;
    const interval = setInterval(() => {
      if (index < currentDialogue.length) {
        setDisplayedText(currentDialogue.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [currentDialogue]);

  const showTypingDots = isTyping && !isAnimating;
  const showBubble = currentDialogue || showTypingDots;

  return (
    <AnimatePresence mode="wait">
      {showBubble && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="relative w-full"
        >
          {/* Speech bubble */}
          <div className="cloud-speech-bubble p-6 px-8 relative mb-6 rounded-[32px] border-3 border-[#7c6a75] shadow-[0_6px_0_#7c6a75] bg-white/95">
            {/* Character name */}
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#7181c8] animate-pulse" />
              <span className="text-sm font-black tracking-wider uppercase gradient-text-purple">
                Dazai
              </span>
            </div>

            {/* Dialogue text */}
            {showTypingDots ? (
              <div className="flex items-center gap-2 py-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-[#7181c8]/60"
                    animate={{ y: [0, -8, 0] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-lg text-[#5d5770] font-black leading-relaxed min-h-[3rem]">
                {displayedText}
                {isAnimating && (
                  <span className="inline-block w-0.5 h-5 bg-[#7181c8] ml-0.5 align-middle animate-typing-cursor" />
                )}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
