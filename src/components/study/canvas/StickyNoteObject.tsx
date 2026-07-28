'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Group, Image as KonvaImage, Text as KonvaText, Circle as KonvaCircle, Rect as KonvaRect } from 'react-konva';
import { Html } from 'react-konva-utils';
import useImage from 'use-image';
import { CanvasItem, AnchorPosition, getAnchorCoords, useCanvasStore } from '@/stores/useCanvasStore';
import { getStickyTemplate, getTemplateBrightness, autoTextColor } from '@/components/study/stickyTemplates';

interface StickyNoteObjectProps {
  item: CanvasItem;
  isSelected: boolean;
  isEditing: boolean;
  gridSnap: boolean;
  GRID_SIZE: number;
}

// Splits text across multiple writable rectangular regions in a template.
const splitTextAcrossRegions = (
  text: string,
  regions: { x: number; y: number; width: number; height: number }[],
  itemWidth: number,
  itemHeight: number,
  fontSize: number,
  lineHeight: number,
  fontFamily: string
): string[] => {
  if (!regions || regions.length <= 1 || !text) return [text];
  if (typeof document === 'undefined') return [text, ...Array(regions.length - 1).fill('')];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [text, ...Array(regions.length - 1).fill('')];
  ctx.font = `${fontSize}px ${fontFamily}`;

  const lines = text.split('\n');
  const regionTexts: string[] = [];
  let lineIdx = 0;

  for (let r = 0; r < regions.length; r++) {
    if (lineIdx >= lines.length) { regionTexts.push(''); continue; }
    if (r === regions.length - 1) { regionTexts.push(lines.slice(lineIdx).join('\n')); break; }

    const regW = (regions[r].width / 100) * itemWidth;
    const regH = (regions[r].height / 100) * itemHeight;
    const maxVisualLines = Math.max(1, Math.floor(regH / (fontSize * lineHeight)));
    const regionLines: string[] = [];
    let visualLineCount = 0;

    while (lineIdx < lines.length && visualLineCount < maxVisualLines) {
      const line = lines[lineIdx];
      if (line === '') { regionLines.push(''); visualLineCount++; lineIdx++; continue; }
      const words = line.split(' ');
      let currentLine = '';
      let wrappedCount = 0;
      for (const word of words) {
        const test = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(test).width > regW && currentLine) { wrappedCount++; currentLine = word; }
        else { currentLine = test; }
      }
      wrappedCount++;
      if (visualLineCount + wrappedCount > maxVisualLines) break;
      regionLines.push(line);
      visualLineCount += wrappedCount;
      lineIdx++;
    }
    regionTexts.push(regionLines.join('\n'));
  }
  return regionTexts;
};

interface InlineTextEditorProps {
  initialContent: string;
  initialCursorStart?: number;
  initialCursorEnd?: number;
  tw: number;
  th: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  isBold?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  padding?: string;
  commitEditing: (newText?: string, cursorStart?: number, cursorEnd?: number) => void;
}

const InlineTextEditor = React.memo(({
  initialContent,
  initialCursorStart,
  initialCursorEnd,
  tw,
  th,
  fontFamily,
  fontSize,
  lineHeight,
  textColor,
  isBold,
  textAlign,
  padding,
  commitEditing,
}: InlineTextEditorProps) => {
  const [localText, setLocalText] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore cursor position on mount
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      const start = initialCursorStart ?? localText.length;
      const end = initialCursorEnd ?? start;
      // Clamp to content length
      const s = Math.min(start, localText.length);
      const e = Math.min(end, localText.length);
      ta.setSelectionRange(s, e);
    }
    // Only run on mount
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
        lineHeight: lineHeight,
        color: textColor,
        fontWeight: isBold !== undefined ? (isBold ? 'bold' : 'normal') : 'bold',
        textAlign: (textAlign || 'left') as any,
        padding: padding || '4px',
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
      }}
    />
  );
});

