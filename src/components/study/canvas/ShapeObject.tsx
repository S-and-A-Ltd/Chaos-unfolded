'use client';

import React, { useState, useCallback } from 'react';
import { Group, Rect as KonvaRect, Circle as KonvaCircle, Text as KonvaText } from 'react-konva';
import { Html } from 'react-konva-utils';
import { CanvasItem, AnchorPosition, getAnchorCoords, useCanvasStore } from '@/stores/useCanvasStore';

interface ShapeObjectProps {
  item: CanvasItem;
  isSelected: boolean;
  isEditing: boolean;
  gridSnap: boolean;
  GRID_SIZE: number;
}

const FALLBACK_THEMES = [
  { name: 'Yellow Sun', bg: '#fffdf0', border: '#fde047' },
  { name: 'Rose Strawberry', bg: '#fff5f7', border: '#f472b6' },
  { name: 'Sky Cloud', bg: '#f0f9ff', border: '#38bdf8' },
  { name: 'Sage Clover', bg: '#f2fbf5', border: '#4ade80' },
  { name: 'Lavender Dream', bg: '#f8f5ff', border: '#c084fc' },
  { name: 'Peach Apricot', bg: '#fffaf5', border: '#fb923c' },
];

interface InlineShapeEditorProps {
  initialContent: string;
  tw: number;
  th: number;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  isBold?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  commitEditing: (newText?: string) => void;
}

const InlineShapeEditor = React.memo(({
  initialContent,
  tw,
  th,
  fontFamily,
  fontSize,
  textColor,
  isBold,
  textAlign,
  commitEditing,
}: InlineShapeEditorProps) => {
  const [localText, setLocalText] = useState(initialContent);

  const handleBlur = useCallback(() => {
    commitEditing(localText);
  }, [commitEditing, localText]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      commitEditing(localText);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      commitEditing(localText);
    }
    e.stopPropagation();
  }, [commitEditing, localText]);

  return (
    <textarea
      value={localText}
      onChange={(e) => setLocalText(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      autoFocus
      style={{
        width: `${tw}px`,
        height: `${th}px`,
        fontFamily: fontFamily,
        fontSize: `${fontSize}px`,
        lineHeight: 1.4,
        color: textColor,
        fontWeight: isBold !== undefined ? (isBold ? 'bold' : 'normal') : 'bold',
        textAlign: (textAlign || 'left') as any,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        caretColor: textColor,
        resize: 'none',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        display: 'block',
        margin: 0,
        padding: '4px',
      }}
    />
  );
});

function ShapeObject({ item, isSelected, isEditing, gridSnap, GRID_SIZE }: ShapeObjectProps) {
  const updateItemFields = useCanvasStore(state => state.updateItemFields);
  const setSelectedId = useCanvasStore(state => state.setSelectedId);
  const startEditing = useCanvasStore(state => state.startEditing);
  const commitEditing = useCanvasStore(state => state.commitEditing);
  const spawnArrowFromAnchor = useCanvasStore(state => state.spawnArrowFromAnchor);

  const isAiCard = item.isAiCard && !item.bgAsset;
  const isText = item.type === 'text';
  const isCircle = item.type === 'shape' && item.shapeType === 'circle';
  const theme = FALLBACK_THEMES.find(t => t.bg === item.color) || FALLBACK_THEMES[0];

  const fontSize = item.fontSize || 15;
  const fontFamily = item.fontFamily || "'Quicksand', 'Nunito', sans-serif";
  const textColor = item.textColor || '#3A3A3A';

  const handleClick = useCallback((e: any) => {
    e.cancelBubble = true;
    setSelectedId(item.id);
  }, [setSelectedId, item.id]);

  const handleDblClick = useCallback((e: any) => {
    e.cancelBubble = true;
    startEditing(item);
  }, [startEditing, item]);

  // BATCH position update
  const handleDragEnd = useCallback((e: any) => {
    let fx = e.target.x();
    let fy = e.target.y();
    if (gridSnap) {
      fx = Math.round(fx / GRID_SIZE) * GRID_SIZE;
      fy = Math.round(fy / GRID_SIZE) * GRID_SIZE;
      e.target.x(fx);
      e.target.y(fy);
    }
    updateItemFields(item.id, { x: fx, y: fy });
  }, [gridSnap, GRID_SIZE, updateItemFields, item.id]);

  // BATCH size update
  const handleTransformEnd = useCallback((e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    const newW = Math.max(60, Math.round(node.width() * scaleX));
    const newH = Math.max(60, Math.round(node.height() * scaleY));

    updateItemFields(item.id, { width: newW, height: newH });
  }, [updateItemFields, item.id]);

  return (
    <Group
      id={`node_${item.id}`}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      draggable={!isEditing}
      onClick={handleClick}
      onDblClick={handleDblClick}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {/* Background shape */}
      {isCircle ? (
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

      {/* AI Card header */}
      {isAiCard && (
        <>
          <KonvaRect width={item.width} height={28} fill={theme.border} cornerRadius={[16, 16, 0, 0]} />
          <KonvaText x={12} y={8} text={item.title || '✨ AI Insight'} fontSize={12} fontFamily="sans-serif" fontStyle="bold" fill="#1f2937" />
        </>
      )}

      {/* Konva Text display */}
      {!isEditing && (
        <KonvaText
          x={12}
          y={isAiCard ? 36 : 12}
          width={Math.max(10, item.width - 24)}
          height={Math.max(10, item.height - (isAiCard ? 48 : 24))}
          text={item.content || ''}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fontStyle={item.isBold !== undefined ? (item.isBold ? 'bold' : 'normal') : 'bold'}
          fill={textColor}
          align={item.textAlign || 'left'}
          lineHeight={1.4}
          wrap="word"
          listening={false}
        />
      )}

      {/* Integrated HTML textarea for editing */}
      {isEditing && (
        <Html groupProps={{ x: 12, y: isAiCard ? 36 : 12 }} divProps={{ style: { opacity: 1 } }}>
          <InlineShapeEditor
            initialContent={item.content}
            tw={Math.max(10, item.width - 24)}
            th={Math.max(10, item.height - (isAiCard ? 48 : 24))}
            fontFamily={fontFamily}
            fontSize={fontSize}
            textColor={textColor}
            isBold={item.isBold}
            textAlign={item.textAlign}
            commitEditing={commitEditing}
          />
        </Html>
      )}

      {/* Anchor handles on edges */}
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
}

export default React.memo(ShapeObject);
