'use client';

import { motion } from 'motion/react';
import Card from '@/components/ui/Card';
import type { QuizResult } from '@/types';

interface QuizResultsProps {
  results: QuizResult[];
}

export default function QuizResults({ results }: QuizResultsProps) {
  const recent = results.slice(-5).reverse();
  const total = results.length;
  const correct = results.filter((r) => r.isCorrect).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Topic breakdown
  const topicMap = new Map<string, { correct: number; total: number }>();
  results.forEach((r) => {
    // We don't have topic on QuizResult, but we can group by questionId prefix or use a default
    const topic = 'General'; // placeholder since QuizResult doesn't have topic
    const existing = topicMap.get(topic) || { correct: 0, total: 0 };
    existing.total++;
    if (r.isCorrect) existing.correct++;
    topicMap.set(topic, existing);
  });

  if (recent.length === 0) {
    return (
      <Card className="text-center py-8">
        <div className="text-3xl mb-2">📝</div>
        <p className="text-sm text-[#5d5770]/80 font-semibold">No quiz results yet</p>
        <p className="text-xs text-[#5d5770]/60 mt-1">
          Results will appear here as you answer questions
        </p>
      </Card>
    );
  }

  return (
    <Card padding="lg" bgVariant="yellow" className="shadow-[0_6px_0_#7c6a75]">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#7c6a75]/20 pb-2">
          <h3 className="text-sm font-black text-[#5d5770] uppercase tracking-wider">
            Quiz Performance
          </h3>
          <div className="flex items-center gap-2">
            <span
              className={`text-lg font-bold ${
                accuracy >= 80
                  ? 'text-emerald-600'
                  : accuracy >= 50
                  ? 'text-amber-500'
                  : 'text-red-500'
              }`}
            >
              {accuracy}%
            </span>
            <span className="text-xs text-[#5d5770]/60">accuracy</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex gap-4">
          <div className="text-center flex-1 py-2 rounded-lg bg-white/30 border border-[#ababdc]/20">
            <p className="text-lg font-bold text-emerald-600">{correct}</p>
            <p className="text-[10px] text-[#5d5770]/60 uppercase font-bold">Correct</p>
          </div>
          <div className="text-center flex-1 py-2 rounded-lg bg-white/30 border border-[#ababdc]/20">
            <p className="text-lg font-bold text-red-500">{total - correct}</p>
            <p className="text-[10px] text-[#5d5770]/60 uppercase font-bold">Wrong</p>
          </div>
          <div className="text-center flex-1 py-2 rounded-lg bg-white/30 border border-[#ababdc]/20">
            <p className="text-lg font-bold text-primary">{total}</p>
            <p className="text-[10px] text-[#5d5770]/60 uppercase font-bold">Total</p>
          </div>
        </div>

        {/* Recent results */}
        <div className="space-y-1.5">
          <p className="text-xs text-[#5d5770]/60 uppercase tracking-wider font-bold">
            Recent
          </p>
          {recent.map((result, i) => (
            <motion.div
              key={result.questionId + i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/40 transition-colors"
            >
              <span
                className={`text-sm font-bold ${
                  result.isCorrect ? 'text-emerald-600' : 'text-red-500'
                }`}
              >
                {result.isCorrect ? '✓' : '✗'}
              </span>
              <span className="text-xs text-[#5d5770]/80 flex-1 truncate font-medium">
                Question #{result.questionId.slice(0, 6)}
              </span>
              <span className="text-[10px] text-[#7181c8] font-bold">
                +{result.xpEarned} XP
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </Card>
  );
}
