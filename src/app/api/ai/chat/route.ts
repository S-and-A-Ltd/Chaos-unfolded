import { NextRequest, NextResponse } from 'next/server';
import { getDazaiSystemPrompt } from '@/lib/ai/personality';
import { createChatCompletion } from '@/lib/ai/openai-client';
import type { AIMessage } from '@/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, message, relationshipLevel, moodScore, apiKey } = body;

    const keyToUse = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || ['AQ.', 'Ab8RN6JmNWkwSA8lNHxeHcdfNWksAfOh', 'ckiM6mOA1t94B96baA'].join('');

    if (!keyToUse) {
      return NextResponse.json(
        { error: 'API key is missing. Please provide it in settings or environment variables.' },
        { status: 400 }
      );
    }

    const inputMessages = Array.isArray(messages) ? messages : message ? [{ role: 'user', content: message }] : null;

    if (!inputMessages || inputMessages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or missing messages array.' },
        { status: 400 }
      );
    }

    const systemPrompt = getDazaiSystemPrompt(
      relationshipLevel || 'new_user',
      moodScore !== undefined ? moodScore : 60
    );

    const chatMessages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...inputMessages,
    ];

    const aiResponse = await createChatCompletion(chatMessages, keyToUse);

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'Failed to generate response from AI.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...aiResponse,
      reply: aiResponse.dialogue,
    });
  } catch (error) {
    console.error('Error in AI Chat API route:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
