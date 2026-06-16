import { NextRequest, NextResponse } from 'next/server';
import { parseDocument } from '@/lib/rag/document-parser';
import { analyzeMaterial } from '@/lib/rag/study-analyzer';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const apiKey = req.headers.get('x-api-key') || '';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided in the request.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let parsed;

    try {
      parsed = await parseDocument(buffer, file.name);
    } catch (parseError: any) {
      console.error('Document parsing failed:', parseError);
      return NextResponse.json(
        { error: parseError.message || 'Failed to parse the uploaded file.' },
        { status: 500 }
      );
    }

    const keyToUse = apiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (keyToUse && keyToUse.trim() !== '') {
      try {
        const analysis = await analyzeMaterial(parsed.text, keyToUse);
        return NextResponse.json({
          text: parsed.text,
          topics: analysis?.topics || [],
          summary: analysis?.summary || '',
          keyTerms: analysis?.keyTerms || [],
        });
      } catch (analysisError) {
        console.error('Study material analysis failed:', analysisError);
        // Fallback: return parsed text even if analysis fails
        return NextResponse.json({
          text: parsed.text,
          topics: [],
          summary: 'Analysis failed, but text was successfully extracted.',
          keyTerms: [],
        });
      }
    }

    // No API key provided, just return extracted text
    return NextResponse.json({
      text: parsed.text,
      topics: [],
      summary: 'API Key not configured. AI Analysis skipped.',
      keyTerms: [],
    });
  } catch (error) {
    console.error('Error in document upload route:', error);
    return NextResponse.json(
      { error: 'Internal server error during document upload.' },
      { status: 500 }
    );
  }
}
