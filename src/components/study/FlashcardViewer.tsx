'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Flashcard } from '@/types';

interface FlashcardViewerProps {
  flashcards: Flashcard[];
}

export default function FlashcardViewer({ flashcards }: FlashcardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [shuffledCards, setShuffledCards] = useState<Flashcard[]>(flashcards);

  if (!shuffledCards || shuffledCards.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#5d5770]/60 text-xs font-bold bg-white/20 rounded-xl">
        No flashcards generated for this document yet.
      </div>
    );
  }

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % shuffledCards.length);
    }, 150); // wait for flip back before changing content
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + shuffledCards.length) % shuffledCards.length);
    }, 150);
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    setTimeout(() => {
      const newOrder = [...shuffledCards].sort(() => Math.random() - 0.5);
      setShuffledCards(newOrder);
      setCurrentIndex(0);
    }, 150);
  };

  const currentCard = shuffledCards[currentIndex];

  return (
    <div className="flex flex-col h-full gap-4 items-center w-full">
      
      <div className="flex justify-between w-full items-center px-2">
        <span className="text-[10px] font-black uppercase text-[#5d5770]/60 tracking-wider">
          Topic: {currentCard.topic || 'General'}
        </span>
        <span className="text-[10px] font-black text-[#5d5770]">
          {currentIndex + 1} / {shuffledCards.length}
        </span>
      </div>

      {/* 3D Flip Card Container */}
      <div 
        className="relative w-full aspect-[4/3] perspective-1000 cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <motion.div
          className="w-full h-full preserve-3d"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          {/* Front */}
          <Card 
            padding="lg" 
            bgVariant="pink" 
            className="absolute inset-0 backface-hidden flex items-center justify-center text-center shadow-lg border-4 border-[#7c6a75]"
          >
            <p className="text-sm font-bold text-[#5d5770] leading-relaxed">
              {currentCard.front}
            </p>
            <div className="absolute bottom-3 text-[9px] font-black uppercase tracking-widest text-[#5d5770]/40">
              Click to flip
            </div>
          </Card>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateY(180deg)' }}>
            <Card 
              padding="lg" 
              bgVariant="yellow" 
              className="w-full h-full flex flex-col items-center justify-center text-center shadow-lg border-4 border-[#7c6a75]"
            >
              <p className="text-sm font-bold text-[#5d5770] leading-relaxed overflow-y-auto max-h-full">
                {currentCard.back}
              </p>
              <div className="absolute bottom-3 text-[9px] font-black uppercase tracking-widest text-[#5d5770]/40">
                Click to flip
              </div>
            </Card>
          </div>
        </motion.div>
      </div>

      <div className="flex gap-2 mt-auto w-full justify-center">
        <Button variant="secondary" onClick={handlePrev} className="px-3 py-1.5 text-xs flex-1">
          ◀ Prev
        </Button>
        <Button variant="secondary" onClick={handleShuffle} className="px-3 py-1.5 text-xs">
          🔀 Shuffle
        </Button>
        <Button variant="secondary" onClick={handleNext} className="px-3 py-1.5 text-xs flex-1">
          Next ▶
        </Button>
      </div>
    </div>
  );
}
