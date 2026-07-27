'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { StudyDocument } from '@/types';

interface StudyCanvasProps {
  document: StudyDocument;
  onClose: () => void;
}

export interface CanvasItem {
  id: string;
  type: 'text' | 'sticky' | 'shape' | 'image' | 'arrow' | 'ai-card';
  title?: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string; // bg hex or rgba
  shapeType?: 'rectangle' | 'circle' | 'line' | 'arrow';
  fontSize?: number;
  isAiCard?: boolean;
  // Connector arrow enhancements
  fromId?: string;
  toId?: string;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

// Cute Pastel Memo Themes matching the reference aesthetics
const MEMO_THEMES = [
  { name: 'Yellow Sun', bg: '#fffdf0', border: '#fde047', headerBg: '#fef08a', text: '#713f12', badge: '☀️ NOTE', accent: '🐻' },
  { name: 'Rose Strawberry', bg: '#fff5f7', border: '#f472b6', headerBg: '#fbcfe8', text: '#881337', badge: '💖 NOTE', accent: '🍓' },
  { name: 'Sky Cloud', bg: '#f0f9ff', border: '#38bdf8', headerBg: '#bae6fd', text: '#0c4a6e', badge: '☁️ NOTE', accent: '🐧' },
  { name: 'Sage Clover', bg: '#f2fbf5', border: '#4ade80', headerBg: '#bbf7d0', text: '#14532d', badge: '🍀 NOTE', accent: '🌷' },
  { name: 'Lavender Dream', bg: '#f8f5ff', border: '#c084fc', headerBg: '#e9d5ff', text: '#581c87', badge: '🔮 NOTE', accent: '🎀' },
  { name: 'Peach Apricot', bg: '#fffaf5', border: '#fb923c', headerBg: '#fed7aa', text: '#7c2d12', badge: '🍑 NOTE', accent: '🌸' },
];

export default function StudyCanvas({ document, onClose }: StudyCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  // Items state & history for Undo/Redo
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [history, setHistory] = useState<CanvasItem[][]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Workspace Viewport (Zoom & Pan)
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Grid Snapping
  const [gridSnap, setGridSnap] = useState<boolean>(true);
  const GRID_SIZE = 20;

  // Active item selection & dragging
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Resizing State
  const [resizingState, setResizingState] = useState<{
    id: string;
    handle: 'se' | 'sw' | 'ne' | 'nw' | 'arrow-start' | 'arrow-end';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startItemX: number;
    startItemY: number;
  } | null>(null);

  // Smart Alignment Guides (Canva/Figma style)
  const [alignGuides, setAlignGuides] = useState<{ x?: number; y?: number }>({});

  // Modals & Popovers
  const [activeDropdown, setActiveDropdown] = useState<'add' | 'ai' | null>(null);
  const [lastSaved, setLastSaved] = useState<string>('Just now');

  // 1. Load saved canvas items from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`dazai_canvas_${document.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
            setHistory([parsed]);
            setHistoryIdx(0);
            const time = localStorage.getItem(`dazai_canvas_time_${document.id}`) || 'Earlier';
            setLastSaved(time);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load canvas items', e);
      }

