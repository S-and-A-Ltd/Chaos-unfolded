'use client';

import React from 'react';
import { useCanvasStore, ConnectorStyle } from '@/stores/useCanvasStore';
import { useShallow } from 'zustand/react/shallow';

function WhiteboardFormattingToolbar() {
  const items = useCanvasStore(useShallow(state => state.items));
  const selectedId = useCanvasStore(state => state.selectedId);
  const editingId = useCanvasStore(state => state.editingId);
  const updateItemField = useCanvasStore(state => state.updateItemField);
  const deleteItem = useCanvasStore(state => state.deleteItem);
  const duplicateItem = useCanvasStore(state => state.duplicateItem);
  const setShowThemePicker = useCanvasStore(state => state.setShowThemePicker);
  const moveToFront = useCanvasStore(state => state.moveToFront);
  const moveToBack = useCanvasStore(state => state.moveToBack);
  const moveForward = useCanvasStore(state => state.moveForward);
  const moveBackward = useCanvasStore(state => state.moveBackward);

  if (!selectedId || editingId) return null;
  const selectedItem = items.find(i => i.id === selectedId);
  if (!selectedItem) return null;

  const isArrow = selectedItem.type === 'arrow';
  const isImage = selectedItem.type === 'image';
  const isShape = selectedItem.type === 'shape';

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-[#232130] text-white border-2 border-purple-500 rounded-2xl px-3 py-1.5 shadow-2xl z-40 flex items-center gap-2 whitespace-nowrap text-xs font-bold animate-fadeIn max-w-[95vw] overflow-x-auto">
      {isArrow ? (
        <>
          <span className="text-purple-300">➔ Style:</span>
          {(['orthogonal', 'curved', 'straight'] as ConnectorStyle[]).map((st) => (
            <button
              key={st}
              onClick={() => updateItemField(selectedItem.id, 'connectorStyle', st)}
              className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                selectedItem.connectorStyle === st || (!selectedItem.connectorStyle && st === 'orthogonal')
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white/10 hover:bg-white/20 text-white/70'
              }`}
            >
              {st === 'orthogonal' ? '📐 Elbow' : st === 'curved' ? '🌙 Curved' : '📏 Straight'}
            </button>
          ))}
          <div className="w-px h-4 bg-white/20 my-auto mx-1" />
          <label className="cursor-pointer bg-white/10 hover:bg-white/20 p-1 rounded border border-white/20 flex items-center justify-center w-6 h-6" title="Arrow Color">
            <input
              type="color"
              value={selectedItem.color || '#8b5cf6'}
              onChange={(e) => updateItemField(selectedItem.id, 'color', e.target.value)}
              className="opacity-0 absolute w-0 h-0"
            />
            <span className="w-3.5 h-3.5 rounded-full border border-white/40" style={{ backgroundColor: selectedItem.color || '#8b5cf6' }} />
          </label>
          <div className="w-px h-4 bg-white/20 my-auto mx-1" />

          {/* Connector thickness */}
          <select
            value={selectedItem.borderWidth || 3}
            onChange={(e) => updateItemField(selectedItem.id, 'borderWidth', Number(e.target.value))}
            className="bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded text-xs border border-white/20 text-white focus:outline-none w-14"
            title="Thickness"
          >
            {[1, 2, 3, 4, 5, 6, 8].map(w => (
              <option key={w} value={w} className="text-black">{w}px</option>
            ))}
          </select>

          {/* Connector dash style */}
          <button
            onClick={() => updateItemField(selectedItem.id, 'borderStyle', selectedItem.borderStyle === 'dashed' ? 'solid' : 'dashed')}
            className={`px-2 py-0.5 rounded ${selectedItem.borderStyle === 'dashed' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60'}`}
            title="Toggle dashed line"
          >
            {selectedItem.borderStyle === 'dashed' ? '┈ Dash' : '─ Solid'}
          </button>

          {/* Arrowhead toggle */}
          <button
            onClick={() => updateItemField(selectedItem.id, 'arrowhead', selectedItem.arrowhead === 'none' ? 'arrow' : 'none')}
            className={`px-2 py-0.5 rounded ${selectedItem.arrowhead === 'none' ? 'bg-white/10 text-white/60' : 'bg-purple-600 text-white'}`}
            title="Toggle arrowhead"
          >
            {selectedItem.arrowhead === 'none' ? '─ No Arrow' : '➔ Arrow'}
          </button>
        </>
      ) : isImage ? (
        /* Image toolbar — minimal, just layer + delete */
        <span className="text-purple-300">🖼️ Image</span>
      ) : (
        <>
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

          {/* Shape-specific: fill, border, radius, opacity */}
          {isShape && (
            <>
              <div className="w-px h-4 bg-white/20 my-auto ml-1" />
              {/* Fill color */}
              <label className="cursor-pointer bg-white/10 hover:bg-white/20 p-1 rounded border border-white/20 flex items-center justify-center w-6 h-6" title="Fill Color">
                <input
                  type="color"
                  value={selectedItem.color || '#e0f2fe'}
                  onChange={(e) => updateItemField(selectedItem.id, 'color', e.target.value)}
                  className="opacity-0 absolute w-0 h-0"
                />
                <span className="w-3.5 h-3.5 rounded-full border border-white/40" style={{ backgroundColor: selectedItem.color || '#e0f2fe' }} />
              </label>
              {/* Border color */}
              <label className="cursor-pointer bg-white/10 hover:bg-white/20 p-1 rounded border border-white/20 flex items-center justify-center w-6 h-6" title="Border Color">
                <input
                  type="color"
                  value={selectedItem.borderColor || '#000000'}
                  onChange={(e) => updateItemField(selectedItem.id, 'borderColor', e.target.value)}
                  className="opacity-0 absolute w-0 h-0"
                />
                <span className="w-3.5 h-3.5 rounded border-2 border-white/40" style={{ borderColor: selectedItem.borderColor || '#000000' }} />
              </label>
              {/* Border width */}
              <select
                value={selectedItem.borderWidth || 1}
                onChange={(e) => updateItemField(selectedItem.id, 'borderWidth', Number(e.target.value))}
                className="bg-white/10 hover:bg-white/20 px-1 py-0.5 rounded text-xs border border-white/20 text-white focus:outline-none w-12"
                title="Border Width"
              >
                {[0, 1, 2, 3, 4, 5, 6].map(w => (
                  <option key={w} value={w} className="text-black">{w}px</option>
                ))}
              </select>
              {/* Border dashed/solid */}
              <button
                onClick={() => updateItemField(selectedItem.id, 'borderStyle', selectedItem.borderStyle === 'dashed' ? 'solid' : 'dashed')}
                className={`px-1.5 py-0.5 rounded text-[10px] ${selectedItem.borderStyle === 'dashed' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60'}`}
                title="Border style"
              >
                {selectedItem.borderStyle === 'dashed' ? '┈' : '─'}
              </button>
              {/* Corner radius (rectangle only) */}
              {selectedItem.shapeType !== 'circle' && (
                <select
                  value={selectedItem.cornerRadius ?? 16}
                  onChange={(e) => updateItemField(selectedItem.id, 'cornerRadius', Number(e.target.value))}
                  className="bg-white/10 hover:bg-white/20 px-1 py-0.5 rounded text-xs border border-white/20 text-white focus:outline-none w-12"
                  title="Corner Radius"
                >
                  {[0, 4, 8, 12, 16, 24, 32].map(r => (
                    <option key={r} value={r} className="text-black">R{r}</option>
                  ))}
                </select>
              )}
              {/* Opacity */}
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={(selectedItem.opacity ?? 1) * 100}
                onChange={(e) => updateItemField(selectedItem.id, 'opacity', Number(e.target.value) / 100)}
                className="w-12 h-3 accent-purple-500"
                title={`Opacity: ${Math.round((selectedItem.opacity ?? 1) * 100)}%`}
              />
            </>
          )}

          {(selectedItem.type === 'sticky' || selectedItem.bgAsset) && (
            <>
              <button
                onClick={() => updateItemField(selectedItem.id, 'lockedBg', !selectedItem.lockedBg)}
                className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all ${
                  selectedItem.lockedBg
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
                title={selectedItem.lockedBg ? 'Background Locked — click to unlock' : 'Lock Background'}
              >
                {selectedItem.lockedBg ? '🔒' : '🔓'}
              </button>
              {!selectedItem.lockedBg && (
                <button
                  onClick={() => setShowThemePicker(true)}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-2 py-0.5 rounded flex items-center gap-1 shadow-sm ml-1"
                >
                  <span>🎨 Theme</span>
                </button>
              )}
            </>
          )}
        </>
      )}

      <div className="w-px h-4 bg-white/20 my-auto mx-1" />

      {/* Layer management */}
      <div className="flex items-center gap-0.5">
        <button onClick={() => moveToFront(selectedItem.id)} className="bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded text-[10px]" title="Bring to Front">⬆⬆</button>
        <button onClick={() => moveForward(selectedItem.id)} className="bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded text-[10px]" title="Bring Forward">⬆</button>
        <button onClick={() => moveBackward(selectedItem.id)} className="bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded text-[10px]" title="Send Backward">⬇</button>
        <button onClick={() => moveToBack(selectedItem.id)} className="bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded text-[10px]" title="Send to Back">⬇⬇</button>
      </div>

      <div className="w-px h-4 bg-white/20 my-auto mx-1" />

      <button onClick={() => deleteItem(selectedItem.id)} className="bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white px-2 py-0.5 rounded transition-colors" title="Delete Card (Del)">
        🗑️
      </button>
      <button onClick={() => duplicateItem(selectedItem.id)} className="bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white px-2 py-0.5 rounded transition-colors" title="Duplicate Card (Ctrl+D)">
        📑
      </button>
    </div>
  );
}

export default React.memo(WhiteboardFormattingToolbar);
