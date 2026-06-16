'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import CharacterAvatar from '@/components/character/CharacterAvatar';
import Button from '@/components/ui/Button';
import { useEffect } from 'react';

export default function FocusWarning() {
  const { focus, recordActivity, isRunning, isBreak } = useSessionStore();
  const { setEmotion, setDialogue } = useCharacterStore();

  const isDistracted = isRunning && !isBreak && (!focus.isWindowFocused || focus.isIdle);

  useEffect(() => {
    if (isDistracted) {
      setEmotion('annoyed');
      setDialogue("Hey! Get back to work! Studying requires actual attention, you know~");
    }
  }, [isDistracted, setEmotion, setDialogue]);

  const handleDismiss = () => {
    recordActivity();
    setEmotion('neutral');
    setDialogue("Fine, let's continue. But don't get distracted again.");
  };

  return (
    <AnimatePresence>
      {isDistracted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md p-6 text-center"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="max-w-md w-full glass-card-static glow-red border-red-500/20 p-8 flex flex-col items-center gap-6"
          >
            <div className="text-red-500 text-5xl animate-bounce mb-2">⚠️</div>
            
            <div className="w-48 h-48 flex items-center justify-center overflow-hidden rounded-full bg-white/30 border border-[#ababdc]/30 p-2">
              <CharacterAvatar />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-red-500 uppercase tracking-wider">
                Distraction Detected!
              </h2>
              <p className="text-[#5d5770] text-sm font-semibold italic">
                &ldquo;Are we slacking off already? How disappointing. I thought you had more resolve than that.&rdquo;
              </p>
            </div>

            <div className="w-full border-t border-[#ababdc]/30 my-2" />

            <div className="flex flex-col gap-2 w-full">
              <Button variant="danger" className="w-full" onClick={handleDismiss}>
                I'm Back! (Resume Study)
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
