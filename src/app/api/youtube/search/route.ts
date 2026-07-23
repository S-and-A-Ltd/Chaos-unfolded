import { NextRequest, NextResponse } from 'next/server';
import ytSearch from 'yt-search';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'all'; // 'video', 'list', 'all'
    const listId = searchParams.get('listId'); // For fetching videos in a playlist

    // If listId is provided, we fetch playlist videos
    if (listId) {
      const playlist = await ytSearch({ listId });
      return NextResponse.json({
        title: playlist.title,
        items: playlist.videos.map((v: any) => ({
          type: 'video',
          videoId: v.videoId,
          title: v.title,
          url: `https://youtube.com/watch?v=${v.videoId}`,
          thumbnail: v.thumbnail,
          author: { name: playlist.author?.name || 'Unknown' },
        })),
      });
    }

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    let items: any[] = [];

    // Use official YouTube Data API if available (avoids Vercel IP blocks)
    if (process.env.YOUTUBE_API_KEY) {
      const ytApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query)}&type=${type === 'all' ? 'video,playlist' : type}&key=${process.env.YOUTUBE_API_KEY}`;
      const apiRes = await fetch(ytApiUrl);
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
    } else {
      // Fallback to yt-search (works locally, but often blocked on Vercel)
      const results = await ytSearch(query);
      if (type === 'video') {
        items = results.videos.slice(0, 15);
      } else if (type === 'list') {
        items = results.lists.slice(0, 15);
      } else {
        items = [...results.videos.slice(0, 10), ...results.lists.slice(0, 5)];
      }
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
