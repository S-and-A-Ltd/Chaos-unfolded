'use client';

import React, { useCallback, useMemo } from 'react';
import { Group, Line as KonvaLine, Circle as KonvaCircle } from 'react-konva';
import { CanvasItem, AnchorPosition, getAnchorCoords, useCanvasStore } from '@/stores/useCanvasStore';
import { useShallow } from 'zustand/react/shallow';

interface ConnectorObjectProps {
  arrow: CanvasItem;
  isSelected: boolean;
}

function ConnectorObject({ arrow, isSelected }: ConnectorObjectProps) {
  const items = useCanvasStore(useShallow(state => state.items));
  const setSelectedId = useCanvasStore(state => state.setSelectedId);
  const updateItemFields = useCanvasStore(state => state.updateItemFields);

  // Dynamically compute start/end from connected objects
  const { sx, sy, ex, ey, fromExists, toExists } = useMemo(() => {
    let startX = arrow.startX ?? arrow.x;
    let startY = arrow.startY ?? arrow.y;
    let endX = arrow.endX ?? (arrow.x + 150);
    let endY = arrow.endY ?? arrow.y;
    let fromOk = false;
    let toOk = false;

    if (arrow.fromId) {
      const fromItem = items.find(i => i.id === arrow.fromId);
      if (fromItem && arrow.fromAnchor) {
        const c = getAnchorCoords(fromItem, arrow.fromAnchor);
        startX = c.x;
        startY = c.y;
        fromOk = true;
      }
    }
    if (arrow.toId) {
      const toItem = items.find(i => i.id === arrow.toId);
      if (toItem && arrow.toAnchor) {
        const c = getAnchorCoords(toItem, arrow.toAnchor);
        endX = c.x;
        endY = c.y;
        toOk = true;
      }
    }

    return { sx: startX, sy: startY, ex: endX, ey: endY, fromExists: fromOk, toExists: toOk };
  }, [arrow, items]);

  const color = isSelected ? '#ec4899' : arrow.color || '#8b5cf6';
  const style = arrow.connectorStyle || 'orthogonal';
  const strokeWidth = arrow.borderWidth || 3;
  const borderStyle = arrow.borderStyle || 'solid';
  const arrowhead = arrow.arrowhead || 'arrow';

  const dash = borderStyle === 'dashed' ? [10, 6] : undefined;

  const points = useMemo(() => {
    if (style === 'straight') {
      return [sx, sy, ex, ey];
    } else if (style === 'curved') {
      const midX = (sx + ex) / 2;
      const midY = (sy + ey) / 2 - 40;
      return [sx, sy, midX, midY, ex, ey];
    } else {
      // Orthogonal: horizontal first, then vertical
      const midX = (sx + ex) / 2;
      return [sx, sy, midX, sy, midX, ey, ex, ey];
    }
  }, [sx, sy, ex, ey, style]);

  const tension = style === 'curved' ? 0.35 : 0;

  const handleClick = useCallback((e: any) => {
    e.cancelBubble = true;
    setSelectedId(arrow.id);
  }, [setSelectedId, arrow.id]);

  // Endpoint drag handlers for reconnection
  const handleEndpointDrag = useCallback((endpoint: 'start' | 'end') => {
    return (e: any) => {
      e.cancelBubble = true;
      const stage = e.target.getStage();
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      const stageScale = stage.scaleX();
      const stagePos = { x: stage.x(), y: stage.y() };
      const worldX = (pos.x - stagePos.x) / stageScale;
      const worldY = (pos.y - stagePos.y) / stageScale;

      // Check for hit on canvas items
      let hitItem: CanvasItem | null = null;
      let hitAnchor: AnchorPosition | null = null;
      let bestDist = 40; // max snap distance

      for (const item of items) {
        if (item.type === 'arrow' || item.id === arrow.id) continue;
        for (const anchor of ['top', 'right', 'bottom', 'left'] as AnchorPosition[]) {
          const coords = getAnchorCoords(item, anchor);
          const dist = Math.sqrt((worldX - coords.x) ** 2 + (worldY - coords.y) ** 2);
          if (dist < bestDist) {
            bestDist = dist;
            hitItem = item;
            hitAnchor = anchor;
          }
        }
      }

      if (hitItem && hitAnchor) {
        if (endpoint === 'start') {
          updateItemFields(arrow.id, { fromId: hitItem.id, fromAnchor: hitAnchor });
        } else {
          updateItemFields(arrow.id, { toId: hitItem.id, toAnchor: hitAnchor });
        }
      } else {
        // Detach
        if (endpoint === 'start') {
          updateItemFields(arrow.id, { fromId: undefined, fromAnchor: undefined, startX: worldX, startY: worldY });
        } else {
          updateItemFields(arrow.id, { toId: undefined, toAnchor: undefined, endX: worldX, endY: worldY });
        }
      }

      // Reset circle position since item fields control the position
      e.target.position({ x: endpoint === 'start' ? sx : ex, y: endpoint === 'start' ? sy : ey });
    };
  }, [arrow, items, updateItemFields, sx, sy, ex, ey]);

  return (
    <Group
      id={`node_${arrow.id}`}
      onClick={handleClick}
    >
      {/* Invisible thicker hit line for easier click selection */}
      <KonvaLine
        points={points}
        stroke="transparent"
        strokeWidth={20}
        tension={tension}
        listening={true}
      />

      {/* Visible connector line with arrowhead */}
      <KonvaLine
        points={points}
        stroke={color}
        strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
        pointerLength={arrowhead === 'none' ? 0 : 12}
        pointerWidth={arrowhead === 'none' ? 0 : 10}
        tension={tension}
        dash={dash}
        listening={false}
      />

      {/* Draggable endpoint indicators when selected */}
      {isSelected && (
        <>
          <KonvaCircle
            x={sx} y={sy} radius={8}
            fill={fromExists ? '#22c55e' : '#ef4444'}
            stroke="#ffffff" strokeWidth={2}
            draggable
            onDragEnd={handleEndpointDrag('start')}
            onMouseEnter={(e: any) => { e.target.scale({ x: 1.3, y: 1.3 }); e.target.getLayer()?.batchDraw(); }}
            onMouseLeave={(e: any) => { e.target.scale({ x: 1, y: 1 }); e.target.getLayer()?.batchDraw(); }}
          />
          <KonvaCircle
            x={ex} y={ey} radius={8}
            fill={toExists ? '#22c55e' : '#ef4444'}
            stroke="#ffffff" strokeWidth={2}
            draggable
            onDragEnd={handleEndpointDrag('end')}
            onMouseEnter={(e: any) => { e.target.scale({ x: 1.3, y: 1.3 }); e.target.getLayer()?.batchDraw(); }}
            onMouseLeave={(e: any) => { e.target.scale({ x: 1, y: 1 }); e.target.getLayer()?.batchDraw(); }}
          />
        </>
      )}
    </Group>
  );
}

export default React.memo(ConnectorObject);
