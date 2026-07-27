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
import { cleanAIResponseText } from '@/lib/utils/clean-response';

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

const safeArray = (val: any): any[] => (Array.isArray(val) ? val : []);

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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [searchMatches, setSearchMatches] = useState<{ pageNumber: number; text: string }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Annotations & AI Toolbar State
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);
  const [undoStack, setUndoStack] = useState<PDFAnnotation[][]>([]);
  const [redoStack, setRedoStack] = useState<PDFAnnotation[][]>([]);
  const [showAnnotationsDrawer, setShowAnnotationsDrawer] = useState<boolean>(false);
  const [copyToast, setCopyToast] = useState<boolean>(false);
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
        setUndoStack([]);
        setRedoStack([]);

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
    async function saveAnnotationsToStorage(updatedAnnotations: PDFAnnotation[], recordHistory = true) {
      if (recordHistory) {
        setUndoStack(prev => [...prev.slice(-30), annotations]);
        setRedoStack([]);
      }
      setAnnotations(updatedAnnotations);
      if (activeDocument?.id) {
        await savePDFAnnotations(activeDocument.id, updatedAnnotations);
      }
    },
    [activeDocument?.id, annotations]
  );

  const handleUndo = useCallback(function handleUndo() {
    if (undoStack.length === 0) return;
    const prevAnnotations = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev.slice(-30), annotations]);
    saveAnnotationsToStorage(prevAnnotations, false);
  }, [undoStack, annotations, saveAnnotationsToStorage]);

  const handleRedo = useCallback(function handleRedo() {
    if (redoStack.length === 0) return;
    const nextAnnotations = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev.slice(-30), annotations]);
    saveAnnotationsToStorage(nextAnnotations, false);
  }, [redoStack, annotations, saveAnnotationsToStorage]);

  const addAnnotation = useCallback(function addAnnotation(type: 'highlight' | 'underline', colorHex: string) {
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
  }, [selectionMenu, annotations, saveAnnotationsToStorage]);

  const removeAnnotation = useCallback(function removeAnnotation(id: string) {
    const updated = annotations.filter(a => a.id !== id);
    saveAnnotationsToStorage(updated);
  }, [annotations, saveAnnotationsToStorage]);

  const handleCopySelection = useCallback(function handleCopySelection() {
    if (selectionMenu?.text) {
      navigator.clipboard.writeText(selectionMenu.text);
      setSelectionMenu(null);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    }
  }, [selectionMenu]);

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

      // Quick annotation shortcuts when text is selected!
      if (selectionMenu) {
        if (e.key === '1' || e.key.toLowerCase() === 'y') {
          e.preventDefault();
          addAnnotation('highlight', '#fef08a');
          return;
        } else if (e.key === '2' || e.key.toLowerCase() === 'g') {
          e.preventDefault();
          addAnnotation('highlight', '#bbf7d0');
          return;
        } else if (e.key === '3' || e.key.toLowerCase() === 'p') {
          e.preventDefault();
          addAnnotation('highlight', '#fbcfe8');
          return;
        } else if (e.key === '4' || e.key.toLowerCase() === 'b') {
          e.preventDefault();
          addAnnotation('highlight', '#bfdbfe');
          return;
        } else if (e.key === '5') {
          e.preventDefault();
          addAnnotation('highlight', '#e9d5ff');
          return;
        } else if (e.key.toLowerCase() === 'u') {
          e.preventDefault();
          addAnnotation('underline', '#8F477B');
          return;
        } else if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          handleCopySelection();
          return;
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoom(0.15);
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        handleZoom(-0.15);
      } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        handleResetZoom();
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
  }, [changePage, selectionMenu, showSearch, viewMode, addAnnotation, handleCopySelection, handleZoom, handleResetZoom, handleUndo, handleRedo]);

  // --- 6. Search Match Logic ---
  useEffect(() => {
    if (!debouncedSearchQuery.trim() || !activeDocument?.extractedText) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const query = debouncedSearchQuery.trim().toLowerCase();
    const pages = activeDocument.extractedText.split('\n\n');
    const matches: { pageNumber: number; text: string }[] = [];

    if (pages.length > 1 || (numPages || 1) === 1) {
      pages.forEach((pageText, pageIdx) => {
        const pageNum = Math.min(numPages || 1, pageIdx + 1);
        const lines = pageText.split('\n');
        lines.forEach((line) => {
          if (line.toLowerCase().includes(query)) {
            matches.push({ pageNumber: pageNum, text: line.trim() });
          }
        });
      });
    } else {
      // Fallback for documents extracted without \n\n page delimiters
      const lines = activeDocument.extractedText.split('\n');
      const linesPerPage = Math.max(1, Math.ceil(lines.length / (numPages || 1)));
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(query)) {
          const approxPage = Math.min(numPages || 1, Math.floor(idx / linesPerPage) + 1);
          matches.push({ pageNumber: approxPage, text: line.trim() });
        }
      });
    }

    setSearchMatches(matches);
    if (matches.length > 0) {
      setCurrentMatchIndex(0);
      jumpToPage(matches[0].pageNumber);
    } else {
      setCurrentMatchIndex(-1);
    }
  }, [debouncedSearchQuery, activeDocument?.extractedText, numPages]);

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

  const scrollToActiveMatch = useCallback(() => {
    if (showSearch && searchMatches.length > 0 && currentMatchIndex >= 0) {
      const activeMatch = searchMatches[currentMatchIndex];
      if (!activeMatch) return;

      const pageEl = document.getElementById(`pdf-page-${activeMatch.pageNumber}`);
      const matchEl = pageEl?.querySelector('.search-highlight') || containerRef.current?.querySelector('.search-highlight');
      if (matchEl) {
        matchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [showSearch, searchMatches, currentMatchIndex]);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToActiveMatch();
    }, 250);
    return () => clearTimeout(timer);
  }, [currentMatchIndex, scrollToActiveMatch]);

  const handlePageRenderSuccess = useCallback((pageNum: number) => {
    if (showSearch && searchMatches.length > 0 && currentMatchIndex >= 0) {
      const activeMatch = searchMatches[currentMatchIndex];
      if (activeMatch && activeMatch.pageNumber === pageNum) {
        setTimeout(() => {
          scrollToActiveMatch();
        }, 100);
      }
    }
  }, [showSearch, searchMatches, currentMatchIndex, scrollToActiveMatch]);

  // --- 7. Text Selection & Annotation Creation ---
  const handleMouseUp = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 0) {
      let targetPageNum = pageNumber;
      const anchorNode = selection?.anchorNode;
      if (anchorNode) {
        const el = anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement;
        const pageEl = el?.closest('[id^="pdf-page-"], .react-pdf__Page');
        if (pageEl) {
          const idNum = pageEl.id?.replace('pdf-page-', '');
          const dataNum = pageEl.getAttribute('data-page-number');
          const parsed = parseInt(idNum || dataNum || '', 10);
          if (!isNaN(parsed) && parsed > 0) {
            targetPageNum = parsed;
          }
        }
      }

      setSelectionMenu({
        x: e.clientX,
        y: Math.max(60, e.clientY - 60),
        text,
        pageNumber: targetPageNum,
      });
    } else {
      if (!(e.target as HTMLElement)?.closest('.selection-toolbar-popup')) {
        setSelectionMenu(null);
      }
    }
  };

  const hexToRgba = (hex: string, alpha = 0.55) => {
    if (!hex || !hex.startsWith('#')) return hex;
    let c = hex.substring(1);
    if (c.length === 3) c = c.split('').map(char => char + char).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return hex;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const makeCustomTextRenderer = useCallback(
    (pageIdx: number) =>
      ({ str }: { str: string; itemIndex: number }) => {
        if (!str || !str.trim()) return str;

        let html = str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');

        const pageAnnotations = safeArray(annotations).filter((a) => a?.pageNumber === pageIdx);
        if (pageAnnotations.length > 0) {
          for (const annot of pageAnnotations) {
            if (!annot.text || !annot.text.trim()) continue;
            const annotTextLower = annot.text.trim().toLowerCase();
            const strLower = str.toLowerCase();

            if (strLower.includes(annotTextLower) || annotTextLower.includes(strLower)) {
              let shouldHighlight = false;
              if (strLower.includes(annotTextLower)) {
                shouldHighlight = true;
              } else if (annotTextLower.includes(strLower)) {
                const cleanStr = str.trim().toLowerCase();
                const words = annotTextLower.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, ''));
                const matchesWord = words.some(w => w === cleanStr || w.startsWith(cleanStr) || w.endsWith(cleanStr));
                if (matchesWord || cleanStr.length > 2) {
                  shouldHighlight = true;
                }
              }

              if (shouldHighlight) {
                const isUnderline = annot.type === 'underline';
                const style = isUnderline
                  ? 'background-color: transparent; border-bottom: 3px solid #8F477B; color: transparent !important; padding: 0 2px; border-radius: 4px;'
                  : `background-color: ${hexToRgba(annot.color, 0.5)}; color: transparent !important; mix-blend-mode: multiply; padding: 0 2px; border-radius: 3px;`;

                if (strLower.includes(annotTextLower)) {
                  const escapedAnnot = annot.text.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                  const regex = new RegExp(`(<[^>]*>)|(${escapedAnnot})`, 'gi');
                  html = html.replace(regex, (match, tag, word) => {
                    if (tag) return tag;
                    if (word !== undefined) {
                      return `<mark class="annotation-highlight" style="${style}">${word}</mark>`;
                    }
                    return match;
                  });
                } else {
                  if (!html.startsWith('<mark')) {
                    html = `<mark class="annotation-highlight" style="${style}">${html}</mark>`;
                  }
                }
              }
            }
          }
        }

        const query = debouncedSearchQuery.trim().toLowerCase();
        if (query && str.toLowerCase().includes(query)) {
          const isActivePage = currentMatchIndex >= 0 && searchMatches[currentMatchIndex]?.pageNumber === pageIdx;
          const bg = isActivePage ? '#fb923c' : '#fef08a';
          const shadow = isActivePage ? '0 0 6px rgba(251, 146, 60, 0.8)' : 'none';
          const style = `background-color: ${hexToRgba(bg, 0.55)}; color: transparent !important; mix-blend-mode: multiply; padding: 0 2px; border-radius: 3px; box-shadow: ${shadow};`;

          const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`(<[^>]*>)|(${escapedQuery})`, 'gi');
          html = html.replace(regex, (match, tag, word) => {
            if (tag) return tag;
            if (word !== undefined) {
              return `<mark class="search-highlight" style="${style}">${word}</mark>`;
            }
            return match;
          });
        }

        return html;
      },
    [annotations, debouncedSearchQuery, currentMatchIndex, searchMatches]
  );

  // --- 8. Helper & AI Actions on Selection ---
  const getApiKey = () => {
    const defaultKey = ['AQ.', 'Ab8RN6JmNWkwSA8lNHxeHcdfNWksAfOh', 'ckiM6mOA1t94B96baA'].join('');
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_GEMINI_API_KEY || defaultKey;
    return (
      localStorage.getItem('dazai_openai_api_key') ||
      localStorage.getItem('dazai_gemini_api_key') ||
      localStorage.getItem('dazai_api_key') ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      defaultKey
    );
  };

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
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: selectionText,
          contextText: activeDocument.extractedText || '',
          documentName: activeDocument.name,
          apiKey: getApiKey(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error?.includes('API key is missing')) {
        setAiModal({
          open: true,
          title: '⚠️ AI API Key is Missing',
          content: 'Please open Settings (the gear icon in the top right of Dazai OS) and enter your OpenAI or Google Gemini API key under AI Settings, or configure it in your environment variables (.env.local).\n\nOnce configured, Dazai will be ready to explain, summarize, create notes, flashcards, and quizzes from your study materials!',
          isLoading: false,
        });
        return;
      }
      const cleanContent = cleanAIResponseText(data.text || data.reply || data.dialogue || data.error);
      setAiModal({
        open: true,
        title: '💡 Dazai’s Concept Explanation',
        content: cleanContent || 'Here is the explanation for the concept.',
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
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: selectionText,
          contextText: activeDocument.extractedText || '',
          documentName: activeDocument.name,
          apiKey: getApiKey(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error?.includes('API key is missing')) {
        setAiModal({
          open: true,
          title: '⚠️ AI API Key is Missing',
          content: 'Please open Settings (the gear icon in the top right of Dazai OS) and enter your OpenAI or Google Gemini API key under AI Settings, or configure it in your environment variables (.env.local).\n\nOnce configured, Dazai will be ready to explain, summarize, create notes, flashcards, and quizzes from your study materials!',
          isLoading: false,
        });
        return;
      }
      const cleanSummary = cleanAIResponseText(data.text || data.reply || data.summary || data.error);
      setAiModal({
        open: true,
        title: '📑 Passage Summary',
        content: cleanSummary || 'Summary generated.',
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

  const handleAIGenerateNotes = async () => {
    if (!selectionMenu) return;
    const selectionText = selectionMenu.text;
    const pageNum = selectionMenu.pageNumber;
    setSelectionMenu(null);
    setAiModal({
      open: true,
      title: 'Generating AI Study Notes',
      content: 'Dazai is extracting key takeaways from this passage for your AI Notes panel...',
      isLoading: true,
    });

    try {
      const promptText = `Generate concise, high-yield bullet point study notes from ONLY this selected passage from "${activeDocument.name}" (do not invent information outside this passage):\n\n"${selectionText}"`;
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: promptText }],
          message: promptText,
          character: 'Dazai',
          apiKey: getApiKey(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error?.includes('API key is missing')) {
        setAiModal({
          open: true,
          title: '⚠️ AI API Key is Missing',
          content: 'Please open Settings (the gear icon in the top right of Dazai OS) and enter your OpenAI or Google Gemini API key under AI Settings, or configure it in your environment variables (.env.local).\n\nOnce configured, Dazai will be ready to explain, summarize, create notes, flashcards, and quizzes from your study materials!',
          isLoading: false,
        });
        return;
      }

      const generatedNote = data.reply || data.dialogue || data.error || 'Note generated.';
      if (onAddToPersonalNotes) {
        onAddToPersonalNotes(`[AI Note - Page ${pageNum}]\n${generatedNote}`, pageNum);
      }
      setAiModal({
        open: true,
        title: '📝 AI Study Note Saved!',
        content: `${generatedNote}\n\n✅ Added to your Notes Panel!`,
        isLoading: false,
      });
    } catch (err) {
      setAiModal({
        open: true,
        title: 'Error',
        content: 'Failed to generate AI study note.',
        isLoading: false,
      });
    }
  };

  const handleAIGenerateCard = async () => {
    if (!selectionMenu) return;
    const selectionText = selectionMenu.text;
    setSelectionMenu(null);
    setAiModal({
      open: true,
      title: 'Generating Flashcards',
      content: 'Dazai is creating flashcards from this passage...',
      isLoading: true,
    });

    try {
      const res = await fetch('/api/ai/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: selectionText,
          apiKey: getApiKey(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error?.includes('API key is missing')) {
        setAiModal({
          open: true,
          title: '⚠️ AI API Key is Missing',
          content: 'Please open Settings (the gear icon in the top right of Dazai OS) and enter your OpenAI or Google Gemini API key under AI Settings, or configure it in your environment variables (.env.local).\n\nOnce configured, Dazai will be ready to explain, summarize, create notes, flashcards, and quizzes from your study materials!',
          isLoading: false,
        });
        return;
      }

      const cards = data.flashcards || [];
      if (cards.length > 0) {
        const formatted = cards
          .map((c: any, i: number) => `**Card ${i + 1}**\nQ: ${c.front}\nA: ${c.back}`)
          .join('\n\n---\n\n');
        setAiModal({
          open: true,
          title: `🎴 Generated ${cards.length} Flashcard(s)`,
          content: formatted,
          isLoading: false,
        });
      } else {
        setAiModal({
          open: true,
          title: '🎴 Flashcards',
          content: 'No flashcards could be generated from this brief passage.',
          isLoading: false,
        });
      }
    } catch (err) {
      setAiModal({
        open: true,
        title: 'Error',
        content: 'Failed to generate flashcard.',
        isLoading: false,
      });
    }
  };

  const handleAIGenerateQuiz = async () => {
    if (!selectionMenu) return;
    const selectionText = selectionMenu.text;
    setSelectionMenu(null);
    setAiModal({
      open: true,
      title: 'Generating Passage Quiz',
      content: 'Dazai is crafting a quiz question from this selection...',
      isLoading: true,
    });

    try {
      const res = await fetch('/api/ai/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentContext: selectionText,
          topic: activeDocument.name,
          apiKey: getApiKey(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error?.includes('API key is missing')) {
        setAiModal({
          open: true,
          title: '⚠️ AI API Key is Missing',
          content: 'Please open Settings (the gear icon in the top right of Dazai OS) and enter your OpenAI or Google Gemini API key under AI Settings, or configure it in your environment variables (.env.local).\n\nOnce configured, Dazai will be ready to explain, summarize, create notes, flashcards, and quizzes from your study materials!',
          isLoading: false,
        });
        return;
      }

      const q = data.question;
      if (q) {
        const formatted = `**Question:** ${q.questionText}\n\n**Options:**\n${(q.options || [])
          .map((opt: string, idx: number) => `${idx + 1}. ${opt}`)
          .join('\n')}\n\n**Correct Answer:** ${q.correctAnswer}\n\n*${q.explanation || ''}*`;
        setAiModal({
          open: true,
          title: '🎯 Passage Quiz Question',
          content: formatted,
          isLoading: false,
        });
      } else {
        setAiModal({
          open: true,
          title: '🎯 Quiz',
          content: 'No quiz question could be generated from this selection.',
          isLoading: false,
        });
      }
    } catch (err) {
      setAiModal({
        open: true,
        title: 'Error',
        content: 'Failed to generate quiz question.',
        isLoading: false,
      });
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

        {/* Center: Search, Undo/Redo & Reading Mode Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="px-2 py-1 rounded-lg text-xs font-black uppercase bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:hover:bg-white/20 text-white transition-all flex items-center gap-1"
            title="Undo last annotation (Ctrl+Z)"
          >
            ↩ Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="px-2 py-1 rounded-lg text-xs font-black uppercase bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:hover:bg-white/20 text-white transition-all flex items-center gap-1"
            title="Redo annotation (Ctrl+Y)"
          >
            ↪ Redo
          </button>

          <div className="h-4 w-px bg-white/20 mx-0.5" />

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
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) {
                      navigateSearchMatch('prev');
                    } else {
                      navigateSearchMatch('next');
                    }
                  }
                }}
                autoFocus
                className="w-full bg-white dark:bg-[#1e1e24] border-2 border-[#7c6a75]/30 rounded-lg px-3 py-1 text-xs text-[#5d5770] dark:text-[#f4f2ee] font-bold focus:outline-none focus:border-[#8F477B]"
              />
            </div>

            <div className="flex items-center gap-2">
              {searchMatches.length > 0 ? (
                <span className="text-xs font-black text-[#5d5770] dark:text-[#f4f2ee]">
                  {currentMatchIndex + 1} of {searchMatches.length} (Page {searchMatches[currentMatchIndex]?.pageNumber})
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
                  key={`page_${pageNumber}_${scale}_${debouncedSearchQuery}_${currentMatchIndex}_${safeArray(annotations).filter(a => a?.pageNumber === pageNumber).map(a => `${a?.id}-${a?.color}-${a?.type}`).join('_')}`}
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  customTextRenderer={makeCustomTextRenderer(pageNumber)}
                  onRenderSuccess={() => handlePageRenderSuccess(pageNumber)}
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
                        key={`page_${p}_${scale}_${debouncedSearchQuery}_${currentMatchIndex}_${safeArray(annotations).filter(a => a?.pageNumber === p).map(a => `${a?.id}-${a?.color}-${a?.type}`).join('_')}`}
                        pageNumber={p}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        customTextRenderer={makeCustomTextRenderer(p)}
                        onRenderSuccess={() => handlePageRenderSuccess(p)}
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
                  {safeArray(annotations).map((annot) => (
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
                onClick={handleAIGenerateNotes}
                className="flex-1 bg-white hover:bg-gray-50 dark:bg-black/20 text-[#8F477B] border border-[#8F477B]/30 font-black text-[10px] uppercase py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                title="Add AI-generated study note to your notes panel"
              >
                <span>📝</span> +Notes
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
              className="bg-white dark:bg-[#2b2b34] border-3 border-[#7c6a75] rounded-3xl shadow-[0_12px_0_#7c6a75] p-6 max-w-2xl w-full flex flex-col gap-4"
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
                  <p className="text-base font-bold text-[#5d5770] dark:text-white">{aiModal.content}</p>
                </div>
              ) : (
                <div className="text-[18px] text-[#5d5770] dark:text-[#f4f2ee] font-medium leading-[1.8] whitespace-pre-wrap max-h-[60vh] overflow-y-auto custom-scrollbar p-5 bg-[#f4f2ee] dark:bg-black/20 rounded-2xl border border-[#7c6a75]/20 space-y-3">
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

      {/* Copy Confirmation Toast */}
      {copyToast && (
        <div className="absolute bottom-6 right-6 z-50 bg-[#7c6a75] text-[#f4f2ee] font-black text-xs px-3.5 py-2 rounded-xl shadow-2xl border-2 border-white/20 flex items-center gap-1.5 animate-fade-in">
          <span>✓</span> Copied to clipboard!
        </div>
      )}
    </div>
  );
}
