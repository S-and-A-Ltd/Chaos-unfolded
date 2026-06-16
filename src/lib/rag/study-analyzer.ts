// ============================================================
// Study Material Analyzer
// AI-powered analysis: topics, summaries, flashcards
// ============================================================

import { extractTopics, generateSummary } from '@/lib/ai/openai-client';

export interface AnalysisResult {
  topics: string[];
  summary: string;
  keyTerms: string[];
}

/**
 * Full analysis pipeline for study material.
 * Runs topic extraction and summarization in parallel.
 */
export async function analyzeMaterial(
  text: string,
  apiKey: string
): Promise<AnalysisResult | null> {
  try {
    // Run both in parallel for speed
    const [topics, summary] = await Promise.all([
      extractTopics(text, apiKey),
      generateSummary(text, apiKey),
    ]);

    if (!topics && !summary) return null;

    // Extract key terms from the topics (short, distinct terms)
    const keyTerms = (topics ?? []).filter((t) => t.split(' ').length <= 3);

    return {
      topics: topics ?? [],
      summary: summary ?? 'Summary generation failed.',
      keyTerms,
    };
  } catch (error) {
    console.error('Material analysis failed:', error);
    return null;
  }
}

export interface Flashcard {
  question: string;
  answer: string;
  topic: string;
}

/**
 * Generate flashcard Q&A pairs from study material.
 * Uses a dedicated prompt rather than quiz generation for simpler output.
 */
export async function generateFlashcards(
  text: string,
  topics: string[],
  apiKey: string
): Promise<Flashcard[]> {
  try {
    const prompt = `Generate flashcard-style question-and-answer pairs from this study material.

## MATERIAL
${text.slice(0, 6000)}

## TOPICS TO FOCUS ON
${topics.length > 0 ? topics.join(', ') : 'All topics in the material'}

## RULES
- Generate 5-15 flashcards depending on material length.
- Questions should be clear and direct.
- Answers should be concise (1-3 sentences).
- Cover the most important concepts from the material.

## OUTPUT FORMAT
Return a JSON array:
[
  { "question": "...", "answer": "...", "topic": "..." },
  ...
]

Return ONLY the JSON array, no markdown fences.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      console.error('Flashcard generation API error:', response.status);
      return [];
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();

    if (!raw) return [];

    let cleaned = raw;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(cleaned) as Flashcard[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Flashcard generation failed:', error);
    return [];
  }
}
