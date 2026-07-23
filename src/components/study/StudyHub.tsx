'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Button from '@/components/ui/Button';
import type { StudyDocument } from '@/types';
import dynamic from 'next/dynamic';
import NotesPanel from './NotesPanel';
import { getDocumentBlob } from '@/lib/storage/document-storage';

const PDFViewer = dynamic(() => import('./PDFViewer'), { ssr: false });

interface StudyHubProps {
  documents: StudyDocument[];
  onTriggerQuiz: (forceRegenerate?: boolean) => void;
  onAddYoutubeUrl: (url: string) => Promise<void>;
}

export default function StudyHub({ documents, onTriggerQuiz, onAddYoutubeUrl }: StudyHubProps) {
  const [activeSidebarTab, setActiveSidebarTab] = useState<'documents' | 'youtube'>('documents');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [activePdfBlob, setActivePdfBlob] = useState<File | Blob | null>(null);

  // YouTube Search State
  const [youtubeSearch, setYoutubeSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlaylistTitle, setSelectedPlaylistTitle] = useState('');
  const [message, setMessage] = useState('');
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');

  const activeDoc = documents.find((d) => d.id === selectedDocId);
  const pdfDocs = documents.filter((d) => d.type !== 'youtube');
  const youtubeDocs = documents.filter((d) => d.type === 'youtube');

  // Load PDF Blob when selected doc changes
  useEffect(() => {
    async function loadBlob() {
      if (activeDoc && activeDoc.type !== 'youtube' && activeDoc.type !== 'txt') {
        const blob = await getDocumentBlob(activeDoc.id);
        setActivePdfBlob(blob || null);
      } else {
        setActivePdfBlob(null);
      }
    }
    loadBlob();
    
    // Auto-load youtube iframe URL if a youtube doc is selected
    if (activeDoc && activeDoc.type === 'youtube') {
      const url = activeDoc.extractedText.match(/URL: (https?:\/\/[^\s]+)/)?.[1] || '';
      if (url) {
        let videoId = '';
        try {
          const parsedUrl = new URL(url);
          if (parsedUrl.hostname.includes('youtube.com')) {
            videoId = parsedUrl.searchParams.get('v') || '';
          } else if (parsedUrl.hostname.includes('youtu.be')) {
            videoId = parsedUrl.pathname.slice(1);
          }
        } catch (e) {
          const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
          const match = url.match(regExp);
          if (match && match[2].length === 11) {
            videoId = match[2];
          }
        }
        if (videoId) {
          setCurrentVideoUrl(`https://www.youtube.com/embed/${videoId}`);
        }
      }
    } else {
      setCurrentVideoUrl('');
    }
  }, [activeDoc]);

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

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);

  const handleTextSelection = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 0) {
      setContextMenu({ x: e.clientX, y: e.clientY - 40, text });
    } else {
      setContextMenu(null);
    }
  };

  // 3-Column Layout Workspace
  return (
    <div className="w-full flex gap-6 h-[75vh] font-fredoka relative">
      
      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-[100] flex bg-white border-2 border-[#7c6a75] rounded-xl shadow-[0_4px_0_#7c6a75] overflow-hidden -translate-x-1/2 -translate-y-full"
          >
            <button className="px-3 py-2 text-[10px] font-black uppercase text-[#5d5770] hover:bg-[#ffd1dc] transition-colors border-r border-[#7c6a75]/10">
              Explain
            </button>
            <button className="px-3 py-2 text-[10px] font-black uppercase text-[#5d5770] hover:bg-[#ffd1dc] transition-colors border-r border-[#7c6a75]/10">
              Notes
            </button>
            <button className="px-3 py-2 text-[10px] font-black uppercase text-[#5d5770] hover:bg-[#ffd1dc] transition-colors border-r border-[#7c6a75]/10">
              Flashcard
            </button>
            <button className="px-3 py-2 text-[10px] font-black uppercase text-[#5d5770] hover:bg-[#ffd1dc] transition-colors border-r border-[#7c6a75]/10">
              Quiz
            </button>
            <button className="px-3 py-2 text-[10px] font-black uppercase text-[#5d5770] hover:bg-[#ffd1dc] transition-colors">
              Bookmark
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* LEFT COLUMN: Explorer (Documents & Search) */}
      <div className="w-[320px] shrink-0 flex flex-col gap-4">
        {/* Workspace Switcher */}
        <div className="flex bg-[#7c6a75]/10 p-1.5 rounded-xl border-2 border-[#7c6a75]/15">
          <button
            onClick={() => setActiveSidebarTab('documents')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
              activeSidebarTab === 'documents' ? 'bg-white text-[#7181c8] shadow-sm border border-[#7c6a75]/10' : 'text-[#5d5770]/60 hover:text-[#5d5770]'
            }`}
          >
            📂 Local
          </button>
          <button
            onClick={() => setActiveSidebarTab('youtube')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
              activeSidebarTab === 'youtube' ? 'bg-white text-[#7181c8] shadow-sm border border-[#7c6a75]/10' : 'text-[#5d5770]/60 hover:text-[#5d5770]'
            }`}
          >
            📺 Web
          </button>
        </div>

        {/* Content of Sidebar */}
        <div className="flex-1 bg-white/40 border-3 border-[#7c6a75] rounded-2xl shadow-inner flex flex-col overflow-hidden">
          {activeSidebarTab === 'documents' && (
            <div className="flex-1 flex flex-col p-3 overflow-y-auto custom-scrollbar gap-2">
              <div className="text-[10px] font-black uppercase text-[#5d5770]/60 tracking-wider mb-1">My Study Materials</div>
              {documents.length === 0 && (
                <div className="text-xs text-center text-[#5d5770]/50 mt-10 font-bold">No documents uploaded yet. Head to the Study Tab to upload some!</div>
              )}
              {documents.map(doc => (
                <div 
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`p-2 rounded-lg cursor-pointer transition-all border-2 flex items-center gap-2 ${selectedDocId === doc.id ? 'bg-[#ffd1dc] border-[#7c6a75] shadow-[0_2px_0_#7c6a75]' : 'bg-white/50 border-transparent hover:border-[#7c6a75]/20'}`}
                >
                  <span className="text-lg">{doc.type === 'youtube' ? '📺' : doc.type === 'pdf' ? '📕' : '📄'}</span>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[11px] font-bold text-[#5d5770] truncate">{doc.name}</span>
                    <span className="text-[9px] text-[#5d5770]/60 uppercase">{doc.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSidebarTab === 'youtube' && (
            <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
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
                        // Normally this would upload it, but for Phase 4.1 we just load it into the player if we want to preview it,
                        // However, the user wants it to trigger the AI upload flow. 
                        // Since StudyHub doesn't have handleUpload prop in the current structure, we rely on the user to upload it in the Dashboard, OR we can provide a quick mock here to dispatch an event or alert.
                        // For now, we preview it. We will add a Context Menu later to "Generate Notes".
                        setCurrentVideoUrl(item.url);
                        setSelectedDocId(''); // deselect current doc to show search video
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
          )}
        </div>
      </div>

      {/* CENTER COLUMN: Reader / Viewer */}
      <div className="flex-1 flex flex-col">
        {!activeDoc && !currentVideoUrl ? (
          <div className="flex-1 flex items-center justify-center border-3 border-[#7c6a75]/20 border-dashed rounded-2xl bg-white/20">
            <div className="text-center">
              <span className="text-4xl opacity-50 block mb-2">📚</span>
              <p className="text-[#5d5770]/60 font-black uppercase tracking-widest text-sm">Select a document to read</p>
            </div>
          </div>
        ) : activeDoc?.type === 'pdf' ? (
          <PDFViewer file={activePdfBlob || ''} />
        ) : activeDoc?.type === 'youtube' || currentVideoUrl ? (
          <div className="flex-1 flex flex-col gap-4 h-full">
            <div className="flex-1 bg-black rounded-2xl border-3 border-[#7c6a75] overflow-hidden relative shadow-inner">
               <iframe
                  src={currentVideoUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full border-none"
                />
            </div>
            {!activeDoc && currentVideoUrl && (
              <div className="w-full shrink-0 flex justify-end">
                <Button 
                  variant="primary" 
                  className="px-6 py-3 font-black text-sm"
                  onClick={async () => {
                    const originalUrl = currentVideoUrl.replace('embed/', 'watch?v=');
                    await onAddYoutubeUrl(originalUrl);
                  }}
                >
                  ✨ Generate AI Notes & Quiz
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div 
            className="flex-1 bg-[#f4f2ee] rounded-2xl border-3 border-[#7c6a75] p-6 overflow-y-auto shadow-inner text-[#3e3835] font-sans text-sm whitespace-pre-wrap"
            onMouseUp={handleTextSelection}
          >
            {activeDoc?.extractedText || 'No text content available.'}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Notes Workspace */}
      <div className="w-[320px] shrink-0">
        {activeDoc ? (
          <NotesPanel 
            document={activeDoc} 
            onUpdatePersonalNotes={(notes) => console.log('Saved notes:', notes)} 
            onTriggerQuiz={onTriggerQuiz}
          />
        ) : (
          <div className="h-full flex items-center justify-center border-3 border-[#7c6a75]/20 border-dashed rounded-2xl bg-white/20">
            <p className="text-[#5d5770]/60 font-black uppercase tracking-widest text-[10px] text-center p-4">Open a document to view notes & flashcards</p>
          </div>
        )}
      </div>
      
    </div>
  );
}