function StickyNoteObject({ item, isSelected, isEditing, gridSnap, GRID_SIZE }: StickyNoteObjectProps) {
  const updateItemFields = useCanvasStore(state => state.updateItemFields);
  const setSelectedId = useCanvasStore(state => state.setSelectedId);
  const startEditing = useCanvasStore(state => state.startEditing);
  const commitEditing = useCanvasStore(state => state.commitEditing);
  const spawnArrowFromAnchor = useCanvasStore(state => state.spawnArrowFromAnchor);

  const template = useMemo(() => getStickyTemplate(item.bgAsset), [item.bgAsset]);
  const [image] = useImage(template.image);

  // Auto-detect brightness and choose text color
  const autoBrightness = useMemo(() => {
    if (!image) return 'light';
    return getTemplateBrightness(image as HTMLImageElement, template);
  }, [image, template]);

  const autoColor = useMemo(() => autoTextColor(autoBrightness), [autoBrightness]);

  // Skip crop for JPEGs where croppedBounds covers ≥95% of image
  const crop = useMemo(() => {
    if (!image || !template.croppedBounds) return undefined;
    const cb = template.croppedBounds;
    if (cb.width >= 95 && cb.height >= 95) return undefined;
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    return {
      x: (cb.left / 100) * iw,
      y: (cb.top / 100) * ih,
      width: (cb.width / 100) * iw,
      height: (cb.height / 100) * ih,
    };
  }, [image, template.croppedBounds]);

  const regions = useMemo(() => {
    return (template.writingRegions && template.writingRegions.length > 0)
      ? template.writingRegions
      : [template.writingArea || { x: 12, y: 22, width: 76, height: 58 }];
  }, [template]);

  // Scale font proportionally to note size (base size at width=280)
  const baseFontSize = item.fontSize || template.defaultFontSize || 15;
  const scaledFontSize = Math.max(8, Math.round(baseFontSize * (item.width / 280)));
  const fontFamily = item.fontFamily || template.defaultFont || "'Quicksand', 'Nunito', sans-serif";
  const lineHeight = template.lineHeight || 1.5;
  // Use item's explicit textColor, fall back to template default, then auto-brightness
  const textColor = item.textColor || template.defaultTextColor || autoColor;

  const flowedTexts = useMemo(() => {
    return splitTextAcrossRegions(item.content, regions, item.width, item.height, scaledFontSize, lineHeight, fontFamily);
  }, [item.content, regions, item.width, item.height, scaledFontSize, lineHeight, fontFamily]);

  const primaryReg = regions[0];
  const tx = (primaryReg.x / 100) * item.width;
  const ty = (primaryReg.y / 100) * item.height;
  const tw = (primaryReg.width / 100) * item.width;
  const th = (primaryReg.height / 100) * item.height;

  const handleClick = useCallback((e: any) => {
    e.cancelBubble = true;
    setSelectedId(item.id);
  }, [setSelectedId, item.id]);

  const handleDblClick = useCallback((e: any) => {
    e.cancelBubble = true;
    startEditing(item);
  }, [startEditing, item]);

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

  // Lock aspect ratio on resize — don't stretch the template PNG
  const handleTransformEnd = useCallback((e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    node.scaleX(1);
    node.scaleY(1);
    const newW = Math.max(80, Math.round(node.width() * scaleX));
    const newH = Math.max(80, Math.round(newW / (template.aspectRatio || 1.0)));
    updateItemFields(item.id, { width: newW, height: newH });
  }, [updateItemFields, item.id, template.aspectRatio]);

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
      {/* Decorative background PNG — fixed when lockedBg is on (never changes) */}
      {image && (
        <KonvaImage
          image={image}
          width={item.width}
          height={item.height}
          crop={crop}
          listening={true}
        />
      )}

      {/* Clip text to writing region bounds — prevents overflow */}
      {!isEditing && regions.map((reg, rIdx) => {
        const rtx = (reg.x / 100) * item.width;
        const rty = (reg.y / 100) * item.height;
        const rtw = (reg.width / 100) * item.width;
        const rth = (reg.height / 100) * item.height;

        return (
          <Group key={rIdx} clipX={rtx} clipY={rty} clipWidth={rtw} clipHeight={rth}>
            <KonvaText
              x={rtx}
              y={rty}
              width={rtw}
              height={rth}
              text={flowedTexts[rIdx] || ''}
              fontSize={scaledFontSize}
              fontFamily={fontFamily}
              fontStyle={item.isBold !== undefined ? (item.isBold ? 'bold' : 'normal') : 'bold'}
              fill={textColor}
              align={item.textAlign || template.textAlign || 'left'}
              lineHeight={lineHeight}
              wrap="word"
              listening={false}
            />
          </Group>
        );
      })}

      {/* Transparent HTML textarea for editing — scrolls on overflow */}
      {isEditing && (
        <Html groupProps={{ x: tx, y: ty }} divProps={{ style: { opacity: 1 } }}>
          <InlineTextEditor
            initialContent={item.content}
            initialCursorStart={item.cursorStart}
            initialCursorEnd={item.cursorEnd}
            tw={tw}
            th={th}
            fontFamily={fontFamily}
            fontSize={scaledFontSize}
            lineHeight={lineHeight}
            textColor={textColor}
            isBold={item.isBold}
            textAlign={item.textAlign || template.textAlign}
            padding={template.padding}
            commitEditing={commitEditing}
          />
        </Html>
      )}

      {/* Anchor handles on edges for connectors */}
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

export default React.memo(StickyNoteObject);
