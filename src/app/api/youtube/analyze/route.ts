import { NextRequest, NextResponse } from 'next/server';

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
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        videoId = match[2];
      }
    }

    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Fetch the YouTube page HTML
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch YouTube page');
    }

    const html = await response.text();

    // Extract title using og:title
    let title = '';
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/);
    if (titleMatch) {
      title = titleMatch[1];
    } else {
      const titleTagMatch = html.match(/<title>([^<]+)<\/title>/);
      title = titleTagMatch ? titleTagMatch[1].replace(' - YouTube', '') : `YouTube Video (${videoId})`;
    }

    // Extract description using og:description
    let description = '';
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)">/);
    if (descMatch) {
      description = descMatch[1];
    } else {
      const descTagMatch = html.match(/<meta name="description" content="([^"]+)">/);
      description = descTagMatch ? descTagMatch[1] : '';
    }

    // Decode HTML entities
    const decodeHtml = (str: string) => {
      return str
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&apos;/g, "'");
    };

    title = decodeHtml(title);
    description = decodeHtml(description);

    // If description is empty or too short, fall back
    if (!description) {
      description = `A study video titled "${title}".`;
    }

    return NextResponse.json({
      videoId,
      title,
      description,
      summary: `This is an educational study video titled "${title}". Description: ${description}`,
    });
  } catch (error: any) {
    console.error('YouTube analysis error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
