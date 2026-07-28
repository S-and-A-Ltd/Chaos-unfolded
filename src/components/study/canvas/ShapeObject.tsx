'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
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

const SHAPE_THEMES = [
  { name: 'Yellow Sun', bg: '#fffdf0', border: '#fde047', text: '#3A3A3A' },
  { name: 'Rose Strawberry', bg: '#fff5f7', border: '#f472b6', text: '#3A3A3A' },
  { name: 'Sky Cloud', bg: '#f0f9ff', border: '#38bdf8', text: '#3A3A3A' },
  { name: 'Sage Clover', bg: '#f2fbf5', border: '#4ade80', text: '#3A3A3A' },
  { name: 'Lavender Dream', bg: '#f8f5ff', border: '#c084fc', text: '#3A3A3A' },
  { name: 'Peach Apricot', bg: '#fffaf5', border: '#fb923c', text: '#3A3A3A' },
  { name: 'Dark Slate', bg: '#1e293b', border: '#475569', text: '#F0F0F0' },
  { name: 'Deep Purple', bg: '#2d1b69', border: '#7c3aed', text: '#F0F0F0' },
];

interface InlineShapeEditorProps {
  initialContent: string;
  initialCursorStart?: number;
  initialCursorEnd?: number;
  tw: number;
  th: number;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  isBold?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  commitEditing: (newText?: string, cursorStart?: number, cursorEnd?: number) => void;
}

const InlineShapeEditor = React.memo(({
  initialContent,
  initialCursorStart,
  initialCursorEnd,
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore cursor position on mount
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      const start = initialCursorStart ?? localText.length;
      const end = initialCursorEnd ?? start;
      const s = Math.min(start, localText.length);
      const e = Math.min(end, localText.length);
      ta.setSelectionRange(s, e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBlur = useCallback(() => {
    const ta = textareaRef.current;
    commitEditing(localText, ta?.selectionStart, ta?.selectionEnd);
  }, [commitEditing, localText]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      const ta = textareaRef.current;
      commitEditing(localText, ta?.selectionStart, ta?.selectionEnd);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const ta = textareaRef.current;
      commitEditing(localText, ta?.selectionStart, ta?.selectionEnd);
    }
    e.stopPropagation();
  }, [commitEditing, localText]);

  return (
    <textarea
      ref={textareaRef}
      value={localText}
      onChange={(e) => setLocalText(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
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
        padding: '8px',
      }}
    />
  );
});

/**
 * Auto-detect text color from background hex color.
 * Uses luminance formula to return white or dark text.
 */
function autoTextFromBg(bgColor?: string): string {
  if (!bgColor || !bgColor.startsWith('#')) return '#3A3A3A';
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#3A3A3A';
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 128 ? '#F0F0F0' : '#3A3A3A';
}

