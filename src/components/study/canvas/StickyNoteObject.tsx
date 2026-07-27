'use client';

import React, { useState, useEffect } from 'react';
import { Group, Image as KonvaImage, Text as KonvaText, Circle as KonvaCircle } from 'react-konva';
import { Html } from 'react-konva-utils';
import useImage from 'use-image';
import { CanvasItem, AnchorPosition, getAnchorCoords, useCanvasStore } from '@/stores/useCanvasStore';
import { getStickyTemplate, StickyTemplate, autoAlphaCropImage } from '@/components/study/stickyTemplates';

interface StickyNoteObjectProps {
  item: CanvasItem;
  isSelected: boolean;
  isEditing: boolean;
  gridSnap: boolean;
  GRID_SIZE: number;
}

// Splits text across multiple writable rectangular regions in a template
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

  const words = text.split(/(\s+)/);
  const regionTexts: string[] = [];
  let wordIdx = 0;

  for (let r = 0; r < regions.length; r++) {
    if (wordIdx >= words.length) {
      regionTexts.push('');
      continue;
    }
    if (r === regions.length - 1) {
      regionTexts.push(words.slice(wordIdx).join(''));
      break;
    }

    const regW = (regions[r].width / 100) * itemWidth;
    const regH = (regions[r].height / 100) * itemHeight;
    const maxLines = Math.max(1, Math.floor(regH / (fontSize * lineHeight)));

    let currentRegionWords: string[] = [];
    let currentLine = '';
    let lineCount = 1;

    while (wordIdx < words.length && lineCount <= maxLines) {
      const word = words[wordIdx];
      if (word.includes('\n')) {
        const parts = word.split('\n');
        const testLine = currentLine + parts[0];
        if (ctx.measureText(testLine).width > regW && currentLine !== '') {
          lineCount++;
          if (lineCount > maxLines) break;
        }
        currentRegionWords.push(parts[0] + '\n');
        currentLine = parts.slice(1).join('\n');
        lineCount += parts.length - 1;
        if (lineCount > maxLines) break;
        wordIdx++;
        continue;
      }

      const testLine = currentLine + word;
      if (ctx.measureText(testLine).width > regW && currentLine !== '') {
        lineCount++;
        if (lineCount > maxLines) break;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
      currentRegionWords.push(word);
      wordIdx++;
    }
    regionTexts.push(currentRegionWords.join(''));
  }
  return regionTexts;
};

export default function StickyNoteObject({ item, isSelected, isEditing, gridSnap, GRID_SIZE }: StickyNoteObjectProps) {
  const { updateItemField, setSelectedId, startEditing, editingText, setEditingText, commitEditing, spawnArrowFromAnchor } = useCanvasStore();
  const template = getStickyTemplate(item.bgAsset);
  const [image] = useImage(template.image);
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number } | undefined>(undefined);

  // Auto-crop transparent borders on import
  useEffect(() => {
    if (image) {
      const iw = image.naturalWidth || image.width;
      const ih = image.naturalHeight || image.height;
      if (template.croppedBounds) {
        setCrop({
          x: (template.croppedBounds.left / 100) * iw,
          y: (template.croppedBounds.top / 100) * ih,
          width: (template.croppedBounds.width / 100) * iw,
          height: (template.croppedBounds.height / 100) * ih,
        });
      } else {
        const auto = autoAlphaCropImage(image);
        setCrop({
          x: (auto.left / 100) * iw,
          y: (auto.top / 100) * ih,
          width: (auto.width / 100) * iw,
          height: (auto.height / 100) * ih,
        });
      }
    }
  }, [image, template]);

  const regions = (template.writingRegions && template.writingRegions.length > 0)
    ? template.writingRegions
    : [template.writingArea || { x: 12, y: 22, width: 76, height: 58 }];

  const fontSize = item.fontSize || template.defaultFontSize || 15;
  const fontFamily = item.fontFamily || template.defaultFont || "'Quicksand', 'Nunito', sans-serif";
  const lineHeight = template.lineHeight || 1.5;
  const textColor = item.textColor || template.defaultTextColor || '#3A3A3A';

  const flowedTexts = splitTextAcrossRegions(
    item.content,
    regions,
    item.width,
    item.height,
    fontSize,
    lineHeight,
    fontFamily
  );

  const primaryReg = regions[0];
  const tx = (primaryReg.x / 100) * item.width;
  const ty = (primaryReg.y / 100) * item.height;
  const tw = (primaryReg.width / 100) * item.width;
  const th = (primaryReg.height / 100) * item.height;

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

        let newW = Math.round(node.width() * scaleX);
        // Scale proportionally without stretching decorative artwork
        let newH = Math.round(newW / (template.aspectRatio || 1.0));

        updateItemField(item.id, 'width', Math.max(80, newW));
        updateItemField(item.id, 'height', Math.max(80, newH));
      }}
    >
      {/* Decorative background PNG only */}
      {image && (
        <KonvaImage
          image={image}
          width={item.width}
          height={item.height}
          crop={crop}
          listening={true}
        />
      )}

      {/* Konva Text flow across writing regions when not editing */}
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
            fontSize={fontSize}
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

      {/* Temporary transparent HTML textarea integrated into Konva coordinates via react-konva-utils <Html> */}
      {isEditing && (
        <Html groupProps={{ x: tx, y: ty }} divProps={{ style: { opacity: 1 } }}>
          <textarea
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onBlur={commitEditing}
            autoFocus
            className="bg-transparent border-0 outline-none shadow-none p-0 focus:ring-0 resize-none font-sans custom-scrollbar whitespace-pre-wrap break-words overflow-hidden"
            style={{
              width: `${tw}px`,
              height: `${th}px`,
              fontFamily: fontFamily,
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              color: textColor,
              fontWeight: item.isBold !== undefined ? (item.isBold ? 'bold' : 'normal') : 'bold',
              textAlign: item.textAlign || template.textAlign || 'left',
              padding: template.padding || '4px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              caretColor: textColor,
            }}
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
