'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import type { StudyDocument, Flashcard } from '@/types';
import { useUserStore } from '@/stores/useUserStore';
import { useCharacterStore } from '@/stores/useCharacterStore';

interface FlashcardGeneratorCardProps {
  activeDocument: StudyDocument | null;
  onUpdateFlashcards?: (docId: string, flashcards: Flashcard[]) => void;
}

export default function FlashcardGeneratorCard({
  activeDocument,
  onUpdateFlashcards,
}: FlashcardGeneratorCardProps) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [shuffledCards, setShuffledCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addXP } = useUserStore();
  const { setEmotion, setDialogue } = useCharacterStore();

  // Load cached flashcards when activeDocument changes
  useEffect(() => {
    if (activeDocument?.aiData?.flashcards && activeDocument.aiData.flashcards.length > 0) {
      setCards(activeDocument.aiData.flashcards);
      setShuffledCards(activeDocument.aiData.flashcards);
      setCurrentIndex(0);
      setIsFlipped(false);
      setError(null);
    } else {
      setCards([]);
      setShuffledCards([]);
      setCurrentIndex(0);
      setIsFlipped(false);
      setError(null);
    }
  }, [activeDocument?.id, activeDocument?.aiData?.flashcards]);

  const handleGenerate = async (isRegeneration = false) => {
    if (!activeDocument) return;
    setIsLoading(true);
    setError(null);

    try {
      if (isRegeneration) {
        setEmotion('excited');
        setDialogue("Regenerating a fresh set of flashcards! Let's see what new angles we can test~");
      } else {
        setEmotion('motivated');
        setDialogue("Crafting custom flashcards from your material! Ready for some rapid-fire review?");
      }

      const res = await fetch('/api/ai/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: activeDocument.extractedText,
          apiKey: useUserStore.getState().apiKey,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Generation failed with status ${res.status}`);
      }

      const data = await res.json();
      const newCards: Flashcard[] = data.flashcards || [];

      if (newCards.length > 0) {
        setCards(newCards);
        setShuffledCards(newCards);
        setCurrentIndex(0);
        setIsFlipped(false);

        // Cache flashcards in study material
        if (onUpdateFlashcards && activeDocument.id) {
          onUpdateFlashcards(activeDocument.id, newCards);
        }

        addXP({
          type: 'quiz',
          amount: 15,
          message: isRegeneration ? 'Flashcards Regenerated!' : 'Flashcards Generated!',
        });

        setEmotion('proud');
        setDialogue(`Created ${newCards.length} flashcards covering concepts, formulas, and definitions!`);
      } else {
        throw new Error('No flashcards returned from AI generator.');
      }
    } catch (err: any) {
      console.error('Error generating flashcards:', err);
      setError(err.message || 'Failed to generate flashcards. Please try again.');
      setEmotion('concerned');
      setDialogue("Hmm, I couldn't generate the flashcards right now. Try checking your API connection!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (shuffledCards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % shuffledCards.length);
    }, 150);
  };

  const handlePrev = () => {
    if (shuffledCards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + shuffledCards.length) % shuffledCards.length);
    }, 150);
  };

  const handleShuffle = () => {
    if (shuffledCards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      const newOrder = [...shuffledCards].sort(() => Math.random() - 0.5);
      setShuffledCards(newOrder);
      setCurrentIndex(0);
    }, 150);
  };

  const handleRestart = () => {
    if (cards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setShuffledCards([...cards]);
      setCurrentIndex(0);
    }, 150);
  };

  const currentCard = shuffledCards[currentIndex];
  const hasCards = shuffledCards.length > 0;

  return (
    <Card padding="md" bgVariant="pink" className="w-full shadow-[0_6px_0_#7c6a75] font-fredoka">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[#7c6a75]/15 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎴</span>
          <h3 className="text-xs font-black text-[#5d5770] uppercase tracking-wider">
            Flashcard Generator
          </h3>
        </div>
        {hasCards && (
          <button
            onClick={() => handleGenerate(true)}
            disabled={isLoading}
            title="Regenerate Flashcards from study material"
            className="text-[10px] font-black uppercase tracking-wider text-[#8F477B] hover:text-[#7a3b68] flex items-center gap-1 bg-white/60 hover:bg-white/90 px-2.5 py-1 rounded-lg transition-all border-2 border-[#7c6a75]/20 disabled:opacity-50 shadow-sm"
          >
            <span>🔄</span> Regenerate
          </button>
        )}
      </div>

      {/* Body Content */}
      {!activeDocument ? (
        <div className="flex flex-col items-center justify-center text-center py-6 px-4 gap-3 bg-white/30 rounded-2xl border-2 border-[#7c6a75]/15">
          <span className="text-2xl">📁</span>
          <p className="text-xs font-bold text-[#5d5770] leading-relaxed">
            Select or upload a study material in the Study Hub to generate AI flashcards!
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center text-center py-10 px-4 gap-4 bg-white/30 rounded-2xl border-2 border-[#7c6a75]/15">
          <div className="w-8 h-8 border-4 border-[#8F477B] border-t-transparent rounded-full animate-spin" />
          <div className="space-y-1">
            <p className="text-xs font-black text-[#8F477B] uppercase tracking-wider">
              Crafting Flashcards...
            </p>
            <p className="text-[11px] font-bold text-[#5d5770]/80">
              Extracting Key Concepts, Formulas & Definitions
            </p>
          </div>
        </div>
      ) : !hasCards ? (
        <div className="flex flex-col items-center justify-center text-center py-6 px-4 gap-4 bg-white/30 rounded-2xl border-2 border-[#7c6a75]/15">
          <div className="space-y-1">
            <h4 className="text-xs font-black text-[#5d5770] uppercase tracking-wide">
              {activeDocument.name}
            </h4>
            <p className="text-[11px] font-bold text-[#5d5770]/70 leading-relaxed">
              Create an AI flashcard deck covering key concepts, definitions, formulas & algorithms.
            </p>
          </div>
          {error && (
            <div className="w-full bg-red-100/80 border border-red-300 text-red-700 text-xs font-bold px-3 py-2 rounded-xl">
              {error}
            </div>
          )}
          <button
            onClick={() => handleGenerate(false)}
            className="w-full bg-[#8F477B] hover:bg-[#7a3b68] text-white shadow-[0_4px_0_#5e2d50] active:translate-y-0.5 active:shadow-[0_2px_0_#5e2d50] transition-all rounded-xl font-black text-xs uppercase tracking-wider py-3 px-4 flex items-center justify-center gap-2"
          >
            <span>✨</span> Generate Flashcards
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 w-full">
          {/* Deck Status Bar */}
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black uppercase text-[#8F477B] tracking-wider bg-white/70 px-2 py-0.5 rounded-md border border-[#7c6a75]/20">
              {currentCard.topic || 'Key Concept'}
            </span>
            <span className="text-xs font-black text-[#5d5770]">
              Card {currentIndex + 1} of {shuffledCards.length}
            </span>
          </div>

          {/* 3D Interactive Flashcard */}
          <div
            className="relative w-full aspect-[4/3] perspective-1000 cursor-pointer select-none"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <motion.div
              className="w-full h-full preserve-3d"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              {/* FRONT (Question / Concept / Term) */}
              <Card
                padding="lg"
                bgVariant="white"
                className="absolute inset-0 backface-hidden flex flex-col items-center justify-between text-center shadow-md border-3 border-[#7c6a75] !rounded-2xl"
              >
                <div className="w-full flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-[#5d5770]/50 border-b border-[#7c6a75]/10 pb-1.5">
                  <span>Question / Term</span>
                  <span>Flip ↻</span>
                </div>
                <div className="flex-1 flex items-center justify-center px-2 py-3 overflow-y-auto">
                  <p className="text-sm font-bold text-[#5d5770] leading-relaxed">
                    {currentCard.front}
                  </p>
                </div>
                <div className="w-full text-[9px] font-black uppercase tracking-widest text-[#8F477B]/70 pt-1 border-t border-[#7c6a75]/10">
                  Click card to reveal answer
                </div>
              </Card>

              {/* BACK (Answer / Definition / Explanation) */}
              <div
                className="absolute inset-0 backface-hidden"
                style={{ transform: 'rotateY(180deg)' }}
              >
                <Card
                  padding="lg"
                  bgVariant="yellow"
                  className="w-full h-full flex flex-col items-center justify-between text-center shadow-md border-3 border-[#7c6a75] !rounded-2xl"
                >
                  <div className="w-full flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-[#5d5770]/50 border-b border-[#7c6a75]/10 pb-1.5">
                    <span>Answer / Definition</span>
                    <span>Flip ↻</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center px-2 py-3 overflow-y-auto max-h-full">
                    <p className="text-sm font-bold text-[#5d5770] leading-relaxed">
                      {currentCard.back}
                    </p>
                  </div>
                  <div className="w-full text-[9px] font-black uppercase tracking-widest text-[#5d5770]/60 pt-1 border-t border-[#7c6a75]/10">
                    Click card to return to question
                  </div>
                </Card>
              </div>
            </motion.div>
          </div>

          {/* Controls: Prev | Shuffle | Restart | Next */}
          <div className="grid grid-cols-4 gap-1.5 mt-1 w-full">
            <Button
              variant="secondary"
              onClick={handlePrev}
              className="px-2 py-2 text-[11px] font-black flex items-center justify-center gap-1 !rounded-xl"
            >
              ◀ Prev
            </Button>
            <Button
              variant="secondary"
              onClick={handleShuffle}
              className="px-2 py-2 text-[11px] font-black flex items-center justify-center gap-1 !rounded-xl"
              title="Shuffle deck order"
            >
              🔀 Shuffle
            </Button>
            <Button
              variant="secondary"
              onClick={handleRestart}
              className="px-2 py-2 text-[11px] font-black flex items-center justify-center gap-1 !rounded-xl"
              title="Restart deck from card 1 in original order"
            >
              🔄 Reset
            </Button>
            <Button
              variant="secondary"
              onClick={handleNext}
              className="px-2 py-2 text-[11px] font-black flex items-center justify-center gap-1 !rounded-xl"
            >
              Next ▶
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
