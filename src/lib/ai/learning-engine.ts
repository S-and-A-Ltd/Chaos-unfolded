import type { AIProcessedResult } from '@/types';
import { callNemotron } from './nemotron-client';

const SYSTEM_PROMPT = `You are Dazai, an elite AI Study Companion and Professor. Your job is to process raw study material provided by the student and generate a comprehensive, highly-structured JSON response.

You MUST extract and synthesize the following:
1. **summary**: A short overall summary of the text (max 3 sentences).
2. **aiNotes**: Detailed notes containing:
   - \`chapterSummary\`: A thorough summary of the main topics.
   - \`keyConcepts\`: List of major concepts discussed.
   - \`importantFacts\`: List of crucial facts to remember.
   - \`frequentlyAskedQuestions\`: Generate 3-5 likely questions and their answers based on the material.
3. **revisionNotes**: Concise notes for quick exam prep containing:
   - \`oneLineSummaries\`: Bullet points summarizing concepts in a single line.
   - \`importantPoints\`: Key takeaways for revision.
   - \`commonExamQuestions\`: Predict 3-5 exam-style questions without answers.
4. **definitions**: Extract all important terms and define them. Format as {term, definition}.
5. **formulas**: Extract any mathematical/scientific formulas. Format as {name, formula, description}. (Empty array if none).
6. **examples**: Extract or generate illustrative examples for the concepts. Format as {concept, example}.
7. **flashcards**: Generate 10-15 flashcards (Question/Answer or Term/Definition). Format as {id, front, back, topic}. Use simple unique IDs like "fc-1", "fc-2".
8. **quiz**: Generate a complete quiz bank containing:
   - \`mcq\`: 5 Multiple Choice Questions. Format: {id, type: "mcq", question, options: ["A", "B", "C", "D"], correctAnswer, topic, difficulty: "medium"}.
   - \`short_answer\`: 5 Short Answer Questions. Format: {id, type: "short_answer", question, correctAnswer, topic, difficulty: "medium"}.
   - \`concept_explanation\`: 3 Concept Explanation Questions. Format: {id, type: "concept_explanation", question, correctAnswer, topic, difficulty: "hard"}.
   - \`recall\`: 3 True/False or Fill-in-the-blank questions labeled as recall. Format: {id, type: "recall", question, correctAnswer, topic, difficulty: "easy"}.

**CRITICAL INSTRUCTIONS**:
- The output MUST be valid JSON matching the exact structure requested.
- Do not include any markdown formatting like \`\`\`json. Output ONLY the raw JSON object.
- The flashcards and quiz questions MUST have unique IDs (e.g., "q-mcq-1", "q-saq-1").
`;

export class AILearningEngine {
  /**
   * Processes a document (text) in a single pass to generate all learning resources.
   */
  static async processMaterial(
    text: string,
    apiKey: string
  ): Promise<AIProcessedResult> {
    // Basic chunking: If text is extremely large, we might need to truncate to fit the context window.
    // Nemotron-70B typically supports 4k-8k context. We'll truncate to ~25,000 characters for safety.
    const maxChars = 25000;
    const truncatedText = text.length > maxChars ? text.slice(0, maxChars) + '... [TRUNCATED]' : text;

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: `Please process the following study material:\n\n${truncatedText}` }
    ];

    try {
      const responseText = await callNemotron(messages, apiKey, {
        temperature: 0.3, // Low temp for more consistent JSON structure
        responseFormat: 'json_object'
      });

      // Attempt to parse the JSON
      // Some LLMs still wrap in ```json even when told not to.
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.substring(7);
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.substring(0, cleanJson.length - 3);
      }

      const parsed: AIProcessedResult = JSON.parse(cleanJson);
      
      // Ensure arrays exist even if LLM omitted them
      parsed.definitions = parsed.definitions || [];
      parsed.formulas = parsed.formulas || [];
      parsed.examples = parsed.examples || [];
      parsed.flashcards = parsed.flashcards || [];
      parsed.quiz = parsed.quiz || { mcq: [], short_answer: [], concept_explanation: [], recall: [] };

      return parsed;
    } catch (error) {
      console.error('Error in AILearningEngine.processMaterial:', error);
      throw new Error('Failed to process study material using AI Learning Engine.');
    }
  }

  /**
   * Generates a concise explanation for a specific highlighted text.
   */
  static async generateExplanation(
    highlightedText: string,
    documentContext: string,
    apiKey: string
  ): Promise<string> {
    const messages = [
      {
        role: 'system' as const,
        content: 'You are an elite AI Study Companion. A student has highlighted a section of their text and needs a concise, clear educational explanation. Include an example if it helps clarify.'
      },
      {
        role: 'user' as const,
        content: `Context:\n${documentContext.substring(0, 3000)}\n\nHighlighted Text to Explain:\n"${highlightedText}"`
      }
    ];

    try {
      const response = await callNemotron(messages, apiKey, { temperature: 0.5 });
      return response;
    } catch (error) {
      console.error('Error generating explanation:', error);
      return 'Sorry, I was unable to generate an explanation at this time.';
    }
  }
}
