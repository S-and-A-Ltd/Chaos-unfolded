'use client';

import { useState, useEffect } from 'react';
import { StudyDocument } from '@/types';
import Button from '@/components/ui/Button';
import FlashcardViewer from './FlashcardViewer';

interface NotesPanelProps {
  document: StudyDocument;
  onUpdatePersonalNotes: (notes: string) => void;
  onTriggerQuiz: (forceRegenerate?: boolean) => void;
}

type TabType = 'personal' | 'ai' | 'revision' | 'flashcards' | 'quiz';

export default function NotesPanel({ document, onUpdatePersonalNotes, onTriggerQuiz }: NotesPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [personalNotes, setPersonalNotes] = useState('');

  // We would normally load personalNotes from some document.personalNotes field, 
  // but we can just use local state for now until the type is expanded, or just assume it's blank.
  useEffect(() => {
    setPersonalNotes('');
  }, [document.id]);

  const handleSaveNotes = () => {
    onUpdatePersonalNotes(personalNotes);
  };

  return (
    <div className="flex flex-col h-full bg-white/40 border-3 border-[#7c6a75] rounded-2xl shadow-[0_4px_0_#7c6a75] overflow-hidden">
      
      {/* Tabs */}
      <div className="flex bg-[#7c6a75]/10 border-b-2 border-[#7c6a75]/20 p-1">
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
            activeTab === 'ai' ? 'bg-white text-[#7c6a75] shadow-sm' : 'text-[#5d5770]/60 hover:bg-white/50'
          }`}
        >
          🤖 AI Notes
        </button>
        <button
          onClick={() => setActiveTab('revision')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
            activeTab === 'revision' ? 'bg-white text-[#7c6a75] shadow-sm' : 'text-[#5d5770]/60 hover:bg-white/50'
          }`}
        >
          📌 Revision
        </button>
        <button
          onClick={() => setActiveTab('flashcards')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
            activeTab === 'flashcards' ? 'bg-white text-[#7c6a75] shadow-sm' : 'text-[#5d5770]/60 hover:bg-white/50'
          }`}
        >
          🎴 Cards
        </button>
        <button
          onClick={() => setActiveTab('quiz')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
            activeTab === 'quiz' ? 'bg-white text-[#7c6a75] shadow-sm' : 'text-[#5d5770]/60 hover:bg-white/50'
          }`}
        >
          🎯 Quiz
        </button>
        <button
          onClick={() => setActiveTab('personal')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
            activeTab === 'personal' ? 'bg-white text-[#7c6a75] shadow-sm' : 'text-[#5d5770]/60 hover:bg-white/50'
          }`}
        >
          📝 Personal
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'ai' && (
          <div className="space-y-4 text-[#5d5770]">
            {!document.aiData?.aiNotes ? (
              <div className="text-center text-xs font-bold text-[#5d5770]/60 mt-10">
                No AI Notes found. Have you uploaded a valid document?
              </div>
            ) : (
              <>
                <h3 className="font-black text-sm border-b-2 border-[#7c6a75]/10 pb-1">Chapter Summary</h3>
                <p className="text-xs leading-relaxed">{document.aiData.aiNotes.chapterSummary}</p>
                
                <h3 className="font-black text-sm border-b-2 border-[#7c6a75]/10 pb-1 mt-4">Key Concepts</h3>
                <ul className="list-disc list-inside text-xs space-y-1">
                  {document.aiData.aiNotes.keyConcepts.map((kc, i) => <li key={i}>{kc}</li>)}
                </ul>

                <h3 className="font-black text-sm border-b-2 border-[#7c6a75]/10 pb-1 mt-4">Important Facts</h3>
                <ul className="list-disc list-inside text-xs space-y-1">
                  {document.aiData.aiNotes.importantFacts.map((f, i) => <li key={i}>{f}</li>)}
                </ul>

                {document.aiData.aiNotes.frequentlyAskedQuestions && document.aiData.aiNotes.frequentlyAskedQuestions.length > 0 && (
                  <>
                    <h3 className="font-black text-sm border-b-2 border-[#7c6a75]/10 pb-1 mt-4">FAQs</h3>
                    <div className="space-y-3">
                      {document.aiData.aiNotes.frequentlyAskedQuestions.map((faq, i) => (
                        <div key={i} className="bg-white/50 p-2 rounded-lg">
                          <p className="text-[11px] font-bold">Q: {faq.question}</p>
                          <p className="text-[11px] mt-1 text-[#5d5770]/80">A: {faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'revision' && (
          <div className="space-y-4 text-[#5d5770]">
            {!document.aiData?.revisionNotes ? (
              <div className="text-center text-xs font-bold text-[#5d5770]/60 mt-10">
                No Revision Notes found.
              </div>
            ) : (
              <>
                <h3 className="font-black text-sm border-b-2 border-[#7c6a75]/10 pb-1">One-Line Summaries</h3>
                <ul className="list-disc list-inside text-xs space-y-1">
                  {document.aiData.revisionNotes.oneLineSummaries.map((s, i) => <li key={i}>{s}</li>)}
                </ul>

                <h3 className="font-black text-sm border-b-2 border-[#7c6a75]/10 pb-1 mt-4">Points to Remember</h3>
                <ul className="list-disc list-inside text-xs space-y-1">
                  {document.aiData.revisionNotes.importantPoints.map((p, i) => <li key={i}>{p}</li>)}
                </ul>

                <h3 className="font-black text-sm border-b-2 border-[#7c6a75]/10 pb-1 mt-4">Common Exam Questions</h3>
                <ul className="list-disc list-inside text-xs space-y-1">
                  {document.aiData.revisionNotes.commonExamQuestions.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
              </>
            )}
          </div>
        )}

        {activeTab === 'flashcards' && (
          <div className="h-full">
             <FlashcardViewer flashcards={document.aiData?.flashcards || []} />
          </div>
        )}

        {activeTab === 'quiz' && (
          <div className="flex flex-col h-full items-center justify-center gap-6 p-4 text-center">
            <span className="text-4xl">🎯</span>
            <div>
              <h3 className="font-black text-[#5d5770] uppercase tracking-wider text-sm mb-2">Master your material</h3>
              <p className="text-xs text-[#5d5770]/70 leading-relaxed font-bold">
                Test your knowledge with a Dazai Quiz! The quiz will use questions extracted from this document.
              </p>
            </div>
            
            <div className="w-full flex flex-col gap-3 mt-4">
              <Button variant="primary" onClick={() => onTriggerQuiz(false)} className="w-full text-xs py-3 font-black">
                Start Quiz (Cached)
              </Button>
              <Button variant="secondary" onClick={() => onTriggerQuiz(true)} className="w-full text-xs py-2">
                Regenerate Quiz Questions
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'personal' && (
          <div className="flex flex-col h-full gap-2">
            <textarea
              className="flex-1 w-full bg-white/60 border-2 border-[#7c6a75]/20 rounded-xl p-3 text-xs text-[#5d5770] focus:outline-none focus:border-[#7c6a75]/50 resize-none custom-scrollbar"
              placeholder="Jot down your own thoughts, formulas, and to-do lists here..."
              value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
            />
            <Button variant="primary" onClick={handleSaveNotes} className="w-full text-xs py-2">
              Save Notes
            </Button>
          </div>
        )}
      </div>

    </div>
  );
}
