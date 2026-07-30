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

export async function fetchRobustYoutubeTranscript(videoId: string): Promise<TranscriptResult> {
  console.log(`\n[YT TRANSCRIPT DIAGNOSTIC] ========================================`);
  console.log(`[YT TRANSCRIPT DIAGNOSTIC] Video ID: ${videoId}`);
  console.log(`[YT TRANSCRIPT DIAGNOSTIC] Environment: ${process.env.NODE_ENV} | Vercel: ${process.env.VERCEL_ENV || 'local'}`);
  console.log(`[YT TRANSCRIPT DIAGNOSTIC] ========================================`);

  let info: any = null;
  let getInfoSuccess = false;
  let metadataError: any = null;

  // 1. Verify getInfo() success
  try {
    const yt = await getYT();
    info = await yt.getInfo(videoId);
    getInfoSuccess = true;
    console.log(`[YT TRANSCRIPT] getInfo(): SUCCESS - Title: "${info.basic_info?.title}"`);
  } catch (err: any) {
    metadataError = err;
    console.error(`[YT TRANSCRIPT] getInfo(): FAILED - Error:`, err?.stack || err?.message || err);
    _yt = null; // Reset singleton on error
  }

  // 2. Log detected caption tracks
  const captionTracks = info?.captions?.caption_tracks || [];
  const availableTracks = captionTracks.map((t: any) => ({
    languageCode: (t.language_code || 'unknown').toString(),
    name: (t.name?.text || t.name || t.language_code || 'Unknown').toString(),
  }));

  console.log(`[YT TRANSCRIPT] Caption tracks detected in metadata: ${captionTracks.length > 0 ? 'YES' : 'NO'} (Count: ${captionTracks.length})`);
  if (availableTracks.length > 0) {
    console.log(
      `[YT TRANSCRIPT] Track list:`,
      availableTracks.map((t: any) => `${t.languageCode} (${t.name})`).join(', ')
    );
  }

  let tier1ErrorStack = '';

  // 3. TIER 1: youtubei.js info.getTranscript()
  if (info) {
    try {
      console.log(`[YT TRANSCRIPT] Tier 1: Attempting youtubei.js info.getTranscript()...`);
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
      tier1ErrorStack = getTranscriptErr?.stack || String(getTranscriptErr);
      console.error(`[YT TRANSCRIPT: TIER 1 FAIL] info.getTranscript() FULL STACK TRACE:`);
      console.error(tier1ErrorStack);
      if (getTranscriptErr?.info) {
        console.error(`[YT TRANSCRIPT] InnerTube error info payload:`, typeof getTranscriptErr.info === 'string' ? getTranscriptErr.info.slice(0, 500) : getTranscriptErr.info);
      }
    }
  }

  // 4. TIER 2: YoutubeTranscript (InnerTube Android client context extraction)
  try {
    console.log(`[YT TRANSCRIPT] Tier 2: Attempting YoutubeTranscript InnerTube Android extraction...`);
    const tList = await YoutubeTranscript.fetchTranscript(videoId);

    if (tList && Array.isArray(tList) && tList.length > 0) {
      const text = tList
        .map((t: any) => t.text || '')
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length > 0) {
        console.log(`[YT TRANSCRIPT: SUCCESS] Tier 2 succeeded! Extracted ${text.length} chars (${tList.length} segments).`);
        return { text, hasCaptions: true, availableTracks };
      }
    }
  } catch (tier2Err: any) {
    console.warn(`[YT TRANSCRIPT: TIER 2 WARN] YoutubeTranscript fallback error:`, tier2Err?.stack || tier2Err?.message || tier2Err);
  }

  // 5. TIER 3: Specific language track extraction using detected caption tracks
  if (availableTracks.length > 0) {
    console.log(`[YT TRANSCRIPT] Tier 3: Attempting language-specific track extractions...`);
    for (const tr of availableTracks) {
      try {
        console.log(`[YT TRANSCRIPT] Tier 3: Trying language '${tr.languageCode}'...`);
        const tList = await YoutubeTranscript.fetchTranscript(videoId, { lang: tr.languageCode });
        if (tList && Array.isArray(tList) && tList.length > 0) {
          const text = tList
            .map((t: any) => t.text || '')
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (text.length > 0) {
            console.log(`[YT TRANSCRIPT: SUCCESS] Tier 3 succeeded for '${tr.languageCode}'! Extracted ${text.length} chars.`);
            return { text, hasCaptions: true, availableTracks };
          }
        }
      } catch (tier3Err: any) {
        console.warn(`[YT TRANSCRIPT: TIER 3 WARN] Tier 3 failed for lang '${tr.languageCode}':`, tier3Err?.message || tier3Err);
      }
    }
  }

  // 6. Final Diagnostic & Error Determination
  if (availableTracks.length === 0 && getInfoSuccess) {
    console.log(`[YT TRANSCRIPT: DETERMINATION] Confirmed NO_TRANSCRIPT_EXISTS for video ${videoId}.`);
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
    console.error(`[YT TRANSCRIPT: DETERMINATION] NETWORK_ERROR for video ${videoId}.`);
    return {
      text: 'Transcript unavailable.',
      hasCaptions: false,
      errorCategory: 'NETWORK_ERROR',
      errorMessage: `youtubei.js getInfo() failed: ${metadataError?.message || String(metadataError)}`,
      errorStack: metadataError?.stack || String(metadataError),
      availableTracks: [],
    };
  }

  const detailedMsg = `Caption tracks detected (${availableTracks.map((t: any) => t.languageCode).join(', ')}), but transcript extraction failed across all 3 tiers.`;
  console.error(`[YT TRANSCRIPT: DETERMINATION] EXTRACTION_FAILED: ${detailedMsg}`);

  return {
    text: 'Transcript unavailable.',
    hasCaptions: false,
    errorCategory: 'EXTRACTION_FAILED',
    errorMessage: detailedMsg,
    errorStack: tier1ErrorStack,
    availableTracks,
  };
}
