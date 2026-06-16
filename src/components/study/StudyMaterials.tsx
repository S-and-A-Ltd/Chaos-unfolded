'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Card from '@/components/ui/Card';
import type { StudyDocument } from '@/types';

interface StudyMaterialsProps {
  documents: StudyDocument[];
  onDelete: (id: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-500/20 text-red-300 border-red-500/20',
  docx: 'bg-blue-500/20 text-blue-300 border-blue-500/20',
  txt: 'bg-green-500/20 text-green-300 border-green-500/20',
  pptx: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
  youtube: 'bg-rose-500/20 text-rose-300 border-rose-500/20',
};

const TYPE_ICONS: Record<string, string> = {
  pdf: '📄',
  docx: '📝',
  txt: '📃',
  pptx: '📊',
  youtube: '📺',
};

export default function StudyMaterials({ documents, onDelete }: StudyMaterialsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <Card className="text-center py-6">
        <p className="text-2xl mb-2">📚</p>
        <p className="text-sm text-[#5d5770]/80 font-semibold">No materials uploaded</p>
        <p className="text-xs text-[#5d5770]/60 mt-1">Upload documents to get started</p>
      </Card>
    );
  }

  return (
    <Card padding="md" bgVariant="lavender" className="shadow-[0_6px_0_#7c6a75]">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold text-[#5d5770]">
          Study Materials
        </h3>
        <span className="text-xs text-[#5d5770]/60">{documents.length} files</span>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        <AnimatePresence>
          {documents.map((doc) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl bg-white/30 border border-[#ababdc]/20 overflow-hidden"
            >
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/50 transition-colors"
                onClick={() =>
                  setExpandedId(expandedId === doc.id ? null : doc.id)
                }
              >
                <span className="text-xl">{TYPE_ICONS[doc.type] || '📄'}</span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#5d5770] truncate font-semibold">
                    {doc.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`px-1.5 py-0.5 text-[9px] uppercase font-bold rounded border ${
                        TYPE_COLORS[doc.type] || 'bg-white/30 text-[#5d5770]'
                      }`}
                    >
                      {doc.type}
                    </span>
                    <span className="text-[10px] text-[#5d5770]/60">
                      {doc.topics.length} topics
                    </span>
                    {!doc.isProcessed && (
                      <span className="text-[10px] text-amber-500 flex items-center gap-1 font-semibold">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Processing
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(doc.id);
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>

                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`text-[#5d5770]/60 transition-transform duration-200 ${
                    expandedId === doc.id ? 'rotate-180' : ''
                  }`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              <AnimatePresence>
                {expandedId === doc.id && doc.topics.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-[#ababdc]/20 px-3 py-2"
                  >
                    <p className="text-[10px] text-[#5d5770]/60 uppercase tracking-wider mb-1.5 font-bold">
                      Extracted Topics
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {doc.topics.map((topic, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary-dark border border-primary/20"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}
