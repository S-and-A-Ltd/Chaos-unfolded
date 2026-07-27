'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Rect as KonvaRect, Circle as KonvaCircle, Line as KonvaLine, Group, Transformer } from 'react-konva';
import useImage from 'use-image';
import Button from '@/components/ui/Button';
import { StudyDocument } from '@/types';
import { STICKY_TEMPLATES, getStickyTemplate, getStickyTemplates, saveCalibratedTemplate, StickyTemplate, autoAlphaCropImage } from '@/components/study/stickyTemplates';

interface KonvaWhiteboardProps {
  document: StudyDocument;
  onClose: () => void;
}

export type AnchorPosition = 'top' | 'right' | 'bottom' | 'left';

export interface CanvasItem {
  id: string;
  type: 'text' | 'sticky' | 'shape' | 'image' | 'arrow' | 'ai-card';
  title?: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  textColor?: string;
  bgAsset?: string;
  shapeType?: 'rectangle' | 'circle' | 'line' | 'arrow';
  fontSize?: number;
  fontFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  isAiCard?: boolean;
  fromId?: string;
  fromAnchor?: AnchorPosition;
  toId?: string;
  toAnchor?: AnchorPosition;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

const FALLBACK_THEMES = [
  { name: 'Yellow Sun', bg: '#fffdf0', border: '#fde047' },
  { name: 'Rose Strawberry', bg: '#fff5f7', border: '#f472b6' },
  { name: 'Sky Cloud', bg: '#f0f9ff', border: '#38bdf8' },
  { name: 'Sage Clover', bg: '#f2fbf5', border: '#4ade80' },
  { name: 'Lavender Dream', bg: '#f8f5ff', border: '#c084fc' },
  { name: 'Peach Apricot', bg: '#fffaf5', border: '#fb923c' },
];

// Helper to calculate exact edge anchor coordinate for any card
export const getAnchorCoords = (item: CanvasItem, anchor: AnchorPosition): { x: number; y: number } => {
  switch (anchor) {
    case 'top': return { x: item.x + item.width / 2, y: item.y };
    case 'right': return { x: item.x + item.width, y: item.y + item.height / 2 };
    case 'bottom': return { x: item.x + item.width / 2, y: item.y + item.height };
    case 'left': return { x: item.x, y: item.y + item.height / 2 };
  }
};

// Automatically find closest edge anchor between two coordinates or cards
const findBestAnchor = (fromItem: CanvasItem, toItem: CanvasItem): { from: AnchorPosition; to: AnchorPosition } => {
  const dx = (toItem.x + toItem.width / 2) - (fromItem.x + fromItem.width / 2);
  const dy = (toItem.y + toItem.height / 2) - (fromItem.y + fromItem.height / 2);
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' };
  } else {
    return dy > 0 ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' };
  }
};

// Splits text across multiple writable rectangular regions in a template
const splitTextAcrossRegions = (
  text: string,
  regions: { x: number; y: number; width: number; height: number }[],
  itemWidth: number,
  itemHeight: number,
  fontSize: number,
  lineHeight: number,
  fontFamily: string
): string[] => {
  if (!regions || regions.length <= 1 || !text) return [text];
  if (typeof document === 'undefined') return [text, ...Array(regions.length - 1).fill('')];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [text, ...Array(regions.length - 1).fill('')];
  ctx.font = `${fontSize}px ${fontFamily}`;

  const words = text.split(/(\s+)/);
  const regionTexts: string[] = [];
  let wordIdx = 0;

  for (let r = 0; r < regions.length; r++) {
    if (wordIdx >= words.length) {
      regionTexts.push('');
      continue;
    }
    if (r === regions.length - 1) {
      regionTexts.push(words.slice(wordIdx).join(''));
      break;
    }

    const regW = (regions[r].width / 100) * itemWidth;
    const regH = (regions[r].height / 100) * itemHeight;
    const maxLines = Math.max(1, Math.floor(regH / (fontSize * lineHeight)));

    let currentRegionWords: string[] = [];
    let currentLine = '';
    let lineCount = 1;

    while (wordIdx < words.length && lineCount <= maxLines) {
      const word = words[wordIdx];
      if (word.includes('\n')) {
        const parts = word.split('\n');
        const testLine = currentLine + parts[0];
        if (ctx.measureText(testLine).width > regW && currentLine !== '') {
          lineCount++;
          if (lineCount > maxLines) break;
        }
        currentRegionWords.push(parts[0] + '\n');
        currentLine = parts.slice(1).join('\n');
        lineCount += parts.length - 1;
        if (lineCount > maxLines) break;
        wordIdx++;
        continue;
      }

      const testLine = currentLine + word;
      if (ctx.measureText(testLine).width > regW && currentLine !== '') {
        lineCount++;
        if (lineCount > maxLines) break;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
      currentRegionWords.push(word);
      wordIdx++;
    }
    regionTexts.push(currentRegionWords.join(''));
  }
  return regionTexts;
};

// Helper component to render a Konva image with automatic alpha cropping
const StationeryImage = ({ url, width, height, template }: { url: string; width: number; height: number; template: StickyTemplate }) => {
  const [image] = useImage(url);
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number } | undefined>(undefined);

  useEffect(() => {
    if (image) {
      if (template.croppedBounds) {
        const iw = image.naturalWidth || image.width;
        const ih = image.naturalHeight || image.height;
        setCrop({
          x: (template.croppedBounds.left / 100) * iw,
          y: (template.croppedBounds.top / 100) * ih,
          width: (template.croppedBounds.width / 100) * iw,
          height: (template.croppedBounds.height / 100) * ih,
        });
      } else {
        const auto = autoAlphaCropImage(image);
        const iw = image.naturalWidth || image.width;
        const ih = image.naturalHeight || image.height;
        setCrop({
          x: (auto.left / 100) * iw,
          y: (auto.top / 100) * ih,
          width: (auto.width / 100) * iw,
          height: (auto.height / 100) * ih,
        });
      }
    }
  }, [image, template]);

  if (!image) return null;

  return (
    <KonvaImage
      image={image}
      width={width}
      height={height}
      crop={crop}
      listening={true}
    />
  );
};

