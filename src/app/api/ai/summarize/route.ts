import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/ai/openai-client';
import { cleanAIResponseText } from '@/lib/utils/clean-response';

export const runtime = 'nodejs';

export const SUMMARIZE_SYSTEM_PROMPT = `You are a precise educational assistant creating concise, high-value revision notes for a student.

STRUCTURE & LENGTH GUIDELINES:
1. Keep your total response between 80–150 words.
2. Generate concise revision notes containing only the main idea, key concepts, important facts, and essential steps.
3. Use short paragraphs and bullet points (•) for scannability.
4. Optimize for a small modal window: minimal scrolling and no walls of text.
5. DO NOT roleplay. Do NOT speak as any character. Do NOT add conversational filler or jokes.
6. NEVER state "no further details were provided". Use the provided context and background knowledge to create complete revision notes.

IMPORTANT FORMATTING RULES:
- Return ONLY plain text.
- DO NOT use Markdown formatting (no **, ##, #, or _).
- DO NOT use HTML, JSON, or code blocks.
- Use literal bullets (•) for lists and clean spacing between sections so the content is easy to read.`;

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
