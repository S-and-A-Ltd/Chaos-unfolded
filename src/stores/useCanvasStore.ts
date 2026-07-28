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
  
  // New shape/image/connector properties
  imageUrl?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed';
  cornerRadius?: number;
  opacity?: number;
  arrowhead?: 'none' | 'arrow' | 'triangle';
  isAiCard?: boolean;
  fromId?: string;
  fromAnchor?: AnchorPosition;
  toId?: string;
  toAnchor?: AnchorPosition;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  // Polish: cursor persistence
  cursorStart?: number;
  cursorEnd?: number;
  // Polish: lock background mode
  lockedBg?: boolean;
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

export interface CanvasInfo {
  id: string;
  name: string;
  updatedAt: number;
}

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
  
  // Document and Canvas Management
  documentId: string | null;
  activeCanvasId: string | null;
  canvases: CanvasInfo[];
  lastSaved: string;
  
  activeDropdown: 'add' | 'ai' | 'canvas' | null;
  showThemePicker: boolean;
  showTemplateEditor: boolean;

  // Connector Creation Mode
  connectorMode: boolean;
  drawingConnector: {
    fromId?: string;
    fromAnchor?: AnchorPosition;
    startX?: number;
    startY?: number;
    currentX: number;
    currentY: number;
  } | null;

  // Actions
  initCanvas: (docId: string, docName: string) => void;
  saveItems: (newItems: CanvasItem[], addToHistory?: boolean) => void;
  addItem: (type: CanvasItem['type'], shapeType?: CanvasItem['shapeType'], extraParams?: any) => void;
  addStickyNoteAsset: (assetUrl: string) => void;
  insertAiCard: (title: string, text: string, themeBg?: string) => void;
  deleteItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  updateItemField: (id: string, field: keyof CanvasItem, value: any) => void;
  updateItemFields: (id: string, fields: Partial<CanvasItem>) => void;
  updateItemBgAsset: (id: string, bgAsset: string) => void;
  setSelectedId: (id: string | null) => void;
  startEditing: (item: CanvasItem) => void;
  setEditingText: (text: string) => void;
  commitEditing: (newText?: string, cursorStart?: number, cursorEnd?: number) => void;
  setScale: (scale: number | ((prev: number) => number)) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setGridSnap: (snap: boolean | ((prev: boolean) => boolean)) => void;
  setActiveDropdown: (d: 'add' | 'ai' | 'canvas' | null) => void;
  setShowThemePicker: (show: boolean) => void;
  setShowTemplateEditor: (show: boolean) => void;
  undo: () => void;
  redo: () => void;
  saveNow: () => void;
  spawnArrowFromAnchor: (fromItem: CanvasItem, anchor: AnchorPosition) => void;
  loadProject: (dataStr: string) => void;
  moveToFront: (id: string) => void;
  moveToBack: (id: string) => void;
  moveForward: (id: string) => void;
  moveBackward: (id: string) => void;

  // Multiple Canvases Actions
  createCanvas: (name: string) => void;
  renameCanvas: (id: string, newName: string) => void;
  duplicateCanvas: (id: string) => void;
  deleteCanvas: (id: string) => void;
  switchCanvas: (id: string) => void;
  clearCanvas: () => void;

  // Connector Creation Mode Actions
  setConnectorMode: (active: boolean) => void;
  startConnectorDraw: (fromId?: string, fromAnchor?: AnchorPosition, x?: number, y?: number) => void;
  updateConnectorDraw: (x: number, y: number) => void;
  finishConnectorDraw: (toId?: string, toAnchor?: AnchorPosition, endX?: number, endY?: number) => void;
  cancelConnectorDraw: () => void;
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

  connectorMode: false,
  drawingConnector: null,

  activeCanvasId: null,
  canvases: [],

  initCanvas: (docId, docName) => {
    const all = getStickyTemplates();
    const store = get();
    // Allow re-initialization if docId changes, else keep current
    if (store.documentId === docId && store.canvases.length > 0) return;

    let initialCanvases: CanvasInfo[] = [];
    let initialActiveId = `default_${docId}`;
    let loadedItems: CanvasItem[] | null = null;
    let loadedPan = { x: 0, y: 0 };
    let loadedScale = 1;

    if (typeof window !== 'undefined') {
      try {
        const listStr = localStorage.getItem(`dazai_canvas_list_${docId}`);
        if (listStr) {
          initialCanvases = JSON.parse(listStr);
        }
        
        if (initialCanvases.length > 0) {
          const lastActive = localStorage.getItem(`dazai_canvas_active_${docId}`);
          if (lastActive && initialCanvases.some(c => c.id === lastActive)) {
            initialActiveId = lastActive;
          } else {
            initialActiveId = initialCanvases[0].id;
          }
        } else {
          initialCanvases = [{ id: initialActiveId, name: 'Main Canvas', updatedAt: Date.now() }];
          localStorage.setItem(`dazai_canvas_list_${docId}`, JSON.stringify(initialCanvases));
        }

        const savedData = localStorage.getItem(`dazai_canvas_data_${initialActiveId}`);
        if (savedData) {
          const parsed = JSON.parse(savedData);
          if (parsed && Array.isArray(parsed.items)) {
            loadedItems = parsed.items;
            if (parsed.pan) loadedPan = parsed.pan;
            if (parsed.scale) loadedScale = parsed.scale;
          }
        }
      } catch (e) {
        console.error('Failed to load canvas data', e);
      }
    }

    if (!loadedItems) {
      loadedItems = [
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
    }

    set({
      items: loadedItems,
      history: [loadedItems],
      historyIdx: 0,
      pan: loadedPan,
      scale: loadedScale,
      documentId: docId,
      activeCanvasId: initialActiveId,
      canvases: initialCanvases,
      lastSaved: 'Just now',
    });
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(`dazai_canvas_active_${docId}`, initialActiveId);
    }
  },

  saveItems: (newItems, addToHistory = true) => {
    const { history, historyIdx, documentId, activeCanvasId, pan, scale } = get();
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

    if (typeof window !== 'undefined' && documentId && activeCanvasId) {
      localStorage.setItem(`dazai_canvas_data_${activeCanvasId}`, JSON.stringify({
        items: newItems,
        pan,
        scale
      }));
      // Update canvas list timestamp
      const canvases = get().canvases;
      const updatedCanvases = canvases.map(c => c.id === activeCanvasId ? { ...c, updatedAt: Date.now() } : c);
      set({ canvases: updatedCanvases });
      localStorage.setItem(`dazai_canvas_list_${documentId}`, JSON.stringify(updatedCanvases));
    }
  },

  loadProject: (dataStr: string) => {
    try {
      const data = JSON.parse(dataStr);
      if (data && data.items && Array.isArray(data.items)) {
        const loadedPan = data.pan || { x: 0, y: 0 };
        const loadedScale = data.scale || 1;
        set({
          items: data.items,
          pan: loadedPan,
          scale: loadedScale,
          history: [data.items],
          historyIdx: 0,
          selectedId: null,
          editingId: null,
          lastSaved: 'Loaded Project',
        });
        get().saveNow();
      }
    } catch (e) {
      console.error('Failed to load project:', e);
      alert('Invalid project file.');
    }
  },

  moveToFront: (id: string) => {
    const { items, saveItems } = get();
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      const newItems = [...items];
      const [item] = newItems.splice(idx, 1);
      newItems.push(item);
      saveItems(newItems);
    }
  },
  
  moveToBack: (id: string) => {
    const { items, saveItems } = get();
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      const newItems = [...items];
      const [item] = newItems.splice(idx, 1);
      newItems.unshift(item);
      saveItems(newItems);
    }
  },

  moveForward: (id: string) => {
    const { items, saveItems } = get();
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1 && idx < items.length - 1) {
      const newItems = [...items];
      const temp = newItems[idx + 1];
      newItems[idx + 1] = newItems[idx];
      newItems[idx] = temp;
      saveItems(newItems);
    }
  },

  moveBackward: (id: string) => {
    const { items, saveItems } = get();
    const idx = items.findIndex(i => i.id === id);
    if (idx > 0) {
      const newItems = [...items];
      const temp = newItems[idx - 1];
      newItems[idx - 1] = newItems[idx];
      newItems[idx] = temp;
      saveItems(newItems);
    }
  },

  addItem: (type, shapeType, extraParams) => {
    const { pan, scale, items, saveItems } = get();
    const id = `item_${Date.now()}`;
    const centerX = Math.round((-pan.x + 200) / scale / GRID_SIZE) * GRID_SIZE;
    const centerY = Math.round((-pan.y + 150) / scale / GRID_SIZE) * GRID_SIZE;

    const all = getStickyTemplates();
    const defaultTemplate = all[0];

    let newItem: CanvasItem = {
      id,
      type,
      content: type === 'sticky' ? 'Type note here...'
        : type === 'text' ? 'Double click to edit text...'
        : type === 'shape' ? 'Double click to add notes...'
        : type === 'image' ? ''
        : '',
      x: centerX > 0 ? centerX : 100,
      y: centerY > 0 ? centerY : 100,
      width: type === 'sticky' ? 280 : type === 'text' ? 240 : type === 'shape' && shapeType === 'circle' ? 180 : type === 'image' && extraParams?.width ? extraParams.width : 220,
      height: type === 'sticky' ? 280 : type === 'text' ? 120 : type === 'shape' && shapeType === 'circle' ? 180 : type === 'image' && extraParams?.height ? extraParams.height : 160,
      color: type === 'shape' ? '#e0f2fe' : type === 'text' ? 'transparent' : '#ffffff',
      bgAsset: type === 'sticky' ? defaultTemplate.image : undefined,
      imageUrl: type === 'image' && extraParams?.imageUrl ? extraParams.imageUrl : undefined,
      shapeType,
      fontSize: type === 'shape' ? 14 : undefined,
      fontFamily: type === 'shape' ? "'Quicksand', 'Nunito', sans-serif" : undefined,
      isBold: type === 'shape' ? true : undefined,
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

  updateItemFields: (id, fields) => {
    const { items, saveItems } = get();
    const next = items.map(i => i.id === id ? { ...i, ...fields } : i);
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
  
  commitEditing: (newText?: string, cursorStart?: number, cursorEnd?: number) => {
    const { editingId, editingText, items, saveItems } = get();
    if (editingId) {
      const textToSave = newText !== undefined ? newText : editingText;
      const next = items.map(i => i.id === editingId ? {
        ...i,
        content: textToSave,
        cursorStart: cursorStart ?? textToSave.length,
        cursorEnd: cursorEnd ?? textToSave.length,
      } : i);
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

  saveNow: () => get().saveItems(get().items, false),

  clearCanvas: () => {
    const { saveItems } = get();
    // clear items, keep pan/scale as-is
    set({
      items: [],
      history: [[]],
      historyIdx: 0,
      selectedId: null,
      editingId: null,
    });
    saveItems([], false);
  },

  createCanvas: (name) => {
    const { documentId, canvases, saveNow } = get();
    if (!documentId) return;
    saveNow(); // save current before switching
    const newId = `canvas_${Date.now()}`;
    const newCanvas = { id: newId, name, updatedAt: Date.now() };
    const nextCanvases = [...canvases, newCanvas];
    set({
      canvases: nextCanvases,
      activeCanvasId: newId,
      items: [],
      history: [[]],
      historyIdx: 0,
      pan: { x: 0, y: 0 },
      scale: 1,
      selectedId: null,
      editingId: null,
      activeDropdown: null,
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(`dazai_canvas_list_${documentId}`, JSON.stringify(nextCanvases));
      localStorage.setItem(`dazai_canvas_active_${documentId}`, newId);
      localStorage.setItem(`dazai_canvas_data_${newId}`, JSON.stringify({ items: [], pan: { x: 0, y: 0 }, scale: 1 }));
    }
  },

  renameCanvas: (id, newName) => {
    const { documentId, canvases } = get();
    if (!documentId) return;
    const nextCanvases = canvases.map(c => c.id === id ? { ...c, name: newName } : c);
    set({ canvases: nextCanvases });
    if (typeof window !== 'undefined') {
      localStorage.setItem(`dazai_canvas_list_${documentId}`, JSON.stringify(nextCanvases));
    }
  },

  duplicateCanvas: (id) => {
    const { documentId, canvases, saveNow } = get();
    if (!documentId) return;
    saveNow(); // save current before duplicating if it's the active one
    const original = canvases.find(c => c.id === id);
    if (!original) return;

    let originalData = { items: [], pan: { x: 0, y: 0 }, scale: 1 };
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`dazai_canvas_data_${id}`);
      if (stored) {
        try { originalData = JSON.parse(stored); } catch (e) {}
      }
    }
    
    // Assign new IDs to all items to prevent ID collisions
    const newItems = originalData.items.map((i: any) => ({ ...i, id: `item_${Date.now()}_${Math.random().toString(36).substr(2,9)}` }));
    
    const newId = `canvas_${Date.now()}`;
    const newCanvas = { id: newId, name: `${original.name} (Copy)`, updatedAt: Date.now() };
    const nextCanvases = [...canvases, newCanvas];
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(`dazai_canvas_data_${newId}`, JSON.stringify({ ...originalData, items: newItems }));
      localStorage.setItem(`dazai_canvas_list_${documentId}`, JSON.stringify(nextCanvases));
    }
    
    set({ canvases: nextCanvases, activeDropdown: null });
    get().switchCanvas(newId);
  },

  deleteCanvas: (id) => {
    const { documentId, canvases, activeCanvasId, saveNow } = get();
    if (!documentId || canvases.length <= 1) return; // Must have at least 1 canvas
    
    const nextCanvases = canvases.filter(c => c.id !== id);
    let nextActiveId = activeCanvasId;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`dazai_canvas_data_${id}`);
      localStorage.setItem(`dazai_canvas_list_${documentId}`, JSON.stringify(nextCanvases));
    }

    if (activeCanvasId === id) {
      nextActiveId = nextCanvases[0].id;
      set({ canvases: nextCanvases, activeDropdown: null });
      get().switchCanvas(nextActiveId);
    } else {
      set({ canvases: nextCanvases, activeDropdown: null });
    }
  },

  switchCanvas: (id) => {
    const { documentId, canvases, activeCanvasId, saveNow } = get();
    if (!documentId || id === activeCanvasId) return;
    
    saveNow(); // Save the canvas we are leaving
    
    let loadedItems: CanvasItem[] = [];
    let loadedPan = { x: 0, y: 0 };
    let loadedScale = 1;

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`dazai_canvas_data_${id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && Array.isArray(parsed.items)) {
            loadedItems = parsed.items;
            if (parsed.pan) loadedPan = parsed.pan;
            if (parsed.scale) loadedScale = parsed.scale;
          }
        }
        localStorage.setItem(`dazai_canvas_active_${documentId}`, id);
      } catch (e) {
        console.error('Failed to load canvas data', e);
      }
    }

    set({
      activeCanvasId: id,
      items: loadedItems,
      history: [loadedItems],
      historyIdx: 0,
      pan: loadedPan,
      scale: loadedScale,
      selectedId: null,
      editingId: null,
      activeDropdown: null,
    });
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
      endX: bestTarget ? getAnchorCoords(bestTarget, targetAnchor).y : startCoords.x + 100,
      endY: bestTarget ? getAnchorCoords(bestTarget, targetAnchor).y : startCoords.y + 50,
    };

    saveItems([...items, newItem], true);
    set({ selectedId: id });
  },

  setConnectorMode: (active) => {
    set({ connectorMode: active, drawingConnector: null, activeDropdown: null });
  },

  startConnectorDraw: (fromId, fromAnchor, x = 0, y = 0) => {
    set({
      connectorMode: true,
      drawingConnector: {
        fromId,
        fromAnchor,
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
      },
    });
  },

  updateConnectorDraw: (x, y) => {
    const { drawingConnector } = get();
    if (!drawingConnector) return;
    set({
      drawingConnector: {
        ...drawingConnector,
        currentX: x,
        currentY: y,
      },
    });
  },

  finishConnectorDraw: (toId, toAnchor, endX, endY) => {
    const { drawingConnector, items, saveItems } = get();
    if (!drawingConnector) {
      set({ connectorMode: false, drawingConnector: null });
      return;
    }

    const id = `arrow_${Date.now()}`;
    const newArrow: CanvasItem = {
      id,
      type: 'arrow',
      title: '➔ Connector Arrow',
      content: 'Connects to ➔',
      width: 100,
      height: 50,
      color: '#8b5cf6',
      connectorStyle: 'orthogonal',
      fromId: drawingConnector.fromId,
      fromAnchor: drawingConnector.fromAnchor,
      toId,
      toAnchor,
      startX: drawingConnector.startX,
      startY: drawingConnector.startY,
      endX,
      endY,
    };

    saveItems([...items, newArrow], true);
    set({
      selectedId: id,
      connectorMode: false,
      drawingConnector: null,
    });
  },

  cancelConnectorDraw: () => {
    set({ connectorMode: false, drawingConnector: null });
  },
}));
