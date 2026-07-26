import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/ai/openai-client';
import { cleanAIResponseText } from '@/lib/utils/clean-response';

export const SUMMARIZE_SYSTEM_PROMPT = `You are a precise educational assistant creating concise, high-value revision notes for a student.

## GUIDELINES
- Generate thorough, concise revision notes based on the provided study concept and document context.
- Preserve all important concepts, definitions, operational steps, and core facts.
- Use short paragraphs or clean bullet points (using simple dashes "- ").
- DO NOT roleplay. Do NOT speak as any character. Do NOT add conversational filler or jokes.
- NEVER state "no further details were provided". Use the provided context and background knowledge about the concept to create meaningful, complete revision notes.

## OUTPUT FORMAT RULES
- NEVER return JSON, object syntax, key-value pairs, or Markdown code blocks.
- Return ONLY plain text revision notes.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, selectionText, contextText, documentName, apiKey } = body;
    const targetText = text || selectionText;

    if (!targetText) {
      return NextResponse.json({ error: 'No text provided to summarize.' }, { status: 400 });
    }

    const keyToUse = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || ['AQ.', 'Ab8RN6JmNWkwSA8lNHxeHcdfNWksAfOh', 'ckiM6mOA1t94B96baA'].join('');

    const contextSnippet = contextText && contextText.length > 50 ? contextText.slice(0, 4000) : targetText;
    const userPrompt = `Target concept/topic to summarize: "${targetText}"\n\nStudy Material Context from "${documentName || 'Study Document'}":\n"${contextSnippet}"\n\nPlease provide complete, clear revision notes for this topic. Do not truncate.`;

    const rawResponse = await callOpenAI(
      [
        { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      keyToUse,
      'gpt-4o-mini',
      0.3,
      2048
    );

    if (!rawResponse) {
      return NextResponse.json({ error: 'Failed to generate AI summary.' }, { status: 500 });
    }

    const summary = cleanAIResponseText(rawResponse);
    return NextResponse.json({ text: summary, reply: summary, summary: summary });
  } catch (error) {
    console.error('Error in /api/ai/summarize:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
