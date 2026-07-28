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

// Build a regex that matches lyric/remix/live/speed variants of the original song title
function buildTitleVariantPattern(originalTitle: string): RegExp | null {
  if (!originalTitle || originalTitle.length < 5) return null;

  // Strip common suffixes to get the core song name
  const coreName = originalTitle
    .replace(/\(.*?\)/g, '')       // Remove parenthetical like (Official Video)
    .replace(/\[.*?\]/g, '')       // Remove bracketed like [Official Audio]
    .replace(/official\s*(video|audio|music\s*video|mv|visualizer)?/gi, '')
    .replace(/\b(lyrics?|lyric\s*video|remix|live|acoustic|speed\s*up|slowed|reverb|nightcore|cover|instrumental|karaoke|clean|explicit|remaster(ed)?|4k|hd|hq)\b/gi, '')
    .replace(/[-–|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (coreName.length < 4) return null;

  // Escape for regex
  const escaped = coreName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return new RegExp(escaped, 'i');
  } catch {
    return null;
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

    // 1. Recommendation Pipeline (YouTube Mix style)
    if (relatedToVideoId) {
      // STEP 1: Extract metadata for the currently playing video
      const vidUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,topicDetails&id=${relatedToVideoId}&key=${apiKey}`;
      const vidRes = await fetch(vidUrl, { headers: { 'Referer': referer } });
      const vidData = await vidRes.json();

      let originalTitle = '';
      let originalChannel = '';
      let searchQueries: string[] = [];

      if (vidData.items && vidData.items.length > 0) {
        const snippet = vidData.items[0].snippet;
        const topicDetails = vidData.items[0].topicDetails;
        const categoryId = snippet.categoryId;
        originalTitle = snippet.title.toLowerCase();
        originalChannel = snippet.channelTitle.toLowerCase();

        const tags = snippet.tags || [];

        // Extract genre keywords from topicDetails (Wikipedia categories like "Pop music", "Electronic music")
        const topicGenres: string[] = [];
        if (topicDetails?.topicCategories) {
          topicDetails.topicCategories.forEach((url: string) => {
            const match = url.match(/wikipedia\.org\/wiki\/(.+)/);
            if (match) {
              const genre = decodeURIComponent(match[1]).replace(/_/g, ' ');
              if (genre.toLowerCase() !== 'music' && genre.toLowerCase() !== 'entertainment') {
                topicGenres.push(genre);
              }
            }
          });
        }

        // Extract pure genre/mood tags — EXCLUDE the artist name and song title
        const artistLower = snippet.channelTitle.toLowerCase();
        const titleWords = originalTitle.split(/[\s\-–|()\[\]]+/).filter((w: string) => w.length > 2);

        const genreTags = tags.filter((t: string) => {
          const tLower = t.toLowerCase();
          // Exclude if tag IS the artist name or closely matches it
          if (tLower === artistLower) return false;
          if (artistLower.includes(tLower) || tLower.includes(artistLower)) return false;
          // Exclude if tag IS any significant word from the title
          if (titleWords.some((w: string) => tLower === w.toLowerCase())) return false;
          // Exclude very short or very long tags
          if (t.length < 3 || t.length > 25) return false;
          return true;
        });

        if (categoryId === '10') {
          // ─── MUSIC ───
          // Build queries from pure genre/mood signals. NEVER include artist name.
          const g1 = topicGenres[0] || genreTags[0] || 'pop';
          const g2 = topicGenres[1] || genreTags[1] || 'hits';
          const g3 = genreTags[2] || 'viral';

          searchQueries = [
            `${g1} music official`,                    // Genre search 1
            `${g2} songs`,                             // Genre search 2
            `top ${g1} hits`,                          // Popular in genre
            `trending ${g3} music ${new Date().getFullYear()}`, // Trending
            `${g1} ${g2} mix`,                         // Mix / radio style
          ];
        } else if (categoryId === '27' || categoryId === '28') {
          // ─── EDUCATION / SCIENCE ───
          // Extract the core subject from tags and title, NEVER the channel name
          const subject = genreTags[0] || tags[0] || snippet.title.split(/[\-|:]/)[0].trim();
          const subtopics = genreTags.slice(1, 5);

          searchQueries = [
            `${subject} tutorial`,
            `${subject} course`,
            `${subtopics[0] || subject} explained`,
            `${subtopics[1] || subject} for beginners`,
            `learn ${subject}`,
          ];
        } else {
          // ─── DEFAULT ───
          const topic = genreTags[0] || tags[0] || snippet.title.split(' ').slice(0, 3).join(' ');
          searchQueries = [
            `${topic}`,
            `${topic} explained`,
            `trending ${topic}`,
          ];
        }
      }

      if (searchQueries.length === 0) {
        searchQueries = ['trending music', 'popular songs', 'music mix'];
      }

      // STEP 2: Fire all queries concurrently (20 results each → up to 100 candidates)
      const fetchPromises = searchQueries.map(q => {
        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(q)}&type=video&key=${apiKey}`;
        if (pageToken) url += `&pageToken=${pageToken}`;
        return fetch(url, { headers: { 'Referer': referer } }).then(r => r.json()).catch(() => ({ items: [] }));
      });

      const allResults = await Promise.all(fetchPromises);

      // Merge all responses
      let pool: any[] = [];
      allResults.forEach(data => {
        if (data.items) pool = [...pool, ...data.items];
        if (!nextPageToken && data.nextPageToken) nextPageToken = data.nextPageToken;
      });

      // STEP 3: Deduplicate by videoId, remove Shorts keywords, remove title variants
      const seenIds = new Set<string>();
      const titleVariantPattern = buildTitleVariantPattern(originalTitle);

      let candidates = pool.filter((item: any) => {
        if (!item.id?.videoId) return false;
        if (seenIds.has(item.id.videoId)) return false;
        if (item.id.videoId === relatedToVideoId) return false;

        const t = item.snippet.title.toLowerCase();
        const ch = item.snippet.channelTitle.toLowerCase();

        // Block shorts
        if (t.includes('#shorts') || t.includes('shorts') || ch.includes('shorts')) return false;

        // Block lyric/remix/live/speed up variants of the SAME song
        if (titleVariantPattern && titleVariantPattern.test(t)) return false;

        seenIds.add(item.id.videoId);
        return true;
      });

      // STEP 4: Diversity scoring — max 1 video per channel in first pass
      const channelCounts: Record<string, number> = {};
      const diverse: any[] = [];
      const overflow: any[] = [];

      for (const item of candidates) {
        const ch = item.snippet.channelTitle.toLowerCase();
        channelCounts[ch] = (channelCounts[ch] || 0) + 1;

        if (channelCounts[ch] <= 1) {
          diverse.push(item);
        } else {
          overflow.push(item);
        }
      }

      // Fill gaps from overflow if diverse pool is too small (allow max 2 per channel)
      if (diverse.length < 20) {
        const channelCounts2: Record<string, number> = {};
        diverse.forEach(item => {
          const ch = item.snippet.channelTitle.toLowerCase();
          channelCounts2[ch] = (channelCounts2[ch] || 0) + 1;
        });
        for (const item of overflow) {
          if (diverse.length >= 40) break;
          const ch = item.snippet.channelTitle.toLowerCase();
          channelCounts2[ch] = (channelCounts2[ch] || 0);
          if (channelCounts2[ch] < 2) {
            channelCounts2[ch]++;
            diverse.push(item);
          }
        }
      }

      // STEP 5: Map to our format
      items = diverse.map((item: any) => ({
        type: 'video',
        videoId: item.id.videoId,
        title: item.snippet.title,
        url: `https://youtube.com/watch?v=${item.id.videoId}`,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
        author: { name: item.snippet.channelTitle },
      }));
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
