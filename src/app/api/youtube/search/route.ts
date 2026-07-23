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

    const results = await ytSearch(query);
    let items: any[] = [];

    if (type === 'video') {
      items = results.videos.slice(0, 15);
    } else if (type === 'list') {
      items = results.lists.slice(0, 15);
    } else {
      // Mixed: 10 videos, 5 playlists
      items = [
        ...results.videos.slice(0, 10),
        ...results.lists.slice(0, 5)
      ];
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
