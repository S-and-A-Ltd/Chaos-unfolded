import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function fetchVideoMetadata(videoIds: string[], apiKey: string, referer: string) {
  if (!videoIds.length) return {};
  
  const idsStr = videoIds.join(',');
  const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${idsStr}&key=${apiKey}`;
  
  try {
    const res = await fetch(url, { headers: { 'Referer': referer } });
    const data = await res.json();
    
    const metadata: Record<string, { duration?: string, viewCount?: string }> = {};
    if (data.items) {
      data.items.forEach((item: any) => {
        metadata[item.id] = {
          duration: item.contentDetails?.duration,
          viewCount: item.statistics?.viewCount
        };
      });
    }
    return metadata;
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'all'; 
    const listId = searchParams.get('listId'); 
    const relatedToVideoId = searchParams.get('relatedToVideoId');
    const pageToken = searchParams.get('pageToken');

    const apiKey = process.env.YOUTUBE_API_KEY || 'AIzaSyC7Gni4wrOkDM-0lW1dQRFFA1AwtsKB2kw';
    const referer = req.headers.get('referer') || 'https://dazai-study-companion.vercel.app/';

    if (!apiKey) {
      return NextResponse.json({ error: 'YouTube API key is missing. Please add YOUTUBE_API_KEY to your Vercel Environment Variables.' }, { status: 500 });
    }

    let items: any[] = [];
    let nextPageToken: string | undefined;

    // 1. Fetch Related Videos Workaround
    if (relatedToVideoId) {
      // First, get the details of the requested video
      const vidUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${relatedToVideoId}&key=${apiKey}`;
      const vidRes = await fetch(vidUrl, { headers: { 'Referer': referer } });
      const vidData = await vidRes.json();
      
      let searchQuery = '';
      if (vidData.items && vidData.items.length > 0) {
        const snippet = vidData.items[0].snippet;
        const tags = snippet.tags ? snippet.tags.slice(0, 3).join('|') : '';
        searchQuery = `${snippet.channelTitle} ${tags} ${snippet.title}`.trim();
      }

      // If we couldn't build a query, fallback to generic
      if (!searchQuery) {
        searchQuery = 'study motivation';
      }

      // Search using that constructed query
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(searchQuery)}&type=video&key=${apiKey}`;
      const apiRes = await fetch(searchUrl, { headers: { 'Referer': referer } });
      const apiData = await apiRes.json();

      if (apiData.items) {
        items = apiData.items.map((item: any) => ({
          type: 'video',
          videoId: item.id.videoId,
          title: item.snippet.title,
          url: `https://youtube.com/watch?v=${item.id.videoId}`,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
          author: { name: item.snippet.channelTitle },
        }));
      }
    }

    // 2. Fetch Playlist
    else if (listId) {
      const playlistApiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${listId}&key=${apiKey}`;
      const plRes = await fetch(playlistApiUrl, { headers: { 'Referer': referer } });
      const plData = await plRes.json();
      
      if (plData.items) {
        items = plData.items.map((item: any) => ({
          type: 'video',
          videoId: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          url: `https://youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
          author: { name: item.snippet.channelTitle },
        }));
      }
    }

    // 3. Regular Search
    else if (query) {
      let ytApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query)}&type=${type === 'all' ? 'video,playlist' : type}&key=${apiKey}`;
      if (pageToken) ytApiUrl += `&pageToken=${pageToken}`;
      
      const apiRes = await fetch(ytApiUrl, { headers: { 'Referer': referer } });
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
      nextPageToken = apiData.nextPageToken;
    }
    
    else {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Enhance all video items with duration and view counts
    const videoIdsToEnhance = items.filter(i => i.type === 'video' && i.videoId).map(i => i.videoId);
    
    // Batch fetch metadata in chunks of 50 (API limit)
    const metadata: Record<string, any> = {};
    for (let i = 0; i < videoIdsToEnhance.length; i += 50) {
      const chunk = videoIdsToEnhance.slice(i, i + 50);
      const chunkMetadata = await fetchVideoMetadata(chunk, apiKey, referer);
      Object.assign(metadata, chunkMetadata);
    }

    items = items.map(item => {
      if (item.type === 'video' && item.videoId && metadata[item.videoId]) {
        return {
          ...item,
          duration: metadata[item.videoId].duration,
          viewCount: metadata[item.videoId].viewCount
        };
      }
      return item;
    });

    return NextResponse.json({ items, nextPageToken });
  } catch (error: any) {
    console.error('YouTube search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform YouTube search.' },
      { status: 500 }
    );
  }
}
