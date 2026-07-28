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

    // 1. Fetch Related Videos Workaround (MULTI-SOURCE AGGREGATOR)
    if (relatedToVideoId) {
      // First, get the details of the requested video
      const vidUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${relatedToVideoId}&key=${apiKey}`;
      const vidRes = await fetch(vidUrl, { headers: { 'Referer': referer } });
      const vidData = await vidRes.json();
      
      let searchQueries: string[] = [];
      let originalTitle = '';
      let originalChannel = '';

      if (vidData.items && vidData.items.length > 0) {
        const snippet = vidData.items[0].snippet;
        const categoryId = snippet.categoryId;
        originalTitle = snippet.title.toLowerCase();
        originalChannel = snippet.channelTitle.toLowerCase();
        
        const tags = snippet.tags || [];
        const cleanTags = tags.filter((t: string) => t.toLowerCase() !== originalTitle && t.length < 20);

        if (categoryId === '10') {
          // MUSIC: 3 distinct queries for massive diversity
          searchQueries.push(`"${snippet.channelTitle}" music`); // Query 1: Exact artist
          searchQueries.push(`"${cleanTags[0] || 'pop'}" OR "${cleanTags[1] || 'song'}" music`); // Query 2: Genre
          searchQueries.push(`trending ${cleanTags[0] || 'music'} song`); // Query 3: Trending
        } else if (categoryId === '27' || categoryId === '28') {
          // EDUCATION/SCIENCE: 3 distinct topic queries
          const coreTopic = cleanTags[0] || snippet.title.split('-')[0].split('|')[0].trim();
          searchQueries.push(`"${snippet.channelTitle}" ${coreTopic}`); // Query 1: Creator + Topic
          searchQueries.push(`${coreTopic} tutorial OR course`); // Query 2: Broad Topic
          searchQueries.push(`${cleanTags[1] || coreTopic} explained`); // Query 3: Related Concept
        } else {
          // DEFAULT
          const coreTopic = cleanTags[0] || snippet.title.split(' ')[0];
          searchQueries.push(`"${snippet.channelTitle}"`);
          searchQueries.push(`${coreTopic} video`);
          searchQueries.push(`trending ${coreTopic}`);
        }
      }

      if (searchQueries.length === 0) {
        searchQueries.push('study motivation');
      }

      // Execute all searches concurrently (limit 15 per query to manage quota, yields up to 45 candidates)
      const fetchPromises = searchQueries.map(q => {
        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(q)}&type=video&key=${apiKey}`;
        if (pageToken) url += `&pageToken=${pageToken}`;
        return fetch(url, { headers: { 'Referer': referer } }).then(res => res.json()).catch(() => ({ items: [] }));
      });

      const rawResults = await Promise.all(fetchPromises);
      
      let mergedItems: any[] = [];
      rawResults.forEach(data => {
        if (data.items) {
           mergedItems = [...mergedItems, ...data.items];
           // Only grab token from the first query to paginate linearly
           if (!nextPageToken) nextPageToken = data.nextPageToken;
        }
      });

      // Filter merged pool
      if (mergedItems.length > 0) {
        // Shuffle the merged items slightly so we don't just process artist 1 completely then artist 2
        for (let i = mergedItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mergedItems[i], mergedItems[j]] = [mergedItems[j], mergedItems[i]];
        }

        const seenIds = new Set();
        items = mergedItems.filter((item: any) => {
          if (!item.id || !item.id.videoId) return false;
          if (seenIds.has(item.id.videoId)) return false;
          
          const itemTitle = item.snippet.title.toLowerCase();
          const channelTitle = item.snippet.channelTitle.toLowerCase();
          
          // Block shorts by keyword
          if (itemTitle.includes('shorts') || itemTitle.includes('#shorts') || channelTitle.includes('shorts')) return false;

          // Block highly similar original videos
          if (originalTitle && itemTitle.includes(originalTitle)) return false;
          if (originalTitle && originalTitle.includes(itemTitle)) return false;
          
          seenIds.add(item.id.videoId);
          return true;
        }).map((item: any) => ({
          type: 'video',
          videoId: item.id.videoId,
          title: item.snippet.title,
          url: `https://youtube.com/watch?v=${item.id.videoId}`,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
          author: { name: item.snippet.channelTitle },
        }));
        
        // Take at most 40 to avoid massive payload
        items = items.slice(0, 40);
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
      let ytApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(query)}&type=${type === 'all' ? 'video,playlist' : type}&key=${apiKey}`;
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

    // Parse duration helper
    const getDurationSeconds = (isoStr?: string) => {
      if (!isoStr) return 0;
      const match = isoStr.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
      if (!match) return 0;
      const h = match[1] ? parseInt(match[1]) : 0;
      const m = match[2] ? parseInt(match[2]) : 0;
      const s = match[3] ? parseInt(match[3]) : 0;
      return (h * 3600) + (m * 60) + s;
    };

    let enhancedItems = items.map(item => {
      if (item.type === 'video' && item.videoId && metadata[item.videoId]) {
        return {
          ...item,
          duration: metadata[item.videoId].duration,
          viewCount: metadata[item.videoId].viewCount,
          durationSeconds: getDurationSeconds(metadata[item.videoId].duration)
        };
      }
      return { ...item, durationSeconds: 999 }; // Assume playlists/unknown are long enough
    });

    // Final filter: If it's a related search (Up Next) or general, absolutely drop any video shorter than 60s to kill Shorts
    enhancedItems = enhancedItems.filter(item => {
      if (item.type === 'video' && item.durationSeconds < 60) {
        return false;
      }
      return true;
    });

    return NextResponse.json({ items: enhancedItems, nextPageToken });
  } catch (error: any) {
    console.error('YouTube search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform YouTube search.' },
      { status: 500 }
    );
  }
}
