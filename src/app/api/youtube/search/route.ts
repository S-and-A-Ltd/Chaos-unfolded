import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'all'; // 'video', 'list', 'all'
    const listId = searchParams.get('listId'); // For fetching videos in a playlist

    // The user requested to hardcode the API key directly in the code for convenience on Vercel
    const apiKey = process.env.YOUTUBE_API_KEY || 'AIzaSyC7Gni4wrOkDM-0lW1dQRFFA1AwtsKB2kw';

    if (!apiKey) {
      return NextResponse.json({ error: 'YouTube API key is missing. Please add YOUTUBE_API_KEY to your Vercel Environment Variables.' }, { status: 500 });
    }

    // If listId is provided, we fetch playlist videos
    if (listId) {
      const playlistApiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${listId}&key=${apiKey}`;
      const referer = req.headers.get('referer') || 'https://dazai-study-companion.vercel.app/';
      const plRes = await fetch(playlistApiUrl, { headers: { 'Referer': referer } });
      const plData = await plRes.json();
      
      if (!plData.items) {
        return NextResponse.json({ items: [] });
      }

      return NextResponse.json({
        title: 'Playlist Details',
        items: plData.items.map((item: any) => ({
          type: 'video',
          videoId: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          url: `https://youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
          author: { name: item.snippet.channelTitle },
        })),
      });
    }

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    let items: any[] = [];

    // Use official YouTube Data API (avoids Vercel IP blocks and serverless crashes)
    const ytApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query)}&type=${type === 'all' ? 'video,playlist' : type}&key=${apiKey}`;
    const referer = req.headers.get('referer') || 'https://dazai-study-companion.vercel.app/';
    
    const apiRes = await fetch(ytApiUrl, {
      headers: {
        'Referer': referer
      }
    });
    const apiData = await apiRes.json();
    
    if (apiData.items) {
      items = apiData.items.map((item: any) => ({
        type: item.id.kind === 'youtube#playlist' ? 'list' : 'video',
        videoId: item.id.videoId,
        listId: item.id.playlistId,
        title: item.snippet.title,
        url: item.id.videoId ? `https://youtube.com/watch?v=${item.id.videoId}` : `https://youtube.com/playlist?list=${item.id.playlistId}`,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
        author: { name: item.snippet.channelTitle },
      }));
    }

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('YouTube search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform YouTube search.' },
      { status: 500 }
    );
  }
}
