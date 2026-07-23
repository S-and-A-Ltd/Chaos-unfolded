// ============================================================
// OpenAI API Client — Raw fetch, no SDK dependency
// gpt-4o for personality, gpt-4o-mini for utility tasks
// ============================================================

import type { AIMessage, AIResponse, QuizQuestion } from '@/types';
import {
  quizGenerationPrompt,
  answerEvaluationPrompt,
  summaryPrompt,
  topicExtractionPrompt,
} from './prompts';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// --- Internal fetch helper ---

async function callOpenAI(
  messages: { role: string; content: string }[],
  apiKey: string,
  model: string = 'gpt-4o-mini',
  temperature: number = 0.7,
  maxTokens: number = 1024
): Promise<string | null> {
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`OpenAI API error (${response.status}):`, error);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    console.error('OpenAI API call failed:', error);
    return null;
  }
}

// --- Parse JSON from model output (handles markdown fences) ---

function parseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return JSON.parse(cleaned) as T;
  } catch {
    console.error('Failed to parse JSON from model output:', raw.slice(0, 200));
    return null;
  }
}

// --- Public API ---

/**
 * Chat completion with Dazai personality (uses gpt-4o for quality).
 */
export async function createChatCompletion(
  messages: AIMessage[],
  apiKey: string
): Promise<AIResponse | null> {
  const raw = await callOpenAI(
    messages,
    apiKey,
    'gpt-4o',
    0.85,
    512
  );

  const parsed = parseJSON<AIResponse>(raw);
  if (!parsed) {
    // Fallback response if parsing fails
    return raw
      ? {
          dialogue: raw,
          emotion: 'neutral' as const,
          moodDelta: 0,
          voiceCategory: 'neutral' as const,
          shouldQuiz: false,
        }
      : null;
  }
  return parsed;
}

/**
 * Generate quiz questions from study material (uses gpt-4o-mini for cost).
 */
