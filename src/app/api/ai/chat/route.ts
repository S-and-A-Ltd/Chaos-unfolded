import { NextRequest, NextResponse } from 'next/server';
import { getDazaiSystemPrompt } from '@/lib/ai/personality';
import { createChatCompletion } from '@/lib/ai/openai-client';
import type { AIMessage } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, relationshipLevel, moodScore, apiKey } = body;

    const keyToUse = apiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (!keyToUse) {
      return NextResponse.json(
        { error: 'OpenAI API key is missing. Please provide it in settings or environment variables.' },
        { status: 400 }
      );
    }

    if (!messages || !Array.isArray(messages)) {
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
      ...messages,
    ];

    const aiResponse = await createChatCompletion(chatMessages, keyToUse);

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'Failed to generate response from OpenAI.' },
        { status: 500 }
      );
    }

    return NextResponse.json(aiResponse);
  } catch (error) {
    console.error('Error in AI Chat API route:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
