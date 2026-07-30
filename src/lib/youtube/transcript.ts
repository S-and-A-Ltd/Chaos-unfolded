import { Innertube } from 'youtubei.js';
import { YoutubeTranscript } from 'youtube-transcript';

export interface TranscriptResult {
  text: string;
  hasCaptions: boolean;
  errorCategory?: 'NO_TRANSCRIPT_EXISTS' | 'EXTRACTION_FAILED' | 'NETWORK_ERROR' | 'PARSING_ERROR';
  errorMessage?: string;
  availableTracks?: Array<{ languageCode: string; name: string }>;
}

let _yt: Innertube | null = null;
async function getYT(): Promise<Innertube> {
  if (!_yt) {
    _yt = await Innertube.create({ lang: 'en', location: 'US' });
  }
  return _yt;
}

export async function fetchRobustYoutubeTranscript(videoId: string): Promise<TranscriptResult> {
  console.log(`\n[YT TRANSCRIPT] ========================================`);
  console.log(`[YT TRANSCRIPT] Starting transcript extraction for videoId: ${videoId}`);
  console.log(`[YT TRANSCRIPT] ========================================`);

  let info: any = null;
  let metadataError: any = null;

  try {
    const yt = await getYT();
    info = await yt.getInfo(videoId);
    console.log(`[YT TRANSCRIPT] Video Metadata Loaded: "${info.basic_info?.title}"`);
  } catch (err: any) {
    metadataError = err;
    console.error(`[YT TRANSCRIPT: NETWORK_ERROR] Failed to fetch video info from youtubei.js:`, err?.message || err);
    _yt = null; // Reset singleton on error
  }

  // Extract caption tracks reported in video metadata
  const captionTracks = info?.captions?.caption_tracks || [];
  const availableTracks = captionTracks.map((t: any) => ({
    languageCode: (t.language_code || 'unknown').toString(),
    name: (t.name?.text || t.name || t.language_code || 'Unknown').toString(),
  }));

  console.log(`[YT TRANSCRIPT] Available Caption Tracks Count: ${captionTracks.length}`);
  if (availableTracks.length > 0) {
    console.log(
      `[YT TRANSCRIPT] Available Tracks:`,
      availableTracks.map((t: any) => `${t.languageCode} (${t.name})`).join(', ')
    );
  } else {
    console.log(`[YT TRANSCRIPT] No caption tracks found in youtubei.js metadata.`);
  }

  // ─── TIER 1: youtubei.js info.getTranscript() ───
  if (info) {
    try {
      console.log(`[YT TRANSCRIPT] Tier 1: Attempting info.getTranscript()...`);
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
      console.log(`[YT TRANSCRIPT] Tier 1 returned empty segments array.`);
    } catch (getTranscriptErr: any) {
      console.error(`[YT TRANSCRIPT: TIER 1 FAIL] info.getTranscript() threw error:`);
      console.error(`  - Name: ${getTranscriptErr?.name || 'Error'}`);
      console.error(`  - Message: ${getTranscriptErr?.message || getTranscriptErr}`);
      if (getTranscriptErr?.info) {
        console.error(`  - Error Info:`, typeof getTranscriptErr.info === 'string' ? getTranscriptErr.info.slice(0, 300) : getTranscriptErr.info);
      }
    }
  }

  // ─── TIER 2: Direct extraction from reported caption tracks ───
  if (captionTracks.length > 0) {
    console.log(`[YT TRANSCRIPT] Tier 2: Caption tracks exist (${captionTracks.length}). Attempting targeted track extraction...`);

    // Try English tracks first, then any other available track
    const tracksToTry = [
      ...captionTracks.filter((t: any) => t.language_code === 'en' || t.language_code?.startsWith('en')),
      ...captionTracks.filter((t: any) => t.language_code !== 'en' && !t.language_code?.startsWith('en')),
    ];

    for (const track of tracksToTry) {
      const lang = track.language_code;
      try {
        console.log(`[YT TRANSCRIPT] Tier 2: Trying language '${lang}' (${track.name?.text || track.name})...`);
        const tList = await YoutubeTranscript.fetchTranscript(videoId, { lang });

        if (tList && Array.isArray(tList) && tList.length > 0) {
          const text = tList
            .map((t: any) => t.text || '')
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (text.length > 0) {
            console.log(`[YT TRANSCRIPT: SUCCESS] Tier 2 succeeded for lang '${lang}'! Extracted ${text.length} chars (${tList.length} segments).`);
            return { text, hasCaptions: true, availableTracks };
          }
        }
      } catch (trackErr: any) {
        console.warn(`[YT TRANSCRIPT: TIER 2 WARN] Extraction failed for lang '${lang}':`, trackErr?.message || trackErr);
      }
    }
  }

  // ─── TIER 3: Default YoutubeTranscript fallback (without language parameter) ───
  try {
    console.log(`[YT TRANSCRIPT] Tier 3: Attempting default YoutubeTranscript fallback...`);
    const tList = await YoutubeTranscript.fetchTranscript(videoId);

    if (tList && Array.isArray(tList) && tList.length > 0) {
      const text = tList
        .map((t: any) => t.text || '')
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length > 0) {
        console.log(`[YT TRANSCRIPT: SUCCESS] Tier 3 succeeded! Extracted ${text.length} chars (${tList.length} segments).`);
        return { text, hasCaptions: true, availableTracks };
      }
    }
  } catch (tier3Err: any) {
    console.error(`[YT TRANSCRIPT: TIER 3 FAIL] Default YoutubeTranscript fallback failed:`, tier3Err?.message || tier3Err);
  }

  // ─── FINAL DIAGNOSTIC & DETERMINATION ───
  if (availableTracks.length === 0 && !metadataError) {
    console.log(`[YT TRANSCRIPT: DETERMINATION] Confirmed NO_TRANSCRIPT_EXISTS: Video ${videoId} has no caption tracks available on YouTube.`);
    return {
      text: 'Transcript unavailable.',
      hasCaptions: false,
      errorCategory: 'NO_TRANSCRIPT_EXISTS',
      errorMessage: 'Video has no available caption tracks on YouTube.',
      availableTracks: [],
    };
  }

  if (metadataError && availableTracks.length === 0) {
    console.error(`[YT TRANSCRIPT: DETERMINATION] NETWORK_ERROR: Failed to reach YouTube metadata for ${videoId}.`);
    return {
      text: 'Transcript unavailable.',
      hasCaptions: false,
      errorCategory: 'NETWORK_ERROR',
      errorMessage: `Network or YouTube API error while fetching video metadata: ${metadataError?.message || metadataError}`,
      availableTracks: [],
    };
  }

  console.error(
    `[YT TRANSCRIPT: DETERMINATION] EXTRACTION_FAILED: Caption tracks exist (${availableTracks
      .map((t: any) => t.languageCode)
      .join(', ')}), but all 3 extraction tiers failed.`
  );
  return {
    text: 'Transcript unavailable.',
    hasCaptions: false,
    errorCategory: 'EXTRACTION_FAILED',
    errorMessage: `Caption tracks existed (${availableTracks
      .map((t: any) => t.languageCode)
      .join(', ')}), but transcript extraction failed across all tiers.`,
    availableTracks,
  };
}
