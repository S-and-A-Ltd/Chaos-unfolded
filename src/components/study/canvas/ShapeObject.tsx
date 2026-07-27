'use client';

import React from 'react';
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

export default function ShapeObject({ item, isSelected, isEditing, gridSnap, GRID_SIZE }: ShapeObjectProps) {
  const { updateItemField, setSelectedId, startEditing, editingText, setEditingText, commitEditing, spawnArrowFromAnchor } = useCanvasStore();

  const isAiCard = item.isAiCard && !item.bgAsset;
  const isText = item.type === 'text';
  const isCircle = item.type === 'shape' && item.shapeType === 'circle';
  const theme = FALLBACK_THEMES.find(t => t.bg === item.color) || FALLBACK_THEMES[0];

  const fontSize = item.fontSize || 15;
  const fontFamily = item.fontFamily || "'Quicksand', 'Nunito', sans-serif";
  const textColor = item.textColor || '#3A3A3A';

  return (
    <Group
      id={`node_${item.id}`}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      draggable={!isEditing}
      onClick={(e: any) => {
        e.cancelBubble = true;
        setSelectedId(item.id);
      }}
      onDblClick={(e: any) => {
        e.cancelBubble = true;
        startEditing(item);
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

        const newW = Math.round(node.width() * scaleX);
        const newH = Math.round(node.height() * scaleY);

        updateItemField(item.id, 'width', Math.max(60, newW));
        updateItemField(item.id, 'height', Math.max(60, newH));
      }}
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
          <textarea
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onBlur={commitEditing}
            autoFocus
            className="bg-transparent border-0 outline-none shadow-none p-0 focus:ring-0 resize-none font-sans custom-scrollbar whitespace-pre-wrap break-words overflow-hidden"
            style={{
              width: `${Math.max(10, item.width - 24)}px`,
              height: `${Math.max(10, item.height - (isAiCard ? 48 : 24))}px`,
              fontFamily: fontFamily,
              fontSize: `${fontSize}px`,
              lineHeight: 1.4,
              color: textColor,
              fontWeight: item.isBold !== undefined ? (item.isBold ? 'bold' : 'normal') : 'bold',
              textAlign: item.textAlign || 'left',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              caretColor: textColor,
            }}
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
