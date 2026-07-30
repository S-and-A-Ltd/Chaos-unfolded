import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const runtime = 'nodejs';

// ─── Singleton Innertube instance ───
let _yt: Innertube | null = null;
async function getYT(): Promise<Innertube> {
  if (!_yt) {
    _yt = await Innertube.create({ lang: 'en', location: 'US' });
  }
  return _yt;
}

// ─── Helpers ───

/** Parse "3:33" or "1:02:45" into total seconds */
function parseDurationText(text?: string): number {
  if (!text) return 0;
  const parts = text.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

/** Convert seconds to ISO 8601 duration (PT1H2M3S) for frontend compat */
function toISO8601(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  let iso = 'PT';
  if (h > 0) iso += `${h}H`;
  if (m > 0) iso += `${m}M`;
  if (s > 0 || iso === 'PT') iso += `${s}S`;
  return iso;
}

/** Parse short_view_count "1.2M views" or view_count number into a raw number string */
function parseViewCount(video: any): string {
  // Try numeric view_count first (from getInfo)
  if (video.view_count != null) return String(video.view_count);
  // Try short_view_count_text from search results
  const short = video.short_view_count?.text || video.short_view_count_text?.text || '';
  if (!short) return '';
  // Convert "1.2M" → "1200000", "45K" → "45000", "123" → "123"
  const cleaned = short.replace(/\s*views?/i, '').trim();
  const match = cleaned.match(/^([\d.]+)\s*([KMBkmb])?$/);
  if (!match) return cleaned.replace(/[^\d]/g, '');
  const num = parseFloat(match[1]);
  const suffix = (match[2] || '').toUpperCase();
  if (suffix === 'K') return String(Math.round(num * 1000));
  if (suffix === 'M') return String(Math.round(num * 1000000));
  if (suffix === 'B') return String(Math.round(num * 1000000000));
  return String(Math.round(num));
}

/** Get best thumbnail URL from a video object */
function getThumbnail(video: any): string {
  const thumbs = video.thumbnails || video.thumbnail || [];
  if (Array.isArray(thumbs) && thumbs.length > 0) {
    // Pick the highest resolution
    const sorted = [...thumbs].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
    return sorted[0]?.url || '';
  }
  return '';
}

/** Build a regex that matches lyric/remix/live/speed variants of the original song title */
function buildTitleVariantPattern(originalTitle: string): RegExp | null {
  if (!originalTitle || originalTitle.length < 5) return null;
  const coreName = originalTitle
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/official\s*(video|audio|music\s*video|mv|visualizer)?/gi, '')
    .replace(/\b(lyrics?|lyric\s*video|remix|live|acoustic|speed\s*up|slowed|reverb|nightcore|cover|instrumental|karaoke|clean|explicit|remaster(ed)?|4k|hd|hq)\b/gi, '')
    .replace(/[-–|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (coreName.length < 4) return null;
  const escaped = coreName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try { return new RegExp(escaped, 'i'); } catch { return null; }
}

// ─── Main route ───

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'all';
    const listId = searchParams.get('listId');
    const relatedToVideoId = searchParams.get('relatedToVideoId');

    const yt = await getYT();

    let items: any[] = [];
    let nextPageToken: string | undefined;
    let _debug: any = null;

    // ────────────────────────────────────────────────────────
    // 1. Recommendation Pipeline
    // ────────────────────────────────────────────────────────
    if (relatedToVideoId) {
      let originalTitle = '';
      let originalChannel = '';
      let originalCategory = '';
      let originalTags: string[] = [];
      let searchQueries: string[] = [];

      try {
        const info = await yt.getInfo(relatedToVideoId);
        const basic = info.basic_info;
        originalTitle = basic.title || '';
        originalChannel = basic.channel?.name || basic.author || '';
        originalCategory = basic.category || '';
        originalTags = basic.tags || [];

        const tags = originalTags;
        const isMusicCategory = originalCategory.toLowerCase().includes('music');

        // Genre extraction from tags
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
          if (GENRE_VOCABULARY.has(tLower)) genreFromTags.push(tLower);
        }

        if (isMusicCategory) {
          const g1 = genreFromTags[0] || 'pop';
          const g2 = genreFromTags[1] || (g1 === 'pop' ? 'hits' : 'pop');
          const g3 = genreFromTags[2] || 'trending';
          const g4 = genreFromTags.find(g => !g.includes(g1.toLowerCase())) || 'viral';
          searchQueries = [
            `${g1} music official video`,
            `top ${g2} songs`,
            `best ${g1} ${g2} playlist`,
            `${g3} music ${new Date().getFullYear()}`,
            `${g4} songs popular`,
          ];
        } else if (originalCategory.toLowerCase().includes('education') || originalCategory.toLowerCase().includes('science')) {
          const artistLower = originalChannel.toLowerCase();
          const safeSubject = tags.find((t: string) => {
            const tl = t.toLowerCase();
            return tl !== artistLower && !artistLower.includes(tl) && !tl.includes(artistLower) && t.length > 2 && t.length < 25;
          }) || originalTitle.split(/[-|:]/)[0].trim();
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
          const artistLower = originalChannel.toLowerCase();
          const topic = tags.find((t: string) => {
            const tl = t.toLowerCase();
            return tl !== artistLower && !artistLower.includes(tl) && !tl.includes(artistLower) && t.length > 2;
          }) || originalTitle.split(' ').slice(0, 3).join(' ');
          searchQueries = [
            `${topic}`,
            `${topic} explained`,
            `trending ${topic}`,
          ];
        }
      } catch (e) {
        console.warn('[YT] Failed to get video info for recommendations:', e);
      }

      if (searchQueries.length === 0) {
        searchQueries = ['trending music', 'popular songs', 'music mix'];
      }

      // Fire all queries concurrently
      const fetchPromises = searchQueries.map(async (q) => {
        try {
          const results = await yt.search(q, { type: 'video' });
          return (results.videos || []).slice(0, 20);
        } catch { return []; }
      });

      const allResults = await Promise.all(fetchPromises);
      let pool: any[] = [];
      allResults.forEach(videos => { pool = [...pool, ...videos]; });

      // Deduplicate, remove Shorts, remove title variants
      const seenIds = new Set<string>();
      const titleVariantPattern = buildTitleVariantPattern(originalTitle.toLowerCase());

      let candidates = pool.filter((video: any) => {
        const vid = video.id;
        if (!vid) return false;
        if (seenIds.has(vid)) return false;
        if (vid === relatedToVideoId) return false;

        const t = (video.title?.text || video.title || '').toLowerCase();
        const ch = (video.author?.name || '').toLowerCase();

        if (t.includes('#shorts') || t.includes('shorts') || ch.includes('shorts')) return false;
        if (titleVariantPattern && titleVariantPattern.test(t)) return false;

        seenIds.add(vid);
        return true;
      });

      // Diversity — max 1 from current artist, max 1 per channel
      const currentArtistLower = originalChannel.toLowerCase();
      const channelCounts: Record<string, number> = {};
      const diverse: any[] = [];

      for (const video of candidates) {
        const ch = (video.author?.name || '').toLowerCase();
        channelCounts[ch] = (channelCounts[ch] || 0) + 1;
        if (ch === currentArtistLower) {
          if (channelCounts[ch] <= 1) diverse.push(video);
          continue;
        }
        if (channelCounts[ch] <= 1) diverse.push(video);
      }

      // Map to response format
      items = diverse.map((video: any) => {
        const durationText = video.duration?.text || video.duration?.toString() || '';
        const durationSec = parseDurationText(durationText);
        return {
          type: 'video' as const,
          videoId: video.id,
          title: video.title?.text || video.title || '',
          url: `https://youtube.com/watch?v=${video.id}`,
          thumbnail: getThumbnail(video),
          author: { name: video.author?.name || '' },
          duration: toISO8601(durationSec),
          viewCount: parseViewCount(video),
          durationSeconds: durationSec,
        };
      });

      _debug = {
        currentVideo: {
          title: originalTitle,
          channel: originalChannel,
          category: originalCategory,
          tags: originalTags,
        },
        searchQueries,
        rawResponses: pool.slice(0, 10).map((v: any) => ({
          title: v.title?.text || v.title || '',
          channel: v.author?.name || '',
        })),
      };
    }

    // ────────────────────────────────────────────────────────
    // 2. Fetch Playlist
    // ────────────────────────────────────────────────────────
    else if (listId) {
      try {
        const playlist = await yt.getPlaylist(listId);
        const videos = playlist.videos || [];
        items = videos.map((video: any) => {
          const durationText = video.duration?.text || video.duration?.toString() || '';
          const durationSec = parseDurationText(durationText);
          return {
            type: 'video' as const,
            videoId: video.id,
            title: video.title?.text || video.title || '',
            url: `https://youtube.com/watch?v=${video.id}`,
            thumbnail: getThumbnail(video),
            author: { name: video.author?.name || '' },
            duration: toISO8601(durationSec),
            viewCount: parseViewCount(video),
            durationSeconds: durationSec,
          };
        });
      } catch (e) {
        console.error('[YT] Playlist fetch error:', e);
        items = [];
      }
    }

    // ────────────────────────────────────────────────────────
    // 3. Regular Search
    // ────────────────────────────────────────────────────────
    else if (query) {
      try {
        const searchResults = await yt.search(query, { type: 'video' });
        const videos = searchResults.videos || [];

        items = videos.map((video: any) => {
          const durationText = video.duration?.text || video.duration?.toString() || '';
          const durationSec = parseDurationText(durationText);
          return {
            type: 'video' as const,
            videoId: video.id,
            title: video.title?.text || video.title || '',
            url: `https://youtube.com/watch?v=${video.id}`,
            thumbnail: getThumbnail(video),
            author: { name: video.author?.name || '' },
            duration: toISO8601(durationSec),
            viewCount: parseViewCount(video),
            durationSeconds: durationSec,
          };
        });
      } catch (e) {
        console.error('[YT] Search error:', e);
        throw e;
      }
    }

    else {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // ────────────────────────────────────────────────────────
    // Post-processing: reject Shorts, cap long videos
    // ────────────────────────────────────────────────────────
    const PLAYLIST_TITLE_PATTERNS = /\b(mix|playlist|top\s*\d+|best\s*of|hours?|compilation|nonstop|non-stop|megamix)\b/i;
    let longVideoCount = 0;

    items = items.filter(item => {
      if (item.type !== 'video') return true;

      const dur = item.durationSeconds || 0;
      const title = item.title || '';

      // Reject Shorts (< 60 seconds)
      if (dur > 0 && dur < 60) return false;

      // For recommendations, apply strict content filtering
      if (relatedToVideoId) {
        if (PLAYLIST_TITLE_PATTERNS.test(title)) return false;
        if (dur > 1200) {
          longVideoCount++;
          if (longVideoCount > 2) return false;
        }
      }

      return true;
    });

    const responsePayload: any = { items, nextPageToken };
    if (_debug) responsePayload._debug = _debug;

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('YouTube search error:', error);
    // Reset the singleton on error so it re-creates on next request
    _yt = null;
    return NextResponse.json(
      { error: 'Failed to perform YouTube search.' },
      { status: 500 }
    );
  }
}
