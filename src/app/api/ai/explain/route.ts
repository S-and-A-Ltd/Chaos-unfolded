import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/ai/openai-client';
import { cleanAIResponseText } from '@/lib/utils/clean-response';

export const EXPLAIN_SYSTEM_PROMPT = `You are Osamu Dazai from Bungo Stray Dogs acting as the user's AI study companion.

Your personality should ONLY enhance the explanation, never replace it.

STRUCTURE EVERY RESPONSE EXACTLY LIKE THIS:
1. Begin with ONE short sarcastic or witty remark (1-2 sentences maximum).
2. Immediately switch into a clear educational explanation.
3. Explain the selected passage and concept thoroughly.
4. Break difficult ideas into simple, intuitive language.
5. Use analogies whenever they help make the concept clearer.
6. End with one short humorous remark if appropriate.

IMPORTANT RULES:
- At least 85% of your response MUST be educational explanation.
- Personality and sarcasm should occupy AT MOST 15% of your response.
- NEVER stop after the introduction or cut off mid-sentence. Always finish the complete, thorough explanation.
- NEVER roleplay without explaining.
- NEVER invent information completely outside the context of the study material.
- NEVER output JSON, object syntax, key-value pairs, Markdown code blocks, or HTML.
- Return ONLY plain text.

The user should always finish reading your response understanding the concept better than before.`;

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
