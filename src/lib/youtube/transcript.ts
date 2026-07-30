import { Innertube } from 'youtubei.js';
import { YoutubeTranscript } from 'youtube-transcript';

export interface TranscriptResult {
  text: string;
  hasCaptions: boolean;
  errorCategory?: 'NO_TRANSCRIPT_EXISTS' | 'EXTRACTION_FAILED' | 'NETWORK_ERROR' | 'PARSING_ERROR';
  errorMessage?: string;
  errorStack?: string;
  availableTracks?: Array<{ languageCode: string; name: string }>;
}

let _yt: Innertube | null = null;
async function getYT(): Promise<Innertube> {
  if (!_yt) {
    _yt = await Innertube.create({ lang: 'en', location: 'US' });
  }
  return _yt;
}

/** Direct timedtext fetch from caption track base_url */
async function fetchCaptionTrackDirect(baseUrl: string): Promise<string> {
  const url = baseUrl.includes('fmt=') ? baseUrl : `${baseUrl}&fmt=json3`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.youtube.com/',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`Direct timedtext fetch HTTP ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const text = json.events
    ?.map((e: any) => e.segs?.map((s: any) => s.utf8).join('') || '')
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    throw new Error('Direct timedtext JSON returned 0 text segments.');
  }

  return text;
}

