'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import Button from '@/components/ui/Button';
import type { StudyDocument, PDFAnnotation, PDFPreferences } from '@/types';
import {
  savePDFAnnotations,
  getPDFAnnotations,
  savePDFPreferences,
  getPDFPreferences,
} from '@/lib/storage/document-storage';
import { motion, AnimatePresence } from 'motion/react';

// Setup pdf worker using the exact version loaded by react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFWorkspaceProps {
  document: StudyDocument;
  file: Blob | File | string;
  onAddToPersonalNotes?: (text: string, pageNumber: number) => void;
  onTriggerQuizFromSelection?: (text: string) => void;
  onGenerateFlashcardFromSelection?: (text: string) => void;
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', hex: '#fef08a', border: '#ca8a04', label: '🟨' },
  { name: 'Green', hex: '#bbf7d0', border: '#16a34a', label: '🟩' },
  { name: 'Pink', hex: '#fbcfe8', border: '#db2777', label: '🌸' },
  { name: 'Blue', hex: '#bfdbfe', border: '#2563eb', label: '🟦' },
  { name: 'Purple', hex: '#e9d5ff', border: '#9333ea', label: '🟪' },
];

export default function PDFWorkspace({
  document: activeDocument,
  file,
  onAddToPersonalNotes,
  onTriggerQuizFromSelection,
  onGenerateFlashcardFromSelection,
}: PDFWorkspaceProps) {
  // Navigation & Zoom State
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>('1');
  const [scale, setScale] = useState<number>(1.0);
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // View Modes & Themes
  const [viewMode, setViewMode] = useState<'single' | 'continuous'>('continuous');
  const [readingMode, setReadingMode] = useState<'light' | 'dark'>('light');
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Search State
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMatches, setSearchMatches] = useState<{ pageNumber: number; text: string }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1);

  // Annotations & AI Toolbar State
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);
  const [showAnnotationsDrawer, setShowAnnotationsDrawer] = useState<boolean>(false);
  const [selectionMenu, setSelectionMenu] = useState<{
    x: number;
    y: number;
    text: string;
    pageNumber: number;
  } | null>(null);

  // AI Modal State (Explain / Summarize)
  const [aiModal, setAiModal] = useState<{
    open: boolean;
    title: string;
    content: string;
    isLoading: boolean;
  } | null>(null);

  // --- 1. Load Persistence on Document Change ---
  useEffect(() => {
    async function loadPersistentData() {
      if (!activeDocument?.id) return;
      try {
        const savedAnnotations = await getPDFAnnotations(activeDocument.id);
        if (savedAnnotations && Array.isArray(savedAnnotations)) {
          setAnnotations(savedAnnotations);
        } else {
          setAnnotations([]);
        }

        const savedPrefs = await getPDFPreferences(activeDocument.id);
        if (savedPrefs) {
          if (savedPrefs.zoom) setScale(savedPrefs.zoom);
          if (savedPrefs.pageNumber) {
            setPageNumber(savedPrefs.pageNumber);
            setInputPage(String(savedPrefs.pageNumber));
          }
          if (savedPrefs.readingMode) setReadingMode(savedPrefs.readingMode);
          if (savedPrefs.viewMode) setViewMode(savedPrefs.viewMode);
        }
      } catch (err) {
        console.error('Failed to load PDF persistent data:', err);
      }
    }
    loadPersistentData();
  }, [activeDocument?.id]);

  // Save annotations automatically
  const saveAnnotationsToStorage = useCallback(
    async (updatedAnnotations: PDFAnnotation[]) => {
      setAnnotations(updatedAnnotations);
      if (activeDocument?.id) {
        await savePDFAnnotations(activeDocument.id, updatedAnnotations);
      }
    },
    [activeDocument?.id]
  );

  // Save preferences automatically
  useEffect(() => {
    if (!activeDocument?.id) return;
    const prefs: PDFPreferences = {
      zoom: scale,
      pageNumber,
      readingMode,
      viewMode,
    };
    savePDFPreferences(activeDocument.id, prefs).catch(err => console.error('Error saving PDF preferences:', err));
  }, [activeDocument?.id, scale, pageNumber, readingMode, viewMode]);

  // Resize listener for Fit Width / Fit Page
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const onDocumentLoadSuccess = ({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    if (pageNumber > total) {
      setPageNumber(1);
      setInputPage('1');
    }
  };

  // --- 2. Navigation & Scrolling ---
  const changePage = useCallback((offset: number) => {
    setPageNumber(prev => {
      const newPage = Math.min(Math.max(1, prev + offset), numPages || 1);
      setInputPage(String(newPage));
      // Scroll to element in continuous mode
      if (viewMode === 'continuous') {
        const pageEl = document.getElementById(`pdf-page-${newPage}`);
        pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return newPage;
    });
  }, [numPages, viewMode]);

  const jumpToPage = (target: number) => {
    const valid = Math.min(Math.max(1, target), numPages || 1);
    setPageNumber(valid);
    setInputPage(String(valid));
    if (viewMode === 'continuous') {
      const pageEl = document.getElementById(`pdf-page-${valid}`);
      pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleScroll = useCallback(() => {
    if (viewMode !== 'continuous' || !containerRef.current) return;
    const container = containerRef.current;
    const containerCenter = container.scrollTop + container.clientHeight / 3;
    let closestPage = pageNumber;
    let minDistance = Infinity;

    for (let p = 1; p <= (numPages || 1); p++) {
      const el = document.getElementById(`pdf-page-${p}`);
      if (el) {
        const offsetTop = el.offsetTop - container.offsetTop;
        const distance = Math.abs(offsetTop - containerCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestPage = p;
        }
      }
    }
    if (closestPage !== pageNumber) {
      setPageNumber(closestPage);
      setInputPage(String(closestPage));
    }
  }, [viewMode, numPages, pageNumber]);

  // --- 3. Zoom Controls ---
  const handleZoom = (amount: number) => {
    setScale(prev => Math.min(Math.max(0.4, prev + amount), 3.0));
  };

  const handleFitWidth = () => {
    if (containerDimensions.width > 0) {
      const targetScale = Math.min(3.0, Math.max(0.5, (containerDimensions.width - 60) / 600));
      setScale(targetScale);
    }
  };

  const handleFitPage = () => {
    if (containerDimensions.height > 0 && containerDimensions.width > 0) {
      const wScale = (containerDimensions.width - 60) / 600;
      const hScale = (containerDimensions.height - 60) / 800;
      setScale(Math.min(wScale, hScale, 2.0));
    }
  };

  const handleResetZoom = () => setScale(1.0);

  // --- 4. Fullscreen Mode ---
  const toggleFullscreen = async () => {
    if (!workspaceRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await workspaceRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Failed to enter fullscreen:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error('Failed to exit fullscreen:', err);
      }
    }
  };

  // --- 5. Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'Escape' && showSearch) {
          setShowSearch(false);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoom(0.15);
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        handleZoom(-0.15);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (viewMode === 'single') changePage(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (viewMode === 'single') changePage(1);
      } else if (e.key === 'Escape') {
        if (showSearch) setShowSearch(false);
        if (selectionMenu) setSelectionMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changePage, selectionMenu, showSearch, viewMode]);

  // --- 6. Search Match Logic ---
  useEffect(() => {
    if (!searchQuery.trim() || !activeDocument?.extractedText) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const lines = activeDocument.extractedText.split('\n');
    const matches: { pageNumber: number; text: string }[] = [];

    const linesPerPage = Math.max(1, Math.ceil(lines.length / (numPages || 1)));
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(query)) {
        const approxPage = Math.min(numPages || 1, Math.floor(idx / linesPerPage) + 1);
        matches.push({ pageNumber: approxPage, text: line.trim() });
      }
    });

    setSearchMatches(matches);
    if (matches.length > 0) {
      setCurrentMatchIndex(0);
      jumpToPage(matches[0].pageNumber);
    } else {
      setCurrentMatchIndex(-1);
    }
  }, [searchQuery, activeDocument?.extractedText, numPages]);

  const navigateSearchMatch = (direction: 'next' | 'prev') => {
    if (searchMatches.length === 0) return;
    let nextIdx = currentMatchIndex;
    if (direction === 'next') {
      nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    } else {
      nextIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    }
    setCurrentMatchIndex(nextIdx);
    jumpToPage(searchMatches[nextIdx].pageNumber);
  };

  // --- 7. Text Selection & Annotation Creation ---
  const handleMouseUp = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 0) {
      setSelectionMenu({
        x: e.clientX,
        y: Math.max(60, e.clientY - 60),
        text,
        pageNumber,
      });
    } else {
      if (!(e.target as HTMLElement)?.closest('.selection-toolbar-popup')) {
        setSelectionMenu(null);
      }
    }
  };

  const addAnnotation = (type: 'highlight' | 'underline', colorHex: string) => {
    if (!selectionMenu) return;
    const newAnnot: PDFAnnotation = {
      id: `annot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      pageNumber: selectionMenu.pageNumber,
      type,
      color: colorHex,
      text: selectionMenu.text,
      createdAt: Date.now(),
    };
    saveAnnotationsToStorage([...annotations, newAnnot]);
    setSelectionMenu(null);
    window.getSelection()?.removeAllRanges();
  };

  const removeAnnotation = (id: string) => {
    const updated = annotations.filter(a => a.id !== id);
    saveAnnotationsToStorage(updated);
  };

  const makeCustomTextRenderer = useCallback(
    (pageIdx: number) =>
      ({ str, itemIndex }: { str: string; itemIndex: number }) => {
        if (!str || !str.trim()) return str;
        const pageAnnotations = annotations.filter((a) => a.pageNumber === pageIdx);
        if (!pageAnnotations.length) return str;

        for (const annot of pageAnnotations) {
          if (
            annot.text &&
            (str.toLowerCase().includes(annot.text.toLowerCase()) ||
              annot.text.toLowerCase().includes(str.toLowerCase()))
          ) {
            const isUnderline = annot.type === 'underline';
            return (
              <mark
                key={annot.id + '_' + itemIndex}
                style={{
                  backgroundColor: isUnderline ? 'transparent' : annot.color,
                  borderBottom: isUnderline ? '3px solid #8F477B' : 'none',
                  color: 'inherit',
                  padding: '0 2px',
                  borderRadius: '4px',
                }}
              >
                {str}
              </mark>
            );
          }
        }
        return str;
      },
    [annotations]
  );

  // --- 8. AI Actions on Selection ---
  const handleAIExplain = async () => {
    if (!selectionMenu) return;
    const selectionText = selectionMenu.text;
    setSelectionMenu(null);
    setAiModal({
      open: true,
      title: `Concept Explanation`,
      content: 'Dazai is analyzing and explaining this concept...',
      isLoading: true,
    });

    try {
      const promptText = `Explain this concept clearly and concisely for a student studying "${activeDocument.name}":\n\n"${selectionText}"`;
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: promptText }],
          message: promptText,
          documentContext: activeDocument.extractedText?.slice(0, 3000),
          character: 'Dazai',
        }),
      });
      const data = await res.json();
      setAiModal({
        open: true,
        title: '💡 Dazai’s Concept Explanation',
        content: data.reply || data.dialogue || data.error || 'Here is the explanation for the concept.',
        isLoading: false,
      });
    } catch (err) {
      setAiModal({
        open: true,
        title: 'Error',
        content: 'Failed to fetch AI explanation. Please try again.',
        isLoading: false,
      });
    }
  };

  const handleAISummarize = async () => {
    if (!selectionMenu) return;
    const selectionText = selectionMenu.text;
    setSelectionMenu(null);
    setAiModal({
      open: true,
      title: 'Quick Summary',
      content: 'Dazai is condensing this passage...',
      isLoading: true,
    });

    try {
      const promptText = `Provide a clear, 3-bullet point summary of this text from "${activeDocument.name}":\n\n"${selectionText}"`;
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: promptText }],
          message: promptText,
          character: 'Dazai',
        }),
      });
      const data = await res.json();
      setAiModal({
        open: true,
        title: '📑 Passage Summary',
        content: data.reply || data.dialogue || data.error || 'Summary generated.',
        isLoading: false,
      });
    } catch (err) {
      setAiModal({
        open: true,
        title: 'Error',
        content: 'Failed to generate summary.',
        isLoading: false,
      });
    }
  };

  const handleCopySelection = () => {
    if (selectionMenu?.text) {
      navigator.clipboard.writeText(selectionMenu.text);
      setSelectionMenu(null);
    }
  };

  return (
    <div
      ref={workspaceRef}
      className={`flex flex-col h-full w-full rounded-2xl overflow-hidden border-3 border-[#7c6a75] shadow-2xl transition-colors ${
        readingMode === 'dark' ? 'bg-[#1e1e24] text-[#f4f2ee]' : 'bg-[#f4f2ee] text-[#5d5770]'
      }`}
    >
      {/* 1. TOP PROGRESS BAR */}
      <div className="w-full bg-[#7c6a75]/15 h-1.5 shrink-0 relative overflow-hidden">
        <div
          className="bg-[#8F477B] h-full transition-all duration-300"
          style={{ width: `${((pageNumber || 1) / (numPages || 1)) * 100}%` }}
        />
      </div>

      {/* 2. HEADER CONTROLS TOOLBAR */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#7c6a75] text-[#f4f2ee] shrink-0 border-b-2 border-[#7c6a75]/20 gap-2 flex-wrap">
        {/* Left: Sidebar, Navigation, Page Input */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowThumbnails(prev => !prev)}
            title="Toggle Thumbnails Sidebar"
            className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1 ${
              showThumbnails ? 'bg-[#ffd1dc] text-[#7c6a75] shadow' : 'bg-white/20 hover:bg-white/30 text-white'
            }`}
          >
            📑 Thumbnails
          </button>

          <div className="h-4 w-px bg-white/20 mx-1" />

          <Button
            variant="secondary"
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            className="px-2.5 py-1 text-xs bg-white text-[#7c6a75] font-black"
          >
            ◀ Prev
          </Button>

          <div className="flex items-center gap-1 text-xs font-bold">
            <span>Page</span>
            <input
              type="number"
              min={1}
              max={numPages || 1}
              value={inputPage}
              onChange={e => {
                setInputPage(e.target.value);
                const p = parseInt(e.target.value, 10);
                if (!isNaN(p)) jumpToPage(p);
              }}
              className="w-12 text-center bg-white text-[#7c6a75] font-black rounded px-1 py-0.5 border border-[#7c6a75]/30 focus:outline-none"
            />
            <span>of {numPages || '--'}</span>
          </div>

          <Button
            variant="secondary"
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages}
            className="px-2.5 py-1 text-xs bg-white text-[#7c6a75] font-black"
          >
            Next ▶
          </Button>
        </div>

        {/* Center: Search & Reading Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1 ${
              showSearch ? 'bg-[#ffd1dc] text-[#7c6a75] shadow' : 'bg-white/20 hover:bg-white/30 text-white'
            }`}
            title="Search text in PDF (Ctrl+F)"
          >
            🔍 Search
          </button>

          <button
            onClick={() => setViewMode(prev => (prev === 'single' ? 'continuous' : 'single'))}
            className="px-2.5 py-1 rounded-lg text-xs font-black uppercase bg-white/20 hover:bg-white/30 text-white transition-all"
            title="Toggle Single-Page or Continuous Scroll"
          >
            {viewMode === 'single' ? '📄 Single' : '📜 Continuous'}
          </button>

          <button
            onClick={() => setReadingMode(prev => (prev === 'light' ? 'dark' : 'light'))}
            className="px-2.5 py-1 rounded-lg text-xs font-black uppercase bg-white/20 hover:bg-white/30 text-white transition-all"
            title="Toggle Light / Dark reading mode"
          >
            {readingMode === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>

        {/* Right: Zoom & Fullscreen Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleZoom(-0.2)}
            className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 text-white rounded font-bold transition-all"
            title="Zoom Out"
          >
            -
          </button>
          <span className="text-xs font-black min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => handleZoom(0.2)}
            className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 text-white rounded font-bold transition-all"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleFitWidth}
            className="px-2 py-1 text-[11px] font-black uppercase bg-white/20 hover:bg-white/30 text-white rounded transition-all"
            title="Fit Width"
          >
            Fit Width
          </button>
          <button
            onClick={handleFitPage}
            className="px-2 py-1 text-[11px] font-black uppercase bg-white/20 hover:bg-white/30 text-white rounded transition-all"
            title="Fit Page"
          >
            Fit Page
          </button>
          <button
            onClick={handleResetZoom}
            className="px-2 py-1 text-[11px] font-black uppercase bg-white/20 hover:bg-white/30 text-white rounded transition-all"
            title="Reset Zoom to 100%"
          >
            100%
          </button>

          <div className="h-4 w-px bg-white/20 mx-1" />

          <button
            onClick={toggleFullscreen}
            className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 text-white rounded font-bold transition-all"
            title="Toggle Fullscreen Reading Mode (Esc to exit)"
          >
            {isFullscreen ? '✕ Exit' : '⛶ Fullscreen'}
          </button>
        </div>
      </div>

      {/* 3. SEARCH BAR BAR */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white/90 dark:bg-[#2b2b34] border-b-2 border-[#7c6a75]/20 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0"
          >
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <span className="text-sm">🔍</span>
              <input
                type="text"
                placeholder="Search words or phrases in document..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-white dark:bg-[#1e1e24] border-2 border-[#7c6a75]/30 rounded-lg px-3 py-1 text-xs text-[#5d5770] dark:text-[#f4f2ee] font-bold focus:outline-none focus:border-[#8F477B]"
              />
            </div>

            <div className="flex items-center gap-2">
              {searchMatches.length > 0 ? (
                <span className="text-xs font-black text-[#5d5770] dark:text-[#f4f2ee]">
                  Match {currentMatchIndex + 1} of {searchMatches.length} (Page {searchMatches[currentMatchIndex]?.pageNumber})
                </span>
              ) : searchQuery ? (
                <span className="text-xs font-bold text-red-500">No matches found</span>
              ) : null}

              <Button
                variant="secondary"
                onClick={() => navigateSearchMatch('prev')}
                disabled={searchMatches.length === 0}
                className="px-2.5 py-1 text-[11px] font-black"
              >
                ◀ Prev
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigateSearchMatch('next')}
                disabled={searchMatches.length === 0}
                className="px-2.5 py-1 text-[11px] font-black"
              >
                Next ▶
              </Button>
              <button
                onClick={() => setShowSearch(false)}
                className="text-[#5d5770]/60 hover:text-red-500 font-bold px-2 py-1 text-xs ml-2"
              >
                ✕ Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. MAIN WORKSPACE AREA (THUMBNAILS SIDEBAR + PDF CANVAS) */}
      <div className="flex-1 flex overflow-hidden relative" onMouseUp={handleMouseUp}>
        {/* Left Thumbnails Sidebar */}
        <AnimatePresence>
          {showThumbnails && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 170, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-white/70 dark:bg-[#2b2b34] border-r-2 border-[#7c6a75]/20 shrink-0 overflow-y-auto p-2 custom-scrollbar flex flex-col gap-3"
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-[#5d5770] dark:text-white/70 px-1 border-b pb-1">
                Pages ({numPages || 0})
              </div>
              <Document file={file} className="flex flex-col gap-3 items-center">
                {Array.from(new Array(numPages), (_, i) => i + 1).map(p => (
                  <div
                    key={p}
                    onClick={() => jumpToPage(p)}
                    className={`cursor-pointer rounded-lg overflow-hidden border-2 p-1 transition-all flex flex-col items-center ${
                      pageNumber === p
                        ? 'border-[#8F477B] shadow-md bg-[#ffd1dc]/40 dark:bg-[#8F477B]/30'
                        : 'border-transparent hover:border-[#7c6a75]/40 bg-white/50 dark:bg-black/20'
                    }`}
                  >
                    <Page
                      pageNumber={p}
                      scale={0.18}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="rounded shadow-sm"
                    />
                    <span className="text-[10px] font-black mt-1 text-[#5d5770] dark:text-[#f4f2ee]">Page {p}</span>
                  </div>
                ))}
              </Document>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PDF Document Render Container */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className={`flex-1 overflow-auto p-6 relative custom-scrollbar ${
            readingMode === 'dark' ? 'bg-[#121217]' : 'bg-black/10'
          }`}
        >
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center my-20 gap-3">
                <div className="w-8 h-8 border-4 border-[#8F477B] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-black uppercase text-[#5d5770] dark:text-white tracking-wider">
                  Loading PDF Workspace...
                </span>
              </div>
            }
            error={
              <div className="text-red-500 font-bold my-20 text-center">
                Failed to load PDF file.
              </div>
            }
            className="flex flex-col items-center gap-8 w-full min-h-max"
          >
            {viewMode === 'single' ? (
              <div className="relative shadow-2xl rounded-lg overflow-hidden bg-white shrink-0">
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  customTextRenderer={makeCustomTextRenderer(pageNumber)}
                  className="rounded"
                />
              </div>
            ) : (
              // Continuous Vertical Scroll Mode
              Array.from(new Array(numPages), (_, i) => i + 1).map(p => {
                const isNearby = Math.abs(p - pageNumber) <= 4;
                return (
                  <div
                    key={p}
                    id={`pdf-page-${p}`}
                    onClick={() => {
                      setPageNumber(p);
                      setInputPage(String(p));
                    }}
                    className={`relative shadow-2xl rounded-lg overflow-hidden bg-white transition-all shrink-0 ${
                      pageNumber === p ? 'ring-4 ring-[#8F477B]/50' : ''
                    }`}
                  >
                    {isNearby ? (
                      <Page
                        pageNumber={p}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        customTextRenderer={makeCustomTextRenderer(p)}
                        className="rounded"
                      />
                    ) : (
                      <div
                        style={{ width: 600 * scale, height: 800 * scale }}
                        className="flex flex-col items-center justify-center bg-white text-[#7c6a75] gap-3 p-8 border border-[#7c6a75]/20 rounded-lg"
                      >
                        <div className="w-6 h-6 border-2 border-[#7c6a75] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-black uppercase tracking-wider">
                          Page {p} (Scroll to render)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </Document>

          {/* Persistent Annotations Header / Badge Panel & Drawer */}
          {annotations.length > 0 && (
            <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
              <div className="bg-white/95 dark:bg-[#2b2b34]/95 border-2 border-[#7c6a75] rounded-xl px-3 py-1.5 shadow-md flex items-center gap-2">
                <button
                  onClick={() => setShowAnnotationsDrawer(!showAnnotationsDrawer)}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  <span className="text-xs">🖍️</span>
                  <span className="text-[10px] font-black uppercase text-[#5d5770] dark:text-[#f4f2ee]">
                    {annotations.length} Annotation{annotations.length !== 1 ? 's' : ''} saved
                  </span>
                </button>
                <button
                  onClick={() => {
                    if (confirm('Clear all highlights and underlines in this document?')) {
                      saveAnnotationsToStorage([]);
                      setShowAnnotationsDrawer(false);
                    }
                  }}
                  className="text-[10px] font-bold text-red-500 hover:underline ml-1 border-l border-gray-300 pl-2"
                >
                  Clear
                </button>
              </div>

              {showAnnotationsDrawer && (
                <div className="w-80 max-h-96 bg-white dark:bg-[#2b2b34] border-2 border-[#7c6a75] rounded-xl shadow-xl overflow-y-auto p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b pb-2 border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-black uppercase text-[#5d5770] dark:text-[#f4f2ee]">
                      Saved Annotations
                    </span>
                    <button
                      onClick={() => setShowAnnotationsDrawer(false)}
                      className="text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      ✕
                    </button>
                  </div>
                  {annotations.map((annot) => (
                    <div
                      key={annot.id}
                      className="flex items-start justify-between gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => jumpToPage(annot.pageNumber)}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="w-3 h-3 rounded-full inline-block shrink-0 border border-gray-300"
                            style={{ backgroundColor: annot.type === 'underline' ? '#8F477B' : annot.color }}
                          />
                          <span className="font-bold text-[10px] uppercase text-gray-500 dark:text-gray-400">
                            Page {annot.pageNumber} • {annot.type}
                          </span>
                        </div>
                        <p className="line-clamp-2 italic text-[#3e3835] dark:text-gray-200">
                          "{annot.text}"
                        </p>
                      </div>
                      <button
                        onClick={() => removeAnnotation(annot.id)}
                        className="text-gray-400 hover:text-red-500 text-sm px-1 font-bold"
                        title="Delete annotation"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. FLOATING SELECTION TOOLBAR FOR HIGHLIGHTS & AI */}
      <AnimatePresence>
        {selectionMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            style={{ top: selectionMenu.y, left: Math.min(window.innerWidth - 320, Math.max(20, selectionMenu.x - 160)) }}
            className="selection-toolbar-popup fixed z-[9999] bg-white dark:bg-[#2b2b34] border-3 border-[#7c6a75] rounded-2xl shadow-[0_8px_0_#7c6a75] p-2 flex flex-col gap-2 max-w-md font-fredoka"
          >
            {/* Color Highlights & Underline Row */}
            <div className="flex items-center justify-between border-b border-[#7c6a75]/20 pb-1.5 px-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-[#5d5770] dark:text-[#f4f2ee] mr-1">Highlight:</span>
                {HIGHLIGHT_COLORS.map(c => (
                  <button
                    key={c.name}
                    onClick={() => addAnnotation('highlight', c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className="w-5 h-5 rounded-full border-2 border-[#7c6a75]/50 hover:scale-125 transition-transform shadow-sm"
                    title={`Highlight ${c.name}`}
                  />
                ))}
              </div>

              <div className="h-4 w-px bg-[#7c6a75]/20 mx-1" />

              <div className="flex items-center gap-1">
                <button
                  onClick={() => addAnnotation('underline', '#8F477B')}
                  className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#7c6a75]/10 hover:bg-[#7c6a75]/20 text-[#7c6a75] dark:text-[#f4f2ee] transition-all"
                  title="Underline Text"
                >
                  U̲ Underline
                </button>

                <button
                  onClick={handleCopySelection}
                  className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#7c6a75]/10 hover:bg-[#7c6a75]/20 text-[#7c6a75] dark:text-[#f4f2ee] transition-all"
                  title="Copy Selected Text"
                >
                  📋 Copy
                </button>
              </div>
            </div>

            {/* AI Action Quick Buttons */}
            <div className="flex items-center justify-between gap-1">
              <button
                onClick={handleAIExplain}
                className="flex-1 bg-[#ffd1dc] hover:bg-[#ffb6c8] text-[#7c6a75] font-black text-[10px] uppercase py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                title="Ask Dazai to explain this concept"
              >
                <span>💡</span> Explain
              </button>
              <button
                onClick={handleAISummarize}
                className="flex-1 bg-[#ffd1dc] hover:bg-[#ffb6c8] text-[#7c6a75] font-black text-[10px] uppercase py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                title="Condense selection into quick bullet points"
              >
                <span>📑</span> Summarize
              </button>
              <button
                onClick={() => {
                  if (onAddToPersonalNotes && selectionMenu) {
                    onAddToPersonalNotes(selectionMenu.text, selectionMenu.pageNumber);
                    setSelectionMenu(null);
                  }
                }}
                className="flex-1 bg-white hover:bg-gray-50 dark:bg-black/20 text-[#8F477B] border border-[#8F477B]/30 font-black text-[10px] uppercase py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                title="Add to your personal notes in right sidebar"
              >
                <span>📝</span> +Notes
              </button>
              <button
                onClick={() => {
                  if (onGenerateFlashcardFromSelection && selectionMenu) {
                    onGenerateFlashcardFromSelection(selectionMenu.text);
                    setSelectionMenu(null);
                  }
                }}
                className="flex-1 bg-[#8F477B] hover:bg-[#7a3b68] text-white font-black text-[10px] uppercase py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                title="Create a Flashcard from selection"
              >
                <span>🎴</span> Card
              </button>
              <button
                onClick={() => {
                  if (onTriggerQuizFromSelection && selectionMenu) {
                    onTriggerQuizFromSelection(selectionMenu.text);
                    setSelectionMenu(null);
                  }
                }}
                className="flex-1 bg-[#8F477B] hover:bg-[#7a3b68] text-white font-black text-[10px] uppercase py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                title="Generate Quiz Questions from selection"
              >
                <span>🎯</span> Quiz
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. AI EXPLANATION / SUMMARY MODAL */}
      <AnimatePresence>
        {aiModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-fredoka"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#2b2b34] border-3 border-[#7c6a75] rounded-3xl shadow-[0_12px_0_#7c6a75] p-6 max-w-lg w-full flex flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b-2 border-[#7c6a75]/20 pb-3">
                <h3 className="text-sm font-black text-[#8F477B] uppercase tracking-wider flex items-center gap-2">
                  {aiModal.title}
                </h3>
                <button
                  onClick={() => setAiModal(null)}
                  className="text-[#5d5770] hover:text-red-500 font-black text-sm px-2 py-1"
                >
                  ✕
                </button>
              </div>

              {aiModal.isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-8 h-8 border-4 border-[#8F477B] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold text-[#5d5770] dark:text-white">{aiModal.content}</p>
                </div>
              ) : (
                <div className="text-xs text-[#5d5770] dark:text-[#f4f2ee] font-bold leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto custom-scrollbar p-2 bg-[#f4f2ee] dark:bg-black/20 rounded-xl border border-[#7c6a75]/20">
                  {aiModal.content}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#7c6a75]/10">
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(aiModal.content);
                  }}
                  className="text-xs py-1.5 px-3 font-bold"
                >
                  📋 Copy
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setAiModal(null)}
                  className="text-xs py-1.5 px-4 font-black"
                >
                  Got it!
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
