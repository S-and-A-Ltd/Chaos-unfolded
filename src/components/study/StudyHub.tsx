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
  }, [activeDoc]);

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
          <PDFViewer file={activePdfBlob || ''} />
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
