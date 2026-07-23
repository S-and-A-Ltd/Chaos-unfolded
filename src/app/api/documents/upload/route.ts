import { NextRequest, NextResponse } from 'next/server';
import { parseDocument } from '@/lib/rag/document-parser';
import { AILearningEngine } from '@/lib/ai/learning-engine';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string | null;
    const apiKey = req.headers.get('x-api-key') || '';

    if (!file && !url) {
      return NextResponse.json(
        { error: 'No file or URL provided in the request.' },
        { status: 400 }
      );
    }

    let parsedText = '';

    if (url) {
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(url);
        parsedText = transcript.map(t => t.text).join(' ');
      } catch (ytError: any) {
        console.error('YouTube transcript parsing failed:', ytError);
        return NextResponse.json(
          { error: 'Failed to extract captions from this YouTube video. The video might not have captions enabled or is restricted.' },
          { status: 400 }
        );
      }
    } else if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        const parsed = await parseDocument(buffer, file.name);
        parsedText = parsed.text;
      } catch (parseError: any) {
        console.error('Document parsing failed:', parseError);
        return NextResponse.json(
          { error: parseError.message || 'Failed to parse the uploaded file.' },
          { status: 500 }
        );
      }
    }

    const keyToUse = apiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (keyToUse && keyToUse.trim() !== '') {
      try {
        const aiData = await AILearningEngine.processMaterial(parsedText, keyToUse);
        return NextResponse.json({
          text: parsedText,
          aiData,
        });
      } catch (analysisError) {
        console.error('Study material analysis failed:', analysisError);
        // Fallback: return parsed text even if analysis fails
        return NextResponse.json({
          text: parsedText,
          error: 'AI analysis failed, but text was successfully extracted.',
        });
      }
    }

    // No API key provided, just return extracted text
    return NextResponse.json({
      text: parsedText,
      error: 'API Key not configured. AI Analysis skipped.',
    });
  } catch (error) {
    console.error('Error in document upload route:', error);
    return NextResponse.json(
      { error: 'Internal server error during document upload.' },
      { status: 500 }
    );
  }
}
