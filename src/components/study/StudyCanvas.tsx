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
}

const STICKY_COLORS = [
  { name: 'Yellow', bg: '#fef08a', border: '#facc15' },
  { name: 'Pink', bg: '#fbcfe8', border: '#f472b6' },
  { name: 'Blue', bg: '#bfdbfe', border: '#60a5fa' },
  { name: 'Green', bg: '#bbf7d0', border: '#4ade80' },
  { name: 'Purple', bg: '#e9d5ff', border: '#c084fc' },
  { name: 'Amber', bg: '#fed7aa', border: '#fb923c' },
];

export default function StudyCanvas({ document, onClose }: StudyCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  
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

  // Modals & Popovers
  const [showAiPicker, setShowAiPicker] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
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
          content: 'This is an infinite digital whiteboard for your study notes.\n\n• Drag cards around\n• Use ✨ Insert AI to drop cached chapter summaries & concepts\n• Add arrows, shapes & sticky notes\n• Zoom with +/- buttons!',
          x: 100,
          y: 80,
          width: 280,
          height: 220,
          color: '#fef08a',
        },
        {
          id: 'welcome_2',
          type: 'ai-card',
          title: '🤖 Study Subject',
          content: `Document: ${document.name}\n\nUse this space to build mind maps, flowcharts, and visual summaries!`,
          x: 440,
          y: 100,
          width: 260,
          height: 160,
          color: '#e9d5ff',
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

  // 3. Pan & Drag Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking background canvas, start panning
    if ((e.target as HTMLElement).classList.contains('canvas-bg') || (e.target as HTMLElement).classList.contains('canvas-container')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    } else if (draggingId) {
      const rawX = (e.clientX - dragOffset.x - pan.x) / scale;
      const rawY = (e.clientY - dragOffset.y - pan.y) / scale;
      const finalX = gridSnap ? Math.round(rawX / GRID_SIZE) * GRID_SIZE : Math.round(rawX);
      const finalY = gridSnap ? Math.round(rawY / GRID_SIZE) * GRID_SIZE : Math.round(rawY);

      setItems(prev => prev.map(item => item.id === draggingId ? { ...item, x: finalX, y: finalY } : item));
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    } else if (draggingId) {
      setDraggingId(null);
      // Push state to history after drag completes
      saveItems(items, true);
    }
  };

  const startDraggingItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    setDraggingId(id);
    const item = items.find(i => i.id === id);
    if (item) {
      const screenX = item.x * scale + pan.x;
      const screenY = item.y * scale + pan.y;
      setDragOffset({ x: e.clientX - screenX, y: e.clientY - screenY });
    }
  };

  // 4. Item Creation Helpers
  const addItem = (type: CanvasItem['type'], shapeType?: CanvasItem['shapeType']) => {
    setShowAddMenu(false);
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
      width: type === 'sticky' ? 220 : type === 'text' ? 240 : type === 'shape' && shapeType === 'circle' ? 140 : 180,
      height: type === 'sticky' ? 180 : type === 'text' ? 120 : type === 'shape' && shapeType === 'circle' ? 140 : 120,
      color: type === 'sticky' ? '#fef08a' : type === 'shape' ? '#bfdbfe' : '#ffffff',
      shapeType,
    };

    if (type === 'arrow') {
      newItem = {
        ...newItem,
        title: '➔ Connector Arrow',
        content: 'Flow / Relationship ➔',
        width: 200,
        height: 50,
        color: '#7c6a75',
      };
    }

    const next = [...items, newItem];
    saveItems(next, true);
    setSelectedId(id);
  };

  // 5. Insert AI Content Helper
  const insertAiCard = (title: string, text: string, color = '#e9d5ff') => {
    setShowAiPicker(false);
    const id = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const centerX = Math.round((-pan.x + 250 + items.length * 20) / scale / GRID_SIZE) * GRID_SIZE;
    const centerY = Math.round((-pan.y + 180 + items.length * 20) / scale / GRID_SIZE) * GRID_SIZE;

    const newItem: CanvasItem = {
      id,
      type: 'ai-card',
      title: `✨ AI: ${title}`,
      content: text,
      x: centerX > 0 ? centerX : 150,
      y: centerY > 0 ? centerY : 150,
      width: 280,
      height: 200,
      color,
      isAiCard: true,
    };

    const next = [...items, newItem];
    saveItems(next, true);
    setSelectedId(id);
  };

  // 6. Delete & Update Item Content
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
        <div className="bg-[#7c6a75] dark:bg-[#342e48] text-white px-5 py-2.5 flex flex-wrap items-center justify-between shadow-md z-30 gap-2">
          
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
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="bg-white text-[#7c6a75] hover:bg-white/90 font-black px-3 py-1.5 rounded-xl text-xs shadow-sm flex items-center gap-1 transition-all hover:scale-105"
              >
                <span>➕ Add Item</span>
                <span>▾</span>
              </button>
              {showAddMenu && (
                <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/40 rounded-xl shadow-2xl p-1.5 z-[60] flex flex-col min-w-[150px] text-gray-800 dark:text-gray-200 text-xs">
                  <button onClick={() => addItem('sticky')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">📌 Sticky Note</button>
                  <button onClick={() => addItem('text')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">📝 Text Box</button>
                  <button onClick={() => addItem('arrow')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">➔ Connector Arrow</button>
                  <button onClick={() => addItem('shape', 'rectangle')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">🔲 Rectangle Box</button>
                  <button onClick={() => addItem('shape', 'circle')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">⚪ Circle / Concept</button>
                </div>
              )}
            </div>

            {/* ✨ INSERT AI BUTTON (Crucial requested feature!) */}
            <div className="relative">
              <button
                onClick={() => setShowAiPicker(!showAiPicker)}
                className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-300 hover:to-pink-400 text-black font-black px-3 py-1.5 rounded-xl text-xs shadow-md flex items-center gap-1.5 animate-pulse transition-transform hover:scale-105"
              >
                <span>✨ Insert AI</span>
                <span>▾</span>
              </button>

              {showAiPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#232130] border-2 border-[#7c6a75]/40 rounded-2xl shadow-2xl p-2 z-[60] w-[300px] max-h-[400px] overflow-y-auto custom-scrollbar text-gray-800 dark:text-gray-200 text-xs">
                  <div className="font-black text-center text-xs text-[#7c6a75] dark:text-purple-300 border-b pb-1 mb-2">
                    ✨ Cached Document Insights
                  </div>
                  
                  {/* Chapter Summary Card Option */}
                  {document.aiData?.aiNotes?.chapterSummary && (
                    <button
                      onClick={() => insertAiCard('Chapter Summary', document.aiData!.aiNotes!.chapterSummary!, '#fbcfe8')}
                      className="w-full text-left bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 p-2 rounded-lg border border-pink-200 mb-1.5 font-medium transition-colors"
                    >
                      <div className="font-bold text-pink-700 dark:text-pink-300">📑 Chapter Summary</div>
                      <div className="text-[10px] text-gray-600 dark:text-gray-400 truncate mt-0.5">{document.aiData.aiNotes.chapterSummary}</div>
                    </button>
                  )}

                  {/* Key Concepts Options */}
                  {document.aiData?.aiNotes?.keyConcepts && document.aiData.aiNotes.keyConcepts.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] font-bold uppercase text-gray-400 mt-2 mb-1">Key Concepts</div>
                      {document.aiData.aiNotes.keyConcepts.map((kc, i) => (
                        <button
                          key={i}
                          onClick={() => insertAiCard(`Concept #${i+1}`, String(kc), '#e9d5ff')}
                          className="w-full text-left bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 p-1.5 rounded border border-purple-200 mb-1 text-[11px] font-medium transition-colors truncate"
                        >
                          ⚡ {String(kc)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Revision Summaries Options */}
                  {document.aiData?.revisionNotes?.oneLineSummaries && document.aiData.revisionNotes.oneLineSummaries.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] font-bold uppercase text-gray-400 mt-2 mb-1">Revision One-Liners</div>
                      {document.aiData.revisionNotes.oneLineSummaries.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => insertAiCard(`Revision #${i+1}`, String(s), '#fef08a')}
                          className="w-full text-left bg-yellow-50 dark:bg-yellow-950/40 hover:bg-yellow-100 p-1.5 rounded border border-yellow-200 mb-1 text-[11px] font-medium transition-colors truncate text-black"
                        >
                          📌 {String(s)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Important Facts Options */}
                  {document.aiData?.aiNotes?.importantFacts && document.aiData.aiNotes.importantFacts.length > 0 && (
                    <div className="mb-1">
                      <div className="text-[10px] font-bold uppercase text-gray-400 mt-2 mb-1">Important Facts</div>
                      {document.aiData.aiNotes.importantFacts.map((f, i) => (
                        <button
                          key={i}
                          onClick={() => insertAiCard(`Fact #${i+1}`, String(f), '#bbf7d0')}
                          className="w-full text-left bg-green-50 dark:bg-green-950/40 hover:bg-green-100 p-1.5 rounded border border-green-200 mb-1 text-[11px] font-medium transition-colors truncate text-black"
                        >
                          🎯 {String(f)}
                        </button>
                      ))}
                    </div>
                  )}

                  {!document.aiData?.aiNotes && !document.aiData?.revisionNotes && (
                    <div className="text-center py-4 text-gray-400 italic">
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
          {/* Zoom & Pan Transform Wrapper */}
          <div
            className="absolute origin-top-left pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              width: '100%',
              height: '100%',
            }}
          >
            {items.map((item) => {
              const isSelected = selectedId === item.id;
              const isSticky = item.type === 'sticky' || item.isAiCard;
              const isShape = item.type === 'shape';
              const isArrow = item.type === 'arrow';

              return (
                <div
                  key={item.id}
                  onMouseDown={(e) => startDraggingItem(e, item.id)}
                  className={`absolute pointer-events-auto transition-shadow rounded-2xl flex flex-col ${
                    isSelected ? 'ring-4 ring-purple-500 shadow-2xl z-20 scale-[1.02]' : 'shadow-md z-10 hover:shadow-lg'
                  }`}
                  style={{
                    left: `${item.x}px`,
                    top: `${item.y}px`,
                    width: `${item.width}px`,
                    minHeight: `${item.height}px`,
                    backgroundColor: isArrow ? 'transparent' : item.color || '#ffffff',
                    borderRadius: isShape && item.shapeType === 'circle' ? '50%' : '16px',
                    border: isArrow ? 'none' : isSelected ? '2px solid #8b5cf6' : '2px solid rgba(124, 106, 117, 0.2)',
                  }}
                >
                  {/* Item Header / Title bar */}
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-black/10 rounded-t-2xl bg-black/5 cursor-move">
                    <span className="font-black text-xs text-[#5d5770] truncate max-w-[150px]">
                      {item.title || (isSticky ? '📌 Sticky Note' : isArrow ? '➔ Arrow' : '📝 Note')}
                    </span>

                    {/* Color picker & Delete button for selected item */}
                    <div className="flex items-center gap-1">
                      {isSelected && isSticky && (
                        <div className="flex items-center gap-0.5 mr-1">
                          {STICKY_COLORS.map(col => (
                            <button
                              key={col.name}
                              onClick={(e) => { e.stopPropagation(); updateItemColor(item.id, col.bg); }}
                              className="w-3.5 h-3.5 rounded-full border border-black/30 hover:scale-125 transition-transform"
                              style={{ backgroundColor: col.bg }}
                              title={col.name}
                            />
                          ))}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                        className="text-red-500 hover:text-red-700 font-bold px-1 text-xs"
                        title="Delete card"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Item Body / ContentEditable area */}
                  <div className="flex-1 p-3 flex flex-col justify-center">
                    <textarea
                      value={item.content}
                      onChange={(e) => updateItemContent(item.id, e.target.value)}
                      placeholder="Type note or idea here..."
                      className={`w-full h-full bg-transparent border-none focus:outline-none resize-none font-sans text-xs md:text-sm text-[#333333] custom-scrollbar ${
                        isArrow ? 'font-black text-center text-base md:text-lg text-[#7c6a75]' : ''
                      }`}
                      style={{
                        minHeight: `${item.height - 40}px`,
                        textAlign: isShape && item.shapeType === 'circle' ? 'center' : 'left',
                      }}
                      onMouseDown={(e) => e.stopPropagation()} // Let typing happen without dragging
                    />
                  </div>
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
