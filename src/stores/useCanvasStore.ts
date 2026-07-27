import { create } from 'zustand';
import { getStickyTemplates, getStickyTemplate, StickyTemplate } from '@/components/study/stickyTemplates';

export type AnchorPosition = 'top' | 'right' | 'bottom' | 'left';
export type ConnectorStyle = 'straight' | 'orthogonal' | 'curved';

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
  connectorStyle?: ConnectorStyle;
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

export const getAnchorCoords = (item: { x: number; y: number; width: number; height: number }, anchor: AnchorPosition): { x: number; y: number } => {
  switch (anchor) {
    case 'top': return { x: item.x + item.width / 2, y: item.y };
    case 'right': return { x: item.x + item.width, y: item.y + item.height / 2 };
    case 'bottom': return { x: item.x + item.width / 2, y: item.y + item.height };
    case 'left': return { x: item.x, y: item.y + item.height / 2 };
  }
};

const findBestAnchor = (fromItem: CanvasItem, toItem: CanvasItem): { from: AnchorPosition; to: AnchorPosition } => {
  const dx = (toItem.x + toItem.width / 2) - (fromItem.x + fromItem.width / 2);
  const dy = (toItem.y + toItem.height / 2) - (fromItem.y + fromItem.height / 2);
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' };
  } else {
    return dy > 0 ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' };
  }
};

interface CanvasStoreState {
  items: CanvasItem[];
  selectedId: string | null;
  editingId: string | null;
  editingText: string;
  scale: number;
  pan: { x: number; y: number };
  gridSnap: boolean;
  history: CanvasItem[][];
  historyIdx: number;
  documentId: string | null;
  lastSaved: string;
  activeDropdown: 'add' | 'ai' | null;
  showThemePicker: boolean;
  showTemplateEditor: boolean;

  // Actions
  initCanvas: (docId: string, docName: string) => void;
  saveItems: (newItems: CanvasItem[], addToHistory?: boolean) => void;
  addItem: (type: CanvasItem['type'], shapeType?: CanvasItem['shapeType']) => void;
  addStickyNoteAsset: (assetUrl: string) => void;
  insertAiCard: (title: string, text: string, themeBg?: string) => void;
  deleteItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  updateItemField: (id: string, field: keyof CanvasItem, value: any) => void;
  updateItemBgAsset: (id: string, bgAsset: string) => void;
  setSelectedId: (id: string | null) => void;
  startEditing: (item: CanvasItem) => void;
  setEditingText: (text: string) => void;
  commitEditing: () => void;
  setScale: (scale: number | ((prev: number) => number)) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setGridSnap: (snap: boolean | ((prev: boolean) => boolean)) => void;
  setActiveDropdown: (d: 'add' | 'ai' | null) => void;
  setShowThemePicker: (show: boolean) => void;
  setShowTemplateEditor: (show: boolean) => void;
  undo: () => void;
  redo: () => void;
  saveNow: () => void;
  spawnArrowFromAnchor: (fromItem: CanvasItem, anchor: AnchorPosition) => void;
}

