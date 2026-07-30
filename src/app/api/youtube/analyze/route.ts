import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const runtime = 'nodejs';

// Reuse singleton from search route pattern
let _yt: Innertube | null = null;
async function getYT(): Promise<Innertube> {
  if (!_yt) {
    _yt = await Innertube.create({ lang: 'en', location: 'US' });
  }
  return _yt;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Extract video ID
    let videoId = '';
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname.includes('youtube.com')) {
        videoId = parsedUrl.searchParams.get('v') || '';
      } else if (parsedUrl.hostname.includes('youtu.be')) {
        videoId = parsedUrl.pathname.slice(1);
      }
    } catch (e) {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        videoId = match[2];
      }
    }

    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    const yt = await getYT();
    const info = await yt.getInfo(videoId);
    const basic = info.basic_info;

    const title = basic.title || `YouTube Video (${videoId})`;
    let description = basic.short_description || '';

    // If description is empty or too short, fall back
    if (!description) {
      description = `A study video titled "${title}".`;
    }

    // Check caption availability
    let hasCaptions = false;
    let transcriptText = '';
    try {
      const transcript = await info.getTranscript();
      const segments = transcript?.transcript?.content?.body?.initial_segments;
      if (segments && Array.isArray(segments) && segments.length > 0) {
        hasCaptions = true;
        transcriptText = segments
          .map((seg: any) => seg?.snippet?.text || '')
          .filter(Boolean)
          .join(' ');
      }
    } catch {
      // No captions available
    }

    return NextResponse.json({
      videoId,
      title,
      description,
      summary: `This is an educational study video titled "${title}". Description: ${description}`,
      hasCaptions,
      transcriptText: transcriptText || undefined,
    });
  } catch (error: any) {
    console.error('YouTube analysis error:', error);
    _yt = null; // Reset singleton on error
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