      // Default welcome cards if canvas is empty
      const initial: CanvasItem[] = [
        {
          id: 'welcome_1',
          type: 'sticky',
          title: '📌 Welcome to Study Canvas!',
          content: 'This is an infinite pastel study whiteboard.\n\n• Double click to edit note cards\n• Drag corner handles to resize any object\n• Use ✨ Insert AI to drop readable summaries\n• Connect ideas with snapping arrows!',
          x: 100,
          y: 80,
          width: 300,
          height: 240,
          color: '#fffdf0',
        },
        {
          id: 'welcome_2',
          type: 'ai-card',
          title: '🤖 Study Subject',
          content: `Document: ${document.name}\n\nUse this space to build mind maps, flowcharts, and visual summaries!`,
          x: 460,
          y: 100,
          width: 280,
          height: 200,
          color: '#f8f5ff',
          isAiCard: true,
        },
      ];
      setItems(initial);
      setHistory([initial]);
      setHistoryIdx(0);
    }
  }, [document.id, document.name]);

  // 2. Save Helper with History
  const saveItems = useCallback((newItems: CanvasItem[], addToHistory = true) => {
    setItems(newItems);
    if (addToHistory) {
      setHistory(prev => {
        const next = prev.slice(0, historyIdx + 1);
        return [...next, newItems];
      });
      setHistoryIdx(prev => prev + 1);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`dazai_canvas_${document.id}`, JSON.stringify(newItems));
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      localStorage.setItem(`dazai_canvas_time_${document.id}`, now);
      setLastSaved(now);
    }
  }, [document.id, historyIdx]);

  const handleUndo = () => {
    if (historyIdx > 0) {
      const prevIdx = historyIdx - 1;
      setHistoryIdx(prevIdx);
      const prevItems = history[prevIdx];
      setItems(prevItems);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`dazai_canvas_${document.id}`, JSON.stringify(prevItems));
      }
    }
  };

  const handleRedo = () => {
    if (historyIdx < history.length - 1) {
      const nextIdx = historyIdx + 1;
      setHistoryIdx(nextIdx);
      const nextItems = history[nextIdx];
      setItems(nextItems);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`dazai_canvas_${document.id}`, JSON.stringify(nextItems));
      }
    }
  };

  // 3. Dropdown Outside Click and Esc Key Listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
        setSelectedId(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  // 4. Keyboard Shortcuts: Delete Item and Duplicate (Ctrl+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (selectedId) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          const next = items.filter(i => i.id !== selectedId);
          saveItems(next, true);
          setSelectedId(null);
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          const original = items.find(i => i.id === selectedId);
          if (original) {
            const newId = `item_${Date.now()}`;
            const duplicate: CanvasItem = {
              ...original,
              id: newId,
              x: original.x + 30,
              y: original.y + 30,
            };
            saveItems([...items, duplicate], true);
            setSelectedId(newId);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, items, saveItems]);

  // 5. Pan & Drag Event Handlers with Smart Alignment Guides
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('canvas-bg') || target.classList.contains('canvas-container')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedId(null);
      setActiveDropdown(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (resizingState) {
      const deltaX = (e.clientX - resizingState.startX) / scale;
      const deltaY = (e.clientY - resizingState.startY) / scale;

      setItems(prev => prev.map(item => {
        if (item.id !== resizingState.id) return item;

        if (item.type === 'arrow') {
          if (resizingState.handle === 'arrow-start') {
            const newSX = (item.startX ?? item.x) + deltaX;
            const newSY = (item.startY ?? item.y) + deltaY;
            let snappedFromId = undefined;
            for (const other of prev) {
              if (other.id === item.id || other.type === 'arrow') continue;
              const cx = other.x + other.width / 2;
              const cy = other.y + other.height / 2;
              if (Math.hypot(cx - newSX, cy - newSY) < 60) {
                snappedFromId = other.id;
                break;
              }
            }
            return { ...item, startX: newSX, startY: newSY, fromId: snappedFromId };
          } else if (resizingState.handle === 'arrow-end') {
            const newEX = (item.endX ?? (item.x + item.width)) + deltaX;
            const newEY = (item.endY ?? (item.y + item.height)) + deltaY;
            let snappedToId = undefined;
            for (const other of prev) {
              if (other.id === item.id || other.type === 'arrow') continue;
              const cx = other.x + other.width / 2;
              const cy = other.y + other.height / 2;
              if (Math.hypot(cx - newEX, cy - newEY) < 60) {
                snappedToId = other.id;
                break;
              }
            }
            return { ...item, endX: newEX, endY: newEY, toId: snappedToId };
          }
        }

        let newW = resizingState.startW;
        let newH = resizingState.startH;
        let newX = item.x;
        let newY = item.y;

        if (resizingState.handle === 'se') {
          newW = Math.max(80, resizingState.startW + deltaX);
          newH = Math.max(80, resizingState.startH + deltaY);
        } else if (resizingState.handle === 'sw') {
          newW = Math.max(80, resizingState.startW - deltaX);
          newH = Math.max(80, resizingState.startH + deltaY);
          if (newW > 80) newX = resizingState.startItemX + deltaX;
        } else if (resizingState.handle === 'ne') {
          newW = Math.max(80, resizingState.startW + deltaX);
          newH = Math.max(80, resizingState.startH - deltaY);
          if (newH > 80) newY = resizingState.startItemY + deltaY;
        } else if (resizingState.handle === 'nw') {
          newW = Math.max(80, resizingState.startW - deltaX);
          newH = Math.max(80, resizingState.startH - deltaY);
          if (newW > 80) newX = resizingState.startItemX + deltaX;
          if (newH > 80) newY = resizingState.startItemY + deltaY;
        }

        return { ...item, width: Math.round(newW), height: Math.round(newH), x: Math.round(newX), y: Math.round(newY) };
      }));
      return;
    }

    if (draggingId) {
      const rawX = (e.clientX - dragOffset.x - pan.x) / scale;
      const rawY = (e.clientY - dragOffset.y - pan.y) / scale;
      let finalX = gridSnap ? Math.round(rawX / GRID_SIZE) * GRID_SIZE : Math.round(rawX);
      let finalY = gridSnap ? Math.round(rawY / GRID_SIZE) * GRID_SIZE : Math.round(rawY);

      // Smart Alignment Guides calculation
      const activeItem = items.find(i => i.id === draggingId);
      const newGuides: { x?: number; y?: number } = {};
      if (activeItem) {
        const center = finalX + activeItem.width / 2;
        const middle = finalY + activeItem.height / 2;

        for (const other of items) {
          if (other.id === draggingId || other.type === 'arrow') continue;
          const otherCenter = other.x + other.width / 2;
          const otherMiddle = other.y + other.height / 2;

          // Align X (Left, Center, Right)
          if (Math.abs(finalX - other.x) < 8) { finalX = other.x; newGuides.x = other.x; }
          else if (Math.abs(center - otherCenter) < 8) { finalX = otherCenter - activeItem.width / 2; newGuides.x = otherCenter; }
          else if (Math.abs(finalX + activeItem.width - (other.x + other.width)) < 8) { finalX = other.x + other.width - activeItem.width; newGuides.x = other.x + other.width; }

          // Align Y (Top, Middle, Bottom)
          if (Math.abs(finalY - other.y) < 8) { finalY = other.y; newGuides.y = other.y; }
          else if (Math.abs(middle - otherMiddle) < 8) { finalY = otherMiddle - activeItem.height / 2; newGuides.y = otherMiddle; }
          else if (Math.abs(finalY + activeItem.height - (other.y + other.height)) < 8) { finalY = other.y + other.height - activeItem.height; newGuides.y = other.y + other.height; }
        }
      }
      setAlignGuides(newGuides);

      setItems(prev => prev.map(item => item.id === draggingId ? { ...item, x: finalX, y: finalY } : item));
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    } else if (resizingState) {
      setResizingState(null);
      saveItems(items, true);
    } else if (draggingId) {
      setDraggingId(null);
      setAlignGuides({});
      saveItems(items, true);
    }
  };

  const startDraggingItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    setDraggingId(id);
    setActiveDropdown(null);
    const item = items.find(i => i.id === id);
    if (item) {
      const screenX = item.x * scale + pan.x;
      const screenY = item.y * scale + pan.y;
      setDragOffset({ x: e.clientX - screenX, y: e.clientY - screenY });
    }
  };

  const startResizing = (e: React.MouseEvent, id: string, handle: 'se' | 'sw' | 'ne' | 'nw' | 'arrow-start' | 'arrow-end') => {
    e.stopPropagation();
    const item = items.find(i => i.id === id);
    if (item) {
      setResizingState({
        id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startW: item.width,
        startH: item.height,
        startItemX: item.x,
        startItemY: item.y,
      });
    }
  };

  // 6. Item Creation Helpers
  const addItem = (type: CanvasItem['type'], shapeType?: CanvasItem['shapeType']) => {
    setActiveDropdown(null);
    const id = `item_${Date.now()}`;
    const centerX = Math.round((-pan.x + 200) / scale / GRID_SIZE) * GRID_SIZE;
    const centerY = Math.round((-pan.y + 150) / scale / GRID_SIZE) * GRID_SIZE;

    let newItem: CanvasItem = {
      id,
      type,
      title: type === 'sticky' ? '📌 Sticky Note' : type === 'text' ? 'Text Box' : undefined,
      content: type === 'sticky' ? 'Type note here...' : type === 'text' ? 'Double click to edit text...' : '',
      x: centerX > 0 ? centerX : 100,
      y: centerY > 0 ? centerY : 100,
      width: type === 'sticky' ? 260 : type === 'text' ? 240 : type === 'shape' && shapeType === 'circle' ? 160 : 200,
      height: type === 'sticky' ? 220 : type === 'text' ? 120 : type === 'shape' && shapeType === 'circle' ? 160 : 120,
      color: type === 'sticky' ? '#fffdf0' : type === 'shape' ? '#e0f2fe' : '#ffffff',
      shapeType,
    };

    if (type === 'arrow') {
      const startCard = items[items.length - 1];
      const endCard = items[items.length - 2];
      newItem = {
        ...newItem,
        title: '➔ Connector Arrow',
        content: 'Connects to ➔',
        width: 150,
        height: 80,
        color: '#8b5cf6',
        startX: startCard ? startCard.x + startCard.width / 2 : centerX,
        startY: startCard ? startCard.y + startCard.height / 2 : centerY,
        endX: endCard ? endCard.x + endCard.width / 2 : centerX + 200,
        endY: endCard ? endCard.y + endCard.height / 2 : centerY + 100,
        fromId: startCard?.id,
        toId: endCard?.id,
      };
    }

    const next = [...items, newItem];
    saveItems(next, true);
    setSelectedId(id);
  };

  // 7. Insert AI Content Helper (Readable formatting with larger contrast font)
  const insertAiCard = (title: string, text: string, themeBg = '#f8f5ff') => {
    setActiveDropdown(null);
    const id = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const centerX = Math.round((-pan.x + 250 + items.length * 25) / scale / GRID_SIZE) * GRID_SIZE;
    const centerY = Math.round((-pan.y + 180 + items.length * 25) / scale / GRID_SIZE) * GRID_SIZE;

    const newItem: CanvasItem = {
      id,
      type: 'ai-card',
      title: `✨ AI: ${title}`,
      content: text,
      x: centerX > 0 ? centerX : 150,
      y: centerY > 0 ? centerY : 150,
      width: 320,
      height: 240,
      color: themeBg,
      isAiCard: true,
    };

    const next = [...items, newItem];
    saveItems(next, true);
    setSelectedId(id);
  };

  // 8. Delete & Update Item Content
  const deleteItem = (id: string) => {
    const next = items.filter(i => i.id !== id);
    saveItems(next, true);
    if (selectedId === id) setSelectedId(null);
  };

  const updateItemContent = (id: string, newContent: string) => {
    const next = items.map(i => i.id === id ? { ...i, content: newContent } : i);
    saveItems(next, false);
  };

  const updateItemColor = (id: string, color: string) => {
    const next = items.map(i => i.id === id ? { ...i, color } : i);
    saveItems(next, true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999999] bg-[#0f0e17]/85 backdrop-blur-2xl flex items-center justify-center p-2 md:p-6 select-none"
    >
      <div className="bg-[#faf8fc] dark:bg-[#181622] border-4 border-[#7c6a75] dark:border-[#a78bfa] rounded-3xl shadow-[0_20px_70px_rgba(0,0,0,0.9)] w-full h-[96vh] flex flex-col overflow-hidden relative">
        
        {/* --- CANVAS TOP TOOLBAR --- */}
        <div ref={toolbarRef} className="bg-[#7c6a75] dark:bg-[#342e48] text-white px-5 py-2.5 flex flex-wrap items-center justify-between shadow-md z-30 gap-2">
          
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎨</span>
            <div>
              <h2 className="font-black text-sm md:text-base tracking-wide flex items-center gap-2">
                <span>Study Canvas Whiteboard</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Infinite Workspace</span>
              </h2>
              <p className="text-[10px] text-white/80 hidden md:block">Organize note cards, mind maps, flowcharts, and AI insights freely</p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            
            {/* Undo / Redo */}
            <div className="flex items-center gap-0.5 bg-black/20 p-1 rounded-lg">
              <button onClick={handleUndo} disabled={historyIdx <= 0} className="px-2 py-1 hover:bg-white/20 disabled:opacity-40 rounded text-xs font-bold" title="Undo">↩ Undo</button>
              <button onClick={handleRedo} disabled={historyIdx >= history.length - 1} className="px-2 py-1 hover:bg-white/20 disabled:opacity-40 rounded text-xs font-bold" title="Redo">↪ Redo</button>
            </div>

            {/* Add Items Dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'add' ? null : 'add')}
                className="bg-white text-[#7c6a75] hover:bg-white/90 font-black px-3 py-1.5 rounded-xl text-xs shadow-sm flex items-center gap-1 transition-all hover:scale-105"
              >
                <span>➕ Add Item</span>
                <span>▾</span>
              </button>
              {activeDropdown === 'add' && (
                <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/40 rounded-xl shadow-2xl p-1.5 z-[60] flex flex-col min-w-[170px] text-gray-800 dark:text-gray-200 text-xs">
                  <button onClick={() => addItem('sticky')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">📌 Pastel Memo Note</button>
                  <button onClick={() => addItem('text')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">📝 Transparent Text</button>
                  <button onClick={() => addItem('arrow')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">➔ Snapping Arrow</button>
                  <button onClick={() => addItem('shape', 'rectangle')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">🔲 Rectangle Box</button>
                  <button onClick={() => addItem('shape', 'circle')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">⚪ Circle / Concept</button>
                </div>
              )}
            </div>

            {/* ✨ INSERT AI BUTTON (Enhanced contrast, size & spacing) */}
            <div className="relative">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'ai' ? null : 'ai')}
                className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-300 hover:to-pink-400 text-black font-black px-3 py-1.5 rounded-xl text-xs shadow-md flex items-center gap-1.5 animate-pulse transition-transform hover:scale-105"
              >
                <span>✨ Insert AI</span>
                <span>▾</span>
              </button>

              {activeDropdown === 'ai' && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#232130] border-2 border-[#7c6a75]/40 rounded-2xl shadow-2xl p-3 z-[60] w-[340px] max-h-[460px] overflow-y-auto custom-scrollbar text-gray-900 dark:text-gray-100 text-xs">
                  <div className="font-black text-center text-xs text-[#7c6a75] dark:text-purple-300 border-b pb-2 mb-3">
                    ✨ Cached Document Insights
                  </div>
                  
                  {/* Chapter Summary Card Option */}
                  {document.aiData?.aiNotes?.chapterSummary && (
                    <button
                      onClick={() => insertAiCard('Chapter Summary', document.aiData!.aiNotes!.chapterSummary!, '#fff5f7')}
                      className="w-full text-left bg-pink-50 dark:bg-pink-950/50 hover:bg-pink-100 dark:hover:bg-pink-900/60 p-2.5 rounded-xl border border-pink-300 dark:border-pink-500/40 mb-2.5 transition-all shadow-sm group"
                    >
                      <div className="font-bold text-sm text-pink-700 dark:text-pink-300 mb-1 flex items-center justify-between">
                        <span>📑 Chapter Summary</span>
                        <span className="text-[10px] bg-pink-200 dark:bg-pink-800 px-1.5 py-0.5 rounded text-pink-900 dark:text-pink-100 font-mono">Insert +</span>
                      </div>
                      <div className="text-xs text-gray-800 dark:text-gray-200 font-normal leading-relaxed whitespace-normal break-words line-clamp-3">
                        {document.aiData.aiNotes.chapterSummary}
                      </div>
                    </button>
                  )}

                  {/* Key Concepts Options */}
                  {document.aiData?.aiNotes?.keyConcepts && document.aiData.aiNotes.keyConcepts.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-2 mb-1.5 px-1">Key Concepts</div>
                      <div className="flex flex-col gap-1.5">
                        {document.aiData.aiNotes.keyConcepts.map((kc, i) => (
                          <button
                            key={i}
                            onClick={() => insertAiCard(`Concept #${i+1}`, String(kc), '#f8f5ff')}
                            className="w-full text-left bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 p-2.5 rounded-xl border border-purple-300 dark:border-purple-500/40 text-xs font-semibold text-gray-900 dark:text-gray-100 transition-all shadow-sm whitespace-normal break-words leading-relaxed"
                          >
                            ⚡ {String(kc)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Revision Summaries Options */}
                  {document.aiData?.revisionNotes?.oneLineSummaries && document.aiData.revisionNotes.oneLineSummaries.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-2 mb-1.5 px-1">Revision One-Liners</div>
                      <div className="flex flex-col gap-1.5">
                        {document.aiData.revisionNotes.oneLineSummaries.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => insertAiCard(`Revision #${i+1}`, String(s), '#fffdf0')}
                            className="w-full text-left bg-yellow-50 dark:bg-yellow-950/50 hover:bg-yellow-100 dark:hover:bg-yellow-900/60 p-2.5 rounded-xl border border-yellow-300 dark:border-yellow-500/40 text-xs font-semibold text-gray-900 dark:text-gray-100 transition-all shadow-sm whitespace-normal break-words leading-relaxed"
                          >
                            📌 {String(s)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Important Facts Options */}
                  {document.aiData?.aiNotes?.importantFacts && document.aiData.aiNotes.importantFacts.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-2 mb-1.5 px-1">Important Facts</div>
                      <div className="flex flex-col gap-1.5">
                        {document.aiData.aiNotes.importantFacts.map((f, i) => (
                          <button
                            key={i}
                            onClick={() => insertAiCard(`Fact #${i+1}`, String(f), '#f2fbf5')}
                            className="w-full text-left bg-green-50 dark:bg-green-950/50 hover:bg-green-100 dark:hover:bg-green-900/60 p-2.5 rounded-xl border border-green-300 dark:border-green-500/40 text-xs font-semibold text-gray-900 dark:text-gray-100 transition-all shadow-sm whitespace-normal break-words leading-relaxed"
                          >
                            🎯 {String(f)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!document.aiData?.aiNotes && !document.aiData?.revisionNotes && (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400 font-medium italic text-xs">
                      No AI insights generated yet. Generate AI Notes in the main panel first!
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Grid Snap Toggle */}
            <button
              onClick={() => setGridSnap(!gridSnap)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                gridSnap ? 'bg-amber-400 text-black border-amber-500 shadow-sm' : 'bg-black/30 text-white/70 border-white/10 hover:bg-black/50'
              }`}
              title="Toggle 20px Grid Snapping"
            >
              📐 Grid Snap: {gridSnap ? 'ON' : 'OFF'}
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-lg text-xs font-bold">
              <button onClick={() => setScale(Math.max(0.5, scale - 0.1))} className="hover:text-amber-300 px-1">➖</button>
              <span className="w-10 text-center font-mono">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(Math.min(2.0, scale + 0.1))} className="hover:text-amber-300 px-1">➕</button>
              <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="text-[10px] ml-1 bg-white/20 px-1.5 py-0.5 rounded hover:bg-white/30" title="Reset Zoom & Pan">Reset</button>
            </div>

            {/* Close Canvas */}
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-red-500 hover:text-white text-white font-black px-3 py-1.5 rounded-xl transition-all ml-2 border border-white/20"
            >
              ✕ Close Canvas
            </button>

          </div>
        </div>

        {/* --- INFINITE WORKSPACE CANVAS AREA --- */}
        <div
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`flex-1 overflow-hidden relative canvas-container canvas-bg ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{
            backgroundImage: gridSnap 
              ? `radial-gradient(circle, rgba(124, 106, 117, 0.25) 1.5px, transparent 1.5px)` 
              : 'none',
            backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            backgroundColor: '#f7f5fa',
          }}
        >
          {/* Smart Alignment Guide Lines */}
          {alignGuides.x !== undefined && (
            <div
              className="absolute border-l-2 border-dashed border-purple-600 z-50 pointer-events-none"
              style={{ left: `${alignGuides.x * scale + pan.x}px`, top: 0, height: '100%' }}
            />
          )}
          {alignGuides.y !== undefined && (
            <div
              className="absolute border-t-2 border-dashed border-purple-600 z-50 pointer-events-none"
              style={{ left: 0, top: `${alignGuides.y * scale + pan.y}px`, width: '100%' }}
            />
          )}

          {/* Zoom & Pan Transform Wrapper */}
          <div
            className="absolute origin-top-left pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              width: '100%',
              height: '100%',
            }}
          >
            {/* --- SVG CONNECTOR ARROW OVERLAY --- */}
            <svg className="absolute inset-0 pointer-events-none z-15" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <marker id="arrowhead" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto">
                  <polygon points="0 0, 12 4, 0 8" fill="#8b5cf6" />
                </marker>
                <marker id="arrowhead-selected" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto">
                  <polygon points="0 0, 12 4, 0 8" fill="#ec4899" />
                </marker>
              </defs>
              {items.filter(i => i.type === 'arrow').map(arrow => {
                let sx = arrow.startX ?? (arrow.x + 10);
                let sy = arrow.startY ?? (arrow.y + 25);
                let ex = arrow.endX ?? (arrow.x + arrow.width - 10);
                let ey = arrow.endY ?? (arrow.y + 25);

                if (arrow.fromId) {
                  const fromItem = items.find(i => i.id === arrow.fromId);
                  if (fromItem) { sx = fromItem.x + fromItem.width / 2; sy = fromItem.y + fromItem.height / 2; }
                }
                if (arrow.toId) {
                  const toItem = items.find(i => i.id === arrow.toId);
                  if (toItem) { ex = toItem.x + toItem.width / 2; ey = toItem.y + toItem.height / 2; }
                }

                const isSelected = selectedId === arrow.id;
                const color = isSelected ? '#ec4899' : arrow.color || '#8b5cf6';

                const dx = ex - sx;
                const dy = ey - sy;
                const cx1 = sx + dx * 0.4;
                const cy1 = sy;
                const cx2 = ex - dx * 0.4;
                const cy2 = ey;
                const pathD = `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${ex} ${ey}`;

                return (
                  <g key={arrow.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedId(arrow.id); }}>
                    {/* Invisible wide hit target */}
                    <path d={pathD} stroke="transparent" strokeWidth="20" fill="none" />
                    {/* Visible arrow path */}
                    <path
                      d={pathD}
                      stroke={color}
                      strokeWidth={isSelected ? '4' : '3'}
                      strokeDasharray={arrow.shapeType === 'line' ? '6,6' : undefined}
                      fill="none"
                      markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
                    />
                    {/* Arrow text label */}
                    {arrow.content && (
                      <foreignObject x={(sx + ex) / 2 - 75} y={(sy + ey) / 2 - 16} width="150" height="32" className="pointer-events-none overflow-visible">
                        <div className="bg-white/95 dark:bg-[#232130]/95 px-2.5 py-0.5 rounded-lg border-2 border-purple-400 text-xs font-bold text-center text-purple-700 dark:text-purple-300 shadow-md truncate">
                          {arrow.content}
                        </div>
                      </foreignObject>
                    )}
                    {/* Snapping endpoints when selected */}
                    {isSelected && (
                      <>
                        <circle
                          cx={sx}
                          cy={sy}
                          r="7"
                          fill="#ffffff"
                          stroke="#8b5cf6"
                          strokeWidth="3"
                          className="cursor-move pointer-events-auto hover:scale-125 transition-transform shadow-md"
                          onMouseDown={(e) => startResizing(e, arrow.id, 'arrow-start')}
                          title="Drag to snap to card"
                        />
                        <circle
                          cx={ex}
                          cy={ey}
                          r="7"
                          fill="#ffffff"
                          stroke="#ec4899"
                          strokeWidth="3"
                          className="cursor-move pointer-events-auto hover:scale-125 transition-transform shadow-md"
                          onMouseDown={(e) => startResizing(e, arrow.id, 'arrow-end')}
                          title="Drag to snap to card"
                        />
                      </>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* --- CANVAS CARDS & SHAPES RENDERER --- */}
            {items.filter(i => i.type !== 'arrow').map((item) => {
              const isSelected = selectedId === item.id;
              const isSticky = item.type === 'sticky' || item.isAiCard;
              const isText = item.type === 'text';
              const isShape = item.type === 'shape';
              const isCircle = isShape && item.shapeType === 'circle';

              // Find matching memo theme for stickies
              const theme = MEMO_THEMES.find(t => t.bg === item.color || t.headerBg === item.color) || MEMO_THEMES[0];

              return (
                <div
                  key={item.id}
                  onMouseDown={(e) => startDraggingItem(e, item.id)}
                  className={`absolute pointer-events-auto transition-all flex flex-col group ${
                    isSelected
                      ? 'ring-2 ring-purple-600 shadow-[0_12px_40px_rgba(139,92,246,0.35)] z-20 scale-[1.01]'
                      : isText
                      ? 'hover:border-dashed hover:border-2 hover:border-gray-400 z-10'
                      : 'shadow-[0_8px_20px_rgba(0,0,0,0.08)] z-10 hover:shadow-xl'
                  }`}
                  style={{
                    left: `${item.x}px`,
                    top: `${item.y}px`,
                    width: `${item.width}px`,
                    minHeight: `${item.height}px`,
                    backgroundColor: isText ? 'transparent' : isSticky ? theme.bg : item.color || '#ffffff',
                    borderRadius: isCircle ? '50%' : isSticky ? '24px' : '16px',
                    border: isText && !isSelected ? '2px solid transparent' : isSticky ? `2.5px solid ${theme.border}` : isSelected ? '2px solid #8b5cf6' : '2px solid rgba(124, 106, 117, 0.25)',
                    backgroundImage: isSticky ? `radial-gradient(${theme.text}12 1px, transparent 1px)` : undefined,
                    backgroundSize: '16px 16px',
                  }}
                >
                  {/* --- MEMO BADGE / HEADER BAR --- */}
                  {isSticky ? (
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-t-3xl border-b border-black/5 cursor-move" style={{ backgroundColor: theme.headerBg }}>
                      <div className="flex items-center gap-1.5 font-black text-xs tracking-wide" style={{ color: theme.text }}>
                        <span>{theme.badge}</span>
                        <span className="text-[10px] opacity-75 truncate max-w-[120px]">{item.title?.replace('📌 ', '').replace('✨ AI: ', '')}</span>
                      </div>
                      
                      {/* Theme switcher & delete */}
                      <div className="flex items-center gap-1">
                        {isSelected && (
                          <div className="flex items-center gap-1 mr-1 bg-white/70 px-1.5 py-0.5 rounded-full shadow-inner">
                            {MEMO_THEMES.map(t => (
                              <button
                                key={t.name}
                                onClick={(e) => { e.stopPropagation(); updateItemColor(item.id, t.bg); }}
                                className="w-3.5 h-3.5 rounded-full border border-black/20 hover:scale-125 transition-transform"
                                style={{ backgroundColor: t.headerBg }}
                                title={t.name}
                              />
                            ))}
                          </div>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                          className="text-red-500 hover:text-red-700 font-bold px-1 text-xs"
                          title="Delete note (Del)"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : !isText ? (
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-black/10 rounded-t-2xl bg-black/5 cursor-move">
                      <span className="font-black text-xs text-[#5d5770] truncate max-w-[150px]">
                        {item.title || (isCircle ? '⚪ Concept Circle' : '🔲 Rectangle Box')}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                        className="text-red-500 hover:text-red-700 font-bold px-1 text-xs"
                        title="Delete shape (Del)"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}

                  {/* --- ITEM BODY / TEXTAREA --- */}
                  <div className="flex-1 p-3.5 flex flex-col justify-center relative">
                    <textarea
                      value={item.content}
                      onChange={(e) => updateItemContent(item.id, e.target.value)}
                      placeholder="Type note or idea here..."
                      className={`w-full h-full bg-transparent border-none focus:outline-none resize-none font-sans text-xs md:text-sm text-[#333333] dark:text-gray-200 custom-scrollbar leading-relaxed ${
                        isCircle ? 'text-center font-bold' : isText ? 'text-base font-medium' : ''
                      }`}
                      style={{
                        minHeight: `${item.height - (isSticky ? 50 : 35)}px`,
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    />

                    {/* Cute Corner Mascot for Pastel Memos */}
                    {isSticky && (
                      <div className="absolute bottom-2 right-2 text-xl select-none pointer-events-none opacity-85">
                        {theme.accent}
                      </div>
                    )}
                  </div>

                  {/* --- 4 CORNER RESIZE HANDLES WHEN SELECTED --- */}
                  {isSelected && (
                    <>
                      <div
                        onMouseDown={(e) => startResizing(e, item.id, 'nw')}
                        className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-purple-600 rounded-full cursor-nwse-resize shadow-md hover:scale-125 z-30"
                      />
                      <div
                        onMouseDown={(e) => startResizing(e, item.id, 'ne')}
                        className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-purple-600 rounded-full cursor-nesw-resize shadow-md hover:scale-125 z-30"
                      />
                      <div
                        onMouseDown={(e) => startResizing(e, item.id, 'sw')}
                        className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-purple-600 rounded-full cursor-nesw-resize shadow-md hover:scale-125 z-30"
                      />
                      <div
                        onMouseDown={(e) => startResizing(e, item.id, 'se')}
                        className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-purple-600 rounded-full cursor-nwse-resize shadow-md hover:scale-125 z-30"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Empty state hint */}
          {items.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400 font-bold text-sm">
              🎨 Canvas is empty. Click ➕ Add Item or ✨ Insert AI at the top!
            </div>
          )}
        </div>

        {/* --- CANVAS FOOTER STATUS --- */}
        <div className="bg-[#7c6a75]/10 dark:bg-black/30 border-t border-[#7c6a75]/20 px-4 py-1.5 flex items-center justify-between text-[11px] text-[#5d5770] dark:text-gray-400 font-medium z-30">
          <div className="flex items-center gap-4">
            <span>🗂️ <strong>{items.length}</strong> canvas cards</span>
            <span>📍 Pan: X={Math.round(pan.x)}, Y={Math.round(pan.y)}</span>
            <span className="hidden md:inline text-purple-600 dark:text-purple-400 font-bold">💡 Tip: Press Delete to remove card, Ctrl+D to duplicate</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Canvas auto-saved at {lastSaved}
            </span>
            <Button variant="ghost" onClick={() => saveItems(items, false)} className="text-[10px] py-0.5 px-2 font-bold hover:bg-white/50">
              💾 Save Now
            </Button>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
