// ============================================================
// AI Prompt Templates
// All prompts return structured JSON from the model
// ============================================================

import type { QuizConfig } from '@/types';

export function quizGenerationPrompt(
  context: string,
  topics: string[],
  config: QuizConfig
): string {
  const difficultyGuide: Record<string, string> = {
    easy: 'Straightforward recall and basic comprehension questions. Test direct facts from the material.',
    medium: 'Application and analysis questions. Require understanding concepts, not just memorizing.',
    hard: 'Synthesis and evaluation questions. Require connecting multiple concepts, critical thinking, or applying knowledge to new scenarios.',
    adaptive: 'Mix of easy (30%), medium (50%), and hard (20%) questions for balanced assessment.',
  };

  const typeDefs: Record<string, string> = {
    mcq: `**mcq** — Multiple choice with exactly 4 options. Only ONE correct answer.`,
    short_answer: `**short_answer** — Requires a brief factual answer (1-2 sentences).`,
    concept_explanation: `**concept_explanation** — Asks student to explain a concept in their own words.`,
    recall: `**recall** — Direct recall from the material (fill-in-the-blank style). You MUST leave a literal dash '____' in the question text where the missing word or phrase belongs.`
  };

  let typeGuide = '';
  if (config.type === 'mixed') {
    if (config.mixedMode === 'custom' && config.distribution) {
      typeGuide = `Generate exactly:\n` +
        `- ${config.distribution.mcq} questions of type: ${typeDefs.mcq}\n` +
        `- ${config.distribution.short_answer} questions of type: ${typeDefs.short_answer}\n` +
        `- ${config.distribution.concept_explanation} questions of type: ${typeDefs.concept_explanation}\n` +
        `- ${config.distribution.recall} questions of type: ${typeDefs.recall}\n`;
    } else {
      typeGuide = `Generate a balanced mix of these types:\n` +
        Object.values(typeDefs).map(t => `- ${t}`).join('\n');
    }
  } else {
    typeGuide = `Generate ONLY questions of this type:\n- ${typeDefs[config.type]}`;
  }

  return `You are a quiz generator for study material. Generate exactly ${config.count} quiz questions based on the provided material.

## STUDY MATERIAL
${context.slice(0, 6000)}

## TOPICS TO FOCUS ON
${topics.length > 0 ? topics.join(', ') : 'All topics found in the material'}

## DIFFICULTY LEVEL: ${config.difficulty.toUpperCase()}
${difficultyGuide[config.difficulty]}

## QUESTION TYPES TO GENERATE:
${typeGuide}

## OUTPUT FORMAT
Respond with a JSON array. Each element must have:
{
  "type": "mcq" | "short_answer" | "concept_explanation" | "recall",
  "question": "The question text",
  "options": ["A", "B", "C", "D"],  // ONLY for mcq type, omit for others
  "correctAnswer": "The correct answer text",
  "topic": "Which topic this question covers",
  "difficulty": "easy" | "medium" | "hard"
}

Return ONLY the JSON array, no markdown fences, no explanation.`;
}

export function answerEvaluationPrompt(
  question: string,
  correctAnswer: string,
  userAnswer: string
): string {
  return `Evaluate the student's answer to this question.

## QUESTION
${question}

## CORRECT ANSWER
${correctAnswer}

## STUDENT'S ANSWER
${userAnswer}

## EVALUATION RULES
- For factual questions: the answer must be substantially correct, exact wording is NOT required.
- For concept explanations: check if the core idea is communicated, even if phrasing differs.
- For MCQs: the selected option must match the correct answer.
- Be fair but not overly lenient. Partial understanding counts as incorrect but deserves acknowledgment.

## RESPONSE FORMAT
Respond with JSON:
{
  "isCorrect": true | false,
  "explanation": "Brief explanation of why the answer is correct or incorrect, and the key concept they should understand",
  "partialCredit": true | false,
  "emotion": "proud" | "happy" | "neutral" | "concerned" | "disappointed" | "annoyed"
}

The emotion reflects how Dazai would feel about this answer quality.
Return ONLY JSON, no markdown fences.`;
}

export function summaryPrompt(text: string): string {
  return `Summarize the following study material concisely. Focus on:
1. Main topics and themes
2. Key concepts and definitions
3. Important relationships between ideas
4. Critical facts that would likely appear in a test

Keep the summary structured with clear sections. Aim for 200-400 words.

## MATERIAL
${text.slice(0, 8000)}

Return the summary as plain text (not JSON).`;
}

export function topicExtractionPrompt(text: string): string {
  return `Extract the key topics and concepts from this study material.

## MATERIAL
${text.slice(0, 8000)}

## RULES
- Identify 3-15 distinct topics/concepts.
- Each topic should be a concise phrase (1-5 words).
- Order from most prominent to least prominent.
- Include subtopics if they are significant enough to generate quiz questions about.

## RESPONSE FORMAT
Return a JSON array of strings. Example: ["Photosynthesis", "Cell Division", "DNA Replication"]
Return ONLY the JSON array, no markdown fences, no explanation.`;
}
