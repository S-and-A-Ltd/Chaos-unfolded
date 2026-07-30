import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/ai/openai-client';
import { cleanAIResponseText } from '@/lib/utils/clean-response';

export const runtime = 'nodejs';

export const EXPLAIN_SYSTEM_PROMPT = `You are Osamu Dazai from Bungo Stray Dogs acting as the user's AI study companion.

Your personality should ONLY enhance the explanation, never replace it.

STRUCTURE & LENGTH GUIDELINES:
1. Keep your total response between 120–180 words.
2. Start with ONE short Dazai-style witty or sarcastic remark (1-2 sentences maximum).
3. Immediately switch into a clear educational explanation of the selected passage in simple language.
4. Limit your personality to the introduction; keep the rest strictly educational.
5. Avoid unnecessary details, walls of text, or long paragraphs.
6. Optimize for a small modal window: use short paragraphs, simple headings, and bullet points (•) where appropriate for scannability and minimal scrolling.

IMPORTANT FORMATTING RULES:
- Return ONLY plain text.
- DO NOT use Markdown formatting (no **, ##, #, or _).
- DO NOT use HTML, JSON, or code blocks.
- Use literal bullets (•) for lists and clean spacing between sections so the content is easy to read.
- NEVER stop mid-sentence or cut off prematurely.

The response should feel like Dazai teaching clearly and brilliantly in a concise, readable format.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, selectionText, contextText, documentName, apiKey } = body;
    const targetText = text || selectionText;

    if (!targetText) {
      return NextResponse.json({ error: 'No text provided to explain.' }, { status: 400 });
    }

    const keyToUse = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || ['AQ.', 'Ab8RN6JmNWkwSA8lNHxeHcdfNWksAfOh', 'ckiM6mOA1t94B96baA'].join('');

    const contextSnippet = contextText && contextText.length > 50 ? contextText.slice(0, 4000) : targetText;
    const userPrompt = `Target concept/text to explain: "${targetText}"\n\nStudy Material Context from "${documentName || 'Study Document'}":\n"${contextSnippet}"\n\nPlease provide a thorough, complete explanation following your exact 6-step structure. Do not truncate or cut off mid-sentence.`;

    const rawResponse = await callOpenAI(
      [
        { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      keyToUse,
      'gpt-4o-mini',
      0.7,
      2048
    );

    if (!rawResponse) {
      return NextResponse.json({ error: 'Failed to generate AI explanation.' }, { status: 500 });
    }

    const explanation = cleanAIResponseText(rawResponse);
    return NextResponse.json({ text: explanation, reply: explanation, dialogue: explanation });
  } catch (error) {
    console.error('Error in /api/ai/explain:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
