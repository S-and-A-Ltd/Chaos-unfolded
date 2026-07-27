'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { getStickyTemplates, saveCalibratedTemplate, StickyTemplate } from '@/components/study/stickyTemplates';

function TemplateStudioModal() {
  const showTemplateEditor = useCanvasStore(state => state.showTemplateEditor);
  const setShowTemplateEditor = useCanvasStore(state => state.setShowTemplateEditor);

  const [devTemplates, setDevTemplates] = useState<StickyTemplate[]>([]);
  const [activeDevIndex, setActiveDevIndex] = useState<number>(0);
  const [devDraggingRegionIdx, setDevDraggingRegionIdx] = useState<number | null>(null);
  const [devResizingRegionIdx, setDevResizingRegionIdx] = useState<{ idx: number; handle: string } | null>(null);
  const [devDragStart, setDevDragStart] = useState<{ x: number; y: number; startTx: number; startTy: number; startTw: number; startTh: number }>({ x: 0, y: 0, startTx: 0, startTy: 0, startTw: 0, startTh: 0 });

  useEffect(() => {
    if (showTemplateEditor) {
      setDevTemplates(getStickyTemplates());
    }
  }, [showTemplateEditor]);

  const getActiveRegions = useCallback((): { x: number; y: number; width: number; height: number }[] => {
    if (!devTemplates || !devTemplates[activeDevIndex]) return [];
    const t = devTemplates[activeDevIndex];
    return (t.writingRegions && t.writingRegions.length > 0) ? t.writingRegions : [t.writingArea || { x: 12, y: 22, width: 76, height: 58 }];
  }, [devTemplates, activeDevIndex]);

  const updateDevRegion = useCallback((regionIdx: number, x: number, y: number, width: number, height: number) => {
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
  }, [getActiveRegions, devTemplates, activeDevIndex]);

  const addDevRegion = useCallback(() => {
    const currentRegions = [...getActiveRegions()];
    currentRegions.push({ x: 20, y: 50, width: 60, height: 35 });
    const updated: StickyTemplate = {
      ...devTemplates[activeDevIndex],
      writingRegions: currentRegions,
    };
    const nextList = saveCalibratedTemplate(updated);
    setDevTemplates(nextList);
  }, [getActiveRegions, devTemplates, activeDevIndex]);

  const deleteDevRegion = useCallback((regionIdx: number) => {
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
  }, [getActiveRegions, devTemplates, activeDevIndex]);

  const updateDevTemplateField = useCallback((field: keyof StickyTemplate, value: any) => {
    const updated: StickyTemplate = {
      ...devTemplates[activeDevIndex],
      [field]: value,
    };
    const nextList = saveCalibratedTemplate(updated);
    setDevTemplates(nextList);
  }, [devTemplates, activeDevIndex]);

  if (!showTemplateEditor || devTemplates.length === 0 || !devTemplates[activeDevIndex]) return null;

  return (
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
  );
}

export default React.memo(TemplateStudioModal);
