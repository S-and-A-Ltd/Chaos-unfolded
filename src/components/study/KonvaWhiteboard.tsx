'use client';

import React, { useEffect } from 'react';
import { StudyDocument } from '@/types';
import { useCanvasStore } from '@/stores/useCanvasStore';
import WhiteboardToolbar from '@/components/study/canvas/WhiteboardToolbar';
import WhiteboardFormattingToolbar from '@/components/study/canvas/WhiteboardFormattingToolbar';
import WhiteboardStage from '@/components/study/canvas/WhiteboardStage';
import ThemePickerModal from '@/components/study/canvas/ThemePickerModal';
import TemplateStudioModal from '@/components/study/canvas/TemplateStudioModal';
import Button from '@/components/ui/Button';

interface KonvaWhiteboardProps {
  document: StudyDocument;
  onClose: () => void;
}

function KonvaWhiteboard({ document, onClose }: KonvaWhiteboardProps) {
  const initCanvas = useCanvasStore(state => state.initCanvas);
  const itemsLength = useCanvasStore(state => state.items.length);
  const panX = useCanvasStore(state => state.pan.x);
  const panY = useCanvasStore(state => state.pan.y);
  const lastSaved = useCanvasStore(state => state.lastSaved);
  const saveNow = useCanvasStore(state => state.saveNow);

  useEffect(() => {
    initCanvas(document.id, document.name);
  }, [document.id, document.name, initCanvas]);

  return (
    <div className="fixed inset-0 z-[999999] bg-[#0f0e17]/85 backdrop-blur-2xl flex items-center justify-center p-2 md:p-6 select-none">
      <div className="bg-[#faf8fc] dark:bg-[#181622] border-4 border-[#7c6a75] dark:border-[#a78bfa] rounded-3xl shadow-[0_20px_70px_rgba(0,0,0,0.9)] w-full h-[96vh] flex flex-col overflow-hidden relative">
        <WhiteboardToolbar document={document} onClose={onClose} />
        <WhiteboardFormattingToolbar />
        <WhiteboardStage />
        <ThemePickerModal />
        <TemplateStudioModal />

        <div className="bg-[#7c6a75]/10 dark:bg-black/30 border-t border-[#7c6a75]/20 px-4 py-1.5 flex items-center justify-between text-[11px] text-[#5d5770] dark:text-gray-400 font-medium z-30">
          <div className="flex items-center gap-4">
            <span>🗂️ <strong>{itemsLength}</strong> canvas objects</span>
            <span>📍 Pan: X={Math.round(panX)}, Y={Math.round(panY)}</span>
            <span className="hidden md:inline text-purple-600 dark:text-purple-400 font-bold">💡 Tip: Click purple edge dots to draw snapping connectors! Double-click card to edit text.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Canvas auto-saved at {lastSaved}
            </span>
            <Button variant="ghost" onClick={saveNow} className="text-[10px] py-0.5 px-2 font-bold">
              💾 Save Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(KonvaWhiteboard);
