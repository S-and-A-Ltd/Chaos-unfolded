'use client';

import dynamic from 'next/dynamic';
import { StudyDocument } from '@/types';
import { CanvasItem as StoreCanvasItem } from '@/stores/useCanvasStore';

export type CanvasItem = StoreCanvasItem;

interface StudyCanvasProps {
  document: StudyDocument;
  onClose: () => void;
}

const KonvaWhiteboard = dynamic(() => import('@/components/study/KonvaWhiteboard'), {
  ssr: false,
});

export default function StudyCanvas({ document, onClose }: StudyCanvasProps) {
  return <KonvaWhiteboard document={document} onClose={onClose} />;
}
