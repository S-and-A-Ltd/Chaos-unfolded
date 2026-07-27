'use client';

import { useState, useEffect, useRef } from 'react';
import { StudyDocument } from '@/types';
import Button from '@/components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import PersonalNotesEditor from './PersonalNotesEditor';

interface NotesPanelProps {
  document: StudyDocument;
  onUpdatePersonalNotes: (notes: string) => void;
  onTriggerQuiz?: (forceRegenerate?: boolean) => void;
  externalNotesTrigger?: number;
}

type TabType = 'personal' | 'ai' | 'revision';

const safeArray = (val: any): any[] => (Array.isArray(val) ? val : []);
const safeStr = (val: any): string => (typeof val === 'string' ? val : typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val || ''));

export default function NotesPanel({ document, onUpdatePersonalNotes, onTriggerQuiz, externalNotesTrigger }: NotesPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [personalNotes, setPersonalNotes] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  
  // Highlighting & Bookmarking (Saved in localStorage)
  const [customHighlights, setCustomHighlights] = useState<string[]>([]);
  const [revisionBookmarks, setRevisionBookmarks] = useState<string[]>([]);
  
  // UI feedback states
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);

  // Scroll memory map
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMap, setScrollMap] = useState<Record<string, number>>({});

  // 1. Load saved personal notes, custom highlights, and bookmarks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedNotes = localStorage.getItem(`dazai_notes_${document.id}`) || '';
      setPersonalNotes(savedNotes);

      try {
        const hl = JSON.parse(localStorage.getItem(`dazai_notes_highlights_${document.id}`) || '[]');
        if (Array.isArray(hl)) setCustomHighlights(hl);
        
        const bm = JSON.parse(localStorage.getItem(`dazai_revision_bookmarks_${document.id}`) || '[]');
        if (Array.isArray(bm)) setRevisionBookmarks(bm);
      } catch (e) {
        console.error('Failed to parse highlights or bookmarks from storage', e);
      }
    }
  }, [document.id]);

  // 2. Handle external notes trigger
  useEffect(() => {
    if (externalNotesTrigger && externalNotesTrigger > 0) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(`dazai_notes_${document.id}`) || '' : '';
      setPersonalNotes(saved);
      setActiveTab('personal');
    }
  }, [externalNotesTrigger, document.id]);

  // 3. Scroll position memory logic
  const saveCurrentScroll = () => {
    if (containerRef.current) {
      const key = `${activeTab}_${isFullscreen ? 'fs' : 'norm'}`;
      setScrollMap(prev => ({ ...prev, [key]: containerRef.current!.scrollTop }));
    }
  };

  const handleTabSwitch = (newTab: TabType) => {
    saveCurrentScroll();
    setActiveTab(newTab);
  };

  const toggleFullscreen = () => {
    saveCurrentScroll();
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const key = `${activeTab}_${isFullscreen ? 'fs' : 'norm'}`;
        containerRef.current.scrollTop = scrollMap[key] || 0;
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [activeTab, isFullscreen]);

  // 4. Save Personal Notes
  const handleSaveNotes = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`dazai_notes_${document.id}`, personalNotes);
    }
    onUpdatePersonalNotes(personalNotes);
  };

  // 5. Highlighting Actions
  const handleCheckSelection = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() || '';
    setHasSelection(text.length > 1);
  };

  const handleAddHighlight = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text && text.length > 1) {
      if (!customHighlights.includes(text)) {
        const next = [...customHighlights, text];
        setCustomHighlights(next);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`dazai_notes_highlights_${document.id}`, JSON.stringify(next));
        }
      }
      sel?.removeAllRanges();
      setHasSelection(false);
    }
  };

  const handleRemoveHighlight = (subText: string) => {
    const next = customHighlights.filter(h => h !== subText);
    setCustomHighlights(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`dazai_notes_highlights_${document.id}`, JSON.stringify(next));
    }
  };

  const handleClearAllHighlights = () => {
    setCustomHighlights([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`dazai_notes_highlights_${document.id}`);
    }
  };

  // 6. Revision Bookmark Actions
  const toggleBookmark = (pointText: string) => {
    const clean = pointText.trim();
    let next: string[];
    if (revisionBookmarks.includes(clean)) {
      next = revisionBookmarks.filter(b => b !== clean);
    } else {
      next = [...revisionBookmarks, clean];
    }
    setRevisionBookmarks(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`dazai_revision_bookmarks_${document.id}`, JSON.stringify(next));
    }
  };

  // 7. Clipboard Copy Helpers
  const copyTextToClipboard = (text: string, labelId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(labelId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopyAll = () => {
    let allText = '';
    if (activeTab === 'ai') {
      const notes = document.aiData?.aiNotes;
      if (notes) {
        allText += `=== CHAPTER SUMMARY ===\n${safeStr(notes.chapterSummary)}\n\n`;
        allText += `=== KEY CONCEPTS ===\n` + safeArray(notes.keyConcepts).map(c => `• ${safeStr(c)}`).join('\n') + '\n\n';
        allText += `=== IMPORTANT FACTS ===\n` + safeArray(notes.importantFacts).map(f => `• ${safeStr(f)}`).join('\n') + '\n\n';
        if (safeArray(notes.frequentlyAskedQuestions).length > 0) {
          allText += `=== FREQUENTLY ASKED QUESTIONS ===\n` + safeArray(notes.frequentlyAskedQuestions).map((faq: any) => `Q: ${safeStr(faq?.question || faq)}\nA: ${safeStr(faq?.answer || '')}`).join('\n\n');
        }
      } else {
        allText = 'No AI Notes available.';
      }
    } else if (activeTab === 'revision') {
      const rev = document.aiData?.revisionNotes;
      if (rev) {
        allText += `=== ONE-LINE SUMMARIES ===\n` + safeArray(rev.oneLineSummaries).map(s => `• ${safeStr(s)}`).join('\n') + '\n\n';
        allText += `=== POINTS TO REMEMBER ===\n` + safeArray(rev.importantPoints).map(p => `• ${safeStr(p)}`).join('\n') + '\n\n';
        allText += `=== COMMON EXAM QUESTIONS ===\n` + safeArray(rev.commonExamQuestions).map(q => `• ${safeStr(q)}`).join('\n') + '\n\n';
      } else {
        allText = 'No Revision Notes available.';
      }
    } else {
      allText = personalNotes || 'No Personal Notes recorded.';
    }
    copyTextToClipboard(allText, 'all');
  };

  // 8. Export Helpers (TXT, DOCX, PDF)
  const handleExport = (format: 'txt' | 'docx' | 'pdf') => {
    setShowExportMenu(false);
    const title = `${document.name} - ${activeTab === 'ai' ? 'AI Notes' : activeTab === 'revision' ? 'Revision Notes' : 'Personal Notes'}`;
    let plainText = '';
    let htmlBody = '';

    if (activeTab === 'ai') {
      const notes = document.aiData?.aiNotes;
      if (notes) {
        plainText += `CHAPTER SUMMARY\n${safeStr(notes.chapterSummary)}\n\n`;
        plainText += `KEY CONCEPTS\n` + safeArray(notes.keyConcepts).map(c => `• ${safeStr(c)}`).join('\n') + '\n\n';
        plainText += `IMPORTANT FACTS\n` + safeArray(notes.importantFacts).map(f => `• ${safeStr(f)}`).join('\n') + '\n\n';
        if (safeArray(notes.frequentlyAskedQuestions).length > 0) {
          plainText += `FREQUENTLY ASKED QUESTIONS\n` + safeArray(notes.frequentlyAskedQuestions).map((faq: any) => `Q: ${safeStr(faq?.question || faq)}\nA: ${safeStr(faq?.answer || '')}`).join('\n\n');
        }

        htmlBody += `<h2>Chapter Summary</h2><p>${safeStr(notes.chapterSummary)}</p>`;
        htmlBody += `<h2>Key Concepts</h2><ul>` + safeArray(notes.keyConcepts).map(c => `<li>${safeStr(c)}</li>`).join('') + `</ul>`;
        htmlBody += `<h2>Important Facts</h2><ul>` + safeArray(notes.importantFacts).map(f => `<li>${safeStr(f)}</li>`).join('') + `</ul>`;
        if (safeArray(notes.frequentlyAskedQuestions).length > 0) {
          htmlBody += `<h2>Frequently Asked Questions</h2>` + safeArray(notes.frequentlyAskedQuestions).map((faq: any) => `<div style="margin-bottom: 12px;"><strong>Q: ${safeStr(faq?.question || faq)}</strong><br/><em>A: ${safeStr(faq?.answer || '')}</em></div>`).join('');
        }
      } else {
        plainText = 'No AI Notes available.';
        htmlBody = '<p>No AI Notes available.</p>';
      }
    } else if (activeTab === 'revision') {
      const rev = document.aiData?.revisionNotes;
      if (rev) {
        plainText += `ONE-LINE SUMMARIES\n` + safeArray(rev.oneLineSummaries).map(s => `• ${safeStr(s)}`).join('\n') + '\n\n';
        plainText += `POINTS TO REMEMBER\n` + safeArray(rev.importantPoints).map(p => `• ${safeStr(p)}`).join('\n') + '\n\n';
        plainText += `COMMON EXAM QUESTIONS\n` + safeArray(rev.commonExamQuestions).map(q => `• ${safeStr(q)}`).join('\n') + '\n\n';

        htmlBody += `<h2>One-Line Summaries</h2><ul>` + safeArray(rev.oneLineSummaries).map(s => `<li>${safeStr(s)}</li>`).join('') + `</ul>`;
        htmlBody += `<h2>Points to Remember</h2><ul>` + safeArray(rev.importantPoints).map(p => `<li>${safeStr(p)}</li>`).join('') + `</ul>`;
        htmlBody += `<h2>Common Exam Questions</h2><ul>` + safeArray(rev.commonExamQuestions).map(q => `<li>${safeStr(q)}</li>`).join('') + `</ul>`;
      } else {
        plainText = 'No Revision Notes available.';
        htmlBody = '<p>No Revision Notes available.</p>';
      }
    } else {
      plainText = personalNotes || 'No Personal Notes recorded.';
      htmlBody = `<p style="white-space: pre-wrap;">${safeStr(personalNotes || 'No Personal Notes recorded.')}</p>`;
    }

    const filenameBase = `${document.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${activeTab}_notes`;

    if (format === 'txt') {
      const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'docx') {
      const docxHtml = `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${title}</title><style>body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.6; color: #333333; padding: 20px; } h1 { color: #5d5770; font-size: 24pt; border-bottom: 2px solid #7c6a75; padding-bottom: 8px; } h2 { color: #7c6a75; font-size: 16pt; margin-top: 18pt; } ul { margin-left: 20pt; } li { margin-bottom: 6pt; }</style></head><body><h1>${title}</h1>${htmlBody}</body></html>`;
      const blob = new Blob(['\ufeff', docxHtml], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #2b2b34; padding: 40px; max-width: 800px; margin: 0 auto; } h1 { color: #5d5770; font-size: 28px; border-bottom: 3px solid #7c6a75; padding-bottom: 12px; margin-bottom: 24px; } h2 { color: #7c6a75; font-size: 20px; margin-top: 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; } ul { padding-left: 24px; } li { margin-bottom: 8px; font-size: 15px; } mark { background-color: #fef08a; padding: 2px 6px; border-radius: 4px; font-weight: 600; } @media print { body { padding: 0; max-width: 100%; } }</style></head><body><h1>${title}</h1>${htmlBody}<script>window.onload = function() { window.print(); window.close(); };</script></body></html>`);
        printWin.document.close();
      }
    }
  };

  // 9. Text Annotation Renderer (Search query + Custom Highlights)
  const renderAnnotatedText = (text: string) => {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    const intervals: { start: number; end: number; type: 'search' | 'custom'; matchText: string }[] = [];

    // Search matches
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      let pos = lowerText.indexOf(q);
      while (pos !== -1) {
        intervals.push({ start: pos, end: pos + q.length, type: 'search', matchText: text.slice(pos, pos + q.length) });
        pos = lowerText.indexOf(q, pos + 1);
      }
    }

    // Custom highlights
    for (const h of customHighlights) {
      if (!h || !h.trim()) continue;
      const hl = h.trim().toLowerCase();
      let pos = lowerText.indexOf(hl);
      while (pos !== -1) {
        intervals.push({ start: pos, end: pos + hl.length, type: 'custom', matchText: text.slice(pos, pos + hl.length) });
        pos = lowerText.indexOf(hl, pos + 1);
      }
    }

    if (intervals.length === 0) return <span>{text}</span>;

    // Merge overlapping intervals
    intervals.sort((a, b) => a.start - b.start);
    const merged: typeof intervals = [];
    for (const curr of intervals) {
      if (merged.length === 0) {
        merged.push({ ...curr });
      } else {
        const prev = merged[merged.length - 1];
        if (curr.start < prev.end) {
          prev.end = Math.max(prev.end, curr.end);
          if (curr.type === 'search') prev.type = 'search';
        } else {
          merged.push({ ...curr });
        }
      }
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    merged.forEach((item, idx) => {
      if (item.start > lastIndex) {
        elements.push(<span key={`t-${idx}`}>{text.slice(lastIndex, item.start)}</span>);
      }
      const sliceText = text.slice(item.start, item.end);
      if (item.type === 'search') {
        elements.push(
          <mark key={`m-${idx}`} className="bg-yellow-300 dark:bg-yellow-600 text-black dark:text-white px-1 rounded shadow-sm font-semibold">
            {sliceText}
          </mark>
        );
      } else {
        elements.push(
          <mark
            key={`m-${idx}`}
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveHighlight(sliceText);
            }}
            title="Click to remove highlight"
            className="bg-amber-200 dark:bg-amber-800/80 text-black dark:text-white px-1 rounded font-semibold cursor-pointer hover:bg-red-300 dark:hover:bg-red-800 transition-colors"
          >
            {sliceText}
          </mark>
        );
      }
      lastIndex = item.end;
    });

    if (lastIndex < text.length) {
      elements.push(<span key="t-end">{text.slice(lastIndex)}</span>);
    }

    return <span>{elements}</span>;
  };

  // Helper to filter strings by search query and bookmarks
  const matchesFilter = (itemText: string, checkBookmark = false) => {
    const clean = itemText.trim();
    if (checkBookmark && showBookmarksOnly && !revisionBookmarks.includes(clean)) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    return clean.toLowerCase().includes(searchQuery.trim().toLowerCase());
  };

  // Render Inner Content (Shared between Normal & Fullscreen Mode)
  const renderPanelContent = (isLarge: boolean) => {
    const textSize = isLarge ? 'text-sm md:text-base' : 'text-xs';
    const headingSize = isLarge ? 'text-base md:text-lg' : 'text-sm';
    const spacing = isLarge ? 'space-y-6 leading-loose' : 'space-y-4 leading-relaxed';

    return (
      <div 
        ref={containerRef}
        onMouseUp={handleCheckSelection}
        className={`flex-1 overflow-y-auto p-4 custom-scrollbar scroll-smooth ${spacing}`}
      >
        {/* --- 🤖 AI NOTES TAB --- */}
        {activeTab === 'ai' && (
          <div className={`text-[#5d5770] dark:text-gray-200 ${spacing}`}>
            {!document.aiData?.aiNotes ? (
              <div className="text-center text-xs font-bold text-[#5d5770]/60 mt-10">
                No AI Notes found. Have you uploaded or processed a valid study document?
              </div>
            ) : (
              <>
                {/* Chapter Summary */}
                <div className="group relative bg-white/40 dark:bg-white/5 p-3 md:p-4 rounded-xl border border-[#7c6a75]/10">
                  <div className="flex items-center justify-between border-b-2 border-[#7c6a75]/10 pb-1 mb-2">
                    <h3 className={`font-black ${headingSize} text-[#7c6a75] dark:text-purple-300`}>Chapter Summary</h3>
                    <button
                      onClick={() => copyTextToClipboard(safeStr(document.aiData?.aiNotes?.chapterSummary), 'summary')}
                      className="text-[10px] bg-white/80 dark:bg-white/10 hover:bg-white px-2 py-1 rounded border border-[#7c6a75]/20 text-[#5d5770] dark:text-gray-300 font-bold transition-all shadow-sm flex items-center gap-1"
                    >
                      {copiedSection === 'summary' ? '✓ Copied' : '📋 Copy'}
                    </button>
                  </div>
                  <p className={`${textSize}`}>{renderAnnotatedText(safeStr(document.aiData.aiNotes.chapterSummary || 'No chapter summary available.'))}</p>
                </div>

                {/* Key Concepts */}
                <div className="group relative bg-white/40 dark:bg-white/5 p-3 md:p-4 rounded-xl border border-[#7c6a75]/10">
                  <div className="flex items-center justify-between border-b-2 border-[#7c6a75]/10 pb-1 mb-2">
                    <h3 className={`font-black ${headingSize} text-[#7c6a75] dark:text-purple-300`}>Key Concepts</h3>
                    <button
                      onClick={() => copyTextToClipboard(safeArray(document.aiData?.aiNotes?.keyConcepts).map(c => `• ${safeStr(c)}`).join('\n'), 'concepts')}
                      className="text-[10px] bg-white/80 dark:bg-white/10 hover:bg-white px-2 py-1 rounded border border-[#7c6a75]/20 text-[#5d5770] dark:text-gray-300 font-bold transition-all shadow-sm flex items-center gap-1"
                    >
                      {copiedSection === 'concepts' ? '✓ Copied' : '📋 Copy'}
                    </button>
                  </div>
                  <ul className="list-disc list-inside space-y-2">
                    {safeArray(document.aiData.aiNotes.keyConcepts)
                      .filter(kc => matchesFilter(safeStr(kc)))
                      .map((kc, i) => (
                        <li key={i} className={`${textSize} hover:bg-white/30 dark:hover:bg-white/5 p-1 rounded transition-colors`}>
                          {renderAnnotatedText(safeStr(kc))}
                        </li>
                      ))}
                  </ul>
                </div>

                {/* Important Facts */}
                <div className="group relative bg-white/40 dark:bg-white/5 p-3 md:p-4 rounded-xl border border-[#7c6a75]/10">
                  <div className="flex items-center justify-between border-b-2 border-[#7c6a75]/10 pb-1 mb-2">
                    <h3 className={`font-black ${headingSize} text-[#7c6a75] dark:text-purple-300`}>Important Facts</h3>
                    <button
                      onClick={() => copyTextToClipboard(safeArray(document.aiData?.aiNotes?.importantFacts).map(f => `• ${safeStr(f)}`).join('\n'), 'facts')}
                      className="text-[10px] bg-white/80 dark:bg-white/10 hover:bg-white px-2 py-1 rounded border border-[#7c6a75]/20 text-[#5d5770] dark:text-gray-300 font-bold transition-all shadow-sm flex items-center gap-1"
                    >
                      {copiedSection === 'facts' ? '✓ Copied' : '📋 Copy'}
                    </button>
                  </div>
                  <ul className="list-disc list-inside space-y-2">
                    {safeArray(document.aiData.aiNotes.importantFacts)
                      .filter(f => matchesFilter(safeStr(f)))
                      .map((f, i) => (
                        <li key={i} className={`${textSize} hover:bg-white/30 dark:hover:bg-white/5 p-1 rounded transition-colors`}>
                          {renderAnnotatedText(safeStr(f))}
                        </li>
                      ))}
                  </ul>
                </div>

                {/* FAQs */}
                {safeArray(document.aiData.aiNotes.frequentlyAskedQuestions).length > 0 && (
                  <div className="group relative bg-white/40 dark:bg-white/5 p-3 md:p-4 rounded-xl border border-[#7c6a75]/10">
                    <div className="flex items-center justify-between border-b-2 border-[#7c6a75]/10 pb-1 mb-2">
                      <h3 className={`font-black ${headingSize} text-[#7c6a75] dark:text-purple-300`}>Frequently Asked Questions</h3>
                      <button
                        onClick={() => copyTextToClipboard(safeArray(document.aiData?.aiNotes?.frequentlyAskedQuestions).map((faq: any) => `Q: ${safeStr(faq?.question || faq)}\nA: ${safeStr(faq?.answer || '')}`).join('\n\n'), 'faqs')}
                        className="text-[10px] bg-white/80 dark:bg-white/10 hover:bg-white px-2 py-1 rounded border border-[#7c6a75]/20 text-[#5d5770] dark:text-gray-300 font-bold transition-all shadow-sm flex items-center gap-1"
                      >
                        {copiedSection === 'faqs' ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {safeArray(document.aiData.aiNotes.frequentlyAskedQuestions)
                        .filter((faq: any) => matchesFilter(`${safeStr(faq?.question)} ${safeStr(faq?.answer)}`))
                        .map((faq: any, i) => (
                          <div key={i} className="bg-white/60 dark:bg-black/20 p-3 rounded-lg border border-[#7c6a75]/10">
                            <p className={`${isLarge ? 'text-sm' : 'text-xs'} font-bold text-[#7c6a75] dark:text-purple-200`}>
                              Q: {renderAnnotatedText(safeStr(faq?.question || faq))}
                            </p>
                            <p className={`${textSize} mt-1 text-[#5d5770]/90 dark:text-gray-300`}>
                              A: {renderAnnotatedText(safeStr(faq?.answer || ''))}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* --- 📌 REVISION NOTES TAB --- */}
        {activeTab === 'revision' && (
          <div className={`text-[#5d5770] dark:text-gray-200 ${spacing}`}>
            {!document.aiData?.revisionNotes ? (
              <div className="text-center text-xs font-bold text-[#5d5770]/60 mt-10">
                No Revision Notes found.
              </div>
            ) : (
              <>
                {/* One-Line Summaries */}
                <div className="group relative bg-white/40 dark:bg-white/5 p-3 md:p-4 rounded-xl border border-[#7c6a75]/10">
                  <div className="flex items-center justify-between border-b-2 border-[#7c6a75]/10 pb-1 mb-2">
                    <h3 className={`font-black ${headingSize} text-[#7c6a75] dark:text-purple-300`}>One-Line Summaries</h3>
                    <button
                      onClick={() => copyTextToClipboard(safeArray(document.aiData?.revisionNotes?.oneLineSummaries).map(s => `• ${safeStr(s)}`).join('\n'), 'oneliners')}
                      className="text-[10px] bg-white/80 dark:bg-white/10 hover:bg-white px-2 py-1 rounded border border-[#7c6a75]/20 text-[#5d5770] dark:text-gray-300 font-bold transition-all shadow-sm flex items-center gap-1"
                    >
                      {copiedSection === 'oneliners' ? '✓ Copied' : '📋 Copy'}
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {safeArray(document.aiData.revisionNotes.oneLineSummaries)
                      .filter(s => matchesFilter(safeStr(s), true))
                      .map((s, i) => {
                        const str = safeStr(s);
                        const isBm = revisionBookmarks.includes(str.trim());
                        return (
                          <li 
                            key={i} 
                            className={`flex items-start gap-2 ${textSize} p-2 rounded-lg transition-all ${
                              isBm ? 'bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-400 font-medium' : 'hover:bg-white/30 dark:hover:bg-white/5'
                            }`}
                          >
                            <button
                              onClick={() => toggleBookmark(str)}
                              title={isBm ? "Remove ⭐ bookmark" : "Mark important with ⭐"}
                              className={`shrink-0 text-base leading-none transition-transform hover:scale-125 ${isBm ? 'text-amber-500 font-bold' : 'text-gray-400 opacity-60 hover:opacity-100'}`}
                            >
                              {isBm ? '⭐' : '☆'}
                            </button>
                            <div className="flex-1">
                              {renderAnnotatedText(str)}
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>

                {/* Points to Remember */}
                <div className="group relative bg-white/40 dark:bg-white/5 p-3 md:p-4 rounded-xl border border-[#7c6a75]/10">
                  <div className="flex items-center justify-between border-b-2 border-[#7c6a75]/10 pb-1 mb-2">
                    <h3 className={`font-black ${headingSize} text-[#7c6a75] dark:text-purple-300`}>Points to Remember</h3>
                    <button
                      onClick={() => copyTextToClipboard(safeArray(document.aiData?.revisionNotes?.importantPoints).map(p => `• ${safeStr(p)}`).join('\n'), 'points')}
                      className="text-[10px] bg-white/80 dark:bg-white/10 hover:bg-white px-2 py-1 rounded border border-[#7c6a75]/20 text-[#5d5770] dark:text-gray-300 font-bold transition-all shadow-sm flex items-center gap-1"
                    >
                      {copiedSection === 'points' ? '✓ Copied' : '📋 Copy'}
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {safeArray(document.aiData.revisionNotes.importantPoints)
                      .filter(p => matchesFilter(safeStr(p), true))
                      .map((p, i) => {
                        const str = safeStr(p);
                        const isBm = revisionBookmarks.includes(str.trim());
                        return (
                          <li 
                            key={i} 
                            className={`flex items-start gap-2 ${textSize} p-2 rounded-lg transition-all ${
                              isBm ? 'bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-400 font-medium' : 'hover:bg-white/30 dark:hover:bg-white/5'
                            }`}
                          >
                            <button
                              onClick={() => toggleBookmark(str)}
                              title={isBm ? "Remove ⭐ bookmark" : "Mark important with ⭐"}
                              className={`shrink-0 text-base leading-none transition-transform hover:scale-125 ${isBm ? 'text-amber-500 font-bold' : 'text-gray-400 opacity-60 hover:opacity-100'}`}
                            >
                              {isBm ? '⭐' : '☆'}
                            </button>
                            <div className="flex-1">
                              {renderAnnotatedText(str)}
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>

                {/* Common Exam Questions */}
                <div className="group relative bg-white/40 dark:bg-white/5 p-3 md:p-4 rounded-xl border border-[#7c6a75]/10">
                  <div className="flex items-center justify-between border-b-2 border-[#7c6a75]/10 pb-1 mb-2">
                    <h3 className={`font-black ${headingSize} text-[#7c6a75] dark:text-purple-300`}>Common Exam Questions</h3>
                    <button
                      onClick={() => copyTextToClipboard(safeArray(document.aiData?.revisionNotes?.commonExamQuestions).map(q => `• ${safeStr(q)}`).join('\n'), 'exams')}
                      className="text-[10px] bg-white/80 dark:bg-white/10 hover:bg-white px-2 py-1 rounded border border-[#7c6a75]/20 text-[#5d5770] dark:text-gray-300 font-bold transition-all shadow-sm flex items-center gap-1"
                    >
                      {copiedSection === 'exams' ? '✓ Copied' : '📋 Copy'}
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {safeArray(document.aiData.revisionNotes.commonExamQuestions)
                      .filter(q => matchesFilter(safeStr(q), true))
                      .map((q, i) => {
                        const str = safeStr(q);
                        const isBm = revisionBookmarks.includes(str.trim());
                        return (
                          <li 
                            key={i} 
                            className={`flex items-start gap-2 ${textSize} p-2 rounded-lg transition-all ${
                              isBm ? 'bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-400 font-medium' : 'hover:bg-white/30 dark:hover:bg-white/5'
                            }`}
                          >
                            <button
                              onClick={() => toggleBookmark(str)}
                              title={isBm ? "Remove ⭐ bookmark" : "Mark important with ⭐"}
                              className={`shrink-0 text-base leading-none transition-transform hover:scale-125 ${isBm ? 'text-amber-500 font-bold' : 'text-gray-400 opacity-60 hover:opacity-100'}`}
                            >
                              {isBm ? '⭐' : '☆'}
                            </button>
                            <div className="flex-1">
                              {renderAnnotatedText(str)}
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {/* --- 📝 PERSONAL NOTES TAB --- */}
        {activeTab === 'personal' && (
          <div className="flex flex-col h-full w-full min-h-[300px]">
            <PersonalNotesEditor
              documentId={document.id}
              documentName={document.name}
              document={document}
              onUpdateNotes={(html) => {
                setPersonalNotes(html);
                onUpdatePersonalNotes(html);
              }}
              isLarge={isLarge}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* NORMAL INLINE PANEL */}
      <div className="flex flex-col h-full bg-white/60 dark:bg-[#1f1d2b]/80 border-3 border-[#7c6a75] dark:border-[#a78bfa]/40 rounded-2xl shadow-[0_4px_0_#7c6a75] overflow-hidden backdrop-blur-md">
        
        {/* Top Tab Bar */}
        <div className="flex bg-[#7c6a75]/10 dark:bg-black/20 border-b-2 border-[#7c6a75]/20 p-1 gap-1">
          <button
            onClick={() => handleTabSwitch('ai')}
            className={`flex-1 py-2 text-[10px] md:text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'ai' ? 'bg-white dark:bg-[#7c6a75] text-[#7c6a75] dark:text-white shadow-sm' : 'text-[#5d5770]/70 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5'
            }`}
          >
            🤖 AI Notes
          </button>
          <button
            onClick={() => handleTabSwitch('revision')}
            className={`flex-1 py-2 text-[10px] md:text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === 'revision' ? 'bg-white dark:bg-[#7c6a75] text-[#7c6a75] dark:text-white shadow-sm' : 'text-[#5d5770]/70 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5'
            }`}
          >
            <span>📌 Revision</span>
            {revisionBookmarks.length > 0 && (
              <span className="bg-amber-400 text-black font-black text-[9px] px-1.5 py-0.2 rounded-full">
                ⭐ {revisionBookmarks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabSwitch('personal')}
            className={`flex-1 py-2 text-[10px] md:text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'personal' ? 'bg-white dark:bg-[#7c6a75] text-[#7c6a75] dark:text-white shadow-sm' : 'text-[#5d5770]/70 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5'
            }`}
          >
            📝 Personal
          </button>
        </div>

        {/* Action Toolbar & Search */}
        <div className="bg-white/40 dark:bg-black/20 border-b border-[#7c6a75]/10 px-2 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[140px]">
            <input
              type="text"
              placeholder="🔍 Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/80 dark:bg-black/40 border border-[#7c6a75]/20 rounded-md py-1 pl-2 pr-6 text-[11px] text-[#5d5770] dark:text-gray-200 focus:outline-none focus:border-[#7c6a75]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Revision Bookmark Toggle */}
          {activeTab === 'revision' && (
            <button
              onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
              className={`text-[10px] px-2 py-1 rounded font-bold transition-all flex items-center gap-1 border ${
                showBookmarksOnly ? 'bg-amber-400 text-black border-amber-500 shadow-sm' : 'bg-white/60 dark:bg-white/10 text-gray-600 dark:text-gray-300 border-[#7c6a75]/20 hover:bg-white'
              }`}
            >
              ⭐ Bookmarked ({revisionBookmarks.length})
            </button>
          )}

          {/* Highlight Selection / Clear Buttons */}
          {(activeTab === 'ai' || activeTab === 'revision') && (
            <div className="flex items-center gap-1">
              {hasSelection && (
                <button
                  onClick={handleAddHighlight}
                  className="bg-amber-300 hover:bg-amber-400 text-black font-black text-[10px] px-2 py-1 rounded shadow-sm animate-pulse flex items-center gap-1"
                  title="Highlight selected text"
                >
                  🖍️ Highlight
                </button>
              )}
              {customHighlights.length > 0 && (
                <button
                  onClick={handleClearAllHighlights}
                  className="text-[10px] text-red-500 hover:text-red-700 bg-white/60 dark:bg-white/5 hover:bg-red-50 px-1.5 py-1 rounded border border-red-200"
                  title="Clear all custom highlights"
                >
                  🧹 Clear
                </button>
              )}
            </div>
          )}

          {/* Action Buttons: Copy All, Export, Fullscreen */}
          <div className="flex items-center gap-1 relative">
            <button
              onClick={handleCopyAll}
              className="text-[10px] bg-white/80 dark:bg-white/10 hover:bg-white px-2 py-1 rounded border border-[#7c6a75]/20 text-[#5d5770] dark:text-gray-300 font-bold transition-all shadow-sm"
              title="Copy all notes from this tab"
            >
              {copiedSection === 'all' ? '✓ Copied All' : '📋 Copy All'}
            </button>

            {/* Export Dropdown Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="text-[10px] bg-white/80 dark:bg-white/10 hover:bg-white px-2 py-1 rounded border border-[#7c6a75]/20 text-[#5d5770] dark:text-gray-300 font-bold transition-all shadow-sm flex items-center gap-0.5"
              >
                <span>📥 Export</span>
                <span>▾</span>
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-lg shadow-xl p-1 z-[50] flex flex-col min-w-[90px]">
                  <button
                    onClick={() => handleExport('txt')}
                    className="text-left text-[11px] px-2 py-1 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded text-[#5d5770] dark:text-gray-200 font-medium"
                  >
                    📄 Text (.txt)
                  </button>
                  <button
                    onClick={() => handleExport('docx')}
                    className="text-left text-[11px] px-2 py-1 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded text-[#5d5770] dark:text-gray-200 font-medium"
                  >
                    📝 Word (.doc)
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="text-left text-[11px] px-2 py-1 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded text-[#5d5770] dark:text-gray-200 font-medium"
                  >
                    📑 PDF / Print
                  </button>
                </div>
              )}
            </div>

            {/* Fullscreen Expand Button */}
            <button
              onClick={toggleFullscreen}
              className="bg-[#7c6a75] hover:bg-[#6b5b65] text-white p-1 rounded-md shadow-sm transition-transform hover:scale-110 ml-0.5"
              title="Expand to Fullscreen Workspace"
            >
              ⛶
            </button>
          </div>

        </div>

        {/* Content Area */}
        {renderPanelContent(false)}
      </div>

      {/* --- FULLSCREEN WORKSPACE MODAL OVERLAY --- */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-xl flex items-center justify-center p-3 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1a1823] border-4 border-[#7c6a75] dark:border-[#a78bfa] rounded-3xl shadow-[0_16px_50px_rgba(0,0,0,0.7)] w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden relative"
            >
              {/* Fullscreen Header */}
              <div className="bg-[#7c6a75] dark:bg-[#342e48] text-white px-6 py-3 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📑</span>
                  <div>
                    <h2 className="font-black text-base md:text-lg tracking-wide">{document.name} - Study Workspace</h2>
                    <p className="text-[11px] text-white/80">Expanded AI & Revision Notes Panel with live search, export, and interactive highlighting</p>
                  </div>
                </div>
                
                <button
                  onClick={toggleFullscreen}
                  className="bg-white/20 hover:bg-white/30 text-white font-black px-4 py-1.5 rounded-xl transition-all flex items-center gap-2 border border-white/20 shadow-sm"
                >
                  <span>✕ Close Fullscreen</span>
                </button>
              </div>

              {/* Fullscreen Navigation Tabs */}
              <div className="flex bg-[#7c6a75]/10 dark:bg-black/30 border-b-2 border-[#7c6a75]/20 p-2 gap-2">
                <button
                  onClick={() => handleTabSwitch('ai')}
                  className={`flex-1 py-2.5 text-xs md:text-sm font-black uppercase tracking-wider rounded-xl transition-all ${
                    activeTab === 'ai' ? 'bg-white dark:bg-[#7c6a75] text-[#7c6a75] dark:text-white shadow-md' : 'text-[#5d5770]/70 dark:text-gray-400 hover:bg-white/50'
                  }`}
                >
                  🤖 AI Notes
                </button>
                <button
                  onClick={() => handleTabSwitch('revision')}
                  className={`flex-1 py-2.5 text-xs md:text-sm font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'revision' ? 'bg-white dark:bg-[#7c6a75] text-[#7c6a75] dark:text-white shadow-md' : 'text-[#5d5770]/70 dark:text-gray-400 hover:bg-white/50'
                  }`}
                >
                  <span>📌 Revision Notes</span>
                  {revisionBookmarks.length > 0 && (
                    <span className="bg-amber-400 text-black font-black text-xs px-2 py-0.5 rounded-full shadow-sm">
                      ⭐ {revisionBookmarks.length} Bookmarked
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleTabSwitch('personal')}
                  className={`flex-1 py-2.5 text-xs md:text-sm font-black uppercase tracking-wider rounded-xl transition-all ${
                    activeTab === 'personal' ? 'bg-white dark:bg-[#7c6a75] text-[#7c6a75] dark:text-white shadow-md' : 'text-[#5d5770]/70 dark:text-gray-400 hover:bg-white/50'
                  }`}
                >
                  📝 Personal Notes
                </button>
              </div>

              {/* Fullscreen Toolbar */}
              <div className="bg-white/60 dark:bg-black/20 border-b border-[#7c6a75]/10 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-sm">
                
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="🔍 Search across notes, concepts, and summaries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-black/40 border-2 border-[#7c6a75]/30 rounded-xl py-2 pl-3 pr-8 text-sm text-[#5d5770] dark:text-gray-200 focus:outline-none focus:border-[#7c6a75] shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Toolbar Filters & Actions */}
                <div className="flex items-center gap-2">
                  {activeTab === 'revision' && (
                    <button
                      onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-black transition-all flex items-center gap-1.5 border shadow-sm ${
                        showBookmarksOnly ? 'bg-amber-400 text-black border-amber-500 scale-105' : 'bg-white dark:bg-white/10 text-gray-700 dark:text-gray-200 border-[#7c6a75]/20 hover:bg-amber-50'
                      }`}
                    >
                      ⭐ Show Bookmarked Only ({revisionBookmarks.length})
                    </button>
                  )}

                  {(activeTab === 'ai' || activeTab === 'revision') && (
                    <div className="flex items-center gap-2 border-l border-[#7c6a75]/20 pl-2">
                      {hasSelection && (
                        <button
                          onClick={handleAddHighlight}
                          className="bg-amber-400 hover:bg-amber-500 text-black font-black text-xs px-3 py-1.5 rounded-xl shadow-md animate-bounce flex items-center gap-1"
                        >
                          🖍️ Highlight Selected
                        </button>
                      )}
                      {customHighlights.length > 0 && (
                        <button
                          onClick={handleClearAllHighlights}
                          className="text-xs text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 px-2.5 py-1.5 rounded-xl border border-red-200 font-bold"
                        >
                          🧹 Clear Highlights
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 border-l border-[#7c6a75]/20 pl-2 relative">
                    <button
                      onClick={handleCopyAll}
                      className="text-xs bg-white dark:bg-white/10 hover:bg-gray-50 px-3 py-1.5 rounded-xl border border-[#7c6a75]/20 text-[#5d5770] dark:text-gray-200 font-bold transition-all shadow-sm"
                    >
                      {copiedSection === 'all' ? '✓ Copied All Notes' : '📋 Copy All'}
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className="text-xs bg-white dark:bg-white/10 hover:bg-gray-50 px-3 py-1.5 rounded-xl border border-[#7c6a75]/20 text-[#5d5770] dark:text-gray-200 font-bold transition-all shadow-sm flex items-center gap-1"
                      >
                        <span>📥 Export Notes</span>
                        <span>▾</span>
                      </button>

                      {showExportMenu && (
                        <div className="absolute right-0 top-full mt-2 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-xl shadow-2xl p-1.5 z-[50] flex flex-col min-w-[140px]">
                          <button
                            onClick={() => handleExport('txt')}
                            className="text-left text-xs px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded-lg text-[#5d5770] dark:text-gray-200 font-bold"
                          >
                            📄 Plain Text (.txt)
                          </button>
                          <button
                            onClick={() => handleExport('docx')}
                            className="text-left text-xs px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded-lg text-[#5d5770] dark:text-gray-200 font-bold"
                          >
                            📝 Microsoft Word (.doc)
                          </button>
                          <button
                            onClick={() => handleExport('pdf')}
                            className="text-left text-xs px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded-lg text-[#5d5770] dark:text-gray-200 font-bold"
                          >
                            📑 PDF Document / Print
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Fullscreen Content Area (Larger fonts, better spacing) */}
              <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/50 dark:bg-black/20">
                {renderPanelContent(true)}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
