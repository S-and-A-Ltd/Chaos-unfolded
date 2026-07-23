'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import type { StudyDocument } from '@/types';

interface StudyHubProps {
  documents: StudyDocument[];
}

type TabType = 'youtube' | 'documents';

const DEFAULT_VIDEOS = [
  { name: '📚 Pomodoro Study Session', url: 'https://www.youtube.com/embed/5qap5aO4i9A' },
  { name: '🌧️ Cozy Library & Rain', url: 'https://www.youtube.com/embed/4vIQON2fDWM' },
];

export default function StudyHub({ documents }: StudyHubProps) {
  const [activeTab, setActiveTab] = useState<TabType>('youtube');
  
  // YouTube State
  const [youtubeSearch, setYoutubeSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlaylistTitle, setSelectedPlaylistTitle] = useState('');
  const [currentVideoUrl, setCurrentVideoUrl] = useState(DEFAULT_VIDEOS[0].url);
  const [message, setMessage] = useState('');
  
  // Document State
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [docSearchQuery, setDocSearchQuery] = useState('');

  // Filter out YouTube links from general documents for the PDF tab, and vice versa
  const pdfDocs = documents.filter(d => d.type !== 'youtube');
  const youtubeDocs = documents.filter(d => d.type === 'youtube');

  // YouTube Search Handler
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

  const handleLoadYoutube = useCallback(async (urlToLoad?: string) => {
    const targetUrl = urlToLoad;
    if (!targetUrl) return;
    
    let videoId = '';
    try {
      const url = new URL(targetUrl);
      if (url.hostname.includes('youtube.com')) {
        videoId = url.searchParams.get('v') || '';
      } else if (url.hostname.includes('youtu.be')) {
        videoId = url.pathname.slice(1);
      }
    } catch (e) {
      // Try regex search if URL parsing fails
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = targetUrl.match(regExp);
      if (match && match[2].length === 11) {
        videoId = match[2];
      }
    }

    if (!videoId) {
      setMessage("Invalid YouTube URL.");
      setTimeout(() => setMessage(''), 4000);
      return;
    }
    
    // Update player to show this video
    setCurrentVideoUrl(`https://www.youtube.com/embed/${videoId}`);
  }, []);

  // Set default document if list updates
  useEffect(() => {
    if (pdfDocs.length > 0 && !selectedDocId) {
      setSelectedDocId(pdfDocs[0].id);
    }
  }, [pdfDocs, selectedDocId]);

  const activeDoc = pdfDocs.find(d => d.id === selectedDocId);

  // Highlight search matches within a string
  const highlightMatches = (text: string, search: string) => {
    if (!search) return <>{text}</>;
    const escaped = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 text-[#1e1c1a] font-bold px-0.5 rounded">{part}</mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Render extracted text in a clean, readable plain-text format
  // Preserves line breaks and paragraph gaps exactly as extracted from the PDF
  const renderHighlightedText = (text: string, search: string) => {
    return (
      <pre
        className="whitespace-pre-wrap break-words font-[inherit] text-sm text-[#3e3835] leading-[1.8] m-0"
        style={{ fontFamily: 'inherit' }}
      >
        {highlightMatches(text, search)}
      </pre>
    );
  };

  return (
    <Card padding="lg" bgVariant="lavender" className="w-full relative shadow-[0_6px_0_#7c6a75] font-fredoka flex flex-col min-h-[660px]">
      {/* Toast Alert message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-4 right-4 z-50 bg-[#ffd1dc] border-3 border-[#7c6a75] text-[#5d5770] font-black text-xs p-3 rounded-xl shadow-lg flex items-center gap-3"
          >
            <span className="text-xl">⚠️</span>
            <span>{message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b-3 border-[#7c6a75]/20 pb-4 mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌐</span>
          <h2 className="text-base font-black text-[#5d5770] tracking-wider uppercase">Study Hub</h2>
        </div>

        {/* Tab selection */}
        <div className="flex bg-[#7c6a75]/10 p-1.5 rounded-xl border border-[#7c6a75]/15">
          <button
            onClick={() => setActiveTab('youtube')}
            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === 'youtube'
                ? 'bg-white text-[#7181c8] shadow-[0_2px_0_#7c6a75]'
                : 'text-[#5d5770]/60 hover:text-[#5d5770]'
            }`}
          >
            📺 YouTube Videos
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === 'documents'
                ? 'bg-white text-[#7181c8] shadow-[0_2px_0_#7c6a75]'
                : 'text-[#5d5770]/60 hover:text-[#5d5770]'
            }`}
          >
            📂 PDFs & Texts
          </button>
        </div>
      </div>

      {/* Workspace Display */}
      <div className="flex-1 flex flex-col">
        {activeTab === 'youtube' && (
          <div className="flex flex-col gap-4 flex-1">
            <form onSubmit={handleSearchYoutube} className="flex gap-3 relative">
              <input
                type="text"
                placeholder="Search YouTube for study videos or playlists..."
                value={youtubeSearch}
                onChange={(e) => setYoutubeSearch(e.target.value)}
                className="flex-1 bg-white/40 border-3 border-[#7c6a75] shadow-[0_3px_0_#7c6a75] rounded-xl px-10 py-2.5 text-xs text-[#5d5770] focus:outline-none focus:border-[#7181c8] font-bold"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#5d5770]/60">🔍</span>
              <Button variant="primary" className="px-5 py-2 text-xs" type="submit" isLoading={isSearching}>
                Search
              </Button>
            </form>

            <div className="flex flex-col gap-2.5 bg-white/30 border border-[#7c6a75]/10 rounded-xl p-3">
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-[10px] font-black text-[#5d5770]/60 uppercase tracking-widest">Presets:</span>
                {DEFAULT_VIDEOS.map((vid, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentVideoUrl(vid.url)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border transition-all cursor-pointer ${
                      currentVideoUrl === vid.url
                        ? 'bg-[#ffd1dc] border-[#7c6a75] text-[#5d5770] shadow-[0_2.5px_0_#7c6a75]'
                        : 'bg-white/40 border-[#7c6a75]/20 text-[#5d5770]/70 hover:bg-white/60'
                    }`}
                  >
                    {vid.name}
                  </button>
                ))}
              </div>

              {youtubeDocs.length > 0 && (
                <div className="flex gap-2 items-center flex-wrap border-t border-[#7c6a75]/10 pt-2.5">
                  <span className="text-[10px] font-black text-[#5d5770]/60 uppercase tracking-widest">Linked Videos:</span>
                  {youtubeDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => {
                        const url = doc.extractedText.match(/URL: (https?:\/\/[^\s]+)/)?.[1] || '';
                        if (url) handleLoadYoutube(url);
                      }}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black truncate max-w-[180px] border transition-all cursor-pointer bg-white/40 border-[#7c6a75]/20 text-[#5d5770]/70 hover:bg-white/60`}
                      title={doc.name}
                    >
                      📺 {doc.name.replace('YouTube Video: ', '')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex gap-4 min-h-[440px]">
              
              {/* Search Results Drawer */}
              {(searchResults.length > 0 || isSearching || selectedPlaylistTitle) && (
                <div className="w-[300px] flex flex-col border-3 border-[#7c6a75] rounded-2xl bg-white/50 overflow-hidden shadow-inner">
                  <div className="bg-[#7c6a75]/10 px-3 py-2 border-b border-[#7c6a75]/20 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-[#5d5770] tracking-wider truncate">
                      {selectedPlaylistTitle || 'Search Results'}
                    </span>
                    {selectedPlaylistTitle && (
                      <button onClick={() => { setSelectedPlaylistTitle(''); setSearchResults([]); setYoutubeSearch(''); }} className="text-[10px] text-blue-500 hover:underline cursor-pointer font-bold">Close</button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[400px]">
                    {isSearching ? (
                      <div className="text-center text-xs font-bold text-[#5d5770]/60 py-10">Searching YouTube...</div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((item, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            if (item.type === 'list') {
                              handleFetchPlaylist(item.listId, item.title);
                            } else {
                              handleLoadYoutube(item.url);
                            }
                          }}
                          className="flex gap-2 p-1.5 rounded-lg hover:bg-white/70 cursor-pointer transition-colors border border-transparent hover:border-[#7c6a75]/30 group"
                        >
                          <div className="relative shrink-0 w-[90px] h-[50px] rounded overflow-hidden bg-black/10">
                            <img src={item.thumbnail} alt="thumb" className="w-full h-full object-cover" />
                            {item.type === 'list' && (
                              <div className="absolute right-0 bottom-0 bg-black/70 text-white text-[8px] font-bold px-1 py-0.5 m-0.5 rounded">PLAYLIST</div>
                            )}
                          </div>
                          <div className="flex flex-col overflow-hidden justify-center flex-1">
                            <span className="text-[10px] font-bold text-[#5d5770] leading-tight line-clamp-2">{item.title}</span>
                            <span className="text-[9px] text-[#5d5770]/70 truncate mt-0.5">{item.author?.name}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-xs font-bold text-[#5d5770]/60 py-10">No results found.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Video Player */}
              <div className={`flex-1 relative border-3 border-[#7c6a75] rounded-2xl overflow-hidden shadow-inner bg-black ${searchResults.length === 0 && !isSearching && !selectedPlaylistTitle ? 'w-full' : ''}`}>
                <iframe
                  src={currentVideoUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full border-none"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="flex flex-col gap-4 flex-1">
            {pdfDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-center flex-1">
                <span className="text-4xl mb-4">📂</span>
                <p className="text-sm font-black text-[#5d5770]">No study documents uploaded yet!</p>
                <p className="text-xs text-[#5d5770]/60 mt-1 max-w-xs">
                  Go to the Study Timer view, upload a PDF/text file via the Document Uploader, and it will show up here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 flex-1">
                {/* Selector + Search */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase text-[#5d5770]/60 px-1">Active File</label>
                    <select
                      value={selectedDocId}
                      onChange={(e) => setSelectedDocId(e.target.value)}
                      className="bg-white/40 border-3 border-[#7c6a75] shadow-[0_3px_0_#7c6a75] rounded-xl px-3 py-2 text-xs text-[#5d5770] font-black focus:outline-none cursor-pointer"
                    >
                      {pdfDocs.map((doc) => (
                        <option key={doc.id} value={doc.id} className="font-sans font-bold text-[#5d5770]">
                          {doc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase text-[#5d5770]/60 px-1">Find in Text</label>
                    <input
                      type="text"
                      placeholder="Search text..."
                      value={docSearchQuery}
                      onChange={(e) => setDocSearchQuery(e.target.value)}
                      className="bg-white/40 border-3 border-[#7c6a75] shadow-[0_3px_0_#7c6a75] rounded-xl px-4 py-2 text-xs text-[#5d5770] focus:outline-none focus:border-[#7181c8] font-bold"
                    />
                  </div>
                </div>

                {/* PDF Summary & Details Box */}
                {activeDoc && activeDoc.summary && (
                  <div className="bg-[#ffd1dc]/40 border border-[#7c6a75]/20 rounded-xl p-3 text-xs text-[#5d5770] font-semibold leading-relaxed">
                    <span className="font-black uppercase tracking-wider block mb-1 text-[10px] text-[#5d5770]/70">
                      📄 Document Summary:
                    </span>
                    {activeDoc.summary}
                  </div>
                )}

                {/* Text View Box */}
                <div className="flex-1 min-h-[360px] bg-white/70 border-3 border-[#7c6a75] rounded-2xl p-5 overflow-y-auto max-h-[450px] shadow-inner select-text">
                  {activeDoc ? (
                    activeDoc.extractedText ? (
                      renderHighlightedText(activeDoc.extractedText, docSearchQuery)
                    ) : (
                      <p className="text-xs text-[#5d5770]/60 italic font-semibold text-center py-20">
                        This document doesn't contain any extractable text content.
                      </p>
                    )
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