export default function KonvaWhiteboard({ document, onClose }: KonvaWhiteboardProps) {
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas state
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [history, setHistory] = useState<CanvasItem[][]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Viewport transformation (Zoom & Pan)
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [gridSnap, setGridSnap] = useState<boolean>(true);
  const GRID_SIZE = 20;

  // Editing text overlay state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Modals & Popovers
  const [activeDropdown, setActiveDropdown] = useState<'add' | 'ai' | null>(null);
  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<string>('Just now');

  // DEV TOOL: Template Editor State
  const [devTemplates, setDevTemplates] = useState<StickyTemplate[]>(STICKY_TEMPLATES);
  const [activeDevIndex, setActiveDevIndex] = useState<number>(0);
  const [devDraggingRegionIdx, setDevDraggingRegionIdx] = useState<number | null>(null);
  const [devResizingRegionIdx, setDevResizingRegionIdx] = useState<{ idx: number; handle: string } | null>(null);
  const [devDragStart, setDevDragStart] = useState<{ x: number; y: number; startTx: number; startTy: number; startTw: number; startTh: number }>({ x: 0, y: 0, startTx: 0, startTy: 0, startTw: 0, startTh: 0 });

  // Load items on mount
  useEffect(() => {
    const all = getStickyTemplates();
    setDevTemplates(all);

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
          x: 480,
          y: 100,
          width: 280,
          height: 220,
          color: '#f8f5ff',
          isAiCard: true,
        },
        {
          id: 'welcome_arrow',
          type: 'arrow',
          content: 'Connects to ➔',
          x: 400,
          y: 200,
          width: 80,
          height: 20,
          color: '#8b5cf6',
          fromId: 'welcome_1',
          fromAnchor: 'right',
          toId: 'welcome_2',
          toAnchor: 'left',
        },
      ];
      setItems(initial);
      setHistory([initial]);
      setHistoryIdx(0);
    }
  }, [document.id, document.name]);

  // Attach Konva Transformer to selected item
  useEffect(() => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const node = stageRef.current.findOne(`#node_${selectedId}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, items]);

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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (selectedId && !showTemplateEditor && !editingId) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          const next = items.filter(i => i.id !== selectedId && i.fromId !== selectedId && i.toId !== selectedId);
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
  }, [selectedId, items, saveItems, showTemplateEditor, editingId]);

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
      const nonArrows = items.filter(i => i.type !== 'arrow');
      const startCard = nonArrows[nonArrows.length - 1];
      const endCard = nonArrows[nonArrows.length - 2];
      const best = startCard && endCard ? findBestAnchor(startCard, endCard) : { from: 'right' as AnchorPosition, to: 'left' as AnchorPosition };

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
        fromAnchor: best.from,
        toId: endCard?.id,
        toAnchor: best.to,
      };
    }

    const next = [...items, newItem];
    saveItems(next, true);
    setSelectedId(id);
  };

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

  const deleteItem = (id: string) => {
    const next = items.filter(i => i.id !== id && i.fromId !== id && i.toId !== id);
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

  // Dev tool region update helpers
  const getActiveRegions = (): { x: number; y: number; width: number; height: number }[] => {
    const t = devTemplates[activeDevIndex];
    return t.writingRegions && t.writingRegions.length > 0 ? t.writingRegions : [t.writingArea];
  };

  const updateDevRegion = (regionIdx: number, x: number, y: number, width: number, height: number) => {
    const currentRegions = [...getActiveRegions()];
    currentRegions[regionIdx] = {
      x: Math.max(0, Math.min(100 - width, Math.round(x))),
      y: Math.max(0, Math.min(100 - height, Math.round(y))),
      width: Math.max(10, Math.min(100, Math.round(width))),
      height: Math.max(10, Math.min(100, Math.round(height))),
    };
    const updated: StickyTemplate = {
      ...devTemplates[activeDevIndex],
      writingArea: currentRegions[0],
      writingRegions: currentRegions,
    };
    const nextList = saveCalibratedTemplate(updated);
    setDevTemplates(nextList);
  };

  const addDevRegion = () => {
    const currentRegions = [...getActiveRegions()];
    currentRegions.push({ x: 20, y: 50, width: 60, height: 35 });
    const updated: StickyTemplate = {
      ...devTemplates[activeDevIndex],
      writingRegions: currentRegions,
    };
    const nextList = saveCalibratedTemplate(updated);
    setDevTemplates(nextList);
  };

  const deleteDevRegion = (regionIdx: number) => {
    const currentRegions = [...getActiveRegions()];
    if (currentRegions.length <= 1) return;
    currentRegions.splice(regionIdx, 1);
    const updated: StickyTemplate = {
      ...devTemplates[activeDevIndex],
      writingArea: currentRegions[0],
      writingRegions: currentRegions,
    };
    const nextList = saveCalibratedTemplate(updated);
    setDevTemplates(nextList);
  };

  // Trigger inline editing
  const startEditingNode = (item: CanvasItem) => {
    setEditingId(item.id);
    setEditingText(item.content);
  };

  const commitEditing = () => {
    if (editingId) {
      const next = items.map(i => i.id === editingId ? { ...i, content: editingText } : i);
      saveItems(next, false);
      setEditingId(null);
    }
  };

  const selectedItem = items.find(i => i.id === selectedId);

  // Helper to spawn a new arrow connected from a card's edge anchor
  const spawnArrowFromAnchor = (fromItem: CanvasItem, anchor: AnchorPosition) => {
    const id = `arrow_${Date.now()}`;
    const startCoords = getAnchorCoords(fromItem, anchor);
    let targetAnchor: AnchorPosition = anchor === 'top' ? 'bottom' : anchor === 'bottom' ? 'top' : anchor === 'left' ? 'right' : 'left';
    
    // Find nearest item to connect to
    const otherItems = items.filter(i => i.id !== fromItem.id && i.type !== 'arrow');
    let bestTarget = otherItems[0];
    let minDist = 999999;
    
    for (const other of otherItems) {
      const dist = Math.hypot(other.x - fromItem.x, other.y - fromItem.y);
      if (dist < minDist) {
        minDist = dist;
        bestTarget = other;
      }
    }

    const newItem: CanvasItem = {
      id,
      type: 'arrow',
      content: '➔',
      x: startCoords.x,
      y: startCoords.y,
      width: 100,
      height: 50,
      color: '#8b5cf6',
      fromId: fromItem.id,
      fromAnchor: anchor,
      toId: bestTarget?.id,
      toAnchor: bestTarget ? findBestAnchor(fromItem, bestTarget).to : targetAnchor,
      endX: bestTarget ? getAnchorCoords(bestTarget, targetAnchor).x : startCoords.x + 100,
      endY: bestTarget ? getAnchorCoords(bestTarget, targetAnchor).y : startCoords.y + 50,
    };

    saveItems([...items, newItem], true);
    setSelectedId(id);
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-[#0f0e17]/85 backdrop-blur-2xl flex items-center justify-center p-2 md:p-6 select-none">
      <div className="bg-[#faf8fc] dark:bg-[#181622] border-4 border-[#7c6a75] dark:border-[#a78bfa] rounded-3xl shadow-[0_20px_70px_rgba(0,0,0,0.9)] w-full h-[96vh] flex flex-col overflow-hidden relative">
        
        {/* --- TOP TOOLBAR --- */}
        <div ref={toolbarRef} className="bg-[#7c6a75] dark:bg-[#342e48] text-white px-5 py-2.5 flex flex-wrap items-center justify-between shadow-md z-30 gap-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎨</span>
            <div>
              <h2 className="font-black text-sm md:text-base tracking-wide flex items-center gap-2">
                <span>Konva Whiteboard Engine</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold">GPU Accelerated</span>
              </h2>
              <p className="text-[10px] text-white/80 hidden md:block">Real canvas objects, invisible overlay editing, multi-region text flow & anchor connectors</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-0.5 bg-black/20 p-1 rounded-lg">
              <button onClick={handleUndo} disabled={historyIdx <= 0} className="px-2 py-1 hover:bg-white/20 disabled:opacity-40 rounded text-xs font-bold" title="Undo">↩ Undo</button>
              <button onClick={handleRedo} disabled={historyIdx >= history.length - 1} className="px-2 py-1 hover:bg-white/20 disabled:opacity-40 rounded text-xs font-bold" title="Redo">↪ Redo</button>
            </div>

            <button
              onClick={() => setShowThemePicker(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-black px-3 py-1.5 rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-transform hover:scale-105"
            >
              <span>🖼️ Sticky Themes (28+)</span>
            </button>

            <button
              onClick={() => setShowTemplateEditor(true)}
              className="bg-amber-500 hover:bg-amber-600 text-black font-black px-3 py-1.5 rounded-xl text-xs shadow-md flex items-center gap-1 transition-transform hover:scale-105"
              title="Open Template Calibration Studio (Dev Tool)"
            >
              <span>🛠️ Template Editor</span>
            </button>

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
                  <button onClick={() => addItem('arrow')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">➔ Snapping Arrow Connector</button>
                  <button onClick={() => addItem('shape', 'rectangle')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">🔲 Rectangle Box</button>
                  <button onClick={() => addItem('shape', 'circle')} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2">⚪ Circle / Concept</button>
                </div>
              )}
            </div>

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
                      <div className="font-bold text-sm text-pink-700 dark:text-pink-300 mb-1">📑 Chapter Summary</div>
                      <div className="text-xs text-gray-800 dark:text-gray-200 line-clamp-3">{document.aiData.aiNotes.chapterSummary}</div>
                    </button>
                  )}
                  {document.aiData?.aiNotes?.keyConcepts && document.aiData.aiNotes.keyConcepts.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-2 mb-1.5 px-1">Key Concepts</div>
                      {document.aiData.aiNotes.keyConcepts.map((kc, i) => (
                        <button key={i} onClick={() => insertAiCard(`Concept #${i+1}`, String(kc), '#f8f5ff')} className="w-full text-left bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 p-2 rounded-xl mb-1 text-xs font-semibold">
                          ⚡ {String(kc)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setGridSnap(!gridSnap)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                gridSnap ? 'bg-amber-400 text-black border-amber-500 shadow-sm' : 'bg-black/30 text-white/70 border-white/10'
              }`}
            >
              📐 Grid Snap: {gridSnap ? 'ON' : 'OFF'}
            </button>

            <div className="flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-lg text-xs font-bold">
              <button onClick={() => setScale(Math.max(0.5, scale - 0.1))} className="hover:text-amber-300 px-1">➖</button>
              <span className="w-10 text-center font-mono">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(Math.min(2.0, scale + 0.1))} className="hover:text-amber-300 px-1">➕</button>
              <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="text-[10px] ml-1 bg-white/20 px-1.5 py-0.5 rounded">Reset</button>
            </div>

            <button onClick={onClose} className="bg-white/20 hover:bg-red-500 hover:text-white font-black px-3 py-1.5 rounded-xl ml-2 border border-white/20">
              ✕ Close
            </button>
          </div>
        </div>

        {/* --- FLOATING RICH FORMATTING TOOLBAR WHEN ITEM SELECTED --- */}
        {selectedItem && !editingId && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-[#232130] text-white border-2 border-purple-500 rounded-2xl px-3 py-1.5 shadow-2xl z-40 flex items-center gap-2 whitespace-nowrap text-xs font-bold">
            <select
              value={selectedItem.fontFamily || "'Quicksand', 'Nunito', sans-serif"}
              onChange={(e) => updateItemField(selectedItem.id, 'fontFamily', e.target.value)}
              className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-xs border border-white/20 text-white focus:outline-none"
            >
              <option value="'Quicksand', 'Nunito', sans-serif" className="text-black">Quicksand</option>
              <option value="'Nunito', sans-serif" className="text-black">Nunito</option>
              <option value="'Fredoka', sans-serif" className="text-black">Fredoka</option>
              <option value="sans-serif" className="text-black">Sans-serif</option>
              <option value="serif" className="text-black">Serif</option>
              <option value="monospace" className="text-black">Monospace</option>
            </select>

            <select
              value={selectedItem.fontSize || 15}
              onChange={(e) => updateItemField(selectedItem.id, 'fontSize', Number(e.target.value))}
              className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-xs border border-white/20 text-white focus:outline-none w-14"
            >
              {[12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48].map(sz => (
                <option key={sz} value={sz} className="text-black">{sz}px</option>
              ))}
            </select>

            <label className="cursor-pointer bg-white/10 hover:bg-white/20 p-1 rounded border border-white/20 flex items-center justify-center w-6 h-6" title="Text Color">
              <input
                type="color"
                value={selectedItem.textColor || '#3A3A3A'}
                onChange={(e) => updateItemField(selectedItem.id, 'textColor', e.target.value)}
                className="opacity-0 absolute w-0 h-0"
              />
              <span className="w-3.5 h-3.5 rounded-full border border-white/40" style={{ backgroundColor: selectedItem.textColor || '#3A3A3A' }} />
            </label>

            <div className="w-px h-4 bg-white/20 my-auto" />

            <button
              onClick={() => updateItemField(selectedItem.id, 'isBold', !selectedItem.isBold)}
              className={`px-2 py-0.5 rounded font-black ${selectedItem.isBold === false ? 'bg-white/10 text-white/60' : 'bg-purple-600 text-white'}`}
            >
              B
            </button>
            <button
              onClick={() => updateItemField(selectedItem.id, 'isItalic', !selectedItem.isItalic)}
              className={`px-2 py-0.5 rounded font-serif italic ${selectedItem.isItalic ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60'}`}
            >
              I
            </button>
            <button
              onClick={() => updateItemField(selectedItem.id, 'isUnderline', !selectedItem.isUnderline)}
              className={`px-2 py-0.5 rounded underline ${selectedItem.isUnderline ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60'}`}
            >
              U
            </button>

            <div className="w-px h-4 bg-white/20 my-auto" />

            <button
              onClick={() => {
                const nextAlign = selectedItem.textAlign === 'center' ? 'right' : selectedItem.textAlign === 'right' ? 'left' : 'center';
                updateItemField(selectedItem.id, 'textAlign', nextAlign);
              }}
              className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-xs"
            >
              {selectedItem.textAlign === 'center' ? '☰ Center' : selectedItem.textAlign === 'right' ? '☷ Right' : '≡ Left'}
            </button>

            {(selectedItem.type === 'sticky' || selectedItem.bgAsset) && (
              <button
                onClick={() => setShowThemePicker(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-2 py-0.5 rounded flex items-center gap-1 shadow-sm ml-1"
              >
                <span>🎨 Theme</span>
              </button>
            )}

            <div className="w-px h-4 bg-white/20 my-auto" />

            <button onClick={() => deleteItem(selectedItem.id)} className="bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white px-2 py-0.5 rounded transition-colors" title="Delete Card (Del)">
              🗑️
            </button>
            <button onClick={() => duplicateItem(selectedItem.id)} className="bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white px-2 py-0.5 rounded transition-colors" title="Duplicate Card (Ctrl+D)">
              📑
            </button>
          </div>
        )}

        {/* --- KONVA CANVAS ENGINE --- */}
        <div ref={containerRef} className="flex-1 overflow-hidden relative canvas-container" style={{ backgroundColor: '#f7f5fa' }}>
          
          <Stage
            ref={stageRef}
            width={typeof window !== 'undefined' ? window.innerWidth : 1200}
            height={typeof window !== 'undefined' ? window.innerHeight - 100 : 800}
            scaleX={scale}
            scaleY={scale}
            x={pan.x}
            y={pan.y}
            draggable={!selectedId && !editingId}
            onDragEnd={(e: any) => {
              if (e.target === stageRef.current) {
                setPan({ x: e.target.x(), y: e.target.y() });
              }
            }}
            onMouseDown={(e: any) => {
              const clickedOnEmpty = e.target === stageRef.current;
              if (clickedOnEmpty) {
                setSelectedId(null);
                if (editingId) commitEditing();
              }
            }}
          >
            <Layer>
              {/* Render background grid dots */}
              {gridSnap && (
                <KonvaRect
                  x={-5000}
                  y={-5000}
                  width={10000}
                  height={10000}
                  fill="#f7f5fa"
                  listening={false}
                />
              )}

              {/* Render connector arrows with dynamic object-to-object anchor rerouting */}
              {items.filter(i => i.type === 'arrow').map(arrow => {
                let sx = arrow.startX ?? (arrow.x + 10);
                let sy = arrow.startY ?? (arrow.y + 25);
                let ex = arrow.endX ?? (arrow.x + arrow.width - 10);
                let ey = arrow.endY ?? (arrow.y + 25);

                if (arrow.fromId) {
                  const fromItem = items.find(i => i.id === arrow.fromId);
                  if (fromItem && arrow.fromAnchor) {
                    const c = getAnchorCoords(fromItem, arrow.fromAnchor);
                    sx = c.x; sy = c.y;
                  }
                }
                if (arrow.toId) {
                  const toItem = items.find(i => i.id === arrow.toId);
                  if (toItem && arrow.toAnchor) {
                    const c = getAnchorCoords(toItem, arrow.toAnchor);
                    ex = c.x; ey = c.y;
                  }
                }

                const isSelected = selectedId === arrow.id;
                const color = isSelected ? '#ec4899' : arrow.color || '#8b5cf6';

                return (
                  <Group
                    key={arrow.id}
                    id={`node_${arrow.id}`}
                    onClick={(e: any) => { e.cancelBubble = true; setSelectedId(arrow.id); }}
                  >
                    <KonvaLine
                      points={[sx, sy, (sx + ex) / 2, sy, (sx + ex) / 2, ey, ex, ey]}
                      stroke={color}
                      strokeWidth={isSelected ? 4 : 3}
                      dash={arrow.shapeType === 'line' ? [6, 6] : undefined}
                      pointerLength={10}
                      pointerWidth={10}
                      tension={0.2}
                    />
                  </Group>
                );
              })}

              {/* Render sticky notes, text boxes, shapes, AI cards */}
              {items.filter(i => i.type !== 'arrow').map(item => {
                const isSelected = selectedId === item.id;
                const isSticky = item.type === 'sticky' || item.bgAsset !== undefined;
                const isAiCard = item.isAiCard && !item.bgAsset;
                const isText = item.type === 'text';
                const isCircle = item.type === 'shape' && item.shapeType === 'circle';

                const template = isSticky ? getStickyTemplate(item.bgAsset) : null;
                const theme = FALLBACK_THEMES.find(t => t.bg === item.color) || FALLBACK_THEMES[0];

                // Multiple Writable Regions support for flowing text around artwork
                const regions = template?.writingRegions && template.writingRegions.length > 0 ? template.writingRegions : [template ? template.writingArea : { x: 5, y: 5, width: 90, height: 90 }];
                const flowedTexts = splitTextAcrossRegions(
                  item.content,
                  regions,
                  item.width,
                  item.height,
                  item.fontSize || (template ? template.defaultFontSize : 15),
                  template?.lineHeight || 1.5,
                  item.fontFamily || "'Quicksand', 'Nunito', sans-serif"
                );

                return (
                  <Group
                    key={item.id}
                    id={`node_${item.id}`}
                    x={item.x}
                    y={item.y}
                    width={item.width}
                    height={item.height}
                    draggable={!editingId}
                    onClick={(e: any) => {
                      e.cancelBubble = true;
                      setSelectedId(item.id);
                    }}
                    onDblClick={(e: any) => {
                      e.cancelBubble = true;
                      startEditingNode(item);
                    }}
                    onDragEnd={(e: any) => {
                      let fx = e.target.x();
                      let fy = e.target.y();
                      if (gridSnap) {
                        fx = Math.round(fx / GRID_SIZE) * GRID_SIZE;
                        fy = Math.round(fy / GRID_SIZE) * GRID_SIZE;
                        e.target.x(fx);
                        e.target.y(fy);
                      }
                      updateItemField(item.id, 'x', fx);
                      updateItemField(item.id, 'y', fy);
                    }}
                    onTransformEnd={(e: any) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);

                      let newW = Math.round(node.width() * scaleX);
                      let newH = Math.round(node.height() * scaleY);

                      if (isSticky && template) {
                        newH = Math.round(newW / (template.aspectRatio || 1.0));
                      }

                      updateItemField(item.id, 'width', Math.max(80, newW));
                      updateItemField(item.id, 'height', Math.max(80, newH));
                    }}
                  >
                    {/* Background layer */}
                    {isSticky && template ? (
                      <StationeryImage
                        url={template.image}
                        width={item.width}
                        height={item.height}
                        template={template}
                      />
                    ) : isCircle ? (
                      <KonvaCircle
                        x={item.width / 2}
                        y={item.height / 2}
                        radius={item.width / 2}
                        fill={item.color || '#e0f2fe'}
                        stroke={isSelected ? '#8b5cf6' : 'rgba(0,0,0,0.1)'}
                        strokeWidth={2}
                      />
                    ) : (
                      <KonvaRect
                        width={item.width}
                        height={item.height}
                        fill={isText ? 'rgba(255,255,255,0.4)' : isAiCard ? theme.bg : item.color || '#ffffff'}
                        stroke={isSelected ? '#8b5cf6' : isText ? '#9ca3af' : 'rgba(0,0,0,0.1)'}
                        strokeWidth={isSelected ? 2 : isText ? 1 : 1}
                        dash={isText && !isSelected ? [4, 4] : undefined}
                        cornerRadius={16}
                      />
                    )}

                    {/* Header bar for AI cards */}
                    {isAiCard && (
                      <KonvaRect
                        width={item.width}
                        height={28}
                        fill={theme.border}
                        cornerRadius={[16, 16, 0, 0]}
                      />
                    )}
                    {isAiCard && (
                      <KonvaText
                        x={12}
                        y={8}
                        text={item.title || '✨ AI Insight'}
                        fontSize={12}
                        fontFamily="sans-serif"
                        fontStyle="bold"
                        fill="#1f2937"
                      />
                    )}

                    {/* Text Layer across multiple writable regions */}
                    {editingId !== item.id && regions.map((reg, rIdx) => {
                      const tx = (reg.x / 100) * item.width;
                      const ty = (reg.y / 100) * item.height;
                      const tw = (reg.width / 100) * item.width;
                      const th = (reg.height / 100) * item.height;

                      return (
                        <KonvaText
                          key={rIdx}
                          x={tx}
                          y={isAiCard && rIdx === 0 ? ty + 24 : ty}
                          width={tw}
                          height={isAiCard && rIdx === 0 ? th - 24 : th}
                          text={flowedTexts[rIdx] || ''}
                          fontSize={item.fontSize || (template ? template.defaultFontSize : 15)}
                          fontFamily={item.fontFamily || "'Quicksand', 'Nunito', sans-serif"}
                          fontStyle={item.isBold !== undefined ? (item.isBold ? 'bold' : 'normal') : 'bold'}
                          fill={item.textColor || (template ? template.defaultTextColor : '#3A3A3A')}
                          align={item.textAlign || (template ? template.textAlign : 'left') || 'left'}
                          lineHeight={template?.lineHeight || 1.5}
                          wrap="word"
                          listening={false}
                        />
                      );
                    })}

                    {/* True Edge Anchor Points for object-to-object connectors */}
                    {isSelected && (['top', 'right', 'bottom', 'left'] as AnchorPosition[]).map((anchorPos) => {
                      const coords = getAnchorCoords({ ...item, x: 0, y: 0 }, anchorPos);
                      return (
                        <KonvaCircle
                          key={anchorPos}
                          x={coords.x}
                          y={coords.y}
                          radius={6}
                          fill="#8b5cf6"
                          stroke="#ffffff"
                          strokeWidth={2}
                          cursor="pointer"
                          onClick={(e: any) => {
                            e.cancelBubble = true;
                            spawnArrowFromAnchor(item, anchorPos);
                          }}
                          onMouseEnter={(e: any) => { e.target.scale({ x: 1.5, y: 1.5 }); e.target.getLayer()?.batchDraw(); }}
                          onMouseLeave={(e: any) => { e.target.scale({ x: 1, y: 1 }); e.target.getLayer()?.batchDraw(); }}
                        />
                      );
                    })}
                  </Group>
                );
              })}

              {/* Konva Transformer for professional boundary resize handles */}
              <Transformer
                ref={transformerRef}
                boundBoxFunc={(oldBox: any, newBox: any) => {
                  if (newBox.width < 60 || newBox.height < 60) {
                    return oldBox;
                  }
                  return newBox;
                }}
                anchorStroke="#8b5cf6"
                anchorFill="#ffffff"
                anchorSize={10}
                borderStroke="#8b5cf6"
                borderStrokeWidth={2}
                rotateEnabled={false}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              />
            </Layer>
          </Stage>

          {/* --- 100% VISUALLY INVISIBLE HTML TEXTAREA OVERLAY FOR SEAMLESS INLINE EDITING --- */}
          {editingId && (() => {
            const item = items.find(i => i.id === editingId);
            if (!item) return null;
            const template = (item.type === 'sticky' || item.bgAsset) ? getStickyTemplate(item.bgAsset) : null;
            const primaryReg = template?.writingRegions && template.writingRegions.length > 0 ? template.writingRegions[0] : (template ? template.writingArea : { x: 5, y: 5, width: 90, height: 90 });
            
            const tx = (primaryReg.x / 100) * item.width;
            const ty = (primaryReg.y / 100) * item.height;
            const tw = (primaryReg.width / 100) * item.width;
            const th = (primaryReg.height / 100) * item.height;

            const screenX = (item.x + tx) * scale + pan.x;
            const screenY = (item.y + ty) * scale + pan.y;
            const screenW = tw * scale;
            const screenH = th * scale;

            return (
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onBlur={commitEditing}
                autoFocus
                className="absolute z-50 bg-transparent border-0 outline-none shadow-none p-0 focus:ring-0 resize-none font-sans custom-scrollbar whitespace-pre-wrap break-words overflow-hidden"
                style={{
                  left: `${screenX}px`,
                  top: `${screenY}px`,
                  width: `${screenW}px`,
                  height: `${screenH}px`,
                  fontFamily: item.fontFamily || "'Quicksand', 'Nunito', sans-serif",
                  fontSize: `${(item.fontSize || (template ? template.defaultFontSize : 15)) * scale}px`,
                  lineHeight: template?.lineHeight || 1.5,
                  color: item.textColor || (template ? template.defaultTextColor : '#3A3A3A'),
                  fontWeight: item.isBold !== undefined ? (item.isBold ? 'bold' : 'normal') : 'bold',
                  textAlign: item.textAlign || (template ? template.textAlign : 'left') || 'left',
                  padding: template ? template.padding : '4px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  caretColor: item.textColor || (template ? template.defaultTextColor : '#3A3A3A'),
                }}
              />
            );
          })()}

        </div>

        {/* --- FOOTER STATUS --- */}
        <div className="bg-[#7c6a75]/10 dark:bg-black/30 border-t border-[#7c6a75]/20 px-4 py-1.5 flex items-center justify-between text-[11px] text-[#5d5770] dark:text-gray-400 font-medium z-30">
          <div className="flex items-center gap-4">
            <span>🗂️ <strong>{items.length}</strong> canvas objects</span>
            <span>📍 Pan: X={Math.round(pan.x)}, Y={Math.round(pan.y)}</span>
            <span className="hidden md:inline text-purple-600 dark:text-purple-400 font-bold">💡 Tip: Click purple edge dots to draw snapping connectors! Double-click card to edit text.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Canvas auto-saved at {lastSaved}
            </span>
            <Button variant="ghost" onClick={() => saveItems(items, false)} className="text-[10px] py-0.5 px-2 font-bold">
              💾 Save Now
            </Button>
          </div>
        </div>

        {/* --- THEME PICKER MODAL --- */}
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
                <button onClick={() => setShowThemePicker(false)} className="bg-gray-100 dark:bg-white/10 hover:bg-red-500 hover:text-white font-bold w-8 h-8 rounded-full flex items-center justify-center">✕</button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 overflow-y-auto custom-scrollbar p-2 flex-1 max-h-[65vh]">
                {devTemplates.map((t) => (
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
                    className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-purple-500/30 hover:border-purple-600 cursor-pointer shadow-sm hover:shadow-xl hover:scale-105 transition-all bg-[#faf8fc] dark:bg-[#181622] flex items-center justify-center p-1.5"
                  >
                    <img src={t.image} alt={t.name} className="w-full h-full object-contain pointer-events-none" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- TEMPLATE CALIBRATION STUDIO (DEV TOOL) --- */}
        {showTemplateEditor && (
          <div className="fixed inset-0 z-[99999999] bg-black/85 backdrop-blur-lg flex items-center justify-center p-4 animate-fadeIn select-none">
            <div className="bg-white dark:bg-[#1e1c2a] border-4 border-amber-500 rounded-3xl p-6 shadow-2xl max-w-6xl w-full max-h-[94vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
                <div>
                  <h3 className="font-black text-lg text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <span>🛠️ Template Calibration Studio (Dev Tool)</span>
                    <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      Template #{activeDevIndex + 1} of {devTemplates.length}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Calibrate multiple writable regions per template so text naturally flows around decorative mascots and tape!</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const tsCode = `export const INITIAL_STICKY_TEMPLATES: StickyTemplate[] = ${JSON.stringify(devTemplates, null, 2)};`;
                      navigator.clipboard?.writeText(tsCode);
                      alert('✅ Copied complete TS configuration array to clipboard! Paste directly into stickyTemplates.ts.');
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-md flex items-center gap-1"
                  >
                    📋 Copy TS Config
                  </button>
                  <button onClick={() => setShowTemplateEditor(false)} className="bg-gray-100 dark:bg-white/10 hover:bg-red-500 hover:text-white font-bold w-8 h-8 rounded-full flex items-center justify-center">✕</button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
                <div className="w-full md:w-56 border-r border-gray-200 dark:border-gray-700 pr-3 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 max-h-[72vh]">
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Select Template</div>
                  {devTemplates.map((t, idx) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveDevIndex(idx)}
                      className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all ${
                        activeDevIndex === idx ? 'bg-amber-500 text-black font-black shadow-md' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 font-medium text-xs'
                      }`}
                    >
                      <img src={t.image} alt={t.name} className="w-8 h-8 object-contain rounded bg-white/10 p-0.5" />
                      <span className="truncate text-xs">{t.name}</span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 flex flex-col items-center justify-center bg-[#f0ecf5] dark:bg-[#12101a] rounded-2xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 relative overflow-hidden">
                  <div className="text-xs font-bold text-gray-500 absolute top-3 left-4">📍 Live Writable Regions Preview (360x360 box)</div>
                  <button onClick={addDevRegion} className="absolute top-3 right-4 bg-green-600 hover:bg-green-700 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-md">+ Add Writable Region</button>
                  
                  <div
                    className="relative w-[360px] h-[360px] bg-transparent rounded-2xl overflow-hidden shadow-2xl border-2 border-purple-500/30"
                    onMouseMove={(e) => {
                      if (devDraggingRegionIdx === null && !devResizingRegionIdx) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const curX = (e.clientX - rect.left) / rect.width * 100;
                      const curY = (e.clientY - rect.top) / rect.height * 100;

                      if (devDraggingRegionIdx !== null) {
                        const deltaX = curX - devDragStart.x;
                        const deltaY = curY - devDragStart.y;
                        updateDevRegion(devDraggingRegionIdx, devDragStart.startTx + deltaX, devDragStart.startTy + deltaY, devDragStart.startTw, devDragStart.startTh);
                      } else if (devResizingRegionIdx) {
                        const deltaX = curX - devDragStart.x;
                        const deltaY = curY - devDragStart.y;
                        let nw = devDragStart.startTw, nh = devDragStart.startTh, nx = devDragStart.startTx, ny = devDragStart.startTy;
                        if (devResizingRegionIdx.handle === 'se') { nw += deltaX; nh += deltaY; }
                        else if (devResizingRegionIdx.handle === 'sw') { nw -= deltaX; nh += deltaY; nx += deltaX; }
                        else if (devResizingRegionIdx.handle === 'ne') { nw += deltaX; nh -= deltaY; ny += deltaY; }
                        else if (devResizingRegionIdx.handle === 'nw') { nw -= deltaX; nh -= deltaY; nx += deltaX; ny += deltaY; }
                        updateDevRegion(devResizingRegionIdx.idx, nx, ny, nw, nh);
                      }
                    }}
                    onMouseUp={() => { setDevDraggingRegionIdx(null); setDevResizingRegionIdx(null); }}
                    onMouseLeave={() => { setDevDraggingRegionIdx(null); setDevResizingRegionIdx(null); }}
                  >
                    <img src={devTemplates[activeDevIndex].image} alt="Template" className="w-full h-full object-contain pointer-events-none select-none" />

                    {getActiveRegions().map((reg, rIdx) => (
                      <div
                        key={rIdx}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDevDraggingRegionIdx(rIdx);
                          const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                          setDevDragStart({
                            x: (e.clientX - rect.left) / rect.width * 100,
                            y: (e.clientY - rect.top) / rect.height * 100,
                            startTx: reg.x,
                            startTy: reg.y,
                            startTw: reg.width,
                            startTh: reg.height,
                          });
                        }}
                        className="absolute border-2 border-green-500 bg-green-500/20 cursor-move flex flex-col justify-start overflow-hidden shadow-lg"
                        style={{
                          left: `${reg.x}%`,
                          top: `${reg.y}%`,
                          width: `${reg.width}%`,
                          height: `${reg.height}%`,
                          padding: devTemplates[activeDevIndex].padding,
                        }}
                      >
                        <div className="flex items-center justify-between bg-green-600 text-white px-1.5 py-0.5 text-[10px] font-mono font-bold w-full">
                          <span>Region #{rIdx + 1}</span>
                          {getActiveRegions().length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); deleteDevRegion(rIdx); }} className="text-red-300 hover:text-white font-black px-1 ml-1">✕</button>
                          )}
                        </div>
                        <div className="font-bold text-[#3A3A3A] whitespace-pre-wrap leading-relaxed select-none overflow-hidden" style={{ fontSize: `${Math.round(360 * (devTemplates[activeDevIndex].defaultFontSize / 280))}px`, lineHeight: devTemplates[activeDevIndex].lineHeight }}>
                          {`Text flow #${rIdx + 1}\nAvoids artwork!`}
                        </div>
                        {['nw', 'ne', 'sw', 'se'].map((h) => (
                          <div
                            key={h}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setDevResizingRegionIdx({ idx: rIdx, handle: h });
                              const rect = e.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
                              setDevDragStart({
                                x: (e.clientX - rect.left) / rect.width * 100,
                                y: (e.clientY - rect.top) / rect.height * 100,
                                startTx: reg.x,
                                startTy: reg.y,
                                startTw: reg.width,
                                startTh: reg.height,
                              });
                            }}
                            className={`absolute w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full cursor-${h}-resize shadow-md hover:scale-125 z-40 ${
                              h === 'nw' ? '-top-1.5 -left-1.5' : h === 'ne' ? '-top-1.5 -right-1.5' : h === 'sw' ? '-bottom-1.5 -left-1.5' : '-bottom-1.5 -right-1.5'
                            }`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full md:w-80 border-l border-gray-200 dark:border-gray-700 pl-4 overflow-y-auto custom-scrollbar flex flex-col gap-3 text-xs text-gray-800 dark:text-gray-200 max-h-[72vh]">
                  <div className="font-black text-sm text-purple-600 border-b pb-1.5">⚙️ Fine-Tune Template & Regions</div>
                  <div>
                    <label className="font-bold text-gray-500 block mb-1">Template Name</label>
                    <input type="text" value={devTemplates[activeDevIndex].name} onChange={(e) => updateDevTemplateField('name', e.target.value)} className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2.5 py-1.5 font-bold" />
                  </div>
                  
                  {getActiveRegions().map((reg, rIdx) => (
                    <div key={rIdx} className="bg-black/5 dark:bg-white/5 p-2.5 rounded-xl border border-gray-300 dark:border-gray-700">
                      <div className="font-bold text-green-600 dark:text-green-400 mb-1 flex items-center justify-between">
                        <span>📐 Region #{rIdx + 1} Coords</span>
                        {getActiveRegions().length > 1 && (
                          <button onClick={() => deleteDevRegion(rIdx)} className="text-[10px] text-red-500 hover:underline">Remove</button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div><label className="text-[10px] text-gray-500">X (%)</label><input type="number" value={reg.x} onChange={(e) => updateDevRegion(rIdx, Number(e.target.value), reg.y, reg.width, reg.height)} className="w-full bg-white dark:bg-black/30 border rounded px-1.5 py-0.5 font-mono text-xs" /></div>
                        <div><label className="text-[10px] text-gray-500">Y (%)</label><input type="number" value={reg.y} onChange={(e) => updateDevRegion(rIdx, reg.x, Number(e.target.value), reg.width, reg.height)} className="w-full bg-white dark:bg-black/30 border rounded px-1.5 py-0.5 font-mono text-xs" /></div>
                        <div><label className="text-[10px] text-gray-500">Width (%)</label><input type="number" value={reg.width} onChange={(e) => updateDevRegion(rIdx, reg.x, reg.y, Number(e.target.value), reg.height)} className="w-full bg-white dark:bg-black/30 border rounded px-1.5 py-0.5 font-mono text-xs" /></div>
                        <div><label className="text-[10px] text-gray-500">Height (%)</label><input type="number" value={reg.height} onChange={(e) => updateDevRegion(rIdx, reg.x, reg.y, reg.width, Number(e.target.value))} className="w-full bg-white dark:bg-black/30 border rounded px-1.5 py-0.5 font-mono text-xs" /></div>
                      </div>
                    </div>
                  ))}

                  <div><label className="font-bold text-gray-500 block mb-0.5">CSS Padding (e.g. "4% 5%")</label><input type="text" value={devTemplates[activeDevIndex].padding} onChange={(e) => updateDevTemplateField('padding', e.target.value)} className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2.5 py-1 font-mono font-bold" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="font-bold text-gray-500 block mb-0.5">Font Size (px)</label><input type="number" value={devTemplates[activeDevIndex].defaultFontSize} onChange={(e) => updateDevTemplateField('defaultFontSize', Number(e.target.value))} className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2 py-1 font-mono font-bold" /></div>
                    <div><label className="font-bold text-gray-500 block mb-0.5">Line Height</label><input type="number" step="0.1" value={devTemplates[activeDevIndex].lineHeight} onChange={(e) => updateDevTemplateField('lineHeight', Number(e.target.value))} className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2 py-1 font-mono font-bold" /></div>
                  </div>
                  <div><label className="font-bold text-gray-500 block mb-0.5">Aspect Ratio (Width / Height)</label><input type="number" step="0.05" value={devTemplates[activeDevIndex].aspectRatio} onChange={(e) => updateDevTemplateField('aspectRatio', Number(e.target.value))} className="w-full bg-gray-100 dark:bg-white/10 border rounded-lg px-2.5 py-1 font-mono font-bold" /></div>
                  
                  <div className="mt-auto pt-4 flex flex-col gap-2">
                    <button onClick={() => { const tsCode = `export const INITIAL_STICKY_TEMPLATES: StickyTemplate[] = ${JSON.stringify(devTemplates, null, 2)};`; navigator.clipboard?.writeText(tsCode); alert('✅ Copied complete TS configuration array to clipboard!'); }} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-2.5 rounded-xl text-xs shadow-lg flex items-center justify-center">
                      <span>📋 Export All 28 to TS Code</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
