'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { QuizQuestion, QuizResult } from '@/types';

interface QuizModalProps {
  questions: QuizQuestion[];
  currentIndex: number;
  sessionResults: QuizResult[];
  isOpen: boolean;
  onClose: () => void;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  onNext: () => void;
}

export default function QuizModal({ questions, currentIndex, sessionResults, isOpen, onClose, onAnswer, onNext }: QuizModalProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  if (!questions || questions.length === 0) return null;

  const isSummary = currentIndex >= questions.length;
  const question = isSummary ? null : questions[currentIndex];

  const handleSubmit = (answer: string) => {
    if (!question) return;
    const correct =
      answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
    setSelectedAnswer(answer);
    setIsCorrect(correct);
    setSubmitted(true);
    onAnswer(answer, correct);
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setTextAnswer('');
    setSubmitted(false);
    onNext();
  };

  const handleClose = () => {
    setSelectedAnswer(null);
    setTextAnswer('');
    setSubmitted(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isSummary ? "Quiz Summary" : "Quiz Time!"} size="md">
      <div className="space-y-5">
        {isSummary ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <h3 className="text-2xl font-black text-[#5d5770]">Session Complete!</h3>
            
            <div className="flex justify-center gap-6 w-full mb-4">
              <div className="bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl p-4 flex flex-col items-center flex-1">
                <span className="text-3xl font-black text-emerald-600">
                  {sessionResults.filter(r => r.isCorrect).length}
                </span>
                <span className="text-xs font-bold text-emerald-700/70 uppercase">Correct</span>
              </div>
              <div className="bg-red-500/10 border-2 border-red-500/20 rounded-2xl p-4 flex flex-col items-center flex-1">
                <span className="text-3xl font-black text-red-500">
                  {sessionResults.filter(r => !r.isCorrect).length}
                </span>
                <span className="text-xs font-bold text-red-700/70 uppercase">Wrong</span>
              </div>
            </div>

            <div className="w-full bg-[#f1e5f6] rounded-full h-4 overflow-hidden shadow-inner border border-[#ababdc]/30">
              <div 
                className="h-full bg-emerald-400 transition-all duration-1000"
                style={{ width: `${(sessionResults.filter(r => r.isCorrect).length / (sessionResults.length || 1)) * 100}%` }}
              />
            </div>
            
            <p className="text-sm font-bold text-[#5d5770]/70 mt-2">
              Total XP Earned: <span className="text-[#7181c8] font-black">+{sessionResults.reduce((acc, curr) => acc + curr.xpEarned, 0)} XP</span>
            </p>

            <Button variant="primary" onClick={handleClose} className="w-full mt-4 py-3 text-sm font-bold">
              Finish Quiz
            </Button>
          </div>
        ) : question ? (
          <>
            {/* Progress Bar & Header */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#5d5770]/70 uppercase tracking-wider">
                <span>Question {currentIndex + 1} of {questions.length}</span>
                <span>Score: {sessionResults.filter(r => r.isCorrect).length} / {currentIndex}</span>
              </div>
              <div className="w-full bg-[#f1e5f6] rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-[#7181c8] transition-all duration-300"
                  style={{ width: `${(currentIndex / questions.length) * 100}%` }}
                />
              </div>
            </div>

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
                  {question.type === 'mcq' && question.options ? (
                    <div className="grid grid-cols-1 gap-2">
                      {question.options.map((option, idx) => (
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
                      {question.type === 'recall' ? (
                        <div className="w-full relative">
                          <input
                            type="text"
                            value={textAnswer}
                            onChange={(e) => setTextAnswer(e.target.value)}
                            placeholder="Type the missing word..."
                            className="w-full px-4 py-3 rounded-xl bg-white/30 border border-[#ababdc]/30
                              text-sm text-[#5d5770] placeholder:text-[#5d5770]/40 font-bold
                              focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                              transition-all text-center"
                          />
                        </div>
                      ) : question.type === 'concept_explanation' ? (
                        <textarea
                          value={textAnswer}
                          onChange={(e) => setTextAnswer(e.target.value)}
                          placeholder="Explain in your own words..."
                          rows={5}
                          className="w-full px-4 py-3 rounded-xl bg-white/30 border border-[#ababdc]/30
                            text-sm text-[#5d5770] placeholder:text-[#5d5770]/40
                            focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                            resize-none transition-all leading-relaxed"
                        />
                      ) : (
                        <textarea
                          value={textAnswer}
                          onChange={(e) => setTextAnswer(e.target.value)}
                          placeholder="Type your brief answer..."
                          rows={2}
                          className="w-full px-4 py-3 rounded-xl bg-white/30 border border-[#ababdc]/30
                            text-sm text-[#5d5770] placeholder:text-[#5d5770]/40
                            focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                            resize-none transition-all"
                        />
                      )}
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

                  <Button variant="secondary" onClick={handleNext} className="w-full">
                    {currentIndex < questions.length - 1 ? 'Next Question' : 'View Summary'}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
