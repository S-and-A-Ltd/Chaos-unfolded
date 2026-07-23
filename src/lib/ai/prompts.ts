// ============================================================
// AI Prompt Templates
// All prompts return structured JSON from the model
// ============================================================

import type { QuizConfig, QuizDistribution } from '@/types';

const difficultyGuide: Record<string, string> = {
  easy: 'Straightforward recall and basic comprehension questions. Test direct facts from the material.',
  medium: 'Application and analysis questions. Require understanding concepts, not just memorizing.',
  hard: 'Synthesis and evaluation questions. Require connecting multiple concepts, critical thinking, or applying knowledge to new scenarios.',
  adaptive: 'Mix of easy (30%), medium (50%), and hard (20%) questions for balanced assessment.',
};

function getBasePrompt(context: string, topics: string[], difficulty: string, count: number): string {
  return `You are an expert quiz generator for study material. Generate exactly ${count} quiz questions based on the provided material.

## STUDY MATERIAL
${context.slice(0, 6000)}

## TOPICS TO FOCUS ON
${topics.length > 0 ? topics.join(', ') : 'All topics found in the material'}

## DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
${difficultyGuide[difficulty]}
`;
}

export function generateMCQPrompt(context: string, topics: string[], config: QuizConfig): string {
  return `${getBasePrompt(context, topics, config.difficulty, config.count)}

## QUESTION TYPE TO GENERATE:
Generate ONLY Multiple Choice Questions (MCQs).
Do not generate open-ended questions.

## STRICT MCQ QUALITY GUIDELINES
1. The question wording MUST NOT hint at or reveal the correct answer.
2. The options must include exactly one correct answer and three plausible, realistic distractors that are conceptually related to the correct answer. Avoid obviously wrong or humorous distractors.
3. Test understanding and application rather than simple recognition, if possible.
4. Format the question like a formal university or competitive exam question.

## OUTPUT FORMAT
Respond with a JSON array. Each element must have:
{
  "type": "mcq",
  "question": "The question text",
  "options": ["A plausible distractor", "Another distractor", "The correct answer", "A third distractor"],  // Exactly 4 options.
  "correctAnswer": "The exact string from the options array that is correct",
  "topic": "The specific topic this relates to",
  "difficulty": "${config.difficulty === 'adaptive' ? 'easy, medium, or hard' : config.difficulty}"
}
`;
}

export function generateShortAnswerPrompt(context: string, topics: string[], config: QuizConfig): string {
  return `${getBasePrompt(context, topics, config.difficulty, config.count)}

## QUESTION TYPE TO GENERATE:
Generate ONLY Short Answer Questions.
Each question should require a concise written factual response (1-3 sentences).
Do not provide options.

## OUTPUT FORMAT
Respond with a JSON array. Each element must have:
{
  "type": "short_answer",
  "question": "The question text",
  "correctAnswer": "The expected ideal answer",
  "topic": "The specific topic this relates to",
  "difficulty": "${config.difficulty === 'adaptive' ? 'easy, medium, or hard' : config.difficulty}"
}
`;
}

export function generateRecallPrompt(context: string, topics: string[], config: QuizConfig): string {
  return `${getBasePrompt(context, topics, config.difficulty, config.count)}

## QUESTION TYPE TO GENERATE:
Generate ONLY Fill-in-the-Blank / Recall questions.
You MUST leave a literal dash '____' in the question text where the missing word or phrase belongs.
Do not generate explanation-style questions.

## OUTPUT FORMAT
Respond with a JSON array. Each element must have:
{
  "type": "recall",
  "question": "The sentence with exactly one '____' replacing the key word.",
  "correctAnswer": "The exact missing word or short phrase",
  "topic": "The specific topic this relates to",
  "difficulty": "${config.difficulty === 'adaptive' ? 'easy, medium, or hard' : config.difficulty}"
}
`;
}

export function generateConceptPrompt(context: string, topics: string[], config: QuizConfig): string {
  return `${getBasePrompt(context, topics, config.difficulty, config.count)}

## QUESTION TYPE TO GENERATE:
Generate ONLY Conceptual Reasoning questions.
These questions must ask the student to explain a concept in their own words, analyze why something happens, or describe the significance of an idea.
Do not generate MCQs or fill-in-the-blank questions.

## OUTPUT FORMAT
Respond with a JSON array. Each element must have:
{
  "type": "concept_explanation",
  "question": "The question text",
  "correctAnswer": "A comprehensive explanation of what a correct answer should include",
  "topic": "The specific topic this relates to",
  "difficulty": "${config.difficulty === 'adaptive' ? 'easy, medium, or hard' : config.difficulty}"
}
`;
}

