'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Group, Image as KonvaImage, Text as KonvaText, Circle as KonvaCircle } from 'react-konva';
import { Html } from 'react-konva-utils';
import useImage from 'use-image';
import { CanvasItem, AnchorPosition, getAnchorCoords, useCanvasStore } from '@/stores/useCanvasStore';
import { getStickyTemplate } from '@/components/study/stickyTemplates';

interface StickyNoteObjectProps {
  item: CanvasItem;
  isSelected: boolean;
  isEditing: boolean;
  gridSnap: boolean;
  GRID_SIZE: number;
}

// Splits text across multiple writable rectangular regions in a template.
// Returns one string per region.
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
    if (lineIdx >= lines.length) {
      regionTexts.push('');
      continue;
    }
    if (r === regions.length - 1) {
      // Last region gets all remaining text
      regionTexts.push(lines.slice(lineIdx).join('\n'));
      break;
    }

    const regW = (regions[r].width / 100) * itemWidth;
    const regH = (regions[r].height / 100) * itemHeight;
    const maxVisualLines = Math.max(1, Math.floor(regH / (fontSize * lineHeight)));

    const regionLines: string[] = [];
    let visualLineCount = 0;

    while (lineIdx < lines.length && visualLineCount < maxVisualLines) {
      const line = lines[lineIdx];
      // Count how many visual lines this text line occupies (word wrap)
      if (line === '') {
        regionLines.push('');
        visualLineCount++;
        lineIdx++;
        continue;
      }
      const words = line.split(' ');
      let currentLine = '';
      let wrappedCount = 0;
      for (const word of words) {
        const test = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(test).width > regW && currentLine) {
          wrappedCount++;
          currentLine = word;
        } else {
          currentLine = test;
        }
      }
      wrappedCount++; // Last line
      if (visualLineCount + wrappedCount > maxVisualLines) {
        // This line doesn't fit; stop here, don't consume it
        break;
      }
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
  tw: number;
  th: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  isBold?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  padding?: string;
  commitEditing: (newText?: string) => void;
}

const InlineTextEditor = React.memo(({
  initialContent,
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

  const handleBlur = useCallback(() => {
    commitEditing(localText);
  }, [commitEditing, localText]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      commitEditing(localText);
    }
    // Allow Enter for newlines, Ctrl+Enter to commit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      commitEditing(localText);
    }
    // Stop propagation so Delete/Backspace don't trigger canvas shortcuts
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

  // Bug 4 fix: Skip crop for JPEG templates where croppedBounds covers ≥95% of image.
  // All 28 templates are JPEGs with no alpha channel, so autoAlphaCrop is useless.
  // croppedBounds of {1,1,98,98} causes subtle distortion — skip it.
  const crop = useMemo(() => {
    if (!image || !template.croppedBounds) return undefined;
    const cb = template.croppedBounds;
    // Skip crop if it covers nearly the full image (no meaningful crop)
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
  const textColor = item.textColor || template.defaultTextColor || '#3A3A3A';

  const flowedTexts = useMemo(() => {
    return splitTextAcrossRegions(
      item.content,
      regions,
      item.width,
      item.height,
      scaledFontSize,
      lineHeight,
      fontFamily
    );
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

  // BATCH position update — single store call for x + y
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

  // BATCH size update — single store call for width + height
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
      {/* Decorative background PNG */}
      {image && (
        <KonvaImage
          image={image}
          width={item.width}
          height={item.height}
          crop={crop}
          listening={true}
        />
      )}

      {/* Konva Text flow across writing regions when NOT editing */}
      {!isEditing && regions.map((reg, rIdx) => {
        const rtx = (reg.x / 100) * item.width;
        const rty = (reg.y / 100) * item.height;
        const rtw = (reg.width / 100) * item.width;
        const rth = (reg.height / 100) * item.height;

        return (
          <KonvaText
            key={rIdx}
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
        );
      })}

      {/* Transparent HTML textarea for editing — only active while isEditing */}
      {isEditing && (
        <Html groupProps={{ x: tx, y: ty }} divProps={{ style: { opacity: 1 } }}>
          <InlineTextEditor
            initialContent={item.content}
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
