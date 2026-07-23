'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { QuizConfig, QuestionType } from '@/types';

interface QuizConfigurationPanelProps {
  isLoading: boolean;
  onGenerateQuiz: (config: QuizConfig, forceRegenerate: boolean) => void;
}

export default function QuizConfigurationPanel({ isLoading, onGenerateQuiz }: QuizConfigurationPanelProps) {
  const [type, setType] = useState<QuestionType | 'mixed'>('mixed');
  const [countStr, setCountStr] = useState<string>('5');
  const [customCount, setCustomCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'adaptive'>('adaptive');
  const [mixedMode, setMixedMode] = useState<'auto' | 'custom'>('auto');
  
  const [dist, setDist] = useState({
    mcq: 2,
    short_answer: 1,
    concept_explanation: 1,
    recall: 1
  });

  const activeCount = countStr === 'custom' ? customCount : parseInt(countStr, 10);

  const distSum = dist.mcq + dist.short_answer + dist.concept_explanation + dist.recall;
  const isCustomMixedInvalid = type === 'mixed' && mixedMode === 'custom' && distSum !== activeCount;

  const handleGenerate = () => {
    if (isCustomMixedInvalid) return;

    const config: QuizConfig = {
      type,
      count: activeCount,
      difficulty,
      mixedMode: type === 'mixed' ? mixedMode : undefined,
      distribution: type === 'mixed' && mixedMode === 'custom' ? dist : undefined
    };

    onGenerateQuiz(config, true); // Manual clicks always force regenerate to guarantee fresh/exact configs
  };

  return (
    <div className="w-full glass-card-yellow-static p-6 shadow-[0_6px_0_#7c6a75] flex flex-col gap-4 font-fredoka">
      <span className="text-xs font-black text-[#5d5770] uppercase tracking-wider text-center border-b border-[#7c6a75]/25 pb-1.5">
        Master your material
      </span>
      
      <div className="flex flex-col gap-3">
        {/* Question Type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#5d5770] px-1">Quiz Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full p-2.5 rounded-xl border-2 border-[#7c6a75] bg-white/70 text-[#5d5770] font-bold text-sm focus:outline-none focus:border-[#7c6a75] cursor-pointer"
          >
            <option value="mixed">Mixed Types</option>
            <option value="mcq">Multiple Choice (MCQ)</option>
            <option value="short_answer">Short Answer (SAQ)</option>
            <option value="concept_explanation">Concept Explanation</option>
            <option value="recall">Recall (Fill-in-the-blank)</option>
          </select>
        </div>

        {/* Question Count & Difficulty Row */}
        <div className="flex gap-2">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-bold text-[#5d5770] px-1">Count</label>
            <select
              value={countStr}
              onChange={(e) => setCountStr(e.target.value)}
              className="w-full p-2.5 rounded-xl border-2 border-[#7c6a75] bg-white/70 text-[#5d5770] font-bold text-sm focus:outline-none focus:border-[#7c6a75] cursor-pointer"
            >
              <option value="5">5 Questions</option>
              <option value="10">10 Questions</option>
              <option value="15">15 Questions</option>
              <option value="20">20 Questions</option>
              <option value="custom">Custom...</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-bold text-[#5d5770] px-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className="w-full p-2.5 rounded-xl border-2 border-[#7c6a75] bg-white/70 text-[#5d5770] font-bold text-sm focus:outline-none focus:border-[#7c6a75] cursor-pointer"
            >
              <option value="adaptive">Adaptive</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {/* Custom Count Input */}
        {countStr === 'custom' && (
          <div className="flex flex-col gap-1">
             <label className="text-xs font-bold text-[#5d5770] px-1">Total Questions</label>
             <input
              type="number"
              min="1"
              max="50"
              value={customCount}
              onChange={(e) => setCustomCount(Math.max(1, parseInt(e.target.value || '1', 10)))}
              className="w-full p-2.5 rounded-xl border-2 border-[#7c6a75] bg-white/70 text-[#5d5770] font-bold text-sm focus:outline-none focus:border-[#7c6a75]"
            />
          </div>
        )}

        {/* Mixed Mode Customization */}
        {type === 'mixed' && (
          <div className="flex flex-col gap-2 mt-1 border-t border-[#7c6a75]/20 pt-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-bold text-[#5d5770]">Distribution</label>
              <div className="flex bg-white/50 rounded-lg p-0.5 border border-[#7c6a75]/30">
                <button 
                  onClick={() => setMixedMode('auto')}
                  className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all ${mixedMode === 'auto' ? 'bg-[#7c6a75] text-white' : 'text-[#5d5770] hover:bg-black/5'}`}
                >
                  Auto
                </button>
                <button 
                  onClick={() => setMixedMode('custom')}
                  className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all ${mixedMode === 'custom' ? 'bg-[#7c6a75] text-white' : 'text-[#5d5770] hover:bg-black/5'}`}
                >
                  Custom
                </button>
              </div>
            </div>

            {mixedMode === 'custom' && (
              <div className="grid grid-cols-2 gap-2 bg-white/40 p-3 rounded-xl border border-[#7c6a75]/20">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#5d5770]">MCQ</label>
                  <input type="number" min="0" value={dist.mcq} onChange={e => setDist({...dist, mcq: parseInt(e.target.value || '0', 10)})} className="w-full p-1.5 rounded-lg border border-[#7c6a75]/50 bg-white text-[#5d5770] font-bold text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#5d5770]">Short Answer</label>
                  <input type="number" min="0" value={dist.short_answer} onChange={e => setDist({...dist, short_answer: parseInt(e.target.value || '0', 10)})} className="w-full p-1.5 rounded-lg border border-[#7c6a75]/50 bg-white text-[#5d5770] font-bold text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#5d5770]">Recall</label>
                  <input type="number" min="0" value={dist.recall} onChange={e => setDist({...dist, recall: parseInt(e.target.value || '0', 10)})} className="w-full p-1.5 rounded-lg border border-[#7c6a75]/50 bg-white text-[#5d5770] font-bold text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#5d5770]">Concept</label>
                  <input type="number" min="0" value={dist.concept_explanation} onChange={e => setDist({...dist, concept_explanation: parseInt(e.target.value || '0', 10)})} className="w-full p-1.5 rounded-lg border border-[#7c6a75]/50 bg-white text-[#5d5770] font-bold text-xs" />
                </div>
                {isCustomMixedInvalid && (
                  <span className="col-span-2 text-[10px] font-bold text-red-500 text-center mt-1">
                    Sum must equal {activeCount} (currently {distSum})
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <Button
          variant="primary"
          className="w-full py-3 text-sm font-black mt-2"
          isLoading={isLoading}
          disabled={isCustomMixedInvalid}
          onClick={handleGenerate}
        >
          Generate Dazai Quiz
        </Button>
      </div>
    </div>
  );
}
