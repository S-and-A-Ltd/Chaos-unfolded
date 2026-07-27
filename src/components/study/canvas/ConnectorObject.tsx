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
  const deleteItem = useCanvasStore(state => state.deleteItem);

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
        strokeWidth={isSelected ? 4 : 3}
        pointerLength={12}
        pointerWidth={10}
        tension={tension}
        listening={false}
      />

      {/* Endpoint indicators when selected */}
      {isSelected && (
        <>
          <KonvaCircle
            x={sx} y={sy} radius={6}
            fill={fromExists ? '#22c55e' : '#ef4444'}
            stroke="#ffffff" strokeWidth={2}
          />
          <KonvaCircle
            x={ex} y={ey} radius={6}
            fill={toExists ? '#22c55e' : '#ef4444'}
            stroke="#ffffff" strokeWidth={2}
          />
        </>
      )}
    </Group>
  );
}

export default React.memo(ConnectorObject);
