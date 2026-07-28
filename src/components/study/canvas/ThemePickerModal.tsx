'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { getStickyTemplates, StickyTemplate } from '@/components/study/stickyTemplates';
import { useShallow } from 'zustand/react/shallow';

function ThemePickerModal() {
  const showThemePicker = useCanvasStore(state => state.showThemePicker);
  const setShowThemePicker = useCanvasStore(state => state.setShowThemePicker);
  const selectedId = useCanvasStore(state => state.selectedId);
  const items = useCanvasStore(useShallow(state => state.items));
  const updateItemBgAsset = useCanvasStore(state => state.updateItemBgAsset);
  const addStickyNoteAsset = useCanvasStore(state => state.addStickyNoteAsset);

  const [templates, setTemplates] = useState<StickyTemplate[]>([]);

  useEffect(() => {
    if (showThemePicker) {
      setTemplates(getStickyTemplates());
    }
  }, [showThemePicker]);

  useEffect(() => {
    if (!showThemePicker) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowThemePicker(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showThemePicker, setShowThemePicker]);

  const handleSelectTemplate = useCallback((t: StickyTemplate) => {
    const selectedItem = selectedId ? items.find(it => it.id === selectedId) : null;
    if (selectedItem && (selectedItem.type === 'sticky' || selectedItem.bgAsset)) {
      if (selectedItem.lockedBg) {
        // Background is locked — don't change it
        setShowThemePicker(false);
        return;
      }
      updateItemBgAsset(selectedId!, t.image);
    } else {
      addStickyNoteAsset(t.image);
    }
    setShowThemePicker(false);
  }, [selectedId, items, updateItemBgAsset, addStickyNoteAsset, setShowThemePicker]);

  if (!showThemePicker) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none"
      onClick={() => setShowThemePicker(false)}
    >
      <div 
        className="bg-white dark:bg-[#232130] border-4 border-purple-500 rounded-3xl p-6 shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
          <div>
            <h3 className="font-black text-lg text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <span>🖼️ Choose a Sticky Note Theme</span>
              <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {templates.length} Templates
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Click any aesthetic memo template to drop it onto your whiteboard or update selected note!</p>
          </div>
          <button onClick={() => setShowThemePicker(false)} className="bg-gray-100 dark:bg-white/10 hover:bg-red-500 hover:text-white font-bold w-8 h-8 rounded-full flex items-center justify-center">✕</button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 overflow-y-auto custom-scrollbar p-2 flex-1 max-h-[65vh]">
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => handleSelectTemplate(t)}
              className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-purple-500/30 hover:border-purple-600 cursor-pointer shadow-sm hover:shadow-xl hover:scale-105 transition-all bg-[#faf8fc] dark:bg-[#181622] flex items-center justify-center p-1.5"
            >
              <img src={t.image} alt={t.name} className="w-full h-full object-contain pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ThemePickerModal);
