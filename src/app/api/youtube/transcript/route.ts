import { NextRequest, NextResponse } from 'next/server';
import { fetchRobustYoutubeTranscript } from '@/lib/youtube/transcript';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'videoId parameter is required.' }, { status: 400 });
    }

    const result = await fetchRobustYoutubeTranscript(videoId);

    if (!result.hasCaptions) {
      console.warn(
        `[API /api/youtube/transcript] Transcript unavailable for videoId=${videoId}. Category: ${result.errorCategory}. Reason: ${result.errorMessage}`
      );
      return NextResponse.json({
        videoId,
        hasCaptions: false,
        transcriptText: 'Transcript unavailable.',
        errorCategory: result.errorCategory,
        errorMessage: result.errorMessage,
        errorStack: result.errorStack,
        availableTracks: result.availableTracks || [],
      });
    }

    return NextResponse.json({
      videoId,
      hasCaptions: true,
      transcriptText: result.text,
      availableTracks: result.availableTracks || [],
    });
  } catch (error: any) {
    console.error('[API /api/youtube/transcript] Unexpected route error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error while fetching transcript.',
        errorMessage: error?.message || String(error),
        errorStack: error?.stack || String(error),
      },
      { status: 500 }
    );
  }
}
