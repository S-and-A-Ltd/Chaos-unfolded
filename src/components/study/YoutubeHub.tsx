'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Button from '@/components/ui/Button';
import { useYoutubeStore } from '@/stores/useYoutubeStore';

interface YoutubeHubProps {
  onAddYoutubeUrl: (url: string) => Promise<void>;
}

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

export default function YoutubeHub({ onAddYoutubeUrl }: YoutubeHubProps) {
  const searchQuery = useYoutubeStore(s => s.searchQuery);
  const searchResults = useYoutubeStore(s => s.searchResults);
  const currentVideoUrl = useYoutubeStore(s => s.currentVideoUrl);
  const currentVideoIndex = useYoutubeStore(s => s.currentVideoIndex);
  const playlistTitle = useYoutubeStore(s => s.playlistTitle);
  const message = useYoutubeStore(s => s.message);
  const isSearching = useYoutubeStore(s => s.isSearching);
  const isProcessing = useYoutubeStore(s => s.isProcessing);

  const setSearchQuery = useYoutubeStore(s => s.setSearchQuery);
  const setSearchResults = useYoutubeStore(s => s.setSearchResults);
  const setCurrentVideoUrl = useYoutubeStore(s => s.setCurrentVideoUrl);
  const setPlaylistTitle = useYoutubeStore(s => s.setPlaylistTitle);
  const setMessage = useYoutubeStore(s => s.setMessage);
  const setIsSearching = useYoutubeStore(s => s.setIsSearching);
  const setIsProcessing = useYoutubeStore(s => s.setIsProcessing);
  const selectVideo = useYoutubeStore(s => s.selectVideo);
  const clearSearch = useYoutubeStore(s => s.clearSearch);
  const restoreFromStorage = useYoutubeStore(s => s.restoreFromStorage);
  const persistToStorage = useYoutubeStore(s => s.persistToStorage);

  const activeItemRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Restore from localStorage on mount
  useEffect(() => {
    restoreFromStorage();
  }, [restoreFromStorage]);

  // Scroll active video into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentVideoIndex]);

  // Build embed URL with autoplay for autoplay-next
  const getEmbedUrl = useCallback((url: string, autoplay = false) => {
    let videoId = '';
    try {
      const parsed = new URL(url);
      videoId = parsed.searchParams.get('v') || '';
    } catch {
      videoId = url.replace('https://www.youtube.com/watch?v=', '');
    }
    if (!videoId) return '';
    const params = new URLSearchParams({
      enablejsapi: '1',
      rel: '0',
    });
    if (autoplay) params.set('autoplay', '1');
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }, []);

  // Listen for YouTube iframe postMessage events (video ended)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // YouTube iframe API sends playerState: 0 when video ends
        if (data?.event === 'onStateChange' && data?.info === 0) {
          // Autoplay next
          const state = useYoutubeStore.getState();
          const videoResults = state.searchResults.filter(r => r.type !== 'list');
          const nextIndex = state.currentVideoIndex + 1;
          if (nextIndex < videoResults.length) {
            const nextVideo = videoResults[nextIndex];
            selectVideo(nextVideo.url, nextIndex);
          }
        }
      } catch { /* not a JSON message, ignore */ }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectVideo]);

  // Search YouTube
  const handleSearchYoutube = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setPlaylistTitle('');
    setMessage('');
    // Keep previous results visible during search

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.items) {
        setSearchResults(data.items);
        persistToStorage();
      }
    } catch {
      setMessage("Failed to search YouTube.");
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch playlist
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
      setMessage("Failed to fetch playlist videos.");
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setIsSearching(false);
    }
  };

  // Get the actual video index (filtering out playlists)
  const getVideoIndex = (idx: number) => {
    let videoCount = -1;
    for (let i = 0; i <= idx; i++) {
      if (searchResults[i]?.type !== 'list') videoCount++;
    }
    return videoCount;
  };

  return (
    <div className="w-full max-w-[1550px] mx-auto flex gap-6 h-[75vh] font-fredoka relative">
      {/* Toast Alert message */}
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
        {/* Workspace Switcher */}
        <div className="flex bg-[#7c6a75]/10 p-1.5 rounded-xl border-2 border-[#7c6a75]/15">
          <button className="flex-1 py-1.5 rounded-lg text-xs font-black uppercase transition-all bg-white text-[#7181c8] shadow-sm border border-[#7c6a75]/10 cursor-default">
            📺 Web Search
          </button>
        </div>

        {/* Content of Sidebar */}
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
                <button onClick={() => clearSearch()} className="text-[9px] text-blue-500 font-bold hover:underline shrink-0 ml-2">Clear</button>
              </div>
            )}

            {/* Skeleton cards while searching */}
            {isSearching && searchResults.length === 0 && (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {/* Search results — stay visible during search, dim slightly */}
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
                      <span className={`text-[10px] font-bold leading-tight line-clamp-2 ${isActive ? 'text-[#7181c8]' : 'text-[#5d5770]'}`}>{item.title}</span>
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
            <div className="flex-1 bg-black rounded-2xl border-3 border-[#7c6a75] overflow-hidden relative shadow-inner">
               <iframe
                  ref={iframeRef}
                  src={getEmbedUrl(currentVideoUrl, true)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full border-none"
               />
            </div>
            {/* Generate Notes Button — no surrounding container */}
            <Button
              variant="primary"
              isLoading={isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                try {
                  await onAddYoutubeUrl(currentVideoUrl);
                  setMessage("Video imported successfully! Switching to Study Hub...");
                } catch {
                  setMessage("Failed to import video.");
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
