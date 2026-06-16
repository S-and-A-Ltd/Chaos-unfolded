'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Card from '@/components/ui/Card';

interface DocumentUploaderProps {
  onUpload: (file: File) => void;
  onStartSelecting?: () => void;
}

const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'text/plain': 'TXT',
};

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export default function DocumentUploader({ onUpload, onStartSelecting }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isAcceptedExt = ext && ['pdf', 'docx', 'txt'].includes(ext);
    const isAcceptedMime = Object.keys(ACCEPTED_TYPES).includes(file.type);
    
    if (!isAcceptedExt && !isAcceptedMime) {
      return 'Unsupported file type. Please upload PDF, DOCX, or TXT files.';
    }
    if (file.size > MAX_SIZE) {
      return 'File too large. Maximum size is 20MB.';
    }
    return null;
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setIsUploading(true);
      setUploadProgress(0);

      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 95) {
            clearInterval(interval);
            return prev;
          }
          return prev + Math.random() * 20;
        });
      }, 200);

      // Simulate processing delay
      await new Promise((r) => setTimeout(r, 1200));

      clearInterval(interval);
      setUploadProgress(100);

      setTimeout(() => {
        onUpload(file);
        setIsUploading(false);
        setUploadProgress(0);
      }, 400);
    },
    [onUpload, validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <Card padding="none" bgVariant="mint" className="overflow-hidden shadow-[0_6px_0_#7c6a75]">
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          onStartSelecting?.();
          inputRef.current?.click();
        }}
        animate={isDragging ? { scale: 1.01 } : { scale: 1 }}
        className={`
          relative p-10 border-3 border-dashed rounded-2xl
          cursor-pointer transition-all duration-300 text-center
          ${
            isDragging
              ? 'border-[#7181c8] bg-[#7181c8]/10'
              : 'border-transparent hover:bg-white/40'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleInputChange}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {isUploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              {/* Spinning loader */}
              <div className="relative w-12 h-12">
                <svg className="animate-spin w-12 h-12" viewBox="0 0 48 48">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="rgba(113,129,200,0.1)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="#7181c8"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="80 45"
                  />
                </svg>
              </div>
              <p className="text-sm text-[#5d5770]/80 font-semibold">Processing document…</p>

              {/* Progress bar */}
              <div className="w-48 h-1.5 rounded-full bg-[#ababdc]/20 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light"
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#ababdc]/10 border border-[#ababdc]/30 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7181c8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#5d5770]">
                  Drop study materials here
                </p>
                <p className="text-xs text-[#5d5770]/60 mt-1">
                  PDF, DOCX, or TXT • Max 20MB
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-red-500 mt-3 font-semibold"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </Card>
  );
}