const GRID_SIZE = 20;

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  items: [],
  selectedId: null,
  editingId: null,
  editingText: '',
  scale: 1,
  pan: { x: 0, y: 0 },
  gridSnap: true,
  history: [],
  historyIdx: -1,
  documentId: null,
  lastSaved: 'Just now',
  activeDropdown: null,
  showThemePicker: false,
  showTemplateEditor: false,

  initCanvas: (docId, docName) => {
    const all = getStickyTemplates();
    const store = get();
    if (store.documentId === docId && store.items.length > 0) return;

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`dazai_canvas_${docId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            set({
              items: parsed,
              history: [parsed],
              historyIdx: 0,
              documentId: docId,
              lastSaved: localStorage.getItem(`dazai_canvas_time_${docId}`) || 'Earlier',
            });
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load canvas items', e);
      }
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
        content: `Document: ${docName}\n\nUse this space to build mind maps, flowcharts, and visual summaries!`,
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
        connectorStyle: 'orthogonal',
        fromId: 'welcome_1',
        fromAnchor: 'right',
        toId: 'welcome_2',
        toAnchor: 'left',
      },
    ];

    set({
      items: initial,
      history: [initial],
      historyIdx: 0,
      documentId: docId,
      lastSaved: 'Just now',
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(`dazai_canvas_${docId}`, JSON.stringify(initial));
    }
  },

  saveItems: (newItems, addToHistory = true) => {
    const { history, historyIdx, documentId } = get();
    let nextHistory = history;
    let nextIdx = historyIdx;

    if (addToHistory) {
      nextHistory = [...history.slice(0, historyIdx + 1), newItems];
      nextIdx = nextHistory.length - 1;
    }

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    set({
      items: newItems,
      history: nextHistory,
      historyIdx: nextIdx,
      lastSaved: now,
    });

    if (typeof window !== 'undefined' && documentId) {
      localStorage.setItem(`dazai_canvas_${documentId}`, JSON.stringify(newItems));
      localStorage.setItem(`dazai_canvas_time_${documentId}`, now);
    }
  },

  addItem: (type, shapeType) => {
    const { pan, scale, items, saveItems } = get();
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
        connectorStyle: 'orthogonal',
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

    saveItems([...items, newItem], true);
    set({ selectedId: id, activeDropdown: null });
  },

  addStickyNoteAsset: (assetUrl) => {
    const { pan, scale, items, saveItems } = get();
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
      fontFamily: template.defaultFont || "'Quicksand', 'Nunito', sans-serif",
      isBold: true,
      textColor: template.defaultTextColor || '#3A3A3A',
      textAlign: template.textAlign || 'left',
    };

    saveItems([...items, newItem], true);
    set({ selectedId: id, showThemePicker: false });
  },

  insertAiCard: (title, text, themeBg = '#f8f5ff') => {
    const { pan, scale, items, saveItems } = get();
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

    saveItems([...items, newItem], true);
    set({ selectedId: id, activeDropdown: null });
  },

  deleteItem: (id) => {
    const { items, selectedId, saveItems } = get();
    const next = items.filter(i => i.id !== id && i.fromId !== id && i.toId !== id);
    saveItems(next, true);
    if (selectedId === id) set({ selectedId: null });
  },

  duplicateItem: (id) => {
    const { items, saveItems } = get();
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
      set({ selectedId: newId });
    }
  },

  updateItemField: (id, field, value) => {
    const { items, saveItems } = get();
    const next = items.map(i => i.id === id ? { ...i, [field]: value } : i);
    saveItems(next, true);
  },

  updateItemBgAsset: (id, bgAsset) => {
    const { items, saveItems } = get();
    const template = getStickyTemplate(bgAsset);
    const next = items.map(i => i.id === id ? {
      ...i,
      bgAsset: template.image,
      height: Math.round(i.width / (template.aspectRatio || 1.0)),
      fontSize: template.defaultFontSize || 15,
      fontFamily: template.defaultFont || "'Quicksand', 'Nunito', sans-serif",
      textColor: template.defaultTextColor || '#3A3A3A',
      textAlign: template.textAlign || 'left',
    } : i);
    saveItems(next, true);
  },

  setSelectedId: (id) => set({ selectedId: id }),
  startEditing: (item) => set({ editingId: item.id, editingText: item.content }),
  setEditingText: (text) => set({ editingText: text }),
  
  commitEditing: () => {
    const { editingId, editingText, items, saveItems } = get();
    if (editingId) {
      const next = items.map(i => i.id === editingId ? { ...i, content: editingText } : i);
      saveItems(next, false);
      set({ editingId: null });
    }
  },

  setScale: (val) => set(state => ({ scale: typeof val === 'function' ? val(state.scale) : val })),
  setPan: (pan) => set({ pan }),
  setGridSnap: (val) => set(state => ({ gridSnap: typeof val === 'function' ? val(state.gridSnap) : val })),
  setActiveDropdown: (d) => set({ activeDropdown: d }),
  setShowThemePicker: (show) => set({ showThemePicker: show }),
  setShowTemplateEditor: (show) => set({ showTemplateEditor: show }),

  undo: () => {
    const { history, historyIdx, documentId } = get();
    if (historyIdx > 0) {
      const prevIdx = historyIdx - 1;
      const prevItems = history[prevIdx];
      set({ historyIdx: prevIdx, items: prevItems });
      if (typeof window !== 'undefined' && documentId) {
        localStorage.setItem(`dazai_canvas_${documentId}`, JSON.stringify(prevItems));
      }
    }
  },

  redo: () => {
    const { history, historyIdx, documentId } = get();
    if (historyIdx < history.length - 1) {
      const nextIdx = historyIdx + 1;
      const nextItems = history[nextIdx];
      set({ historyIdx: nextIdx, items: nextItems });
      if (typeof window !== 'undefined' && documentId) {
        localStorage.setItem(`dazai_canvas_${documentId}`, JSON.stringify(nextItems));
      }
    }
  },

  saveNow: () => {
    const { items, saveItems } = get();
    saveItems(items, false);
  },

  spawnArrowFromAnchor: (fromItem, anchor) => {
    const { items, saveItems } = get();
    const id = `arrow_${Date.now()}`;
    const startCoords = getAnchorCoords(fromItem, anchor);
    let targetAnchor: AnchorPosition = anchor === 'top' ? 'bottom' : anchor === 'bottom' ? 'top' : anchor === 'left' ? 'right' : 'left';
    
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
      connectorStyle: 'orthogonal',
      fromId: fromItem.id,
      fromAnchor: anchor,
      toId: bestTarget?.id,
      toAnchor: bestTarget ? findBestAnchor(fromItem, bestTarget).to : targetAnchor,
      endX: bestTarget ? getAnchorCoords(bestTarget, targetAnchor).x : startCoords.x + 100,
      endY: bestTarget ? getAnchorCoords(bestTarget, targetAnchor).y : startCoords.y + 50,
    };

    saveItems([...items, newItem], true);
    set({ selectedId: id });
  },
}));
