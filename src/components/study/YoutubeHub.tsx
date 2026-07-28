'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Button from '@/components/ui/Button';
import { useYoutubeStore } from '@/stores/useYoutubeStore';

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
}

export default function YoutubeHub({ onAddYoutubeUrl }: YoutubeHubProps) {
  /* ---------- store selectors ---------- */
  const searchQuery = useYoutubeStore((s) => s.searchQuery);
  const searchResults = useYoutubeStore((s) => s.searchResults);
  const currentVideoUrl = useYoutubeStore((s) => s.currentVideoUrl);
  const currentVideoIndex = useYoutubeStore((s) => s.currentVideoIndex);
  const playlistTitle = useYoutubeStore((s) => s.playlistTitle);
  const message = useYoutubeStore((s) => s.message);
  const isSearching = useYoutubeStore((s) => s.isSearching);
  const isProcessing = useYoutubeStore((s) => s.isProcessing);
  const autoplay = useYoutubeStore((s) => s.autoplay);

  const setSearchQuery = useYoutubeStore((s) => s.setSearchQuery);
  const setSearchResults = useYoutubeStore((s) => s.setSearchResults);
  const setPlaylistTitle = useYoutubeStore((s) => s.setPlaylistTitle);
  const setMessage = useYoutubeStore((s) => s.setMessage);
  const setIsSearching = useYoutubeStore((s) => s.setIsSearching);
  const setIsProcessing = useYoutubeStore((s) => s.setIsProcessing);
  const toggleAutoplay = useYoutubeStore((s) => s.toggleAutoplay);
  const selectVideo = useYoutubeStore((s) => s.selectVideo);
  const clearSearch = useYoutubeStore((s) => s.clearSearch);
  const restoreFromStorage = useYoutubeStore((s) => s.restoreFromStorage);
  const persistToStorage = useYoutubeStore((s) => s.persistToStorage);
  const extractVideoId = useYoutubeStore((s) => s.extractVideoId);

  /* ---------- refs ---------- */
  const activeItemRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const currentVideoIdRef = useRef<string>('');

  /* ---------- restore from localStorage on mount ---------- */
  useEffect(() => {
    restoreFromStorage();
  }, [restoreFromStorage]);

  /* ---------- scroll active item into view ---------- */
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentVideoIndex]);

  /* ---------- YT.Player lifecycle ---------- */
  const createOrUpdatePlayer = useCallback(
    async (videoId: string) => {
      if (!videoId) return;
      if (currentVideoIdRef.current === videoId && playerRef.current) return;

      await loadYoutubeApi();
      const YT = (window as any).YT;
      if (!YT?.Player) return;

      // If player already exists, just load the new video
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        currentVideoIdRef.current = videoId;
        playerRef.current.loadVideoById(videoId);
        return;
      }

      // Destroy stale player if it somehow exists
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }

      // Need a fresh div inside the container
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
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: any) => {
            event.target.playVideo();
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED === 0
            if (event.data === 0) {
              const state = useYoutubeStore.getState();
              if (state.autoplay) {
                const advanced = state.playNext();
                if (advanced) {
                  const nextState = useYoutubeStore.getState();
                  const nextId = nextState.extractVideoId(nextState.currentVideoUrl);
                  if (nextId && playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
                    currentVideoIdRef.current = nextId;
                    playerRef.current.loadVideoById(nextId);
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

  /* ---------- React to video URL changes ---------- */
  useEffect(() => {
    if (!currentVideoUrl) return;
    const videoId = extractVideoId(currentVideoUrl);
    if (videoId) {
      createOrUpdatePlayer(videoId);
    }
  }, [currentVideoUrl, extractVideoId, createOrUpdatePlayer]);

  /* ---------- Destroy player on unmount ---------- */
  useEffect(() => {
    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
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

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.items) {
        setSearchResults(data.items);
        persistToStorage();
      }
    } catch {
      setMessage('Failed to search YouTube.');
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setIsSearching(false);
    }
  };

  /* ---------- fetch playlist ---------- */
  const handleFetchPlaylist = async (listId: string, title: string) => {
    setIsSearching(true);
    setPlaylistTitle(`Playlist: ${title}`);
    setMessage('');

    try {
      const res = await fetch(`/api/youtube/search?listId=${listId}`);
      const data = await res.json();
      if (data.items) {
        setSearchResults(data.items);
        persistToStorage();
      }
    } catch {
      setMessage('Failed to fetch playlist videos.');
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setIsSearching(false);
    }
  };

  /* ---------- video index helper ---------- */
  const getVideoIndex = (idx: number) => {
    let videoCount = -1;
    for (let i = 0; i <= idx; i++) {
      if (searchResults[i]?.type !== 'list') videoCount++;
    }
    return videoCount;
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

      {/* LEFT COLUMN: Search Sidebar */}
      <div className="w-[320px] shrink-0 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex bg-[#7c6a75]/10 p-1.5 rounded-xl border-2 border-[#7c6a75]/15">
            <button className="flex-1 py-1.5 rounded-lg text-xs font-black uppercase transition-all bg-white text-[#7181c8] shadow-sm border border-[#7c6a75]/10 cursor-default">
              📺 Web Search
            </button>
          </div>
          {/* Autoplay toggle */}
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
          <form onSubmit={handleSearchYoutube} className="flex gap-2 w-full">
            <input
              type="text"
              placeholder="Search YouTube..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-0 bg-white/60 border-2 border-[#7c6a75]/20 rounded-xl px-3 py-1.5 text-xs text-[#5d5770] focus:outline-none focus:border-[#7181c8] font-bold"
            />
            <Button variant="primary" type="submit" isLoading={isSearching} className="px-3 py-1.5 text-xs shrink-0">
              🔍
            </Button>
          </form>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
            {playlistTitle && (
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

            {/* Results — dim during re-search */}
            <div className={isSearching && searchResults.length > 0 ? 'opacity-60 pointer-events-none' : ''}>
              {searchResults.map((item, idx) => {
                const isActive = item.type !== 'list' && item.url === currentVideoUrl;
                const videoIdx = item.type !== 'list' ? getVideoIndex(idx) : -1;

                return (
                  <div
                    key={idx}
                    ref={isActive ? activeItemRef : null}
                    onClick={() => {
                      if (item.type === 'list') {
                        handleFetchPlaylist(item.listId!, item.title);
                      } else {
                        selectVideo(item.url, videoIdx);
                      }
                    }}
                    className={`flex gap-2 p-1.5 rounded-lg cursor-pointer transition-colors border-2 group ${
                      isActive
                        ? 'bg-[#7181c8]/15 border-[#7181c8]/50 shadow-sm'
                        : 'border-transparent hover:bg-white/70 hover:border-[#7c6a75]/30'
                    }`}
                  >
                    <div className="relative shrink-0 w-[80px] h-[45px] rounded overflow-hidden bg-black/10">
                      <img src={item.thumbnail} alt="thumb" className="w-full h-full object-cover" />
                      {item.type === 'list' && (
                        <div className="absolute right-0 bottom-0 bg-black/70 text-white text-[7px] font-bold px-1 m-0.5 rounded">LIST</div>
                      )}
                      {isActive && (
                        <div className="absolute inset-0 bg-[#7181c8]/30 flex items-center justify-center">
                          <span className="text-white text-lg">▶</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col overflow-hidden justify-center flex-1">
                      <span className={`text-[10px] font-bold leading-tight line-clamp-2 ${isActive ? 'text-[#7181c8]' : 'text-[#5d5770]'}`}>
                        {item.title}
                      </span>
                      <span className="text-[9px] text-[#5d5770]/70 truncate mt-0.5">{item.author?.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* CENTER COLUMN: YouTube Player */}
      <div className="flex-1 flex flex-col">
        {!currentVideoUrl ? (
          <div className="flex-1 flex items-center justify-center border-3 border-[#7c6a75]/20 border-dashed rounded-2xl bg-white/20">
            <div className="text-center">
              <span className="text-4xl opacity-50 block mb-2">📺</span>
              <p className="text-[#5d5770]/60 font-black uppercase tracking-widest text-sm">Search and select a video to preview</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3 h-full">
            {/* Player container — YT.Player renders into this div */}
            <div
              ref={playerContainerRef}
              className="flex-1 bg-black rounded-2xl border-3 border-[#7c6a75] overflow-hidden relative shadow-inner"
            />
            {/* Generate Notes Button */}
            <Button
              variant="primary"
              isLoading={isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                try {
                  await onAddYoutubeUrl(currentVideoUrl);
                  setMessage('Video imported successfully! Switching to Study Hub...');
                } catch {
                  setMessage('Failed to import video.');
                } finally {
                  setIsProcessing(false);
                  setTimeout(() => setMessage(''), 3000);
                }
              }}
              className="w-full max-w-sm mx-auto py-2 shadow-[0_4px_0_#7c6a75]"
            >
              <span className="mr-2">✨</span>
              Generate AI Notes & Quiz
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
