'use client';

import React from 'react';
import { Group, Line as KonvaLine, Circle as KonvaCircle } from 'react-konva';
import { CanvasItem, getAnchorCoords, useCanvasStore } from '@/stores/useCanvasStore';

interface ConnectorObjectProps {
  arrow: CanvasItem;
  isSelected: boolean;
}

export default function ConnectorObject({ arrow, isSelected }: ConnectorObjectProps) {
  const { items, setSelectedId } = useCanvasStore();

  let sx = arrow.startX ?? (arrow.x + 10);
  let sy = arrow.startY ?? (arrow.y + 25);
  let ex = arrow.endX ?? (arrow.x + arrow.width - 10);
  let ey = arrow.endY ?? (arrow.y + 25);

  // Automatically track connected object anchor handles
  if (arrow.fromId) {
    const fromItem = items.find(i => i.id === arrow.fromId);
    if (fromItem && arrow.fromAnchor) {
      const c = getAnchorCoords(fromItem, arrow.fromAnchor);
      sx = c.x; sy = c.y;
    }
  }
  if (arrow.toId) {
    const toItem = items.find(i => i.id === arrow.toId);
    if (toItem && arrow.toAnchor) {
      const c = getAnchorCoords(toItem, arrow.toAnchor);
      ex = c.x; ey = c.y;
    }
  }

  const color = isSelected ? '#ec4899' : arrow.color || '#8b5cf6';
  const style = arrow.connectorStyle || 'orthogonal';

  let points: number[] = [];
  let tension = 0;

  if (style === 'straight') {
    points = [sx, sy, ex, ey];
    tension = 0;
  } else if (style === 'curved') {
    const midX = (sx + ex) / 2;
    const midY = (sy + ey) / 2 - 30; // Curve arch
    points = [sx, sy, midX, midY, ex, ey];
    tension = 0.35;
  } else {
    // Orthogonal 90-degree flowchart elbow
    const midX = (sx + ex) / 2;
    points = [sx, sy, midX, sy, midX, ey, ex, ey];
    tension = 0;
  }

  return (
    <Group
      id={`node_${arrow.id}`}
      onClick={(e: any) => {
        e.cancelBubble = true;
        setSelectedId(arrow.id);
      }}
    >
      {/* Invisible thicker hit line for easier selection */}
      <KonvaLine
        points={points}
        stroke="transparent"
        strokeWidth={20}
        tension={tension}
      />
      
      {/* Visible connector line */}
      <KonvaLine
        points={points}
        stroke={color}
        strokeWidth={isSelected ? 4 : 3}
        dash={arrow.shapeType === 'line' ? [6, 6] : undefined}
        pointerLength={10}
        pointerWidth={10}
        tension={tension}
      />

      {/* Endpoint indicators when selected */}
      {isSelected && (
        <>
          <KonvaCircle x={sx} y={sy} radius={5} fill="#ffffff" stroke={color} strokeWidth={2} />
          <KonvaCircle x={ex} y={ey} radius={5} fill="#ffffff" stroke={color} strokeWidth={2} />
        </>
      )}
    </Group>
  );
}
