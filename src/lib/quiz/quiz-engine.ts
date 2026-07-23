// ============================================================
// Quiz Engine (Client-Side)
// Orchestrates question generation, evaluation, and adaptation
// ============================================================

import type { QuizQuestion, QuestionType, QuizResult } from '@/types';

// --- Performance tracking ---

interface PerformanceStats {
  totalAnswered: number;
  totalCorrect: number;
  byTopic: Record<string, { correct: number; total: number }>;
  byType: Record<QuestionType, { correct: number; total: number }>;
  recentResults: boolean[]; // Last N results (true = correct)
}

const EMPTY_TYPE_STATS = () => ({
  mcq: { correct: 0, total: 0 },
  short_answer: { correct: 0, total: 0 },
  concept_explanation: { correct: 0, total: 0 },
  recall: { correct: 0, total: 0 },
});

export class QuizEngine {
  private stats: PerformanceStats;
  private questionCache: QuizQuestion[] = [];

  constructor() {
    this.stats = {
      totalAnswered: 0,
      totalCorrect: 0,
      byTopic: {},
      byType: EMPTY_TYPE_STATS(),
      recentResults: [],
    };
  }

  /**
   * Generate quiz questions by calling the API route.
   */
  async generateQuestions(
    topics: string[],
    context: string,
    difficulty: 'easy' | 'medium' | 'hard' | 'adaptive',
    count: number,
    apiKey: string,
    type: 'mixed' | 'mcq' | 'short_answer' | 'concept_explanation' | 'recall' = 'mixed'
  ): Promise<QuizQuestion[]> {
    try {
      const response = await fetch('/api/ai/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics, context, difficulty, count, apiKey, type }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 400 && (errData.error === 'OpenAI API key is missing.' || errData.error?.includes('API key'))) {
          throw new Error('API_KEY_MISSING');
        }
        console.error('Quiz generation failed:', response.status);
        return [];
      }

      const data = await response.json();
      const questions: QuizQuestion[] = data.questions ?? [];
      this.questionCache = questions;
      return questions;
    } catch (error: any) {
      if (error.message === 'API_KEY_MISSING') {
        throw error;
      }
      console.error('Quiz generation error:', error);
      return [];
    }
  }

  /**
   * Evaluate a student's answer by calling the API route.
   */
  async evaluateAnswer(
    question: QuizQuestion,
    userAnswer: string,
    apiKey: string
  ): Promise<{
    isCorrect: boolean;
    explanation: string;
    emotion: string;
  } | null> {
    try {
      const response = await fetch('/api/ai/quiz', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.question,
          correctAnswer: question.correctAnswer,
          userAnswer,
          apiKey,
        }),
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Answer evaluation error:', error);
      return null;
    }
  }

  /**
   * Calculate when the next quiz should appear.
   */
  getNextQuizTime(lastQuizTime: number, intervalMinutes: number): number {
    return lastQuizTime + intervalMinutes * 60 * 1000;
  }

  /**
   * Select a question type, weighted by difficulty and past performance.
   * Students who struggle get more recall/MCQ; strong students get more explanations.
   */
  selectQuestionType(): QuestionType {
    const recentAccuracy = this.getRecentAccuracy();

    // Weights: [mcq, short_answer, concept_explanation, recall]
    let weights: number[];

    if (recentAccuracy < 0.4) {
      // Struggling — more recall and MCQ
      weights = [0.35, 0.15, 0.1, 0.4];
    } else if (recentAccuracy < 0.7) {
      // Moderate — balanced
      weights = [0.25, 0.3, 0.2, 0.25];
    } else {
      // Strong — more concept and short answer
      weights = [0.15, 0.3, 0.35, 0.2];
    }

    const types: QuestionType[] = ['mcq', 'short_answer', 'concept_explanation', 'recall'];
    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return types[i];
      }
    }

    return 'mcq';
  }

  /**
   * Track the result of an answered question.
   */
  trackPerformance(result: QuizResult): void {
    this.stats.totalAnswered++;
    if (result.isCorrect) this.stats.totalCorrect++;

    // Track recent results (keep last 20)
    this.stats.recentResults.push(result.isCorrect);
    if (this.stats.recentResults.length > 20) {
      this.stats.recentResults.shift();
    }

    // Track by topic (find the question to get the topic)
    const question = this.questionCache.find((q) => q.id === result.questionId);
    if (question) {
      const topic = question.topic;
      if (!this.stats.byTopic[topic]) {
        this.stats.byTopic[topic] = { correct: 0, total: 0 };
      }
      this.stats.byTopic[topic].total++;
      if (result.isCorrect) this.stats.byTopic[topic].correct++;

      // Track by type
      const type = question.type;
      this.stats.byType[type].total++;
      if (result.isCorrect) this.stats.byType[type].correct++;
    }
  }

  /**
   * Get overall accuracy.
   */
  getAccuracy(): number {
    if (this.stats.totalAnswered === 0) return 0;
    return this.stats.totalCorrect / this.stats.totalAnswered;
  }

  /**
   * Get recent accuracy (last 20 questions).
   */
  getRecentAccuracy(): number {
    if (this.stats.recentResults.length === 0) return 0.5; // Default to moderate
    const correct = this.stats.recentResults.filter(Boolean).length;
    return correct / this.stats.recentResults.length;
  }

  /**
   * Get weak topics (accuracy < 50%).
   */
  getWeakTopics(): string[] {
    return Object.entries(this.stats.byTopic)
      .filter(([, s]) => s.total >= 2 && s.correct / s.total < 0.5)
      .map(([topic]) => topic);
  }

  /**
   * Get strong topics (accuracy >= 80%).
   */
  getStrongTopics(): string[] {
    return Object.entries(this.stats.byTopic)
      .filter(([, s]) => s.total >= 2 && s.correct / s.total >= 0.8)
      .map(([topic]) => topic);
  }

  /**
   * Get full performance stats snapshot.
   */
  getStats(): PerformanceStats {
    return { ...this.stats };
  }
}
