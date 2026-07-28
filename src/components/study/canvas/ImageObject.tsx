'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Group, Rect as KonvaRect, Image as KonvaImage, Circle as KonvaCircle } from 'react-konva';
import { CanvasItem, AnchorPosition, getAnchorCoords, useCanvasStore } from '@/stores/useCanvasStore';

interface ImageObjectProps {
  item: CanvasItem;
  isSelected: boolean;
  gridSnap: boolean;
  GRID_SIZE: number;
}

function ImageObject({ item, isSelected, gridSnap, GRID_SIZE }: ImageObjectProps) {
  const updateItemFields = useCanvasStore(state => state.updateItemFields);
  const setSelectedId = useCanvasStore(state => state.setSelectedId);
  const spawnArrowFromAnchor = useCanvasStore(state => state.spawnArrowFromAnchor);

  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (item.imageUrl) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setImage(img);
      img.src = item.imageUrl;
    }
  }, [item.imageUrl]);

  const connectorMode = useCanvasStore(state => state.connectorMode);
  const drawingConnector = useCanvasStore(state => state.drawingConnector);

  const handleClick = useCallback((e: any) => {
    e.cancelBubble = true;
    const store = useCanvasStore.getState();
    if (store.connectorMode) {
      const pos = e.target.getStage()?.getPointerPosition();
      let anchorPos: AnchorPosition = 'right';
      if (pos) {
        const stage = e.target.getStage();
        const worldX = (pos.x - stage.x()) / stage.scaleX();
        const worldY = (pos.y - stage.y()) / stage.scaleY();
        const relX = worldX - item.x;
        const relY = worldY - item.y;
        const dx = relX - item.width / 2;
        const dy = relY - item.height / 2;
        anchorPos = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
      }
      const coords = getAnchorCoords(item, anchorPos);

      if (!store.drawingConnector) {
        store.startConnectorDraw(item.id, anchorPos, coords.x, coords.y);
      } else if (store.drawingConnector.fromId !== item.id) {
        store.finishConnectorDraw(item.id, anchorPos);
      }
      return;
    }
    setSelectedId(item.id);
  }, [setSelectedId, item]);

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
    const newW = Math.max(40, Math.round(node.width() * scaleX));
    const newH = Math.max(40, Math.round(node.height() * scaleY));
    updateItemFields(item.id, { width: newW, height: newH });
  }, [updateItemFields, item.id]);

  return (
    <Group
      id={`node_${item.id}`}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      draggable
      onClick={handleClick}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {/* Selection border */}
      {isSelected && (
        <KonvaRect
          width={item.width}
          height={item.height}
          stroke="#8b5cf6"
          strokeWidth={2}
          cornerRadius={4}
          dash={[6, 3]}
          listening={false}
        />
      )}

      {/* Rendered image */}
      {image && (
        <KonvaImage
          image={image}
          width={item.width}
          height={item.height}
          cornerRadius={4}
        />
      )}

      {/* Placeholder if image hasn't loaded */}
      {!image && (
        <>
          <KonvaRect
            width={item.width}
            height={item.height}
            fill="#f3f4f6"
            stroke="#d1d5db"
            strokeWidth={1}
            cornerRadius={4}
          />
        </>
      )}

      {/* Anchor handles on edges */}
      {(isSelected || connectorMode || drawingConnector !== null) && (['top', 'right', 'bottom', 'left'] as AnchorPosition[]).map((anchorPos) => {
        const coords = getAnchorCoords({ ...item, x: 0, y: 0 }, anchorPos);
        const isFromAnchor = drawingConnector?.fromId === item.id && drawingConnector?.fromAnchor === anchorPos;
        return (
          <KonvaCircle
            key={anchorPos}
            x={coords.x}
            y={coords.y}
            radius={isFromAnchor ? 8 : (connectorMode || drawingConnector) ? 7 : 6}
            fill={isFromAnchor ? '#22c55e' : (connectorMode || drawingConnector) ? '#a855f7' : '#8b5cf6'}
            stroke="#ffffff"
            strokeWidth={2}
            cursor="pointer"
            onClick={(e: any) => {
              e.cancelBubble = true;
              const store = useCanvasStore.getState();
              const absoluteCoords = getAnchorCoords(item, anchorPos);
              if (!store.drawingConnector) {
                store.startConnectorDraw(item.id, anchorPos, absoluteCoords.x, absoluteCoords.y);
              } else if (store.drawingConnector.fromId !== item.id) {
                store.finishConnectorDraw(item.id, anchorPos);
              }
            }}
            onMouseEnter={(e: any) => { e.target.scale({ x: 1.5, y: 1.5 }); e.target.getLayer()?.batchDraw(); }}
            onMouseLeave={(e: any) => { e.target.scale({ x: 1, y: 1 }); e.target.getLayer()?.batchDraw(); }}
          />
        );
      })}
    </Group>
  );
}

export default React.memo(ImageObject);
