'use client';

import React, { useCallback } from 'react';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { StudyDocument } from '@/types';

interface WhiteboardToolbarProps {
  document: StudyDocument;
  onClose: () => void;
}

function WhiteboardToolbar({ document, onClose }: WhiteboardToolbarProps) {
  const historyIdx = useCanvasStore(state => state.historyIdx);
  const historyLength = useCanvasStore(state => state.history.length);
  const undo = useCanvasStore(state => state.undo);
  const redo = useCanvasStore(state => state.redo);
  const setShowThemePicker = useCanvasStore(state => state.setShowThemePicker);
  const setShowTemplateEditor = useCanvasStore(state => state.setShowTemplateEditor);
  const activeDropdown = useCanvasStore(state => state.activeDropdown);
  const setActiveDropdown = useCanvasStore(state => state.setActiveDropdown);
  const addItem = useCanvasStore(state => state.addItem);
  const insertAiCard = useCanvasStore(state => state.insertAiCard);
  const gridSnap = useCanvasStore(state => state.gridSnap);
  const setGridSnap = useCanvasStore(state => state.setGridSnap);
  const scale = useCanvasStore(state => state.scale);
  const setScale = useCanvasStore(state => state.setScale);
  const setPan = useCanvasStore(state => state.setPan);
  
  const canvases = useCanvasStore(state => state.canvases);
  const activeCanvasId = useCanvasStore(state => state.activeCanvasId);
  const activeCanvas = canvases.find(c => c.id === activeCanvasId);
  const switchCanvas = useCanvasStore(state => state.switchCanvas);
  const createCanvas = useCanvasStore(state => state.createCanvas);
  const renameCanvas = useCanvasStore(state => state.renameCanvas);
  const duplicateCanvas = useCanvasStore(state => state.duplicateCanvas);
  const deleteCanvas = useCanvasStore(state => state.deleteCanvas);
  const clearCanvas = useCanvasStore(state => state.clearCanvas);
  const saveNow = useCanvasStore(state => state.saveNow);
  const connectorMode = useCanvasStore(state => state.connectorMode);
  const setConnectorMode = useCanvasStore(state => state.setConnectorMode);

  const handleExportFormat = useCallback((e: React.MouseEvent, format: 'png' | 'pdf') => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Toolbar export clicked: ${format}`);
    const activeCanvasName = activeCanvas?.name || document.name || 'study-canvas';
    window.dispatchEvent(new CustomEvent('export-canvas', {
      detail: { fileName: activeCanvasName, format }
    }));
  }, [document.name, activeCanvas]);

  const handleSaveProject = useCallback(() => {
    const data = JSON.stringify({
      items: useCanvasStore.getState().items,
      pan: useCanvasStore.getState().pan,
      scale: useCanvasStore.getState().scale,
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    const activeCanvasName = activeCanvas?.name || document.name || 'CanvasName';
    link.download = `${activeCanvasName}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [document.name, activeCanvas]);

  const handleLoadProject = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        useCanvasStore.getState().loadProject(result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleInsertImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const img = new Image();
        img.onload = () => {
          addItem('image', undefined, { imageUrl: dataUrl, width: img.width, height: img.height });
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [addItem]);

  return (
    <div className="bg-[#7c6a75] dark:bg-[#342e48] text-white px-5 py-2.5 flex flex-wrap items-center justify-between shadow-md z-30 gap-2">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎨</span>
        <div>
          <h2 className="font-black text-sm md:text-base tracking-wide flex items-center gap-2">
            <span>Study Whiteboard Engine</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Zustand + Konva Html</span>
          </h2>
          <p className="text-[10px] text-white/80 hidden md:block">Excalidraw/FigJam clean architecture with stable zooming, multi-region text flow & anchor connectors</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-0.5 bg-black/20 p-1 rounded-lg">
          <button onClick={undo} disabled={historyIdx <= 0} className="px-2 py-1 hover:bg-white/20 disabled:opacity-40 rounded text-xs font-bold" title="Undo">↩ Undo</button>
          <button onClick={redo} disabled={historyIdx >= historyLength - 1} className="px-2 py-1 hover:bg-white/20 disabled:opacity-40 rounded text-xs font-bold" title="Redo">↪ Redo</button>
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

        {/* Canvas Manager */}
        <div className="relative ml-2">
          <button
            onClick={() => setActiveDropdown(activeDropdown === 'canvas' ? null : 'canvas')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3 py-1.5 rounded-xl text-xs shadow-sm flex items-center gap-1.5 transition-all hover:scale-105"
          >
            <span>📄 {activeCanvas ? activeCanvas.name : 'Canvas'}</span>
            <span>▾</span>
          </button>
          {activeDropdown === 'canvas' && (
            <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/40 rounded-xl shadow-2xl p-2 z-[60] flex flex-col min-w-[220px] text-gray-800 dark:text-gray-200 text-xs">
              <div className="font-bold text-[#7c6a75] mb-2 px-2">Your Canvases</div>
              <div className="max-h-[200px] overflow-y-auto mb-2 space-y-1">
                {canvases.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded">
                    <button
                      onClick={() => switchCanvas(c.id)}
                      className={`flex-1 text-left truncate font-bold ${c.id === activeCanvasId ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
                    >
                      {c.id === activeCanvasId && '✓ '}{c.name}
                    </button>
                    {c.id === activeCanvasId && (
                      <div className="flex items-center gap-1 opacity-70 hover:opacity-100">
                        <button onClick={() => {
                          const newName = prompt('Rename canvas:', c.name);
                          if (newName) renameCanvas(c.id, newName);
                        }} title="Rename">✏️</button>
                        <button onClick={() => duplicateCanvas(c.id)} title="Duplicate">📑</button>
                        <button onClick={() => {
                          if (canvases.length > 1 && confirm(`Delete canvas "${c.name}"?`)) {
                            deleteCanvas(c.id);
                          }
                        }} title="Delete" disabled={canvases.length <= 1}>🗑️</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  const name = prompt('New canvas name:', 'New Canvas');
                  if (name) createCanvas(name);
                }}
                className="w-full text-center bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold py-1.5 rounded hover:bg-indigo-500/30"
              >
                + New Canvas
              </button>
            </div>
          )}
        </div>

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
              <button onClick={() => { setActiveDropdown(null); setConnectorMode(true); }} className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2 text-purple-600 dark:text-purple-400 font-black">➔ Connector Arrow Mode</button>
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
          onClick={() => setGridSnap(prev => !prev)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
            gridSnap ? 'bg-amber-400 text-black border-amber-500 shadow-sm' : 'bg-black/30 text-white/70 border-white/10'
          }`}
        >
          📐 Grid Snap: {gridSnap ? 'ON' : 'OFF'}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setConnectorMode(!connectorMode)}
            className={`font-bold px-2.5 py-1 rounded-lg text-xs shadow-sm flex items-center gap-1 transition-all ${
              connectorMode
                ? 'bg-purple-500 text-white ring-2 ring-purple-300 animate-pulse'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
            title="Connector Creation Mode (Click object/anchor to draw)"
          >
            <span>➔ Connector</span>
          </button>

          <label className="cursor-pointer bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs shadow-sm" title="Insert Image">
            🖼️ Image
            <input type="file" accept="image/png, image/jpeg, image/webp" hidden onChange={handleInsertImage} />
          </label>
          
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'export' ? null : 'export')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs shadow-sm flex items-center gap-1 transition-all"
              title="Export Canvas"
            >
              <span>📤 Export</span>
              <span>▾</span>
            </button>
            {activeDropdown === 'export' && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/40 rounded-xl shadow-2xl p-1.5 z-[60] flex flex-col min-w-[150px] text-gray-800 dark:text-gray-200 text-xs">
                <button 
                  onClick={(e) => { setActiveDropdown(null); handleExportFormat(e, 'png'); }} 
                  className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2"
                >
                  📸 Export PNG
                </button>
                <button 
                  onClick={(e) => { setActiveDropdown(null); handleExportFormat(e, 'pdf'); }} 
                  className="text-left font-bold px-3 py-2 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded flex items-center gap-2 text-red-600 dark:text-red-400"
                >
                  📄 Export PDF
                </button>
              </div>
            )}
          </div>
          
          <button
            type="button"
            onClick={handleSaveProject}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs shadow-sm"
            title="Save Project (.json)"
          >
            💾 Save Project
          </button>
          
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs shadow-sm" title="Load Project (.json)">
            📂 Load Project
            <input type="file" accept=".json,application/json" hidden onChange={handleLoadProject} />
          </label>

          <button
            type="button"
            onClick={() => {
              if (window.confirm("Clear this canvas? This cannot be undone.")) {
                clearCanvas();
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs shadow-sm ml-1"
            title="Clear Canvas"
          >
            🗑️ Clear
          </button>
        </div>

        <div className="flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-lg text-xs font-bold">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="hover:text-amber-300 px-1">➖</button>
          <span className="w-10 text-center font-mono">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.0, s + 0.1))} className="hover:text-amber-300 px-1">➕</button>
          <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="text-[10px] ml-1 bg-white/20 px-1.5 py-0.5 rounded">Reset</button>
        </div>

        <button onClick={onClose} className="bg-white/20 hover:bg-red-500 hover:text-white font-black px-3 py-1.5 rounded-xl ml-2 border border-white/20">
          ✕ Close
        </button>
      </div>
    </div>
  );
}

export default React.memo(WhiteboardToolbar);