export async function fetchRobustYoutubeTranscript(videoId: string): Promise<TranscriptResult> {
  console.log(`\n[YT TRANSCRIPT VERCEL DIAGNOSTIC] ========================================`);
  console.log(`[YT TRANSCRIPT VERCEL DIAGNOSTIC] Video ID: ${videoId}`);
  console.log(`[YT TRANSCRIPT VERCEL DIAGNOSTIC] Node Env: ${process.env.NODE_ENV} | Vercel Env: ${process.env.VERCEL_ENV || 'local'}`);
  console.log(`[YT TRANSCRIPT VERCEL DIAGNOSTIC] ========================================`);

  let info: any = null;
  let getInfoSuccess = false;
  let metadataError: any = null;

  // 1. Verify whether getInfo() succeeds
  try {
    const yt = await getYT();
    info = await yt.getInfo(videoId);
    getInfoSuccess = true;
    console.log(`[YT TRANSCRIPT] Task 2 (getInfo): SUCCESS - Loaded title: "${info.basic_info?.title}"`);
  } catch (err: any) {
    metadataError = err;
    console.error(`[YT TRANSCRIPT] Task 2 (getInfo): FAILED - Error:`, err?.stack || err?.message || err);
    _yt = null; // Reset singleton on error
  }

  // 2. Check and log whether caption tracks are detected BEFORE calling getTranscript()
  const captionTracks = info?.captions?.caption_tracks || [];
  const availableTracks = captionTracks.map((t: any) => ({
    languageCode: (t.language_code || 'unknown').toString(),
    name: (t.name?.text || t.name || t.language_code || 'Unknown').toString(),
    baseUrl: t.base_url || '',
  }));

  console.log(`[YT TRANSCRIPT] Task 3 (Caption Tracks Detected): ${captionTracks.length > 0 ? 'YES' : 'NO'} (Count: ${captionTracks.length})`);
  if (availableTracks.length > 0) {
    console.log(
      `[YT TRANSCRIPT] Task 4 (Tracks Metadata):`,
      availableTracks.map((t: any) => `${t.languageCode} (${t.name})`).join(', ')
    );
  }

  // 3. TIER 1: youtubei.js info.getTranscript() + log exact full stack trace
  let tier1ErrorStack = '';
  if (info) {
    try {
      console.log(`[YT TRANSCRIPT] Tier 1: Calling youtubei.js info.getTranscript()...`);
      const transcript = await info.getTranscript();
      const segments = transcript?.transcript?.content?.body?.initial_segments;

      if (segments && Array.isArray(segments) && segments.length > 0) {
        const text = segments
          .map((seg: any) => seg?.snippet?.text || '')
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length > 0) {
          console.log(`[YT TRANSCRIPT: SUCCESS] Tier 1 succeeded! Extracted ${text.length} chars (${segments.length} segments).`);
          return { text, hasCaptions: true, availableTracks };
        }
      }
      console.log(`[YT TRANSCRIPT] Tier 1 returned empty segments.`);
    } catch (getTranscriptErr: any) {
      tier1ErrorStack = getTranscriptErr?.stack || String(getTranscriptErr);
      console.error(`[YT TRANSCRIPT: Task 1 (getTranscript Error Stack)] FULL STACK TRACE:`);
      console.error(tier1ErrorStack);
      if (getTranscriptErr?.info) {
        console.error(`[YT TRANSCRIPT] getTranscript Error Payload Info:`, typeof getTranscriptErr.info === 'string' ? getTranscriptErr.info.slice(0, 500) : getTranscriptErr.info);
      }
    }
  }

  // 4. TIER 2: Direct Timedtext Fetch from detected captionTracks (Solves Vercel 400 get_transcript issue)
  if (captionTracks.length > 0) {
    console.log(`[YT TRANSCRIPT] Tier 2: Caption tracks exist (${captionTracks.length}). Attempting direct timedtext fetch from base_url...`);

    const tracksToTry = [
      ...captionTracks.filter((t: any) => t.language_code === 'en' || t.language_code?.startsWith('en')),
      ...captionTracks.filter((t: any) => t.language_code !== 'en' && !t.language_code?.startsWith('en')),
    ];

    for (const track of tracksToTry) {
      if (track.base_url) {
        try {
          console.log(`[YT TRANSCRIPT] Tier 2: Direct fetching base_url for lang '${track.language_code}'...`);
          const text = await fetchCaptionTrackDirect(track.base_url);
          if (text && text.length > 0) {
            console.log(`[YT TRANSCRIPT: SUCCESS] Tier 2 succeeded for lang '${track.language_code}'! Extracted ${text.length} chars.`);
            return { text, hasCaptions: true, availableTracks };
          }
        } catch (directErr: any) {
          console.warn(`[YT TRANSCRIPT: TIER 2 WARN] Direct fetch failed for lang '${track.language_code}':`, directErr?.message || directErr);
        }
      }
    }
  }

  // 5. TIER 3: YoutubeTranscript Library Fallback
  if (captionTracks.length > 0) {
    console.log(`[YT TRANSCRIPT] Tier 3: Attempting YoutubeTranscript library fallback...`);
    const preferredTrack = availableTracks[0]?.languageCode || 'en';
    try {
      const tList = await YoutubeTranscript.fetchTranscript(videoId, { lang: preferredTrack });
      if (tList && Array.isArray(tList) && tList.length > 0) {
        const text = tList
          .map((t: any) => t.text || '')
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length > 0) {
          console.log(`[YT TRANSCRIPT: SUCCESS] Tier 3 succeeded for lang '${preferredTrack}'! Extracted ${text.length} chars.`);
          return { text, hasCaptions: true, availableTracks };
        }
      }
    } catch (tier3Err: any) {
      console.warn(`[YT TRANSCRIPT: TIER 3 WARN] YoutubeTranscript fallback failed:`, tier3Err?.message || tier3Err);
    }
  }

  // 6. Return Actual Detailed Error during Debugging
  if (availableTracks.length === 0 && getInfoSuccess) {
    console.log(`[YT TRANSCRIPT: RESULT] NO_TRANSCRIPT_EXISTS: Video ${videoId} has no caption tracks.`);
    return {
      text: 'Transcript unavailable.',
      hasCaptions: false,
      errorCategory: 'NO_TRANSCRIPT_EXISTS',
      errorMessage: 'Video has no available caption tracks on YouTube.',
      errorStack: tier1ErrorStack,
      availableTracks: [],
    };
  }

  if (!getInfoSuccess && metadataError) {
    console.error(`[YT TRANSCRIPT: RESULT] NETWORK_ERROR: getInfo() failed on Vercel.`);
    return {
      text: 'Transcript unavailable.',
      hasCaptions: false,
      errorCategory: 'NETWORK_ERROR',
      errorMessage: `youtubei.js getInfo() failed on Vercel: ${metadataError?.message || String(metadataError)}`,
      errorStack: metadataError?.stack || String(metadataError),
      availableTracks: [],
    };
  }

  const detailedMsg = `Caption tracks detected (${availableTracks.map((t: any) => t.languageCode).join(', ')}), but getTranscript() failed (Error: ${tier1ErrorStack.split('\n')[0] || 'Unknown'}) and fallback fetches failed.`;
  console.error(`[YT TRANSCRIPT: RESULT] EXTRACTION_FAILED: ${detailedMsg}`);

  return {
    text: 'Transcript unavailable.',
    hasCaptions: false,
    errorCategory: 'EXTRACTION_FAILED',
    errorMessage: detailedMsg,
    errorStack: tier1ErrorStack,
    availableTracks,
  };
}
