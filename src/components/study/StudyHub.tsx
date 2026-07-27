'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Button from '@/components/ui/Button';
import type { StudyDocument } from '@/types';
import dynamic from 'next/dynamic';
import NotesPanel from './NotesPanel';
import { getDocumentBlob } from '@/lib/storage/document-storage';
import { cleanAIResponseText } from '@/lib/utils/clean-response';

const PDFWorkspace = dynamic(() => import('./PDFWorkspace'), { ssr: false });

interface StudyHubProps {
  documents: StudyDocument[];
  onTriggerQuiz: (forceRegenerate?: boolean) => void;
  onAddYoutubeUrl: (url: string) => Promise<void>;
}

const safeArray = (val: any): any[] => (Array.isArray(val) ? val : []);

export default function StudyHub({ documents, onTriggerQuiz, onAddYoutubeUrl }: StudyHubProps) {
  const [activeSidebarTab, setActiveSidebarTab] = useState<'documents' | 'youtube'>('documents');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [activePdfBlob, setActivePdfBlob] = useState<File | Blob | null>(null);

  const activeDoc = safeArray(documents).find((d) => d.id === selectedDocId);
  const pdfDocs = safeArray(documents).filter((d) => d.type !== 'youtube');
  const youtubeDocs = safeArray(documents).filter((d) => d.type === 'youtube');

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
  }, [activeDoc]);

  // Context Menu & AI Modal State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [notesTrigger, setNotesTrigger] = useState<number>(0);
  const [aiModal, setAiModal] = useState<{
    open: boolean;
    title: string;
    content: string;
    isLoading: boolean;
  }>({
    open: false,
    title: '',
    content: '',
    isLoading: false,
  });

  const handleTextSelection = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 0) {
      setContextMenu({ x: e.clientX, y: e.clientY - 40, text });
    } else {
      setContextMenu(null);
    }
  };

  const handleAIExplainText = async (text: string) => {
    setContextMenu(null);
    setAiModal({
      open: true,
      title: '💡 Dazai’s Concept Explanation',
      content: 'Dazai is analyzing and explaining this concept...',
      isLoading: true,
    });
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          contextText: activeDoc?.extractedText || '',
          documentName: activeDoc?.name || 'Study Material',
        }),
      });
      const data = await res.json();
      const cleanContent = cleanAIResponseText(data.text || data.reply || data.dialogue || data.error);
      setAiModal({
        open: true,
        title: '💡 Dazai’s Concept Explanation',
        content: cleanContent || 'Explanation generated.',
        isLoading: false,
      });
    } catch {
      setAiModal({
        open: true,
        title: 'Error',
        content: 'Failed to generate explanation.',
        isLoading: false,
      });
    }
  };

  const handleAISummarizeText = async (text: string) => {
    setContextMenu(null);
    setAiModal({
      open: true,
      title: '📑 Passage Revision Notes',
      content: 'Generating revision notes...',
      isLoading: true,
    });
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          contextText: activeDoc?.extractedText || '',
          documentName: activeDoc?.name || 'Study Material',
        }),
      });
      const data = await res.json();
      const cleanSummary = cleanAIResponseText(data.text || data.reply || data.summary || data.error);
      setAiModal({
        open: true,
        title: '📑 Passage Revision Notes',
        content: cleanSummary || 'Revision notes generated.',
        isLoading: false,
      });
    } catch {
      setAiModal({
        open: true,
        title: 'Error',
        content: 'Failed to generate revision notes.',
        isLoading: false,
      });
    }
  };

  // 3-Column Layout Workspace
  return (
    <div className="w-full flex gap-6 h-[75vh] font-fredoka relative">
      
      {/* AI Explanation / Summary Modal */}
      <AnimatePresence>
        {aiModal.open && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#2a2438] text-[#e0def4] border-2 border-[#575279] rounded-2xl shadow-2xl max-w-2xl w-full p-6 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b border-[#575279]/50 pb-3">
                <h3 className="font-bold text-sm tracking-wide text-[#eb6f92]">{aiModal.title}</h3>
                <button
                  onClick={() => setAiModal({ ...aiModal, open: false })}
                  className="text-xs text-[#908caa] hover:text-white transition-colors p-1"
                >
                  ✕
                </button>
              </div>

              <div className="bg-[#1f1d2e] rounded-xl p-5 text-[18px] leading-[1.8] max-h-[60vh] overflow-y-auto custom-scrollbar font-sans whitespace-pre-wrap space-y-3">
                {aiModal.isLoading ? (
                  <div className="flex items-center gap-3 text-[#908caa]">
                    <span className="animate-spin text-base">⏳</span>
                    <span className="text-base">{aiModal.content}</span>
                  </div>
                ) : (
                  aiModal.content
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(aiModal.content);
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#31748f] text-white hover:bg-[#31748f]/80 transition-colors"
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => setAiModal({ ...aiModal, open: false })}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#eb6f92] text-white hover:bg-[#eb6f92]/80 transition-colors"
                >
                  Got it!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
            <button
              onClick={() => handleAIExplainText(contextMenu.text)}
              className="px-3 py-2 text-[10px] font-black uppercase text-[#5d5770] hover:bg-[#ffd1dc] transition-colors border-r border-[#7c6a75]/10"
            >
              Explain
            </button>
            <button
              onClick={() => handleAISummarizeText(contextMenu.text)}
              className="px-3 py-2 text-[10px] font-black uppercase text-[#5d5770] hover:bg-[#ffd1dc] transition-colors border-r border-[#7c6a75]/10"
            >
              Notes
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEFT COLUMN: Explorer (Documents) */}
      <div className="w-[320px] shrink-0 flex flex-col gap-4">
        {/* Workspace Switcher */}
        <div className="flex bg-[#7c6a75]/10 p-1.5 rounded-xl border-2 border-[#7c6a75]/15">
          <button
            onClick={() => setActiveSidebarTab('documents')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase transition-all bg-white text-[#7181c8] shadow-sm border border-[#7c6a75]/10`}
          >
            📂 Local
          </button>
        </div>

        {/* Content of Sidebar */}
        <div className="flex-1 bg-white/40 border-3 border-[#7c6a75] rounded-2xl shadow-inner flex flex-col overflow-hidden">
          {activeSidebarTab === 'documents' && (
            <div className="flex-1 flex flex-col p-3 overflow-y-auto custom-scrollbar gap-2">
              <div className="text-[10px] font-black uppercase text-[#5d5770]/60 tracking-wider mb-1">My Study Materials</div>
              {safeArray(documents).length === 0 && (
                <div className="text-xs text-center text-[#5d5770]/50 mt-10 font-bold">No documents uploaded yet. Head to the Study Tab to upload some!</div>
              )}
              {safeArray(documents).map(doc => (
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
        </div>
      </div>

      {/* CENTER COLUMN: Reader / Viewer */}
      <div className="flex-1 flex flex-col">
        {!activeDoc ? (
          <div className="flex-1 flex items-center justify-center border-3 border-[#7c6a75]/20 border-dashed rounded-2xl bg-white/20">
            <div className="text-center">
              <span className="text-4xl opacity-50 block mb-2">📚</span>
              <p className="text-[#5d5770]/60 font-black uppercase tracking-widest text-sm">Select a document to read</p>
            </div>
          </div>
        ) : activeDoc?.type === 'pdf' ? (
          activePdfBlob ? (
            <PDFWorkspace
              document={activeDoc}
              file={activePdfBlob}
              onAddToPersonalNotes={(text, pageNum) => {
                if (typeof window !== 'undefined' && activeDoc) {
                  const existing = localStorage.getItem(`dazai_notes_${activeDoc.id}`) || '';
                  const entry = `• [Page ${pageNum}] "${text}"\n\n`;
                  const updated = existing ? existing + entry : entry;
                  localStorage.setItem(`dazai_notes_${activeDoc.id}`, updated);
                  setNotesTrigger(Date.now());
                }
              }}
              onGenerateFlashcardFromSelection={(text) => {
                if (typeof window !== 'undefined' && activeDoc) {
                  const existing = localStorage.getItem(`dazai_notes_${activeDoc.id}`) || '';
                  const entry = `[Flashcard Idea] Q: What is the significance of: "${text.slice(0, 50)}..."? A: ${text}\n\n`;
                  const updated = existing ? existing + entry : entry;
                  localStorage.setItem(`dazai_notes_${activeDoc.id}`, updated);
                  setNotesTrigger(Date.now());
                }
              }}
              onTriggerQuizFromSelection={(text) => {
                onTriggerQuiz(true);
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center border-3 border-[#7c6a75]/20 border-dashed rounded-2xl bg-[#ffd1dc]/30 p-8 text-center gap-4">
              <span className="text-4xl opacity-50 block">⚠️</span>
              <p className="text-[#5d5770] font-black uppercase tracking-widest text-sm">Document File Missing</p>
              <p className="text-[#5d5770]/80 text-xs font-bold max-w-sm">The actual PDF file for this document could not be found in your browser storage. This usually happens if you clear your browser data or restart the development server. Please delete this document and re-upload it.</p>
            </div>
          )
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
            externalNotesTrigger={notesTrigger}
          />
        ) : (
          <div className="h-full flex items-center justify-center border-3 border-[#7c6a75]/20 border-dashed rounded-2xl bg-white/20">
            <p className="text-[#5d5770]/60 font-black uppercase tracking-widest text-[10px] text-center p-4">Open a document to view study notes</p>
          </div>
        )}
      </div>
      
    </div>
  );
}
