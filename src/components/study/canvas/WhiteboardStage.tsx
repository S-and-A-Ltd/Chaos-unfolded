'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect as KonvaRect, Transformer, Line as KonvaLine, Circle as KonvaCircle, Group } from 'react-konva';
import { useCanvasStore, getAnchorCoords } from '@/stores/useCanvasStore';
import { useShallow } from 'zustand/react/shallow';
import StickyNoteObject from '@/components/study/canvas/StickyNoteObject';
import ShapeObject from '@/components/study/canvas/ShapeObject';
import ConnectorObject from '@/components/study/canvas/ConnectorObject';
import ImageObject from '@/components/study/canvas/ImageObject';
import { jsPDF } from 'jspdf';

const GRID_SIZE = 20;
const ZOOM_FACTOR = 1.08;
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

function WhiteboardStage() {
  const items = useCanvasStore(useShallow(state => state.items));
  const selectedId = useCanvasStore(state => state.selectedId);
  const editingId = useCanvasStore(state => state.editingId);
  const scale = useCanvasStore(state => state.scale);
  const pan = useCanvasStore(useShallow(state => state.pan));
  const gridSnap = useCanvasStore(state => state.gridSnap);
  const setPan = useCanvasStore(state => state.setPan);
  const setScale = useCanvasStore(state => state.setScale);
  const setSelectedId = useCanvasStore(state => state.setSelectedId);
  const commitEditing = useCanvasStore(state => state.commitEditing);
  const deleteItem = useCanvasStore(state => state.deleteItem);
  const duplicateItem = useCanvasStore(state => state.duplicateItem);
  const updateItemFields = useCanvasStore(state => state.updateItemFields);
  
  const connectorMode = useCanvasStore(state => state.connectorMode);
  const drawingConnector = useCanvasStore(state => state.drawingConnector);
  const setConnectorMode = useCanvasStore(state => state.setConnectorMode);
  const updateConnectorDraw = useCanvasStore(state => state.updateConnectorDraw);
  const cancelConnectorDraw = useCanvasStore(state => state.cancelConnectorDraw);

  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const [clipboard, setClipboard] = useState<any>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

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

  // Ghost Node Cleanup (Fix orphaned objects)
  useEffect(() => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    const allNodes = stage.find('Group, Text');
    let needsRedraw = false;

    allNodes.forEach((node: any) => {
      const id = node.id();
      if (id && id.startsWith('node_')) {
        const itemId = id.replace('node_', '');
        if (!items.find((i: any) => i.id === itemId)) {
          console.warn(`Cleaning up orphaned group node: ${id}`);
          node.destroy();
          needsRedraw = true;
        }
      } else if (node.className === 'Text') {
        // Find if this text is inside a valid node_ group
        let parent = node.parent;
        let isValid = false;
        while (parent) {
          if (parent.id() && parent.id().startsWith('node_')) {
            isValid = true;
            break;
          }
          parent = parent.parent;
        }
        if (!isValid) {
          console.warn(`Cleaning up orphaned KonvaText`);
          node.destroy();
          needsRedraw = true;
        }
      }
    });

    if (needsRedraw) {
      stage.getLayers().forEach((layer: any) => layer.batchDraw());
    }
    
    // DOM cleanup for unmounted react-konva-utils Html
    if (typeof document !== 'undefined') {
      const htmlNodes = document.querySelectorAll('.konvajs-html');
      htmlNodes.forEach(htmlNode => {
        // The Html component attaches to the container. If it has no children or if editingId is null but there's an active textarea, destroy it.
        // Actually, we can check if there's any active editingId. If not, NO textarea should exist.
        if (!useCanvasStore.getState().editingId) {
          if (htmlNode.querySelector('textarea')) {
            console.warn(`Cleaning up orphaned HTML textarea`);
            htmlNode.remove();
          }
        }
      });
    }
  }, [items]);

  // Expanded Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Space for pan mode
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        e.preventDefault();
        if (editingId) {
          commitEditing();
        }
        setSelectedId(null);
        return;
      }

      // Ctrl+Z / Ctrl+Y for undo/redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        useCanvasStore.getState().undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        useCanvasStore.getState().redo();
        return;
      }

      if (!selectedId || editingId) return;

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteItem(selectedId);
        return;
      }

      // Ctrl+D → Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateItem(selectedId);
        return;
      }

      // Ctrl+C → Copy
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const item = items.find((i: any) => i.id === selectedId);
        if (item) {
          setClipboard({ ...item });
        }
        return;
      }

      // Ctrl+V → Paste
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (clipboard) {
          const newId = `item_${Date.now()}`;
          const newItem = { ...clipboard, id: newId, x: clipboard.x + 30, y: clipboard.y + 30 };
          const { items: currentItems, saveItems } = useCanvasStore.getState();
          saveItems([...currentItems, newItem]);
          setSelectedId(newId);
        }
        return;
      }

      // Arrow keys → Move 1px (Shift → 10px)
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') { e.preventDefault(); updateItemFields(selectedId, { x: (items.find((i: any) => i.id === selectedId)?.x || 0) - step }); }
      if (e.key === 'ArrowRight') { e.preventDefault(); updateItemFields(selectedId, { x: (items.find((i: any) => i.id === selectedId)?.x || 0) + step }); }
      if (e.key === 'ArrowUp') { e.preventDefault(); updateItemFields(selectedId, { y: (items.find((i: any) => i.id === selectedId)?.y || 0) - step }); }
      if (e.key === 'ArrowDown') { e.preventDefault(); updateItemFields(selectedId, { y: (items.find((i: any) => i.id === selectedId)?.y || 0) + step }); }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setSpaceHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedId, editingId, deleteItem, duplicateItem, updateItemFields, items, clipboard, commitEditing, setSelectedId]);

  // Export PNG listener
  useEffect(() => {
    const handleExport = (e: Event) => {
      console.log("Received export event");
      const customEvent = e as CustomEvent;
      if (stageRef.current) {
        if (transformerRef.current) {
          transformerRef.current.nodes([]);
          transformerRef.current.getLayer()?.batchDraw();
        }

        const format = customEvent.detail?.format || 'png';
        const fileName = customEvent.detail?.fileName || 'StudyCanvas';
        
        const stage = stageRef.current;
        const layer = stage.getLayers()[0];
        
        const clientRect = layer.getClientRect({ skipTransform: true });
        
        const dataURL = stage.toDataURL({ 
          x: clientRect.x - 40,
          y: clientRect.y - 40,
          width: clientRect.width + 80,
          height: clientRect.height + 80,
          pixelRatio: 3, 
          mimeType: 'image/png' 
        });

        if (format === 'pdf') {
          try {
            const canvasWidth = Math.max(1, clientRect.width + 80);
            const canvasHeight = Math.max(1, clientRect.height + 80);
            
            const pdf = new jsPDF({
              orientation: canvasWidth > canvasHeight ? "landscape" : "portrait",
              unit: "px",
              format: [canvasWidth, canvasHeight],
            });
            
            pdf.addImage(dataURL, "PNG", 0, 0, canvasWidth, canvasHeight);
            pdf.save(`${fileName}.pdf`);
          } catch (err) {
            console.error("PDF export failed:", err);
          }
        } else {
          const link = document.createElement('a');
          link.download = `${fileName}.png`;
          link.href = dataURL;
          link.click();
        }

        if (selectedId) {
          const node = stageRef.current.findOne(`#node_${selectedId}`);
          if (node && transformerRef.current) {
            transformerRef.current.nodes([node]);
            transformerRef.current.getLayer()?.batchDraw();
          }
        }
      }
    };
    window.addEventListener('export-canvas', handleExport);
    return () => window.removeEventListener('export-canvas', handleExport);
  }, [selectedId]);

  const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const height = typeof window !== 'undefined' ? window.innerHeight - 100 : 800;

  const handleDragEnd = useCallback((e: any) => {
    if (e.target === stageRef.current) {
      setPan({ x: e.target.x(), y: e.target.y() });
    }
  }, [setPan]);

  const handleMouseDown = useCallback((e: any) => {
    const clickedOnEmpty = e.target === stageRef.current;
    const store = useCanvasStore.getState();

    if (store.connectorMode) {
      const stage = stageRef.current;
      const pos = stage?.getPointerPosition();
      if (pos && stage) {
        const worldX = (pos.x - stage.x()) / stage.scaleX();
        const worldY = (pos.y - stage.y()) / stage.scaleY();
        if (!store.drawingConnector) {
          store.startConnectorDraw(undefined, undefined, worldX, worldY);
        } else {
          store.finishConnectorDraw(undefined, undefined, worldX, worldY);
        }
      }
      return;
    }

    if (clickedOnEmpty) {
      setSelectedId(null);
      if (editingId) commitEditing();
    }
  }, [setSelectedId, editingId, commitEditing]);

  const handleMouseMove = useCallback((e: any) => {
    const store = useCanvasStore.getState();
    if (store.connectorMode || store.drawingConnector) {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const worldX = (pos.x - stage.x()) / stage.scaleX();
      const worldY = (pos.y - stage.y()) / stage.scaleY();
      store.updateConnectorDraw(worldX, worldY);
    }
  }, []);

  // Wheel zoom at cursor position
  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, direction > 0 ? oldScale * ZOOM_FACTOR : oldScale / ZOOM_FACTOR));

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setScale(newScale);
    setPan(newPos);
  }, [setScale, setPan]);

  const arrowItems = useMemo(() => items.filter((i: any) => i.type === 'arrow'), [items]);
  const nonArrowItems = useMemo(() => items.filter((i: any) => i.type !== 'arrow'), [items]);

  const gridPattern = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = GRID_SIZE;
    canvas.height = GRID_SIZE;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f7f5fa';
      ctx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
      ctx.strokeStyle = '#e5e1eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(GRID_SIZE, 0);
      ctx.lineTo(GRID_SIZE, GRID_SIZE);
      ctx.lineTo(0, GRID_SIZE);
      ctx.stroke();
    }
    return canvas;
  }, []);

  // Determine if stage should be draggable (space held OR empty canvas click)
  const isDraggable = spaceHeld || (!connectorMode && !drawingConnector && !selectedId && !editingId);

  const previewPoints = useMemo(() => {
    if (!drawingConnector) return null;
    let sx = drawingConnector.startX ?? 0;
    let sy = drawingConnector.startY ?? 0;
    if (drawingConnector.fromId) {
      const fromItem = items.find((i: any) => i.id === drawingConnector.fromId);
      if (fromItem && drawingConnector.fromAnchor) {
        const c = getAnchorCoords(fromItem, drawingConnector.fromAnchor);
        sx = c.x;
        sy = c.y;
      }
    }
    const ex = drawingConnector.currentX;
    const ey = drawingConnector.currentY;
    const midX = (sx + ex) / 2;
    return { points: [sx, sy, midX, sy, midX, ey, ex, ey], sx, sy, ex, ey };
  }, [drawingConnector, items]);

  return (
    <div
      className="flex-1 overflow-hidden relative canvas-container"
      style={{
        backgroundColor: '#f7f5fa',
        cursor: spaceHeld ? 'grab' : (connectorMode || drawingConnector) ? 'crosshair' : 'default'
      }}
    >
      {(connectorMode || drawingConnector) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-indigo-600/90 backdrop-blur-md text-white font-bold px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 text-xs border border-indigo-400">
          <span>➔ Connector Mode Active: {drawingConnector?.fromId ? 'Click target object or anchor point to finish' : 'Click any object or anchor point to start'}</span>
          <button
            onClick={() => cancelConnectorDraw()}
            className="bg-white/20 hover:bg-white/30 text-white font-black px-2.5 py-0.5 rounded-full text-[10px]"
          >
            Cancel (Esc)
          </button>
        </div>
      )}

      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={scale}
        scaleY={scale}
        x={pan.x}
        y={pan.y}
        draggable={isDraggable}
        onDragEnd={handleDragEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
      >
        <Layer>
          {/* Background grid */}
          {gridSnap && gridPattern && (
            <KonvaRect
              x={-5000}
              y={-5000}
              width={10000}
              height={10000}
              fillPatternImage={gridPattern}
              fillPatternRepeat="repeat"
              listening={false}
            />
          )}

          {/* Connectors (rendered underneath cards) */}
          {arrowItems.map((arrow: any) => (
            <ConnectorObject
              key={arrow.id}
              arrow={arrow}
              isSelected={selectedId === arrow.id}
            />
          ))}

          {/* Sticky notes, textboxes, shapes, images, AI cards */}
          {nonArrowItems.map((item: any) => {
            const isItemSelected = selectedId === item.id;
            const isEditing = editingId === item.id;
            const isSticky = item.type === 'sticky' || (item.bgAsset !== undefined && item.type !== 'image');
            const isImage = item.type === 'image';

            if (isImage) {
              return (
                <ImageObject
                  key={item.id}
                  item={item}
                  isSelected={isItemSelected}
                  gridSnap={gridSnap}
                  GRID_SIZE={GRID_SIZE}
                />
              );
            }

            if (isSticky) {
              return (
                <StickyNoteObject
                  key={item.id}
                  item={item}
                  isSelected={isItemSelected}
                  isEditing={isEditing}
                  gridSnap={gridSnap}
                  GRID_SIZE={GRID_SIZE}
                />
              );
            }

            return (
              <ShapeObject
                key={item.id}
                item={item}
                isSelected={isItemSelected}
                isEditing={isEditing}
                gridSnap={gridSnap}
                GRID_SIZE={GRID_SIZE}
              />
            );
          })}

          {/* Live Preview Line during Connector Mode */}
          {previewPoints && (
            <Group>
              <KonvaLine
                points={previewPoints.points}
                stroke="#a855f7"
                strokeWidth={3}
                dash={[8, 6]}
                pointerLength={12}
                pointerWidth={10}
              />
              <KonvaCircle
                x={previewPoints.ex}
                y={previewPoints.ey}
                radius={6}
                fill="#a855f7"
                stroke="#ffffff"
                strokeWidth={2}
              />
            </Group>
          )}

          {/* Konva Transformer for resizing */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox: any, newBox: any) => {
              if (newBox.width < 50 || newBox.height < 50) return oldBox;
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
    </div>
  );
}

export default React.memo(WhiteboardStage);