function ShapeObject({ item, isSelected, isEditing, gridSnap, GRID_SIZE }: ShapeObjectProps) {
  const updateItemFields = useCanvasStore(state => state.updateItemFields);
  const setSelectedId = useCanvasStore(state => state.setSelectedId);
  const startEditing = useCanvasStore(state => state.startEditing);
  const commitEditing = useCanvasStore(state => state.commitEditing);
  const spawnArrowFromAnchor = useCanvasStore(state => state.spawnArrowFromAnchor);

  const isAiCard = item.isAiCard && !item.bgAsset;
  const isText = item.type === 'text';
  const isCircle = item.type === 'shape' && item.shapeType === 'circle';
  const theme = SHAPE_THEMES.find(t => t.bg === item.color) || SHAPE_THEMES[0];

  const fontSize = item.fontSize || 15;
  const fontFamily = item.fontFamily || "'Quicksand', 'Nunito', sans-serif";
  // Auto text color: use explicit textColor, then theme text, then auto-detect from bg
  const textColor = item.textColor || theme.text || autoTextFromBg(item.color);

  // Content insets — shapes/circles now have generous padding for writing
  const padX = isCircle ? Math.round(item.width * 0.15) : 12;
  const padY = isCircle ? Math.round(item.height * 0.2) : (isAiCard ? 36 : 12);
  const contentW = Math.max(10, item.width - padX * 2);
  const contentH = Math.max(10, item.height - padY - (isCircle ? Math.round(item.height * 0.15) : 12));

  const handleClick = useCallback((e: any) => {
    e.cancelBubble = true;
    setSelectedId(item.id);
  }, [setSelectedId, item.id]);

  const handleDblClick = useCallback((e: any) => {
    e.cancelBubble = true;
    startEditing(item);
  }, [startEditing, item]);

  const handleDragMove = useCallback((e: any) => {
    if (e.target === e.currentTarget) {
      updateItemFields(item.id, { x: e.target.x(), y: e.target.y() });
    }
  }, [updateItemFields, item.id]);

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

  const handleTransformEnd = useCallback((e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    let newW = Math.max(60, Math.round(node.width() * scaleX));
    let newH = Math.max(60, Math.round(node.height() * scaleY));
    // Circles maintain 1:1 aspect ratio
    if (isCircle) { newH = newW; }
    updateItemFields(item.id, { width: newW, height: newH });
  }, [updateItemFields, item.id, isCircle]);

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
      onDragMove={handleDragMove}
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
          stroke={isSelected ? '#8b5cf6' : (item.borderColor || 'rgba(0,0,0,0.1)')}
          strokeWidth={item.borderWidth ?? 2}
          dash={item.borderStyle === 'dashed' ? [8, 4] : undefined}
          opacity={item.opacity ?? 1}
          shadowBlur={isSelected ? 8 : 3}
          shadowColor={isSelected ? '#8b5cf6' : 'rgba(0,0,0,0.1)'}
          shadowOpacity={0.3}
        />
      ) : (
        <KonvaRect
          width={item.width}
          height={item.height}
          fill={isText ? 'rgba(255,255,255,0.4)' : isAiCard ? theme.bg : item.color || '#ffffff'}
          stroke={isSelected ? '#8b5cf6' : isText ? '#9ca3af' : (item.borderColor || 'rgba(0,0,0,0.1)')}
          strokeWidth={isSelected ? 2 : (item.borderWidth ?? 1)}
          dash={isText && !isSelected ? [4, 4] : item.borderStyle === 'dashed' ? [8, 4] : undefined}
          cornerRadius={item.cornerRadius ?? 16}
          opacity={item.opacity ?? 1}
          shadowBlur={isSelected ? 8 : 3}
          shadowColor={isSelected ? '#8b5cf6' : 'rgba(0,0,0,0.1)'}
          shadowOpacity={0.3}
        />
      )}

      {/* AI Card header */}
      {isAiCard && (
        <>
          <KonvaRect width={item.width} height={28} fill={theme.border} cornerRadius={[16, 16, 0, 0]} />
          <KonvaText x={12} y={8} text={item.title || '✨ AI Insight'} fontSize={12} fontFamily="sans-serif" fontStyle="bold" fill="#1f2937" />
        </>
      )}

      {/* Clipped text display — scrolls via textarea when editing, clips via Group when viewing */}
      {!isEditing && (
        <Group clipX={padX} clipY={padY} clipWidth={contentW} clipHeight={contentH}>
          <KonvaText
            x={padX}
            y={padY}
            width={contentW}
            height={contentH}
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
        </Group>
      )}

      {/* Integrated HTML textarea for editing — scrolls on overflow */}
      {isEditing && (
        <Html groupProps={{ x: padX, y: padY }} divProps={{ style: { opacity: 1 } }}>
          <InlineShapeEditor
            initialContent={item.content}
            initialCursorStart={item.cursorStart}
            initialCursorEnd={item.cursorEnd}
            tw={contentW}
            th={contentH}
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
