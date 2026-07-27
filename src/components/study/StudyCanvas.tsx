'use client';

import dynamic from 'next/dynamic';
import { StudyDocument } from '@/types';
import { CanvasItem as KonvaCanvasItem } from '@/components/study/KonvaWhiteboard';

export type CanvasItem = KonvaCanvasItem;

interface StudyCanvasProps {
  document: StudyDocument;
  onClose: () => void;
}

const KonvaWhiteboard = dynamic(() => import('@/components/study/KonvaWhiteboard'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[999999] bg-[#0f0e17]/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-white font-sans select-none">
      <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
      <div className="text-lg font-black tracking-wide text-purple-300">Loading GPU Whiteboard Engine...</div>
      <p className="text-xs text-white/60 mt-1">Initializing React Konva canvas & stationery templates</p>
    </div>
  ),
});

export default function StudyCanvas({ document, onClose }: StudyCanvasProps) {
  return <KonvaWhiteboard document={document} onClose={onClose} />;
}
