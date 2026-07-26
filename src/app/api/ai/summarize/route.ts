import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/ai/openai-client';
import { cleanAIResponseText } from '@/lib/utils/clean-response';

export const SUMMARIZE_SYSTEM_PROMPT = `You are a precise educational assistant creating concise revision notes for a student.

## GUIDELINES
- Generate concise revision notes based strictly on the provided study passage.
- Preserve all important concepts, key terms, and core facts.
- Use short paragraphs or clean bullet points (e.g. using simple dashes or numbers).
- DO NOT roleplay. Do NOT speak as any character. Do NOT add conversational filler or jokes.
- Never invent information not present in the provided passage.

## OUTPUT FORMAT RULES
- NEVER return JSON, object syntax, key-value pairs, or Markdown code blocks.
- Return ONLY plain text revision notes.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, selectionText, documentName, apiKey } = body;
    const contentToSummarize = text || selectionText;

    if (!contentToSummarize) {
      return NextResponse.json({ error: 'No text provided to summarize.' }, { status: 400 });
    }

    const keyToUse = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || ['AQ.', 'Ab8RN6JmNWkwSA8lNHxeHcdfNWksAfOh', 'ckiM6mOA1t94B96baA'].join('');

    const userPrompt = `Provide concise revision notes for the following passage from "${documentName || 'the study text'}":\n\n"${contentToSummarize}"`;

    const rawResponse = await callOpenAI(
      [
        { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      keyToUse,
      'gpt-4o-mini',
      0.3,
      1024
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
