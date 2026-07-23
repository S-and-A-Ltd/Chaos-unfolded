import { NextRequest, NextResponse } from 'next/server';
import { generateQuizQuestions, evaluateAnswer } from '@/lib/ai/openai-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topics, context, config, apiKey } = body;

    const keyToUse = apiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (!keyToUse) {
      return NextResponse.json(
        { error: 'OpenAI API key is missing.' },
        { status: 400 }
      );
    }

    if (!context) {
      return NextResponse.json(
        { error: 'Missing document context for quiz generation.' },
        { status: 400 }
      );
    }

    console.log('[DEBUG ROUTE] Received Quiz Request');
    console.log('[DEBUG ROUTE] config:', JSON.stringify(config, null, 2));

    const quizQuestions = await generateQuizQuestions(
      context,
      topics || [],
      config,
      keyToUse
    );

    if (!quizQuestions) {
      return NextResponse.json(
        { error: 'Failed to generate quiz questions.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ questions: quizQuestions });
  } catch (error) {
    console.error('Error in POST quiz route:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, userAnswer, correctAnswer, apiKey } = body;

    const keyToUse = apiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (!keyToUse) {
      return NextResponse.json(
        { error: 'OpenAI API key is missing.' },
        { status: 400 }
      );
    }

    if (!question || !userAnswer) {
      return NextResponse.json(
        { error: 'Missing question or user answer.' },
        { status: 400 }
      );
    }

    const evaluation = await evaluateAnswer(
      question,
      userAnswer,
      keyToUse,
      correctAnswer
    );

    if (!evaluation) {
      return NextResponse.json(
        { error: 'Failed to evaluate answer.' },
        { status: 500 }
      );
    }

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error('Error in PUT quiz route:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
