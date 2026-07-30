'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Button from '@/components/ui/Button';
import { useYoutubeStore, YoutubeVideo } from '@/stores/useYoutubeStore';

/* ------------------------------------------------------------------ */
/*  Global YouTube IFrame API loader                                   */
/* ------------------------------------------------------------------ */
let ytApiReady = false;
let ytApiLoading = false;
const ytApiCallbacks: (() => void)[] = [];

function loadYoutubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (ytApiReady && typeof window !== 'undefined' && (window as any).YT?.Player) {
      resolve();
      return;
    }
    ytApiCallbacks.push(resolve);
    if (ytApiLoading) return;
    ytApiLoading = true;

    (window as any).onYouTubeIframeAPIReady = () => {
      ytApiReady = true;
      ytApiCallbacks.forEach((cb) => cb());
      ytApiCallbacks.length = 0;
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
}

/* ------------------------------------------------------------------ */
/*  Formatters                                                         */
/* ------------------------------------------------------------------ */
function formatDuration(isoStr?: string) {
  if (!isoStr) return '';
  const match = isoStr.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return '';
  const h = match[1] ? parseInt(match[1]) : 0;
  const m = match[2] ? parseInt(match[2]) : 0;
  const s = match[3] ? parseInt(match[3]) : 0;
  
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViewCount(views?: string) {
  if (!views) return '';
  const num = parseInt(views);
  if (isNaN(num)) return '';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M views';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K views';
  return num.toString() + ' views';
}

/* ------------------------------------------------------------------ */
/*  Skeleton card for loading state                                    */
/* ------------------------------------------------------------------ */
function SkeletonCard() {
  return (
    <div className="flex gap-2 p-1.5 rounded-lg animate-pulse">
      <div className="shrink-0 w-[80px] h-[45px] rounded bg-[#7c6a75]/20" />
      <div className="flex flex-col gap-1.5 flex-1 justify-center">
        <div className="h-2.5 bg-[#7c6a75]/20 rounded w-full" />
        <div className="h-2.5 bg-[#7c6a75]/15 rounded w-3/4" />
        <div className="h-2 bg-[#7c6a75]/10 rounded w-1/2" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
interface YoutubeHubProps {
  onAddYoutubeUrl: (url: string) => Promise<void>;
  isActive?: boolean;
}

export default function YoutubeHub({ onAddYoutubeUrl, isActive = true }: YoutubeHubProps) {
  /* ---------- store selectors ---------- */
  const sidebarView = useYoutubeStore((s) => s.sidebarView);
  const searchQuery = useYoutubeStore((s) => s.searchQuery);
  const searchResults = useYoutubeStore((s) => s.searchResults);
  const upNextQueue = useYoutubeStore((s) => s.upNextQueue);
  const currentVideoUrl = useYoutubeStore((s) => s.currentVideoUrl);
  const playlistTitle = useYoutubeStore((s) => s.playlistTitle);
  const message = useYoutubeStore((s) => s.message);
  const isSearching = useYoutubeStore((s) => s.isSearching);
  const isFetchingNextPage = useYoutubeStore((s) => s.isFetchingNextPage);
  const isFetchingUpNext = useYoutubeStore((s) => s.isFetchingUpNext);
  const isProcessing = useYoutubeStore((s) => s.isProcessing);
  const autoplay = useYoutubeStore((s) => s.autoplay);
  const searchNextPageToken = useYoutubeStore((s) => s.searchNextPageToken);
  const hasCaptions = useYoutubeStore((s) => s.hasCaptions);
  const isTranscriptLoading = useYoutubeStore((s) => s.isTranscriptLoading);

  const setSearchQuery = useYoutubeStore((s) => s.setSearchQuery);
  const setSearchResults = useYoutubeStore((s) => s.setSearchResults);
  const fetchNextSearchPage = useYoutubeStore((s) => s.fetchNextSearchPage);
  const setPlaylistTitle = useYoutubeStore((s) => s.setPlaylistTitle);
  const setMessage = useYoutubeStore((s) => s.setMessage);
  const setIsSearching = useYoutubeStore((s) => s.setIsSearching);
  const setIsProcessing = useYoutubeStore((s) => s.setIsProcessing);
  const toggleAutoplay = useYoutubeStore((s) => s.toggleAutoplay);
  const selectVideo = useYoutubeStore((s) => s.selectVideo);
  const showSearchSidebar = useYoutubeStore((s) => s.showSearchSidebar);
  const clearSearch = useYoutubeStore((s) => s.clearSearch);
  const restoreFromStorage = useYoutubeStore((s) => s.restoreFromStorage);
  const extractVideoId = useYoutubeStore((s) => s.extractVideoId);

  // Derived: is a video currently playing?
  const hasActiveVideo = !!currentVideoUrl;

  /* ---------- refs ---------- */
  const activeItemRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const currentVideoIdRef = useRef<string>('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  /* ---------- restore from localStorage on mount ---------- */
  useEffect(() => {
    restoreFromStorage();
  }, [restoreFromStorage]);

  /* ---------- scroll active item into view ---------- */
  useEffect(() => {
    if (sidebarView === 'upnext' && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentVideoUrl, sidebarView]);

  /* ---------- Infinite Scrolling ---------- */
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      if (sidebarView === 'search') {
        if (searchNextPageToken && !isFetchingNextPage && !isSearching) {
          fetchNextSearchPage();
        }
      } else if (sidebarView === 'upnext') {
        const upNextNextPageToken = useYoutubeStore.getState().upNextNextPageToken;
        if (upNextNextPageToken && !isFetchingUpNext) {
          const videoId = extractVideoId(currentVideoUrl);
          if (videoId) {
            useYoutubeStore.getState().fetchUpNext(videoId, true);
          }
        }
      }
    }
  }, [sidebarView, searchNextPageToken, isFetchingNextPage, isSearching, fetchNextSearchPage, isFetchingUpNext, currentVideoUrl, extractVideoId]);

  /* ---------- YT.Player lifecycle ---------- */
  const createOrUpdatePlayer = useCallback(
    async (videoId: string) => {
      if (!videoId) return;
      if (currentVideoIdRef.current === videoId && playerRef.current) return;

      await loadYoutubeApi();
      const YT = (window as any).YT;
      if (!YT?.Player) return;

      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        currentVideoIdRef.current = videoId;
        playerRef.current.loadVideoById(videoId);
        return;
      }

      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }

      if (playerContainerRef.current) {
        playerContainerRef.current.innerHTML = '';
        const el = document.createElement('div');
        el.id = 'yt-player-target';
        playerContainerRef.current.appendChild(el);
      }

      currentVideoIdRef.current = videoId;

      playerRef.current = new YT.Player('yt-player-target', {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        },
        events: {
          onReady: () => {
            // Do not force playVideo automatically on ready/mount/tab switch
          },
          onStateChange: (event: any) => {
            if (event.data === 0) { // ENDED
              const state = useYoutubeStore.getState();
              if (state.autoplay) {
                const advanced = state.playNext();
                if (advanced) {
                  const nextState = useYoutubeStore.getState();
                  const nextId = nextState.extractVideoId(nextState.currentVideoUrl);
                  if (nextId && playerRef.current && typeof playerRef.current.cueVideoById === 'function') {
                    currentVideoIdRef.current = nextId;
                    playerRef.current.cueVideoById(nextId);
                  }
                }
              }
            }
          },
        },
      });
    },
    []
  );

  useEffect(() => {
    if (!currentVideoUrl) {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.pauseVideo(); playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
        currentVideoIdRef.current = '';
      }
      return;
    }
    const videoId = extractVideoId(currentVideoUrl);
    if (videoId) {
      createOrUpdatePlayer(videoId);
    }
  }, [currentVideoUrl, extractVideoId, createOrUpdatePlayer]);

  // Pause when leaving YouTube tab; resume when returning
  useEffect(() => {
    if (!playerRef.current) return;
    if (isActive) {
      // Tab became visible — do nothing, let user press play intentionally
    } else {
      // Tab hidden — pause video to stop background audio
      try {
        if (typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        }
      } catch { /* ignore */ }
    }
  }, [isActive]);

  // Cleanup only on full unmount (never happens during tab switch now)
  useEffect(() => {
    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { 
          if (typeof playerRef.current.pauseVideo === 'function') {
            playerRef.current.pauseVideo();
          }
          playerRef.current.destroy(); 
        } catch { /* ignore */ }
        playerRef.current = null;
        currentVideoIdRef.current = '';
      }
    };
  }, []);

  /* ---------- search ---------- */
  const handleSearchYoutube = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setPlaylistTitle('');
    setMessage('');
    // Switch sidebar to search results but DO NOT touch the player
    useYoutubeStore.setState({ sidebarView: 'search' });

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.items) {
        setSearchResults(data.items, data.nextPageToken);
      }
    } catch {
      setMessage('Failed to search YouTube.');
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFetchPlaylist = async (listId: string, title: string) => {
    setIsSearching(true);
    setPlaylistTitle(`Playlist: ${title}`);
    setMessage('');
    useYoutubeStore.setState({ sidebarView: 'search' });

    try {
      const res = await fetch(`/api/youtube/search?listId=${listId}`);
      const data = await res.json();
      if (data.items) {
        setSearchResults(data.items, data.nextPageToken);
      }
    } catch {
      setMessage('Failed to fetch playlist videos.');
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setIsSearching(false);
    }
  };

  /* ---------- render video item ---------- */
  const renderVideoItem = (item: YoutubeVideo, idx: number, isQueue: boolean) => {
    const isActive = item.url === currentVideoUrl;
    const durationStr = formatDuration(item.duration);
    const viewsStr = formatViewCount(item.viewCount);

    return (
      <div
        key={`${isQueue ? 'q' : 's'}-${idx}-${item.videoId || item.url}`}
        ref={isActive ? activeItemRef : null}
        onClick={() => {
          if (item.type === 'list') {
            handleFetchPlaylist(item.listId!, item.title);
          } else {
            selectVideo(item.url);
          }
        }}
        className={`flex gap-2 p-1.5 rounded-lg cursor-pointer transition-colors border-2 group relative ${
          isActive
            ? 'bg-[#7181c8]/15 border-[#7181c8]/50 shadow-sm border-l-4 border-l-[#7181c8]'
            : 'border-transparent hover:bg-white/70 hover:border-[#7c6a75]/30'
        }`}
      >
        <div className="relative shrink-0 w-[100px] h-[56px] rounded overflow-hidden bg-black/10">
          <img src={item.thumbnail} alt="thumb" className="w-full h-full object-cover" />
          
          {item.type === 'list' && (
            <div className="absolute right-0 bottom-0 bg-black/70 text-white text-[7px] font-bold px-1 m-0.5 rounded">LIST</div>
          )}
          
          {durationStr && !isActive && (
            <div className="absolute right-0 bottom-0 bg-black/70 text-white text-[9px] font-bold px-1 m-0.5 rounded tracking-wider">
              {durationStr}
            </div>
          )}

          {isActive && (
            <div className="absolute inset-0 bg-[#7181c8]/30 flex items-center justify-center">
              <span className="text-white text-lg drop-shadow-md">▶</span>
            </div>
          )}
        </div>
        <div className="flex flex-col overflow-hidden justify-center flex-1">
          <span className={`text-[11px] font-bold leading-tight line-clamp-2 ${isActive ? 'text-[#7181c8]' : 'text-[#5d5770]'}`}>
            {item.title}
          </span>
          <span className="text-[10px] text-[#5d5770]/70 truncate mt-1 font-semibold">{item.author?.name}</span>
          {viewsStr && (
            <span className="text-[9px] text-[#5d5770]/50 truncate mt-0.5">{viewsStr}</span>
          )}
        </div>
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="w-full max-w-[1550px] mx-auto flex gap-6 h-[75vh] font-fredoka relative">
      {/* Toast */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#ffd1dc] border-3 border-[#7c6a75] text-[#5d5770] font-black text-xs p-3 rounded-xl shadow-lg flex items-center gap-3"
          >
            <span className="text-xl">⚠️</span>
            <span>{message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEFT COLUMN: Sidebar */}
      <div className="w-[320px] shrink-0 flex flex-col gap-4">
        {/* Autoplay toggle */}
        <div className="flex items-center justify-end">
          <button
            onClick={toggleAutoplay}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase border-2 transition-all ${
              autoplay
                ? 'bg-[#7181c8]/15 border-[#7181c8]/40 text-[#7181c8]'
                : 'bg-white/40 border-[#7c6a75]/15 text-[#5d5770]/60'
            }`}
            title={autoplay ? 'Autoplay is ON' : 'Autoplay is OFF'}
          >
            <span className={`w-6 h-3.5 rounded-full relative transition-colors ${autoplay ? 'bg-[#7181c8]' : 'bg-[#7c6a75]/30'}`}>
              <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all ${autoplay ? 'left-3' : 'left-0.5'}`} />
            </span>
            <span>Auto</span>
          </button>
        </div>

        {/* Sidebar content */}
        <div className="flex-1 bg-white/40 border-3 border-[#7c6a75] rounded-2xl shadow-inner flex flex-col overflow-hidden p-3 gap-3">
          {/* Unified search bar — always visible */}
          <div className="flex gap-2 w-full items-center">
            {/* Toggle arrow: visible when a video is playing (Video Mode), allows toggling sidebar content */}
            {hasActiveVideo && (
              <button
                type="button"
                onClick={() => {
                  useYoutubeStore.setState((s) => ({
                    sidebarView: s.sidebarView === 'upnext' ? 'search' : 'upnext'
                  }));
                }}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/60 hover:bg-[#7181c8]/10 border border-[#7c6a75]/20 text-[#5d5770] text-sm font-bold transition-colors"
                title={sidebarView === 'upnext' ? 'Back to search results' : 'Go to Up Next'}
              >
                {sidebarView === 'upnext' ? '←' : '→'}
              </button>
            )}
            <input
              type="text"
              placeholder="Search YouTube..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchYoutube();
                }
              }}
              className="flex-1 min-w-0 bg-white/60 border-2 border-[#7c6a75]/20 rounded-xl px-3 py-1.5 text-xs text-[#5d5770] focus:outline-none focus:border-[#7181c8] font-bold"
            />
            <Button variant="primary" type="button" onClick={() => handleSearchYoutube()} isLoading={isSearching} className="px-3 py-1.5 text-xs shrink-0">
              🔍
            </Button>
          </div>

          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pb-10"
          >
            {/* Playlist Title */}
            {playlistTitle && sidebarView === 'search' && (
              <div className="bg-[#7c6a75]/10 px-2 py-1.5 rounded-lg flex justify-between items-center mb-2">
                <span className="text-[9px] font-black uppercase truncate text-[#5d5770]">{playlistTitle}</span>
                <button onClick={() => clearSearch()} className="text-[9px] text-blue-500 font-bold hover:underline shrink-0 ml-2">
                  Clear
                </button>
              </div>
            )}

            {/* Skeleton cards while searching (first load) */}
            {isSearching && searchResults.length === 0 && (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {/* Content Lists */}
            <div className={isSearching && searchResults.length > 0 ? 'opacity-60 pointer-events-none' : ''}>
              
              {/* UP NEXT sidebar view */}
              {sidebarView === 'upnext' && (
                <>
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2 text-[#7c6a75] font-black text-xs border-b-2 border-[#7c6a75]/10 pb-1">
                      <span>▶ Up Next</span>
                    </div>

                    {/* Skeletons while fetching related videos */}
                    {isFetchingUpNext && upNextQueue.length === 0 && (
                       <>
                         <SkeletonCard />
                         <SkeletonCard />
                         <SkeletonCard />
                       </>
                    )}

                    {!isFetchingUpNext && upNextQueue.length === 0 && !currentVideoUrl ? (
                      <div className="text-xs text-[#5d5770]/60 text-center py-4 font-bold">No recommendations available.</div>
                    ) : (
                      upNextQueue.map((item, idx) => {
                        if (item.url === currentVideoUrl) return null;
                        return renderVideoItem(item, idx, true);
                      })
                    )}
                    
                    {/* Skeletons appending at the bottom if fetching more while queue exists */}
                    {isFetchingUpNext && upNextQueue.length > 0 && (
                      <div className="mt-2 opacity-50">
                        <SkeletonCard />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* SEARCH RESULTS sidebar view */}
              {sidebarView === 'search' && searchResults.length > 0 && (
                <div>
                  {searchResults.map((item, idx) => renderVideoItem(item, idx, false))}
                  
                  {/* Infinite Loading Spinner */}
                  {isFetchingNextPage && (
                    <div className="flex justify-center py-4">
                      <div className="w-5 h-5 border-2 border-[#7181c8] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  {!searchNextPageToken && searchResults.length > 0 && (
                    <div className="text-center text-[#5d5770]/50 text-[10px] font-bold py-4">
                      No more results
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* CENTER COLUMN: YouTube Player */}
      <div className="flex-1 flex flex-col relative">
        {/* Placeholder (only when no video is playing) */}
        <div className={`absolute inset-0 flex items-center justify-center border-3 border-[#7c6a75]/20 border-dashed rounded-2xl bg-white/20 transition-opacity ${!hasActiveVideo ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <div className="text-center">
            <span className="text-4xl opacity-50 block mb-2">📺</span>
            <p className="text-[#5d5770]/60 font-black uppercase tracking-widest text-sm">
              {searchResults.length > 0 ? "Select a video from the results" : "Search to discover videos"}
            </p>
          </div>
        </div>

        {/* Player Container (visible whenever a video URL exists — completely independent of sidebar) */}
        <div className={`flex-1 flex flex-col gap-3 h-full absolute inset-0 ${hasActiveVideo ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'}`}>
          <div
            ref={playerContainerRef}
            className="flex-1 bg-black rounded-2xl border-3 border-[#7c6a75] overflow-hidden relative shadow-inner"
          />
          {/* Generate Notes Button */}
          <Button
            variant={hasCaptions ? 'primary' : 'secondary'}
            isLoading={isProcessing || isTranscriptLoading}
            disabled={!hasCaptions || isTranscriptLoading || isProcessing}
            onClick={async () => {
              if (!currentVideoUrl) return;
              if (!hasCaptions) {
                setMessage('Transcript unavailable for this video.');
                setTimeout(() => setMessage(''), 4000);
                return;
              }
              setIsProcessing(true);
              try {
                await onAddYoutubeUrl(currentVideoUrl);
                setMessage('Video imported successfully! Switching to Study Hub...');
              } catch (err: any) {
                setMessage(err?.message || 'Transcript unavailable for this video.');
              } finally {
                setIsProcessing(false);
                setTimeout(() => setMessage(''), 4000);
              }
            }}
            className="w-full max-w-sm mx-auto py-2 shadow-[0_4px_0_#7c6a75]"
          >
            <span className="mr-2">✨</span>
            {isTranscriptLoading
              ? 'Extracting Captions...'
              : !hasCaptions
              ? 'Transcript unavailable for this video.'
              : 'Generate AI Notes & Quiz'}
          </Button>
        </div>
      </div>
    </div>
  );
}
