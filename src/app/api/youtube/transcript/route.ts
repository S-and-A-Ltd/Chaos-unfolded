import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const runtime = 'nodejs';

let _yt: Innertube | null = null;
async function getYT(): Promise<Innertube> {
  if (!_yt) {
    _yt = await Innertube.create({ lang: 'en', location: 'US' });
  }
  return _yt;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    const yt = await getYT();
    const info = await yt.getInfo(videoId);

    let transcriptText = '';
    let hasCaptions = false;

    try {
      const transcript = await info.getTranscript();
      const segments = transcript?.transcript?.content?.body?.initial_segments;

      if (segments && Array.isArray(segments) && segments.length > 0) {
        hasCaptions = true;
        transcriptText = segments
          .map((seg: any) => seg?.snippet?.text || '')
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    } catch {
      // No captions available for this video
    }

    return NextResponse.json({
      videoId,
      hasCaptions,
      transcriptText: hasCaptions ? transcriptText : 'Transcript unavailable.',
    });
  } catch (error: any) {
    console.error('[YT Transcript] Error:', error);
    _yt = null;
    return NextResponse.json(
      { error: 'Failed to fetch transcript.' },
      { status: 500 }
    );
  }
}
