'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { motion } from 'motion/react';
import { StudyDocument } from '@/types';
import { STICKY_TEMPLATES, getStickyTemplate, getStickyTemplates, saveCalibratedTemplate, StickyTemplate } from '@/components/study/stickyTemplates';

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
  textColor?: string;
  bgAsset?: string; // Transparent PNG/JPEG background template for asset-based sticky notes
  shapeType?: 'rectangle' | 'circle' | 'line' | 'arrow';
  fontSize?: number;
  fontFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  isAiCard?: boolean;
  fromId?: string;
  toId?: string;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

// Fallback pastel themes for non-asset AI cards
const FALLBACK_THEMES = [
  { name: 'Yellow Sun', bg: '#fffdf0', border: '#fde047' },
  { name: 'Rose Strawberry', bg: '#fff5f7', border: '#f472b6' },
  { name: 'Sky Cloud', bg: '#f0f9ff', border: '#38bdf8' },
  { name: 'Sage Clover', bg: '#f2fbf5', border: '#4ade80' },
  { name: 'Lavender Dream', bg: '#f8f5ff', border: '#c084fc' },
  { name: 'Peach Apricot', bg: '#fffaf5', border: '#fb923c' },
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
  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<string>('Just now');

  // DEV TOOL: Template Editor State
  const [devTemplates, setDevTemplates] = useState<StickyTemplate[]>(STICKY_TEMPLATES);
  const [activeDevIndex, setActiveDevIndex] = useState<number>(0);
  const [devDraggingArea, setDevDraggingArea] = useState<boolean>(false);
  const [devResizingArea, setDevResizingArea] = useState<string | null>(null);
  const [devDragStart, setDevDragStart] = useState<{ x: number; y: number; startTx: number; startTy: number; startTw: number; startTh: number }>({ x: 0, y: 0, startTx: 0, startTy: 0, startTw: 0, startTh: 0 });

  // 1. Preload sticky note templates & load canvas items from localStorage on mount
  useEffect(() => {
    const all = getStickyTemplates();
    setDevTemplates(all);
    all.forEach(t => {
      const img = new Image();
      img.src = t.image;
    });

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
          content: 'Welcome to Study Canvas!\nDouble click to edit me.\n• Drag me around\n• Resize any side\n• Connect ideas with arrows\n• Make it your own',
          x: 100,
          y: 80,
          width: 300,
          height: 300,
          bgAsset: all[0].image,
          fontSize: 15,
          fontFamily: "'Quicksand', 'Nunito', sans-serif",
          isBold: true,
          textColor: '#3A3A3A',
        },
        {
          id: 'welcome_2',
          type: 'ai-card',
          title: '🤖 Study Subject',
          content: `Document: ${document.name}\n\nUse this space to build mind maps, flowcharts, and visual summaries!`,
          x: 440,
          y: 100,
          width: 280,
          height: 220,
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
        setShowThemePicker(false);
        setShowTemplateEditor(false);
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

  // 4. Keyboard Shortcuts: Delete Item and Duplicate (Ctrl+D / Cmd+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (selectedId && !showTemplateEditor) {
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
  }, [selectedId, items, saveItems, showTemplateEditor]);

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

        const template = (item.type === 'sticky' || item.bgAsset) ? getStickyTemplate(item.bgAsset) : null;
        const aspect = template?.aspectRatio || 1.0;

        let newW = resizingState.startW;
        let newH = resizingState.startH;
        let newX = item.x;
        let newY = item.y;

        if (resizingState.handle === 'se') {
          newW = Math.max(100, resizingState.startW + deltaX);
          newH = template ? Math.round(newW / aspect) : Math.max(80, resizingState.startH + deltaY);
        } else if (resizingState.handle === 'sw') {
          newW = Math.max(100, resizingState.startW - deltaX);
          newH = template ? Math.round(newW / aspect) : Math.max(80, resizingState.startH + deltaY);
          if (newW > 100) newX = resizingState.startItemX + deltaX;
        } else if (resizingState.handle === 'ne') {
          newW = Math.max(100, resizingState.startW + deltaX);
          newH = template ? Math.round(newW / aspect) : Math.max(80, resizingState.startH - deltaY);
          if (newH > 80 && !template) newY = resizingState.startItemY + deltaY;
        } else if (resizingState.handle === 'nw') {
          newW = Math.max(100, resizingState.startW - deltaX);
          newH = template ? Math.round(newW / aspect) : Math.max(80, resizingState.startH - deltaY);
          if (newW > 100) newX = resizingState.startItemX + deltaX;
          if (newH > 80 && !template) newY = resizingState.startItemY + deltaY;
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

      const activeItem = items.find(i => i.id === draggingId);
      const newGuides: { x?: number; y?: number } = {};
      if (activeItem) {
        const center = finalX + activeItem.width / 2;
        const middle = finalY + activeItem.height / 2;

        for (const other of items) {
          if (other.id === draggingId || other.type === 'arrow') continue;
          const otherCenter = other.x + other.width / 2;
          const otherMiddle = other.y + other.height / 2;

          if (Math.abs(finalX - other.x) < 8) { finalX = other.x; newGuides.x = other.x; }
          else if (Math.abs(center - otherCenter) < 8) { finalX = otherCenter - activeItem.width / 2; newGuides.x = otherCenter; }
          else if (Math.abs(finalX + activeItem.width - (other.x + other.width)) < 8) { finalX = other.x + other.width - activeItem.width; newGuides.x = other.x + other.width; }

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

    const all = getStickyTemplates();
    const defaultTemplate = all[0];

    let newItem: CanvasItem = {
      id,
      type,
      content: type === 'sticky' ? 'Type note here...' : type === 'text' ? 'Double click to edit text...' : '',
      x: centerX > 0 ? centerX : 100,
      y: centerY > 0 ? centerY : 100,
      width: type === 'sticky' ? 280 : type === 'text' ? 240 : type === 'shape' && shapeType === 'circle' ? 160 : 200,
      height: type === 'sticky' ? 280 : type === 'text' ? 120 : type === 'shape' && shapeType === 'circle' ? 160 : 120,
      color: type === 'shape' ? '#e0f2fe' : '#ffffff',
      bgAsset: type === 'sticky' ? defaultTemplate.image : undefined,
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

  // Insert specific asset note from Theme Picker
  const addStickyNoteAsset = (assetUrl: string) => {
    const id = `sticky_${Date.now()}`;
    const centerX = Math.round((-pan.x + 200) / scale / GRID_SIZE) * GRID_SIZE;
    const centerY = Math.round((-pan.y + 150) / scale / GRID_SIZE) * GRID_SIZE;

    const template = getStickyTemplate(assetUrl);

    const newItem: CanvasItem = {
      id,
      type: 'sticky',
      content: 'Write your study note here...',
      x: centerX > 0 ? centerX : 120,
      y: centerY > 0 ? centerY : 100,
      width: 280,
      height: Math.round(280 / (template.aspectRatio || 1.0)),
      bgAsset: template.image,
      fontSize: template.defaultFontSize || 15,
      fontFamily: "'Quicksand', 'Nunito', sans-serif",
      isBold: true,
      textColor: template.defaultTextColor || '#3A3A3A',
      textAlign: template.textAlign || 'left',
    };

    const next = [...items, newItem];
    saveItems(next, true);
    setSelectedId(id);
  };

  // 7. Insert AI Content Helper
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

  // 8. Delete, Duplicate & Update Item Fields
  const deleteItem = (id: string) => {
    const next = items.filter(i => i.id !== id);
    saveItems(next, true);
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateItem = (id: string) => {
    const original = items.find(i => i.id === id);
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
  };

  const updateItemContent = (id: string, newContent: string) => {
    const next = items.map(i => i.id === id ? { ...i, content: newContent } : i);
    saveItems(next, false);
  };

  const updateItemField = (id: string, field: keyof CanvasItem, value: any) => {
    const next = items.map(i => i.id === id ? { ...i, [field]: value } : i);
    saveItems(next, true);
  };

  const updateItemBgAsset = (id: string, bgAsset: string) => {
    const template = getStickyTemplate(bgAsset);
    const next = items.map(i => i.id === id ? {
      ...i,
      bgAsset: template.image,
      height: Math.round(i.width / (template.aspectRatio || 1.0)),
      fontSize: template.defaultFontSize || 15,
      textColor: template.defaultTextColor || '#3A3A3A',
      textAlign: template.textAlign || 'left',
    } : i);
    saveItems(next, true);
  };

  // 9. DEV TOOL: Update live dev template calibration
  const updateDevTemplateField = (field: keyof StickyTemplate, val: any) => {
    const updated: StickyTemplate = { ...devTemplates[activeDevIndex], [field]: val };
    const nextList = saveCalibratedTemplate(updated);
    setDevTemplates(nextList);
  };

  const updateDevTextArea = (x: number, y: number, width: number, height: number) => {
    const updated: StickyTemplate = {
      ...devTemplates[activeDevIndex],
      textArea: {
        x: Math.max(0, Math.min(100 - width, Math.round(x))),
        y: Math.max(0, Math.min(100 - height, Math.round(y))),
        width: Math.max(10, Math.min(100, Math.round(width))),
        height: Math.max(10, Math.min(100, Math.round(height))),
      },
    };
    const nextList = saveCalibratedTemplate(updated);
    setDevTemplates(nextList);
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

            {/* Quick Sticky Note Theme Picker Button */}
            <button
              onClick={() => setShowThemePicker(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-black px-3 py-1.5 rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-transform hover:scale-105"
            >
              <span>🖼️ Sticky Themes (28+)</span>
            </button>

            {/* DEV TOOL: Template Editor Calibration Studio Button */}
            <button
              onClick={() => setShowTemplateEditor(true)}
              className="bg-amber-500 hover:bg-amber-600 text-black font-black px-3 py-1.5 rounded-xl text-xs shadow-md flex items-center gap-1 transition-transform hover:scale-105"
              title="Open Template Calibration Studio (Dev Tool)"
            >
              <span>🛠️ Template Editor</span>
            </button>

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
                <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/40 rounded-xl shadow-2xl p-1.5 z-[60] flex flex-col min-w-[190px] text-gray-800 dark:text-gray-200 text-xs">
                  <button onClick={() => { setActiveDropdown(null); setShowThemePicker(true); }} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">📌 Sticky Note Theme Picker...</button>
                  <button onClick={() => { setActiveDropdown(null); setShowTemplateEditor(true); }} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2 text-amber-600 dark:text-amber-400">🛠️ Template Editor (Calibrate)...</button>
                  <button onClick={() => addItem('text')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">📝 Transparent Text Box</button>
                  <button onClick={() => addItem('arrow')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">➔ Snapping Arrow</button>
                  <button onClick={() => addItem('shape', 'rectangle')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">🔲 Rectangle Box</button>
                  <button onClick={() => addItem('shape', 'circle')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">⚪ Circle / Concept</button>
                </div>
              )}
            </div>

            {/* ✨ INSERT AI BUTTON */}
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
                    <path d={pathD} stroke="transparent" strokeWidth="20" fill="none" />
                    <path
                      d={pathD}
                      stroke={color}
                      strokeWidth={isSelected ? '4' : '3'}
                      strokeDasharray={arrow.shapeType === 'line' ? '6,6' : undefined}
                      fill="none"
                      markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
                    />
                    {arrow.content && (
                      <foreignObject x={(sx + ex) / 2 - 75} y={(sy + ey) / 2 - 16} width="150" height="32" className="pointer-events-none overflow-visible">
                        <div className="bg-white/95 dark:bg-[#232130]/95 px-2.5 py-0.5 rounded-lg border-2 border-purple-400 text-xs font-bold text-center text-purple-700 dark:text-purple-300 shadow-md truncate">
                          {arrow.content}
                        </div>
                      </foreignObject>
                    )}
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
              const isSticky = item.type === 'sticky' || item.bgAsset !== undefined;
              const isAiCard = item.isAiCard && !item.bgAsset;
              const isText = item.type === 'text';
              const isShape = item.type === 'shape';
              const isCircle = isShape && item.shapeType === 'circle';

              const template = isSticky ? getStickyTemplate(item.bgAsset) : null;
              const theme = FALLBACK_THEMES.find(t => t.bg === item.color) || FALLBACK_THEMES[0];

              return (
                <div
                  key={item.id}
                  onMouseDown={(e) => startDraggingItem(e, item.id)}
                  className={`absolute pointer-events-auto transition-all flex flex-col group ${
                    isSelected
                      ? 'ring-2 ring-purple-600 shadow-[0_12px_40px_rgba(139,92,246,0.35)] z-20 scale-[1.01]'
                      : isText
                      ? 'border border-dashed border-gray-400/50 dark:border-gray-500/50 bg-white/30 dark:bg-black/20 hover:border-purple-400 z-10'
                      : 'shadow-[0_8px_20px_rgba(0,0,0,0.08)] z-10 hover:shadow-xl'
                  }`}
                  style={{
                    left: `${item.x}px`,
                    top: `${item.y}px`,
                    width: `${item.width}px`,
                    minHeight: `${item.height}px`,
                    backgroundColor: isText || isSticky ? 'transparent' : isAiCard ? theme.bg : item.color || '#ffffff',
                    borderRadius: isCircle ? '50%' : isSticky ? '24px' : '16px',
                    border: isText && !isSelected ? undefined : isSticky ? 'none' : isSelected ? '2px solid #8b5cf6' : '2px solid rgba(124, 106, 117, 0.25)',
                  }}
                >
                  {/* --- 1. DECORATIVE STATIONERY PNG LAYER (Cropped to visible bounds without stretching) --- */}
                  {isSticky && template ? (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl select-none">
                      <img
                        src={template.image}
                        alt={template.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : isAiCard ? (
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-t-3xl border-b border-black/5 cursor-move" style={{ backgroundColor: theme.border }}>
                      <span className="font-black text-xs text-gray-800 truncate max-w-[150px]">
                        {item.title || '✨ AI Insight'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                        className="text-red-500 hover:text-red-700 font-bold px-1 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}

                  {/* Top center drag handle pill for clean, headerless shapes and notes */}
                  {(isSticky || isShape) && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-black/20 dark:bg-white/30 hover:bg-purple-600 rounded-full cursor-move z-30 opacity-60 group-hover:opacity-100 transition-opacity" title="Drag card" />
                  )}

                  {/* --- 2. FLOATING RICH TEXT FORMATTING TOOLBAR WHEN SELECTED --- */}
                  {isSelected && (
                    <div
                      className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#232130] text-white border-2 border-purple-500 rounded-2xl px-3 py-1.5 shadow-2xl z-50 flex items-center gap-2 animate-fadeIn whitespace-nowrap pointer-events-auto text-xs font-bold"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <select
                        value={item.fontFamily || "'Quicksand', 'Nunito', sans-serif"}
                        onChange={(e) => updateItemField(item.id, 'fontFamily', e.target.value)}
                        className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-xs border border-white/20 focus:outline-none text-white"
                      >
                        <option value="'Quicksand', 'Nunito', sans-serif" className="text-black">Quicksand</option>
                        <option value="'Nunito', sans-serif" className="text-black">Nunito</option>
                        <option value="'Fredoka', sans-serif" className="text-black">Fredoka</option>
                        <option value="sans-serif" className="text-black">Sans-serif</option>
                        <option value="serif" className="text-black">Serif</option>
                        <option value="monospace" className="text-black">Monospace</option>
                      </select>

                      <select
                        value={item.fontSize || (template ? template.defaultFontSize : 15)}
                        onChange={(e) => updateItemField(item.id, 'fontSize', Number(e.target.value))}
                        className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-xs border border-white/20 focus:outline-none w-14 text-white"
                      >
                        {[12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48].map(sz => (
                          <option key={sz} value={sz} className="text-black">{sz}px</option>
                        ))}
                      </select>

                      <label className="cursor-pointer bg-white/10 hover:bg-white/20 p-1 rounded border border-white/20 flex items-center justify-center w-6 h-6" title="Text Color">
                        <input
                          type="color"
                          value={item.textColor || (template ? template.defaultTextColor : '#3A3A3A')}
                          onChange={(e) => updateItemField(item.id, 'textColor', e.target.value)}
                          className="opacity-0 absolute w-0 h-0"
                        />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/40" style={{ backgroundColor: item.textColor || (template ? template.defaultTextColor : '#3A3A3A') }} />
                      </label>

                      <div className="w-px h-4 bg-white/20 my-auto" />

                      <button
                        onClick={() => updateItemField(item.id, 'isBold', item.isBold !== undefined ? !item.isBold : false)}
                        className={`px-2 py-0.5 rounded font-black ${item.isBold === false ? 'bg-white/10 text-white/60' : 'bg-purple-600 text-white'}`}
                        title="Bold"
                      >
                        B
                      </button>
                      <button
                        onClick={() => updateItemField(item.id, 'isItalic', !item.isItalic)}
                        className={`px-2 py-0.5 rounded font-serif italic ${item.isItalic ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60'}`}
                        title="Italic"
                      >
                        I
                      </button>
                      <button
                        onClick={() => updateItemField(item.id, 'isUnderline', !item.isUnderline)}
                        className={`px-2 py-0.5 rounded underline ${item.isUnderline ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60'}`}
                        title="Underline"
                      >
                        U
                      </button>

                      <div className="w-px h-4 bg-white/20 my-auto" />

                      <button
                        onClick={() => {
                          const nextAlign = item.textAlign === 'center' ? 'right' : item.textAlign === 'right' ? 'left' : 'center';
                          updateItemField(item.id, 'textAlign', nextAlign);
                        }}
                        className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-xs"
                        title={`Align: ${item.textAlign || 'left'}`}
                      >
                        {item.textAlign === 'center' ? '☰ Center' : item.textAlign === 'right' ? '☷ Right' : '≡ Left'}
                      </button>

                      {isSticky && (
                        <button
                          onClick={() => setShowThemePicker(true)}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-2 py-0.5 rounded flex items-center gap-1 shadow-sm ml-1"
                          title="Change Note Theme"
                        >
                          <span>🎨</span><span>Theme</span>
                        </button>
                      )}

                      <div className="w-px h-4 bg-white/20 my-auto" />

                      <button
                        onClick={() => deleteItem(item.id)}
                        className="bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white px-2 py-0.5 rounded transition-colors"
                        title="Delete Card (Del)"
                      >
                        🗑️
                      </button>
                      <button
                        onClick={() => duplicateItem(item.id)}
                        className="bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white px-2 py-0.5 rounded transition-colors"
                        title="Duplicate Card (Ctrl+D)"
                      >
                        📑
                      </button>
                    </div>
                  )}

                  {/* --- 3. SAFE WRITING REGION & RICH TEXT LAYER (Calibrated per template) --- */}
                  {isSticky && template ? (
                    <div
                      className="absolute z-10 flex flex-col overflow-hidden"
                      style={{
                        left: `${template.textArea.x}%`,
                        top: `${template.textArea.y}%`,
                        width: `${template.textArea.width}%`,
                        height: `${template.textArea.height}%`,
                        padding: template.padding,
                      }}
                    >
                      <textarea
                        value={item.content}
                        onChange={(e) => updateItemContent(item.id, e.target.value)}
                        placeholder="Write study notes..."
                        className="w-full h-full bg-transparent border-none focus:outline-none resize-none font-sans custom-scrollbar leading-relaxed whitespace-pre-wrap break-words"
                        style={{
                          fontFamily: item.fontFamily || "'Quicksand', 'Nunito', sans-serif",
                          fontSize: `${item.fontSize || Math.max(12, Math.round(item.width * (template.defaultFontSize / 280)))}px`,
                          lineHeight: template.lineHeight || 1.5,
                          color: item.textColor || template.defaultTextColor || '#3A3A3A',
                          fontWeight: item.isBold !== undefined ? (item.isBold ? 'bold' : 'normal') : 'bold',
                          fontStyle: item.isItalic ? 'italic' : 'normal',
                          textDecoration: item.isUnderline ? 'underline' : 'none',
                          textAlign: item.textAlign || template.textAlign || 'left',
                          textShadow: '0 0 10px rgba(255,255,255,0.9), 0 0 3px rgba(255,255,255,1)',
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-center relative z-10 p-3.5">
                      <textarea
                        value={item.content}
                        onChange={(e) => updateItemContent(item.id, e.target.value)}
                        placeholder={isText ? "Double click or start typing here..." : "Write note or idea here..."}
                        className={`w-full h-full bg-transparent border-none focus:outline-none resize-none font-sans custom-scrollbar leading-relaxed whitespace-pre-wrap break-words ${
                          isCircle ? 'text-center font-bold text-gray-800 dark:text-gray-200' : isText ? 'text-base font-medium text-gray-800 dark:text-gray-200' : 'font-bold'
                        } ${isText && !item.content ? 'border border-dashed border-gray-400/50 bg-white/20 dark:bg-black/20 rounded-xl p-2' : ''}`}
                        style={{
                          fontFamily: item.fontFamily || undefined,
                          fontSize: item.fontSize ? `${item.fontSize}px` : undefined,
                          color: item.textColor || undefined,
                          fontWeight: item.isBold !== undefined ? (item.isBold ? 'bold' : 'normal') : undefined,
                          fontStyle: item.isItalic ? 'italic' : undefined,
                          textDecoration: item.isUnderline ? 'underline' : undefined,
                          textAlign: item.textAlign || undefined,
                          minHeight: `${item.height - 35}px`,
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

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
              🎨 Canvas is empty. Click ➕ Add Item or 🖼️ Sticky Themes at the top!
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

        {/* --- STICKY NOTE THEME PICKER MODAL --- */}
        {showThemePicker && (
          <div className="fixed inset-0 z-[9999999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none">
            <div className="bg-white dark:bg-[#232130] border-4 border-purple-500 rounded-3xl p-6 shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
                <div>
                  <h3 className="font-black text-lg text-purple-700 dark:text-purple-300 flex items-center gap-2">
                    <span>🖼️ Choose a Sticky Note Theme</span>
                    <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {devTemplates.length} Templates
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Click any aesthetic memo template to drop it onto your whiteboard or update selected note!</p>
                </div>
                <button
                  onClick={() => setShowThemePicker(false)}
                  className="bg-gray-100 dark:bg-white/10 hover:bg-red-500 hover:text-white text-gray-700 dark:text-gray-200 font-bold w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  title="Close Picker (Esc)"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 overflow-y-auto custom-scrollbar p-2 flex-1 max-h-[65vh]">
                {devTemplates.map((t, i) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (selectedId && items.find(it => it.id === selectedId && (it.type === 'sticky' || it.bgAsset))) {
                        updateItemBgAsset(selectedId, t.image);
                      } else {
                        addStickyNoteAsset(t.image);
                      }
                      setShowThemePicker(false);
                    }}
                    className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-purple-500/30 hover:border-purple-600 dark:hover:border-pink-400 cursor-pointer shadow-sm hover:shadow-xl hover:scale-105 transition-all bg-[#faf8fc] dark:bg-[#181622] flex items-center justify-center p-1.5"
                  >
                    <img src={t.image} alt={t.name} className="w-full h-full object-contain pointer-events-none" />
                    <div className="absolute inset-0 bg-purple-600/0 group-hover:bg-purple-600/15 transition-colors flex items-end justify-center pb-2">
                      <span className="opacity-0 group-hover:opacity-100 bg-purple-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full shadow-lg transition-opacity flex items-center gap-1">
                        <span>{selectedId && items.find(it => it.id === selectedId && it.bgAsset) ? '🎨 Apply' : '➕ Insert'}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- DEV TOOL: STICKY NOTE TEMPLATE CALIBRATION STUDIO --- */}
        {showTemplateEditor && (
          <div className="fixed inset-0 z-[99999999] bg-black/85 backdrop-blur-lg flex items-center justify-center p-4 animate-fadeIn select-none">
            <div className="bg-white dark:bg-[#1e1c2a] border-4 border-amber-500 rounded-3xl p-6 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col">
              
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
                <div>
                  <h3 className="font-black text-lg text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <span>🛠️ Template Calibration Studio (Dev Tool)</span>
                    <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      Template #{activeDevIndex + 1} of {devTemplates.length}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Drag & resize the green safe writing region over the PNG. Changes save to localStorage and export directly to TypeScript!</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const tsCode = `export const INITIAL_STICKY_TEMPLATES: StickyTemplate[] = ${JSON.stringify(devTemplates, null, 2)};`;
                      navigator.clipboard?.writeText(tsCode);
                      alert('✅ Copied complete TS configuration array to clipboard! Paste directly into stickyTemplates.ts.');
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-md flex items-center gap-1 transition-transform hover:scale-105"
                  >
                    📋 Copy TS Config
                  </button>
                  <button
                    onClick={() => setShowTemplateEditor(false)}
                    className="bg-gray-100 dark:bg-white/10 hover:bg-red-500 hover:text-white text-gray-700 dark:text-gray-200 font-bold w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    title="Close Editor (Esc)"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
                
                {/* Left: Template Selector Sidebar */}
                <div className="w-full md:w-56 border-r border-gray-200 dark:border-gray-700 pr-3 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 max-h-[70vh]">
                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Select Template</div>
                  {devTemplates.map((t, idx) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveDevIndex(idx)}
                      className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all ${
                        activeDevIndex === idx
                          ? 'bg-amber-500 text-black font-black shadow-md'
                          : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 font-medium text-xs'
                      }`}
                    >
                      <img src={t.image} alt={t.name} className="w-8 h-8 object-contain rounded bg-white/10 p-0.5" />
                      <span className="truncate text-xs">{t.name}</span>
                    </button>
                  ))}
                </div>

                {/* Center: Live Interactive Calibration Workbench */}
                <div className="flex-1 flex flex-col items-center justify-center bg-[#f0ecf5] dark:bg-[#12101a] rounded-2xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 relative overflow-hidden">
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 absolute top-3 left-4">
                    📍 Live Preview (360x360 box) — Drag green box to calibrate writing zone
                  </div>

                  {/* 360x360 Template Simulation Canvas */}
                  <div
                    className="relative w-[360px] h-[360px] bg-transparent rounded-2xl overflow-hidden shadow-2xl border-2 border-purple-500/30"
                    onMouseMove={(e) => {
                      if (!devDraggingArea && !devResizingArea) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const curX = (e.clientX - rect.left) / rect.width * 100;
                      const curY = (e.clientY - rect.top) / rect.height * 100;

                      if (devDraggingArea) {
                        const deltaX = curX - devDragStart.x;
                        const deltaY = curY - devDragStart.y;
                        updateDevTextArea(devDragStart.startTx + deltaX, devDragStart.startTy + deltaY, devDragStart.startTw, devDragStart.startTh);
                      } else if (devResizingArea) {
                        const deltaX = curX - devDragStart.x;
                        const deltaY = curY - devDragStart.y;
                        let nw = devDragStart.startTw;
                        let nh = devDragStart.startTh;
                        let nx = devDragStart.startTx;
                        let ny = devDragStart.startTy;

                        if (devResizingArea === 'se') { nw += deltaX; nh += deltaY; }
                        else if (devResizingArea === 'sw') { nw -= deltaX; nh += deltaY; nx += deltaX; }
                        else if (devResizingArea === 'ne') { nw += deltaX; nh -= deltaY; ny += deltaY; }
                        else if (devResizingArea === 'nw') { nw -= deltaX; nh -= deltaY; nx += deltaX; ny += deltaY; }

                        updateDevTextArea(nx, ny, nw, nh);
                      }
                    }}
                    onMouseUp={() => { setDevDraggingArea(false); setDevResizingArea(null); }}
                    onMouseLeave={() => { setDevDraggingArea(false); setDevResizingArea(null); }}
                  >
                    {/* PNG Layer */}
                    <img
                      src={devTemplates[activeDevIndex].image}
                      alt="Template Calibration"
                      className="w-full h-full object-contain pointer-events-none select-none"
                    />

                    {/* Interactive Green Safe Writing Region Box */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDevDraggingArea(true);
                        const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                        setDevDragStart({
                          x: (e.clientX - rect.left) / rect.width * 100,
                          y: (e.clientY - rect.top) / rect.height * 100,
                          startTx: devTemplates[activeDevIndex].textArea.x,
                          startTy: devTemplates[activeDevIndex].textArea.y,
                          startTw: devTemplates[activeDevIndex].textArea.width,
                          startTh: devTemplates[activeDevIndex].textArea.height,
                        });
                      }}
                      className="absolute border-2 border-green-500 bg-green-500/15 cursor-move flex flex-col justify-start overflow-hidden group shadow-lg"
                      style={{
                        left: `${devTemplates[activeDevIndex].textArea.x}%`,
                        top: `${devTemplates[activeDevIndex].textArea.y}%`,
                        width: `${devTemplates[activeDevIndex].textArea.width}%`,
                        height: `${devTemplates[activeDevIndex].textArea.height}%`,
                        padding: devTemplates[activeDevIndex].padding,
                      }}
                    >
                      <div className="text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded font-mono font-bold absolute top-0 right-0 opacity-80 pointer-events-none">
                        Safe Zone
                      </div>

                      {/* Simulation Text */}
                      <div
                        className="font-bold text-[#3A3A3A] whitespace-pre-wrap leading-relaxed select-none overflow-hidden"
                        style={{
                          fontFamily: "'Quicksand', 'Nunito', sans-serif",
                          fontSize: `${Math.round(360 * (devTemplates[activeDevIndex].defaultFontSize / 280))}px`,
                          lineHeight: devTemplates[activeDevIndex].lineHeight,
                          color: devTemplates[activeDevIndex].defaultTextColor || '#3A3A3A',
                          textShadow: '0 0 8px rgba(255,255,255,0.9)',
                        }}
                      >
                        {`✨ Calibrating ${devTemplates[activeDevIndex].name}!\n• Safe writing region\n• Never overlaps artwork\n• Perfect spacing`}
                      </div>

                      {/* 4 Corner Handles for Green Box */}
                      {['nw', 'ne', 'sw', 'se'].map((h) => (
                        <div
                          key={h}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDevResizingArea(h);
                            const rect = e.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
                            setDevDragStart({
                              x: (e.clientX - rect.left) / rect.width * 100,
                              y: (e.clientY - rect.top) / rect.height * 100,
                              startTx: devTemplates[activeDevIndex].textArea.x,
                              startTy: devTemplates[activeDevIndex].textArea.y,
                              startTw: devTemplates[activeDevIndex].textArea.width,
                              startTh: devTemplates[activeDevIndex].textArea.height,
                            });
                          }}
                          className={`absolute w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full cursor-${h}-resize shadow-md hover:scale-125 z-40 ${
                            h === 'nw' ? '-top-1.5 -left-1.5' : h === 'ne' ? '-top-1.5 -right-1.5' : h === 'sw' ? '-bottom-1.5 -left-1.5' : '-bottom-1.5 -right-1.5'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Fine-Tuning Metadata Controls */}
                <div className="w-full md:w-72 border-l border-gray-200 dark:border-gray-700 pl-4 overflow-y-auto custom-scrollbar flex flex-col gap-3 text-xs text-gray-800 dark:text-gray-200 max-h-[70vh]">
                  <div className="font-black text-sm text-purple-600 dark:text-purple-400 border-b pb-1.5">
                    ⚙️ Fine-Tune Coordinates
                  </div>

                  <div>
                    <label className="font-bold text-gray-500 dark:text-gray-400 block mb-1">Template Name</label>
                    <input
                      type="text"
                      value={devTemplates[activeDevIndex].name}
                      onChange={(e) => updateDevTemplateField('name', e.target.value)}
                      className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-gray-500 block mb-0.5">X Offset (%)</label>
                      <input
                        type="number"
                        value={devTemplates[activeDevIndex].textArea.x}
                        onChange={(e) => updateDevTextArea(Number(e.target.value), devTemplates[activeDevIndex].textArea.y, devTemplates[activeDevIndex].textArea.width, devTemplates[activeDevIndex].textArea.height)}
                        className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2 py-1 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-500 block mb-0.5">Y Offset (%)</label>
                      <input
                        type="number"
                        value={devTemplates[activeDevIndex].textArea.y}
                        onChange={(e) => updateDevTextArea(devTemplates[activeDevIndex].textArea.x, Number(e.target.value), devTemplates[activeDevIndex].textArea.width, devTemplates[activeDevIndex].textArea.height)}
                        className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2 py-1 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-500 block mb-0.5">Width (%)</label>
                      <input
                        type="number"
                        value={devTemplates[activeDevIndex].textArea.width}
                        onChange={(e) => updateDevTextArea(devTemplates[activeDevIndex].textArea.x, devTemplates[activeDevIndex].textArea.y, Number(e.target.value), devTemplates[activeDevIndex].textArea.height)}
                        className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2 py-1 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-500 block mb-0.5">Height (%)</label>
                      <input
                        type="number"
                        value={devTemplates[activeDevIndex].textArea.height}
                        onChange={(e) => updateDevTextArea(devTemplates[activeDevIndex].textArea.x, devTemplates[activeDevIndex].textArea.y, devTemplates[activeDevIndex].textArea.width, Number(e.target.value))}
                        className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2 py-1 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-gray-500 block mb-0.5">CSS Padding (e.g. "4% 5%")</label>
                    <input
                      type="text"
                      value={devTemplates[activeDevIndex].padding}
                      onChange={(e) => updateDevTemplateField('padding', e.target.value)}
                      className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2.5 py-1 font-mono font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-gray-500 block mb-0.5">Font Size (px)</label>
                      <input
                        type="number"
                        value={devTemplates[activeDevIndex].defaultFontSize}
                        onChange={(e) => updateDevTemplateField('defaultFontSize', Number(e.target.value))}
                        className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2 py-1 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-500 block mb-0.5">Line Height</label>
                      <input
                        type="number"
                        step="0.1"
                        value={devTemplates[activeDevIndex].lineHeight}
                        onChange={(e) => updateDevTemplateField('lineHeight', Number(e.target.value))}
                        className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2 py-1 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-gray-500 block mb-0.5">Aspect Ratio (Width / Height)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={devTemplates[activeDevIndex].aspectRatio}
                      onChange={(e) => updateDevTemplateField('aspectRatio', Number(e.target.value))}
                      className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2.5 py-1 font-mono font-bold"
                    />
                  </div>

                  <div className="mt-auto pt-4 flex flex-col gap-2">
                    <button
                      onClick={() => {
                        const tsCode = `export const INITIAL_STICKY_TEMPLATES: StickyTemplate[] = ${JSON.stringify(devTemplates, null, 2)};`;
                        navigator.clipboard?.writeText(tsCode);
                        alert('✅ Copied complete TS configuration array to clipboard! Paste directly into stickyTemplates.ts.');
                      }}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-2.5 rounded-xl text-xs shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-1.5"
                    >
                      <span>📋 Export All 28 to TS Code</span>
                    </button>
                    <div className="text-[10px] text-gray-400 text-center italic">
                      💡 Calibrations automatically save to localStorage and apply instantly to your whiteboard!
                    </div>
                  </div>

                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </motion.div>
  );
}
