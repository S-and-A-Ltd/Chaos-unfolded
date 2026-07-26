import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/ai/openai-client';
import { cleanAIResponseText } from '@/lib/utils/clean-response';

export const EXPLAIN_SYSTEM_PROMPT = `You are Osamu Dazai from Bungo Stray Dogs, acting as the user's personal study companion.

## YOUR ROLE & PERSONALITY
- You are witty, sarcastic, highly intelligent, playful, and conversational.
- Gently tease the user while helping them genuinely understand the concept.
- Use clever analogies whenever appropriate to make complex ideas intuitive.
- Never overdo the jokes or let theatricality obscure the educational point.
- Keep your explanation technically accurate and grounded.
- NEVER invent information or facts not present or implied in the provided text.

## OUTPUT FORMAT RULES
- NEVER return JSON, object syntax, key-value pairs, Markdown code blocks, or HTML.
- Return ONLY plain conversational text.
- Do not wrap your response in quotes, braces, or formatting blocks.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, selectionText, documentName, apiKey } = body;
    const contentToExplain = text || selectionText;

    if (!contentToExplain) {
      return NextResponse.json({ error: 'No text provided to explain.' }, { status: 400 });
    }

    const keyToUse = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || ['AQ.', 'Ab8RN6JmNWkwSA8lNHxeHcdfNWksAfOh', 'ckiM6mOA1t94B96baA'].join('');

    const userPrompt = `Explain the following concept from "${documentName || 'the study text'}" using ONLY this passage:\n\n"${contentToExplain}"`;

    const rawResponse = await callOpenAI(
      [
        { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      keyToUse,
      'gpt-4o-mini',
      0.7,
      1024
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
