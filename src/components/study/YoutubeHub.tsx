'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Button from '@/components/ui/Button';

interface YoutubeHubProps {
  onAddYoutubeUrl: (url: string) => Promise<void>;
}

export default function YoutubeHub({ onAddYoutubeUrl }: YoutubeHubProps) {
  // YouTube Search State
  const [youtubeSearch, setYoutubeSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlaylistTitle, setSelectedPlaylistTitle] = useState('');
  const [message, setMessage] = useState('');
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // YouTube Search Logic
  const handleSearchYoutube = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!youtubeSearch.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setSelectedPlaylistTitle('');
    setMessage('');

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(youtubeSearch)}`);
      const data = await res.json();
      if (data.items) setSearchResults(data.items);
    } catch (err) {
      setMessage("Failed to search YouTube.");
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFetchPlaylist = async (listId: string, title: string) => {
    setIsSearching(true);
    setSearchResults([]);
    setSelectedPlaylistTitle(`Playlist: ${title}`);
    setMessage('');

    try {
      const res = await fetch(`/api/youtube/search?listId=${listId}`);
      const data = await res.json();
      if (data.items) setSearchResults(data.items);
    } catch (err) {
      setMessage("Failed to fetch playlist videos.");
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setIsSearching(false);
    }
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
              value={youtubeSearch}
              onChange={(e) => setYoutubeSearch(e.target.value)}
              className="flex-1 min-w-0 bg-white/60 border-2 border-[#7c6a75]/20 rounded-xl px-3 py-1.5 text-xs text-[#5d5770] focus:outline-none focus:border-[#7181c8] font-bold"
            />
            <Button variant="primary" type="submit" isLoading={isSearching} className="px-3 py-1.5 text-xs shrink-0">
              🔍
            </Button>
          </form>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
            {selectedPlaylistTitle && (
              <div className="bg-[#7c6a75]/10 px-2 py-1.5 rounded-lg flex justify-between items-center mb-2">
                <span className="text-[9px] font-black uppercase truncate text-[#5d5770]">{selectedPlaylistTitle}</span>
                <button onClick={() => { setSelectedPlaylistTitle(''); setSearchResults([]); setYoutubeSearch(''); }} className="text-[9px] text-blue-500 font-bold hover:underline shrink-0 ml-2">Clear</button>
              </div>
            )}
            {isSearching ? (
              <div className="text-center text-xs font-bold text-[#5d5770]/60 py-10">Searching...</div>
            ) : searchResults.map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => {
                  if (item.type === 'list') {
                    handleFetchPlaylist(item.listId, item.title);
                  } else {
                    setCurrentVideoUrl(item.url);
                  }
                }}
                className="flex gap-2 p-1.5 rounded-lg hover:bg-white/70 cursor-pointer transition-colors border-2 border-transparent hover:border-[#7c6a75]/30 group"
              >
                <div className="relative shrink-0 w-[80px] h-[45px] rounded overflow-hidden bg-black/10">
                  <img src={item.thumbnail} alt="thumb" className="w-full h-full object-cover" />
                  {item.type === 'list' && (
                    <div className="absolute right-0 bottom-0 bg-black/70 text-white text-[7px] font-bold px-1 m-0.5 rounded">LIST</div>
                  )}
                </div>
                <div className="flex flex-col overflow-hidden justify-center flex-1">
                  <span className="text-[10px] font-bold text-[#5d5770] leading-tight line-clamp-2">{item.title}</span>
                  <span className="text-[9px] text-[#5d5770]/70 truncate mt-0.5">{item.author?.name}</span>
                </div>
              </div>
            ))}
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
          <div className="flex-1 flex flex-col gap-4 h-full">
            <div className="flex-1 bg-black rounded-2xl border-3 border-[#7c6a75] overflow-hidden relative shadow-inner">
               <iframe
                  src={currentVideoUrl.replace('watch?v=', 'embed/')}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full border-none"
               />
            </div>
            {/* Generate Notes Button */}
            <div className="h-16 flex items-center justify-center bg-white/40 border-3 border-[#7c6a75] rounded-2xl shadow-inner px-4">
              <Button
                variant="primary"
                isLoading={isProcessing}
                onClick={async () => {
                  setIsProcessing(true);
                  try {
                    await onAddYoutubeUrl(currentVideoUrl);
                    setMessage("Video imported successfully! Switching to Study Hub...");
                  } catch (e) {
                    setMessage("Failed to import video.");
                  } finally {
                    setIsProcessing(false);
                    setTimeout(() => setMessage(''), 3000);
                  }
                }}
                className="w-full max-w-sm py-2 shadow-[0_4px_0_#7c6a75]"
              >
                <span className="mr-2">✨</span>
                Generate AI Notes & Quiz
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
