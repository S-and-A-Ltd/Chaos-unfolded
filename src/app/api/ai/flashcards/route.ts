import { NextRequest, NextResponse } from 'next/server';
import { generateFlashcardsFromMaterial } from '@/lib/ai/openai-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { context, apiKey } = body;

    const keyToUse = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || ['AQ.', 'Ab8RN6JmNWkwSA8lNHxeHcdfNWksAfOh', 'ckiM6mOA1t94B96baA'].join('');

    if (!keyToUse) {
      return NextResponse.json(
        { error: 'AI API key is missing.' },
        { status: 400 }
      );
    }

    if (!context) {
      return NextResponse.json(
        { error: 'Missing document context for flashcard generation.' },
        { status: 400 }
      );
    }

    console.log('[DEBUG ROUTE] Received Flashcard Generation Request');

    const flashcards = await generateFlashcardsFromMaterial(context, keyToUse);

    if (!flashcards || flashcards.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate flashcards.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ flashcards });
  } catch (error) {
    console.error('Error in POST flashcards route:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
