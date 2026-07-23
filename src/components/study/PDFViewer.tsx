'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import Button from '@/components/ui/Button';

// Setup pdf worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PDFViewerProps {
  file: Blob | File | string;
}

export default function PDFViewer({ file }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Update container width for "fit width" logic
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }
    const handleResize = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.clientWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const newPage = prevPageNumber + offset;
      return Math.min(Math.max(1, newPage), numPages);
    });
  };

  const handleZoom = (amount: number) => {
    setScale(prev => Math.min(Math.max(0.5, prev + amount), 3.0));
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f2ee] rounded-2xl overflow-hidden border-3 border-[#7c6a75] shadow-inner">
      {/* PDF Controls Toolbar */}
      <div className="flex items-center justify-between p-2 bg-[#7c6a75] text-[#f4f2ee]">
        <div className="flex gap-2 items-center">
          <Button variant="secondary" onClick={() => changePage(-1)} disabled={pageNumber <= 1} className="px-2 py-1 text-xs bg-white text-[#7c6a75]">
            ◀ Prev
          </Button>
          <span className="text-xs font-bold mx-2">
            Page {pageNumber} of {numPages || '--'}
          </span>
          <Button variant="secondary" onClick={() => changePage(1)} disabled={pageNumber >= numPages} className="px-2 py-1 text-xs bg-white text-[#7c6a75]">
            Next ▶
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => handleZoom(-0.2)} className="px-2 py-1 text-xs bg-white text-[#7c6a75]">
            -
          </Button>
          <span className="text-xs font-bold flex items-center">{Math.round(scale * 100)}%</span>
          <Button variant="secondary" onClick={() => handleZoom(0.2)} className="px-2 py-1 text-xs bg-white text-[#7c6a75]">
            +
          </Button>
          <Button variant="secondary" onClick={() => setScale(containerWidth / 600)} className="px-2 py-1 text-xs bg-white text-[#7c6a75]">
            Fit Width
          </Button>
        </div>
      </div>

      {/* PDF Document Render Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center p-4 bg-black/10 relative"
      >
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="text-[#7c6a75] font-bold mt-10">Loading PDF...</div>}
          error={<div className="text-red-500 font-bold mt-10">Failed to load PDF.</div>}
          className="shadow-2xl"
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale} 
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="rounded"
          />
        </Document>
      </div>
    </div>
  );
}