export async function generateQuizQuestions(
  context: string,
  topics: string[],
  config: QuizConfig,
  apiKey: string
): Promise<QuizQuestion[] | null> {
  const prompt = quizGenerationPrompt(context, topics, config);

  const raw = await callOpenAI(
    [{ role: 'user', content: prompt }],
    apiKey,
    'gpt-4o-mini',
    0.7,
    2048
  );

  let parsed = parseJSON<Omit<QuizQuestion, 'id'>[]>(raw);

  // Fallback: Generate local questions if OpenAI fails/rate-limits
  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
    console.warn("OpenAI quiz generation failed. Crafting offline fallback questions...");
    const sentences = context
      .split(/[.!?]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25 && s.length < 150);

    const fallbacks: Omit<QuizQuestion, 'id'>[] = [];
    const targetCount = config.count || 3;

    if (sentences.length > 0) {
      const selectedSentences = [...sentences].sort(() => 0.5 - Math.random()).slice(0, targetCount);
      selectedSentences.forEach((sentence, idx) => {
        // Map types/difficulty based on selected difficulty
        let qType: 'mcq' | 'short_answer' | 'concept_explanation' | 'recall' = 'recall';
        let qDiff: 'easy' | 'medium' | 'hard' = 'easy';

        if (config.difficulty === 'easy') {
          qType = 'recall';
          qDiff = 'easy';
        } else if (config.difficulty === 'medium') {
          qType = Math.random() > 0.5 ? 'short_answer' : 'recall';
          qDiff = 'medium';
        } else if (config.difficulty === 'hard') {
          qType = Math.random() > 0.5 ? 'concept_explanation' : 'short_answer';
          qDiff = 'hard';
        } else { // adaptive
          const rand = Math.random();
          if (rand < 0.3) {
            qType = 'recall';
            qDiff = 'easy';
          } else if (rand < 0.8) {
            qType = 'short_answer';
            qDiff = 'medium';
          } else {
            qType = 'concept_explanation';
            qDiff = 'hard';
          }
        }

        if (qType === 'recall') {
          const words = sentence.split(/\s+/).filter((w) => w.length > 5 && !w.includes('http'));
          if (words.length > 0) {
            const blankWord = words[Math.floor(Math.random() * words.length)].replace(/[,.:;()'"?]/g, '');
            const questionText = sentence.replace(new RegExp(`\\b${blankWord}\\b`, 'i'), '_____');
            fallbacks.push({
              type: 'recall',
              question: `From the study text: Fill in the blank: "${questionText}"`,
              correctAnswer: blankWord,
              topic: topics[0] || 'Direct Comprehension',
              difficulty: qDiff,
            });
          } else {
            fallbacks.push({
              type: 'short_answer',
              question: `From the study text: Explain the key idea of this statement: "${sentence}"`,
              correctAnswer: sentence,
              topic: topics[0] || 'Direct Comprehension',
              difficulty: qDiff,
            });
          }
        } else if (qType === 'short_answer') {
          fallbacks.push({
            type: 'short_answer',
            question: `In reference to the text: Explain the significance of this statement: "${sentence}"`,
            correctAnswer: 'Verify details from context.',
            topic: topics[0] || 'Key Concept',
            difficulty: qDiff,
          });
        } else {
          fallbacks.push({
            type: 'concept_explanation',
            question: `Explain in your own words the core idea described in this context: "${sentence}"`,
            correctAnswer: 'Verify explanation details.',
            topic: topics[0] || 'Critical Analysis',
            difficulty: qDiff,
          });
        }
      });
    }

    // Secondary fallback in case no sentences matched
    if (fallbacks.length === 0) {
      const qDiff: 'easy' | 'medium' | 'hard' = config.difficulty === 'adaptive' ? 'medium' : config.difficulty;
      fallbacks.push({
        type: 'mcq',
        question: 'What is the most effective way to improve long-term learning and memory recall?',
        options: [
          'Cramming everything the night before the exam',
          'Active recall testing combined with spaced repetition',
          'Highlighting every single line in the textbook',
          'Sleeping with the textbook under your pillow',
        ],
        correctAnswer: 'Active recall testing combined with spaced repetition',
        topic: 'Effective Studying',
        difficulty: qDiff,
      });
      fallbacks.push({
        type: 'short_answer',
        question: 'Explain why taking regular short breaks (e.g. 5-10 minutes) during study sessions is beneficial.',
        correctAnswer: 'It helps refresh focus, consolidates learned information, and prevents cognitive fatigue.',
        topic: 'Effective Studying',
        difficulty: qDiff,
      });
    }

    parsed = fallbacks;
  }

  // Add IDs to each question
  return parsed.map((q, i) => ({
    ...q,
    id: `q_fallback_${Date.now()}_${i}`,
  }));
}

/**
 * Evaluate a student's answer (uses gpt-4o-mini).
 */
export async function evaluateAnswer(
  question: string,
  userAnswer: string,
  apiKey: string,
  correctAnswer?: string
): Promise<{
  isCorrect: boolean;
  explanation: string;
  partialCredit: boolean;
  emotion: string;
} | null> {
  const prompt = answerEvaluationPrompt(
    question,
    correctAnswer ?? '(not provided — evaluate based on the question)',
    userAnswer
  );

  const raw = await callOpenAI(
    [{ role: 'user', content: prompt }],
    apiKey,
    'gpt-4o-mini',
    0.3, // Low temperature for consistent evaluation
    512
  );

  return parseJSON(raw);
}

/**
 * Generate a summary of study material (uses gpt-4o-mini).
 */
export async function generateSummary(
  text: string,
  apiKey: string
): Promise<string | null> {
  const prompt = summaryPrompt(text);
  return callOpenAI(
    [{ role: 'user', content: prompt }],
    apiKey,
    'gpt-4o-mini',
    0.5,
    1024
  );
}

/**
 * Extract key topics from study material (uses gpt-4o-mini).
 */
export async function extractTopics(
  text: string,
  apiKey: string
): Promise<string[] | null> {
  const prompt = topicExtractionPrompt(text);
  const raw = await callOpenAI(
    [{ role: 'user', content: prompt }],
    apiKey,
    'gpt-4o-mini',
    0.3,
    512
  );
  return parseJSON<string[]>(raw);
}
