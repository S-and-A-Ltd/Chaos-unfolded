// ============================================================
// OpenAI API Client — Raw fetch, no SDK dependency
// gpt-4o for personality, gpt-4o-mini for utility tasks
// ============================================================

import type { AIMessage, AIResponse, QuizQuestion } from '@/types';
import {
  generateMCQPrompt,
  generateShortAnswerPrompt,
  generateRecallPrompt,
  generateConceptPrompt,
  generateMixedPrompt,
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
  let prompt = '';
  switch (config.type) {
    case 'mcq':
      prompt = generateMCQPrompt(context, topics, config);
      break;
    case 'short_answer':
      prompt = generateShortAnswerPrompt(context, topics, config);
      break;
    case 'recall':
      prompt = generateRecallPrompt(context, topics, config);
      break;
    case 'concept_explanation':
      prompt = generateConceptPrompt(context, topics, config);
      break;
    case 'mixed':
    default:
      prompt = generateMixedPrompt(context, topics, config);
      break;
  }
  console.log('[DEBUG ROUTE] Calling AI with type:', config.type);
  console.log('[DEBUG ROUTE] Generated Prompt snippet (first 100 chars):', prompt.slice(0, 100));

  let parsed: Omit<QuizQuestion, 'id'>[] | null = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const raw = await callOpenAI(
      [{ role: 'user', content: prompt }],
      apiKey,
      'gpt-4o-mini',
      0.5, // Lower temp for more reliable formatting
      2048
    );

    const maybeParsed = parseJSON<Omit<QuizQuestion, 'id'>[]>(raw);
    
    if (Array.isArray(maybeParsed) && maybeParsed.length > 0) {
      // Validate schema
      let isValid = true;
      for (const q of maybeParsed) {
        if (!q.question || !q.correctAnswer || !q.topic || !q.difficulty || !q.type) {
          isValid = false;
          break;
        }
        
        // Type specific validation
        if (config.type !== 'mixed' && q.type !== config.type) {
          isValid = false; // Strictly enforce requested type if not mixed
          break;
        }

        if (q.type === 'mcq' && (!Array.isArray(q.options) || q.options.length !== 4)) {
          isValid = false;
          break;
        }

        if (q.type === 'recall' && !q.question.includes('____')) {
          isValid = false;
          break;
        }
      }

      // Check distribution if mixed custom
      if (isValid && config.type === 'mixed' && config.mixedMode === 'custom' && config.distribution) {
        const counts = { mcq: 0, short_answer: 0, concept_explanation: 0, recall: 0 };
        maybeParsed.forEach(q => counts[q.type as keyof typeof counts]++);
        if (
          counts.mcq !== config.distribution.mcq ||
          counts.short_answer !== config.distribution.short_answer ||
          counts.recall !== config.distribution.recall ||
          counts.concept_explanation !== config.distribution.concept_explanation
        ) {
          isValid = false;
        }
      }

      if (isValid) {
        parsed = maybeParsed;
        break; // Success!
      } else {
        console.warn(`[Attempt ${attempt + 1}] AI returned invalid schema for type: ${config.type}. Retrying...`);
        // We could append a correction prompt here, but simply retrying with the strict prompt often works
      }
    } else {
      console.warn(`[Attempt ${attempt + 1}] AI failed to return a JSON array. Retrying...`);
    }
  }

  // Fallback: Generate local questions if OpenAI fails/rate-limits or failed validation 3 times
  if (!parsed || parsed.length === 0) {
    console.warn("OpenAI quiz generation failed after retries. Crafting offline fallback questions...");
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
        let qDiff: 'easy' | 'medium' | 'hard' = config.difficulty === 'adaptive' ? 'medium' : config.difficulty;

        // If a specific type is requested, enforce it
        if (config.type !== 'mixed') {
          qType = config.type;
        } else {
          // If mixed mode is custom, try to satisfy the distribution (loosely in offline mode)
          if (config.mixedMode === 'custom' && config.distribution) {
             const dist = config.distribution;
             const total = dist.mcq + dist.short_answer + dist.recall + dist.concept_explanation;
             const rand = Math.random() * total;
             if (rand < dist.mcq) qType = 'mcq';
             else if (rand < dist.mcq + dist.short_answer) qType = 'short_answer';
             else if (rand < dist.mcq + dist.short_answer + dist.recall) qType = 'recall';
             else qType = 'concept_explanation';
          } else {
            // Otherwise, balance based on difficulty
            if (config.difficulty === 'easy') {
              qType = Math.random() > 0.5 ? 'recall' : 'mcq';
            } else if (config.difficulty === 'medium') {
              qType = Math.random() > 0.5 ? 'short_answer' : 'mcq';
            } else if (config.difficulty === 'hard') {
              qType = Math.random() > 0.5 ? 'concept_explanation' : 'short_answer';
            } else { // adaptive
              const rand = Math.random();
              if (rand < 0.25) qType = 'recall';
              else if (rand < 0.5) qType = 'mcq';
              else if (rand < 0.75) qType = 'short_answer';
              else qType = 'concept_explanation';
            }
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
        } else if (qType === 'mcq') {
          fallbacks.push({
            type: 'mcq',
            question: `Which of the following statements is true regarding this concept: "${sentence.slice(0, 30)}..."?`,
            options: [
              sentence,
              "This concept is entirely false and deprecated.",
              "It only applies in very specific, unrelated edge cases.",
              "None of the above are correct."
            ],
            correctAnswer: sentence,
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
