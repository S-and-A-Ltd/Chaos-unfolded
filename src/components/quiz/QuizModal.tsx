'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { QuizQuestion, QuizResult } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { QuizEngine } from '@/lib/quiz/quiz-engine';

interface QuizModalProps {
  questions: QuizQuestion[];
  currentIndex: number;
  sessionResults: QuizResult[];
  isOpen: boolean;
  onClose: () => void;
  onAnswer: (answer: string, isCorrect: boolean, evalData?: Partial<QuizResult>) => void;
  onNext: () => void;
}

export default function QuizModal({ questions, currentIndex, sessionResults, isOpen, onClose, onAnswer, onNext }: QuizModalProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<Partial<QuizResult> | null>(null);
  const { openaiApiKey } = useSettingsStore();

  if (!questions || questions.length === 0) return null;

  const isSummary = currentIndex >= questions.length;
  const question = isSummary ? null : questions[currentIndex];

  const handleSubmit = async (answer: string) => {
    if (!question) return;
    
    // Deterministic for MCQ and Recall
    if (question.type === 'mcq' || question.type === 'recall') {
      const correct = answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
      setSelectedAnswer(answer);
      setIsCorrect(correct);
      setSubmitted(true);
      onAnswer(answer, correct);
      return;
    }

    // AI Evaluation for Concept Explanation and Short Answer
    setIsEvaluating(true);
    const engine = new QuizEngine();
    const evaluation = await engine.evaluateAnswer(question, answer, openaiApiKey);
    setIsEvaluating(false);

    setSelectedAnswer(answer);
    setSubmitted(true);
    
    if (evaluation) {
      setIsCorrect(evaluation.correct);
      const evalData = {
        score: evaluation.score,
        maxScore: evaluation.maxScore,
        grade: evaluation.grade,
        aiExplanation: evaluation.feedback,
        strengths: evaluation.strengths,
        missingPoints: evaluation.missingPoints,
        suggestions: evaluation.suggestions,
      };
      setEvalResult(evalData);
      onAnswer(answer, evaluation.correct, evalData);
    } else {
      // API failed — give benefit of the doubt instead of auto-failing
      // A student who wrote a long answer deserves at least partial credit
      const hasSubstantialAnswer = answer.trim().length > 20;
      setIsCorrect(hasSubstantialAnswer);
      const fallbackData = {
        score: hasSubstantialAnswer ? 6 : 3,
        maxScore: 10,
        grade: hasSubstantialAnswer ? 'Good Understanding' : 'Partial Understanding',
        aiExplanation: 'Dazai couldn\'t reach the grading server right now. Your answer has been given provisional credit based on its length and effort. Try again later for a full evaluation!',
        strengths: hasSubstantialAnswer ? ['Provided a detailed response'] : ['Attempted to answer the question'],
        missingPoints: [],
        suggestions: ['Try submitting again when the AI service is available for a full evaluation'],
      };
      setEvalResult(fallbackData);
      onAnswer(answer, hasSubstantialAnswer, fallbackData);
    }
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setTextAnswer('');
    setSubmitted(false);
    setEvalResult(null);
    onNext();
  };

  const handleClose = () => {
    setSelectedAnswer(null);
    setTextAnswer('');
    setSubmitted(false);
    setEvalResult(null);
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
                        disabled={!textAnswer.trim() || isEvaluating}
                      >
                        {isEvaluating ? "Dazai is reviewing..." : "Submit Answer"}
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
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-red-500/10 border-red-500/30'}
                    `}
                  >
                    <span className="text-2xl">{isCorrect ? '✅' : '❌'}</span>
                    <div className="flex-1">
                      {/* Grade badge + Score */}
                      {evalResult?.score !== undefined ? (
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`
                            px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider
                            ${(evalResult.score ?? 0) >= 9 ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30' :
                              (evalResult.score ?? 0) >= 7 ? 'bg-blue-500/15 text-blue-700 border border-blue-500/30' :
                              (evalResult.score ?? 0) >= 5 ? 'bg-amber-500/15 text-amber-700 border border-amber-500/30' :
                              'bg-red-500/15 text-red-600 border border-red-500/30'}
                          `}>
                            {evalResult.grade || 'Evaluated'}
                          </span>
                          <span className="text-lg font-black text-[#5d5770]">
                            {evalResult.score}<span className="text-sm font-bold text-[#5d5770]/50">/{evalResult.maxScore}</span>
                          </span>
                        </div>
                      ) : (
                        isCorrect ? (
                          <h4 className="text-xl font-black text-emerald-600 mb-1">Correct! ✨</h4>
                        ) : (
                          <h4 className="text-xl font-black text-red-500 mb-1">Incorrect</h4>
                        )
                      )}

                      {/* Feedback */}
                      <p className="text-sm font-semibold text-[#7c6a75] leading-relaxed mb-4">
                        {evalResult?.aiExplanation || (isCorrect
                          ? `You got it right! The answer is: ${question.correctAnswer}.`
                          : `The correct answer was: ${question.correctAnswer}.`)}
                      </p>

                      {/* Strengths */}
                      {evalResult?.strengths && evalResult.strengths.length > 0 && (
                        <div className="mb-3 text-left">
                          <span className="text-xs font-bold uppercase text-emerald-600">✦ What you got right</span>
                          <ul className="mt-1 space-y-1">
                            {evalResult.strengths.map((str, idx) => (
                              <li key={idx} className="text-sm text-emerald-700 font-medium flex gap-2">
                                <span className="text-emerald-500">✓</span> <span>{str}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Missing Points */}
                      {evalResult?.missingPoints && evalResult.missingPoints.length > 0 && (
                        <div className="mb-3 text-left">
                          <span className="text-xs font-bold uppercase text-amber-600">✦ Missing concepts</span>
                          <ul className="mt-1 space-y-1">
                            {evalResult.missingPoints.map((pt, idx) => (
                              <li key={idx} className="text-sm text-amber-700 font-medium flex gap-2">
                                <span className="text-amber-500">○</span> <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Suggestions */}
                      {evalResult?.suggestions && evalResult.suggestions.length > 0 && (
                        <div className="mb-4 text-left">
                          <span className="text-xs font-bold uppercase text-blue-600">✦ How to improve</span>
                          <ul className="mt-1 space-y-1">
                            {evalResult.suggestions.map((sug, idx) => (
                              <li key={idx} className="text-sm text-blue-700 font-medium flex gap-2">
                                <span className="text-blue-500">→</span> <span>{sug}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Button variant="secondary" onClick={handleNext} className="w-full py-3">
                        {currentIndex < questions.length - 1 ? 'Next Question' : 'View Summary'}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