export function generateMixedPrompt(context: string, topics: string[], config: QuizConfig): string {
  let distributionInstruction = 'Generate a balanced mix of MCQs, Short Answers, Recall, and Concept Explanations.';
  
  if (config.mixedMode === 'custom' && config.distribution) {
    distributionInstruction = `Generate EXACTLY:
- ${config.distribution.mcq} Multiple Choice (mcq)
- ${config.distribution.short_answer} Short Answer (short_answer)
- ${config.distribution.recall} Recall / Fill-in-the-blank (recall)
- ${config.distribution.concept_explanation} Concept Explanation (concept_explanation)`;
  }

  return `${getBasePrompt(context, topics, config.difficulty, config.count)}

## QUESTION DISTRIBUTION:
${distributionInstruction}

## TYPE RULES:
- **mcq**: Must include exactly 4 "options" and "correctAnswer" must strictly match one option.
- **short_answer**: Requires a brief factual answer (1-2 sentences).
- **recall**: Fill-in-the-blank style. You MUST include a literal dash '____' in the question text.
- **concept_explanation**: Asks the student to explain a concept in their own words.

## OUTPUT FORMAT
Respond with a JSON array containing EXACTLY ${config.count} elements. Each element must follow this schema based on its type:
{
  "type": "mcq" | "short_answer" | "concept_explanation" | "recall",
  "question": "The question text (must contain '____' if type is recall)",
  "options": ["A", "B", "C", "D"], // REQUIRED ONLY for mcq
  "correctAnswer": "The correct answer / expected explanation",
  "topic": "The topic",
  "difficulty": "${config.difficulty === 'adaptive' ? 'easy, medium, or hard' : config.difficulty}"
}
`;
}

export function answerEvaluationPrompt(
  question: string,
  correctAnswer: string,
  userAnswer: string,
  questionType?: string
): string {
  return `You are a university professor grading a student's descriptive exam answer. Your goal is to evaluate whether the student genuinely UNDERSTANDS the concept. You are NOT comparing their answer to the reference — you are assessing their knowledge.

## QUESTION
${question}

## QUESTION TYPE
${questionType || 'short_answer'}

## REFERENCE ANSWER (for your context only — this is NOT the gold standard; it is just one possible way to answer)
${correctAnswer}

## STUDENT'S ANSWER
${userAnswer}

## GRADING RUBRIC (10 points total)

1. **Conceptual Understanding (0–4 points)**: Does the student show they understand the core idea? Award full marks if the underlying concept is correct, regardless of wording, terminology, analogies, or examples used.

2. **Technical Accuracy (0–3 points)**: Is the information factually correct? Deduct only for outright errors or misconceptions. Minor imprecisions or simplified explanations are acceptable and should NOT be penalized.

3. **Completeness (0–2 points)**: Did the student address the key aspects? Do NOT deduct marks for omitting minor implementation details unless the question specifically asks about implementation. Only deduct if major core ideas are entirely missing.

4. **Clarity (0–1 point)**: Is the answer understandable? Award this point unless the response is genuinely incoherent.

## GRADE SCALE
- 9–10: "Excellent"
- 7–8: "Very Good"
- 5–6: "Good Understanding"
- 3–4: "Partial Understanding"
- 1–2: "Major Misconceptions"
- 0: "Incorrect"

## CRITICAL RULES
- A student who explains a concept correctly in their own words MUST receive 7–10, even if their phrasing is completely different from the reference.
- DO NOT penalize for: different word choices, different sentence structure, simpler language, different (but valid) examples, different ordering, or omitting minor details the question didn't ask about.
- DO penalize for: factual errors, fundamental misunderstandings, contradicting the core concept, or completely missing the point.
- Score >= 5 means the student understands the concept (mark correct).
- Score < 5 means the student does NOT understand the concept (mark incorrect).
- Always provide at least one strength — even for weak answers (e.g., "Attempted to engage with the topic").
- Provide 1–2 actionable suggestions to help the student improve.
- Your feedback should be supportive and educational, like a professor who wants the student to succeed.

## RESPONSE FORMAT
Return ONLY this JSON (no markdown fences, no extra text):
{
  "score": 8,
  "maxScore": 10,
  "grade": "Very Good",
  "feedback": "Supportive summary of their performance",
  "strengths": ["What the student demonstrated well"],
  "missingPoints": ["Key concepts that were absent, if any"],
  "suggestions": ["How they could improve their answer"],
  "emotion": "happy"
}

The "emotion" field reflects how Dazai (a witty anime tutor) would react:
- 9–10: "proud" or "excited"
- 7–8: "happy"
- 5–6: "neutral" or "concerned"
- 3–4: "disappointed"
- 0–2: "annoyed"`;
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
