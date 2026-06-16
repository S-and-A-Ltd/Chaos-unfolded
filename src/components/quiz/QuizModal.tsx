'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { QuizQuestion } from '@/types';

interface QuizModalProps {
  question: QuizQuestion | null;
  isOpen: boolean;
  onClose: () => void;
  onAnswer: (answer: string, isCorrect: boolean) => void;
}

export default function QuizModal({ question, isOpen, onClose, onAnswer }: QuizModalProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  if (!question) return null;

  const handleSubmit = (answer: string) => {
    const correct =
      answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
    setSelectedAnswer(answer);
    setIsCorrect(correct);
    setSubmitted(true);
    onAnswer(answer, correct);
  };

  const handleClose = () => {
    setSelectedAnswer(null);
    setTextAnswer('');
    setSubmitted(false);
    onClose();
  };

  const isMCQ = question.type === 'mcq' && question.options;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Quiz Time!" size="md">
      <div className="space-y-5">
        {/* Topic & Difficulty */}
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-primary/10 text-primary-dark border border-primary/20">
            {question.topic}
          </span>
          <span className={`
            px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border
            ${question.difficulty === 'easy' ? 'bg-[#76c8c0]/10 text-[#76c8c0]-dark border-[#76c8c0]/20' :
              question.difficulty === 'medium' ? 'bg-[#e2b761]/10 text-[#e2b761]-dark border-[#e2b761]/20' :
              'bg-[#f98e8b]/10 text-red-500 border-[#f98e8b]/20'}
          `}>
            {question.difficulty}
          </span>
        </div>

        {/* Question */}
        <p className="text-base text-[#5d5770] font-semibold leading-relaxed">
          {question.question}
        </p>

        {/* Answers */}
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="answering"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {isMCQ ? (
                <div className="grid grid-cols-1 gap-2">
                  {question.options!.map((option, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleSubmit(option)}
                      className="w-full text-left px-4 py-3 rounded-xl
                        bg-white/30 border border-[#ababdc]/30 text-sm text-[#5d5770] font-semibold
                        hover:bg-white/60 hover:border-primary/50
                        transition-all duration-200 cursor-pointer"
                    >
                      <span className="text-purple-400 font-semibold mr-3">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      {option}
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white/30 border border-[#ababdc]/30
                      text-sm text-[#5d5770] placeholder:text-[#5d5770]/40
                      focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                      resize-none transition-all"
                  />
                  <Button
                    variant="primary"
                    onClick={() => handleSubmit(textAnswer)}
                    disabled={!textAnswer.trim()}
                  >
                    Submit Answer
                  </Button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Result banner */}
              <div
                className={`
                  p-4 rounded-xl border flex items-center gap-3
                  ${isCorrect
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800'
                    : 'bg-red-500/10 border-red-500/30 text-red-800'}
                `}
              >
                <span className="text-2xl">{isCorrect ? '✅' : '❌'}</span>
                <div>
                  <p className={`text-sm font-bold ${isCorrect ? 'text-emerald-700' : 'text-red-600'}`}>
                    {isCorrect ? 'Correct! Well done!' : 'Not quite right.'}
                  </p>
                  <p className="text-xs text-[#5d5770]/60 mt-0.5">
                    Answer: <span className="text-[#5d5770] font-semibold">{question.correctAnswer}</span>
                  </p>
                </div>
              </div>

              <Button variant="secondary" onClick={handleClose} className="w-full">
                Continue Studying
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
