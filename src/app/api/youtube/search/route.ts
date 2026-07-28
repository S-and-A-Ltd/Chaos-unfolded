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
    let _debug: any = null;

    // 1. Recommendation Pipeline (YouTube Mix style)
    if (relatedToVideoId) {
      // STEP 1: Extract metadata for the currently playing video
      const vidUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,topicDetails&id=${relatedToVideoId}&key=${apiKey}`;
      const vidRes = await fetch(vidUrl, { headers: { 'Referer': referer } });
      const vidData = await vidRes.json();

      let originalTitle = '';
      let originalChannel = '';
      let originalCategory = '';
      let originalTags: string[] = [];
      let searchQueries: string[] = [];

      if (vidData.items && vidData.items.length > 0) {
        const snippet = vidData.items[0].snippet;
        const topicDetails = vidData.items[0].topicDetails;
        const categoryId = snippet.categoryId;
        originalTitle = snippet.title;
        originalChannel = snippet.channelTitle;
        originalCategory = categoryId;
        originalTags = snippet.tags || [];

        const tags = snippet.tags || [];

        // ─── GENRE EXTRACTION ───
        // Primary source: topicDetails Wikipedia categories (cleanest signal)
        const topicGenres: string[] = [];
        if (topicDetails?.topicCategories) {
          topicDetails.topicCategories.forEach((url: string) => {
            const match = url.match(/wikipedia\.org\/wiki\/(.+)/);
            if (match) {
              const genre = decodeURIComponent(match[1]).replace(/_/g, ' ');
              // Exclude overly generic categories
              if (!['music', 'entertainment', 'song', 'single'].includes(genre.toLowerCase())) {
                topicGenres.push(genre);
              }
            }
          });
        }

        // Secondary source: tags, but ONLY if they match known genre/mood vocabulary
        const GENRE_VOCABULARY = new Set([
          'pop', 'rock', 'hip hop', 'rap', 'r&b', 'rnb', 'country', 'jazz', 'blues',
          'soul', 'funk', 'reggae', 'reggaeton', 'latin', 'k-pop', 'kpop', 'j-pop',
          'electronic', 'edm', 'house', 'techno', 'trance', 'dubstep', 'dnb', 'drum and bass',
          'indie', 'alternative', 'punk', 'metal', 'classical', 'folk', 'acoustic',
          'lo-fi', 'lofi', 'chill', 'ambient', 'trap', 'drill', 'afrobeat', 'afrobeats',
          'dancehall', 'disco', 'grunge', 'emo', 'goth', 'shoegaze', 'synthwave',
          'vaporwave', 'new wave', 'post-punk', 'psychedelic', 'progressive',
          'romantic', 'sad', 'happy', 'upbeat', 'melancholy', 'dark', 'dreamy',
          'energetic', 'mellow', 'aggressive', 'emotional', 'nostalgic', 'summer',
          'love', 'heartbreak', 'party', 'workout', 'study', 'sleep', 'relax',
          'ballad', 'anthem', 'banger', 'viral', 'trending', 'hit', 'top',
          'singer songwriter', 'singer-songwriter', 'vocal', 'a cappella',
          'contemporary', 'modern', 'classic', 'retro', '80s', '90s', '2000s', '2010s', '2020s',
          'hindi', 'bollywood', 'spanish', 'french', 'german', 'portuguese', 'korean', 'japanese',
          'arabic', 'turkish', 'mandarin', 'cantonese', 'tamil', 'telugu', 'punjabi', 'bengali',
        ]);

        const genreFromTags: string[] = [];
        for (const tag of tags) {
          const tLower = tag.toLowerCase().trim();
          if (GENRE_VOCABULARY.has(tLower)) {
            genreFromTags.push(tLower);
          }
        }

        if (categoryId === '10') {
          // ─── MUSIC ───
          // Build queries ONLY from genre/mood. Artist name is NEVER used.
          const allGenres = [...topicGenres, ...genreFromTags];
          
          // Pick distinct genre keywords, with hardcoded fallbacks
          const g1 = allGenres[0] || 'pop';
          const g2 = allGenres[1] || (g1 === 'pop' ? 'hits' : 'pop');
          const g3 = allGenres[2] || 'trending';
          const g4 = genreFromTags.find(g => !g.includes(g1.toLowerCase())) || 'viral';

          searchQueries = [
            `${g1} music official video`,
            `top ${g2} songs`,
            `best ${g1} ${g2} playlist`,
            `${g3} music ${new Date().getFullYear()}`,
            `${g4} songs popular`,
          ];
        } else if (categoryId === '27' || categoryId === '28') {
          // ─── EDUCATION / SCIENCE ───
          // Extract topic from tags and title, NEVER the channel name
          const artistLower = snippet.channelTitle.toLowerCase();
          const safeSubject = tags.find((t: string) => {
            const tl = t.toLowerCase();
            return tl !== artistLower && !artistLower.includes(tl) && !tl.includes(artistLower) && t.length > 2 && t.length < 25;
          }) || snippet.title.split(/[-|:]/)[0].trim();
          
          const otherTopics = tags.filter((t: string) => {
            const tl = t.toLowerCase();
            return tl !== artistLower && !artistLower.includes(tl) && !tl.includes(artistLower) && tl !== safeSubject.toLowerCase() && t.length > 2 && t.length < 25;
          });

          searchQueries = [
            `${safeSubject} tutorial`,
            `${safeSubject} course`,
            `${otherTopics[0] || safeSubject} explained`,
            `${otherTopics[1] || safeSubject} for beginners`,
            `learn ${safeSubject}`,
          ];
        } else {
          // ─── DEFAULT ───
          const artistLower = snippet.channelTitle.toLowerCase();
          const topic = tags.find((t: string) => {
            const tl = t.toLowerCase();
            return tl !== artistLower && !artistLower.includes(tl) && !tl.includes(artistLower) && t.length > 2;
          }) || snippet.title.split(' ').slice(0, 3).join(' ');
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
      const titleVariantPattern = buildTitleVariantPattern(originalTitle.toLowerCase());

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

      // STEP 4: Diversity — max 1 from current artist, max 1 per any other channel
      const currentArtistLower = originalChannel.toLowerCase();
      const channelCounts: Record<string, number> = {};
      const diverse: any[] = [];

      for (const item of candidates) {
        const ch = item.snippet.channelTitle.toLowerCase();
        channelCounts[ch] = (channelCounts[ch] || 0) + 1;

        // Current artist: allow exactly 1
        if (ch === currentArtistLower) {
          if (channelCounts[ch] <= 1) {
            diverse.push(item);
          }
          continue;
        }

        // All other channels: max 1 each
        if (channelCounts[ch] <= 1) {
          diverse.push(item);
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

      // STEP 6: Package Debug Info
      if (!pageToken) {
        _debug = {
          currentVideo: {
            title: originalTitle,
            channel: originalChannel,
            category: originalCategory,
            tags: originalTags,
          },
          searchQueries,
          rawResponses: pool.slice(0, 10).map((i: any) => ({
            title: i.snippet.title,
            channel: i.snippet.channelTitle,
          })),
        };
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
      console.log('[DEBUG] apiData:', JSON.stringify(apiData).substring(0, 300));
      
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

    // Final filter: Reject Shorts, cap long videos, block playlist-style titles
    const PLAYLIST_TITLE_PATTERNS = /\b(mix|playlist|top\s*\d+|best\s*of|hours?|compilation|nonstop|non-stop|megamix)\b/i;
    let longVideoCount = 0;

    enhancedItems = enhancedItems.filter(item => {
      if (item.type !== 'video') return true; // Keep playlists (type=list) as-is for search results

      const dur = item.durationSeconds || 0;
      const title = item.title || '';

      // Reject Shorts (< 60 seconds)
      if (dur > 0 && dur < 60) {
        console.log('[DEBUG] Rejected as short:', title, dur);
        return false;
      }

      // For recommendation results (relatedToVideoId), apply strict content filtering
      if (relatedToVideoId) {
        // Block playlist-style titles
        if (PLAYLIST_TITLE_PATTERNS.test(title)) return false;

        // Cap long videos (>20 min = 1200s) at max 2
        if (dur > 1200) {
          longVideoCount++;
          if (longVideoCount > 2) return false;
        }
      }

      return true;
    });

    const responsePayload: any = { items: enhancedItems, nextPageToken };
    if (_debug) responsePayload._debug = _debug;

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('YouTube search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform YouTube search.' },
      { status: 500 }
    );
  }
}
