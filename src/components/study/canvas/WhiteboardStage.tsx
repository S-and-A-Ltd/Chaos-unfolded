'use client';

import React, { useRef, useEffect } from 'react';
import { Stage, Layer, Rect as KonvaRect, Transformer } from 'react-konva';
import { useCanvasStore } from '@/stores/useCanvasStore';
import StickyNoteObject from '@/components/study/canvas/StickyNoteObject';
import ShapeObject from '@/components/study/canvas/ShapeObject';
import ConnectorObject from '@/components/study/canvas/ConnectorObject';

const GRID_SIZE = 20;

export default function WhiteboardStage() {
  const { items, selectedId, editingId, scale, pan, gridSnap, setPan, setSelectedId, commitEditing, deleteItem, duplicateItem } = useCanvasStore();
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

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

  // Keyboard Shortcuts (Delete, Duplicate)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (selectedId && !editingId) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          deleteItem(selectedId);
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          duplicateItem(selectedId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingId, deleteItem, duplicateItem]);

  const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const height = typeof window !== 'undefined' ? window.innerHeight - 100 : 800;

  return (
    <div className="flex-1 overflow-hidden relative canvas-container" style={{ backgroundColor: '#f7f5fa' }}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
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
          {/* Background grid */}
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

          {/* Connectors (rendered underneath cards) */}
          {items.filter(i => i.type === 'arrow').map(arrow => (
            <ConnectorObject
              key={arrow.id}
              arrow={arrow}
              isSelected={selectedId === arrow.id}
            />
          ))}

          {/* Sticky notes, textboxes, shapes, AI cards */}
          {items.filter(i => i.type !== 'arrow').map(item => {
            const isSelected = selectedId === item.id;
            const isEditing = editingId === item.id;
            const isSticky = item.type === 'sticky' || item.bgAsset !== undefined;

            if (isSticky) {
              return (
                <StickyNoteObject
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  isEditing={isEditing}
                  gridSnap={gridSnap}
                  GRID_SIZE={GRID_SIZE}
                />
              );
            } else {
              return (
                <ShapeObject
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  isEditing={isEditing}
                  gridSnap={gridSnap}
                  GRID_SIZE={GRID_SIZE}
                />
              );
            }
          })}

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
