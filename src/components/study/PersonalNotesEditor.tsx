'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';

interface PersonalNotesEditorProps {
  documentId: string;
  documentName: string;
  onUpdateNotes: (notesHtml: string) => void;
  isLarge?: boolean;
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', color: '#fef08a', label: '🟨' },
  { name: 'Amber', color: '#fed7aa', label: '🟧' },
  { name: 'Pink', color: '#fbcfe8', label: '🩷' },
  { name: 'Green', color: '#bbf7d0', label: '🟩' },
  { name: 'Blue', color: '#bfdbfe', label: '🟦' },
  { name: 'Purple', color: '#e9d5ff', label: '🪻' },
];

export default function PersonalNotesEditor({
  documentId,
  documentName,
  onUpdateNotes,
  isLarge = false,
}: PersonalNotesEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor Stats & Status
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [lastEdited, setLastEdited] = useState<string>('Just now');
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHeadingPicker, setShowHeadingPicker] = useState(false);

  // Image resize selection state
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);

  // 1. Load initial content from storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && editorRef.current) {
      const savedHtml = localStorage.getItem(`dazai_notes_${documentId}`) || '';
      const savedTime = localStorage.getItem(`dazai_notes_timestamp_${documentId}`) || 'Not saved yet';
      
      // If saved content is plain text from before, wrap in paragraphs
      if (savedHtml && !savedHtml.includes('<') && !savedHtml.includes('>')) {
        editorRef.current.innerHTML = `<p>${savedHtml.replace(/\n/g, '<br/>')}</p>`;
      } else if (savedHtml) {
        editorRef.current.innerHTML = savedHtml;
      } else {
        editorRef.current.innerHTML = `<p className="text-gray-400">Start typing your personal notes, formulas, or drag & drop screenshots here...</p>`;
      }

      setLastEdited(savedTime);
      updateStatsOnly();
    }
  }, [documentId]);

  // Helper to update words and chars without triggering save loop
  const updateStatsOnly = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const chars = text.replace(/\s/g, '').length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setCharCount(chars);
    setWordCount(words);
  };

  // 2. Save and notify parent
  const updateStatsAndSave = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const text = editorRef.current.innerText || '';

    const chars = text.replace(/\s/g, '').length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setCharCount(chars);
    setWordCount(words);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`dazai_notes_${documentId}`, html);
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      localStorage.setItem(`dazai_notes_timestamp_${documentId}`, now);
      setLastEdited(now);
    }
    onUpdateNotes(html);
  }, [documentId, onUpdateNotes]);

  // 3. Formatting Command Executors
  const execCmd = (command: string, value: string | undefined = undefined) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateStatsAndSave();
  };

  const applyHighlight = (hexColor: string | null) => {
    editorRef.current?.focus();
    if (!hexColor) {
      document.execCommand('removeFormat', false, undefined);
    } else {
      // HiliteColor works across browsers for background highlight
      document.execCommand('hiliteColor', false, hexColor);
      document.execCommand('backColor', false, hexColor);
    }
    setShowColorPicker(false);
    updateStatsAndSave();
  };

  const insertHeading = (tag: 'h1' | 'h2' | 'h3' | 'p') => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, `<${tag}>`);
    setShowHeadingPicker(false);
    updateStatsAndSave();
  };

  const insertChecklist = () => {
    editorRef.current?.focus();
    const id = `chk_${Date.now()}`;
    const html = `<div class="dazai-checklist-item my-1.5 flex items-center gap-2.5" style="display: flex; align-items: center; gap: 10px;"><input type="checkbox" id="${id}" style="width: 16px; height: 16px; accent-color: #8b5cf6; cursor: pointer;" onchange="this.setAttribute('checked', this.checked ? 'true' : 'false');" /><span style="flex: 1; outline: none; border-bottom: 1px dashed rgba(124, 106, 117, 0.3);">New checklist task...</span></div><p><br/></p>`;
    document.execCommand('insertHTML', false, html);
    updateStatsAndSave();
  };

  const insertLink = () => {
    const url = window.prompt('Enter link URL:', 'https://');
    if (url) {
      execCmd('createLink', url);
    }
  };

  // 4. Image Insertion (File Picker, Paste Screenshot, Drag & Drop)
  const insertImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        editorRef.current?.focus();
        const imgHtml = `<div class="dazai-img-wrapper my-3 p-2.5 bg-white/80 dark:bg-black/30 border-2 border-[#7c6a75]/20 rounded-xl max-w-fit mx-auto shadow-md" contenteditable="false" style="margin: 14px auto; padding: 10px; border: 2px solid rgba(124, 106, 117, 0.2); border-radius: 12px; background: rgba(255,255,255,0.8);"><img src="${dataUrl}" style="width: 350px; max-width: 100%; height: auto; border-radius: 8px; cursor: pointer; display: block; margin: 0 auto;" class="dazai-note-img block mx-auto" /><div contenteditable="true" class="text-center text-xs text-[#5d5770] dark:text-gray-300 mt-2 p-1 border-b border-dashed border-[#7c6a75]/30 focus:border-[#7c6a75] outline-none min-w-[180px] italic" style="text-align: center; font-size: 12px; margin-top: 8px; font-style: italic;">Caption: Add image description here...</div></div><p><br/></p>`;
        document.execCommand('insertHTML', false, imgHtml);
        updateStatsAndSave();
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) insertImageFile(file);
          return;
        }
      }
    }
    setTimeout(updateStatsAndSave, 50);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          e.preventDefault();
          insertImageFile(files[i]);
          return;
        }
      }
    }
  };

  // 5. Click handler for image resizing and checklist strikethroughs
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      if (target.checked) {
        target.setAttribute('checked', 'true');
        target.nextElementSibling?.classList.add('line-through', 'opacity-50');
      } else {
        target.removeAttribute('checked');
        target.nextElementSibling?.classList.remove('line-through', 'opacity-50');
      }
      updateStatsAndSave();
    } else if (target instanceof HTMLImageElement) {
      setSelectedImg(target);
    } else {
      if (selectedImg) setSelectedImg(null);
    }
  };

  // Image Resizing & Deletion
  const resizeSelectedImage = (newWidth: string) => {
    if (selectedImg) {
      selectedImg.style.width = newWidth;
      updateStatsAndSave();
    }
  };

  const deleteSelectedImage = () => {
    if (selectedImg) {
      const wrapper = selectedImg.closest('.dazai-img-wrapper');
      if (wrapper) {
        wrapper.remove();
      } else {
        selectedImg.remove();
      }
      setSelectedImg(null);
      updateStatsAndSave();
    }
  };

  // 6. Keyboard Shortcuts (Ctrl+B, Ctrl+I, Ctrl+Z, Ctrl+Y, Ctrl+U)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      execCmd('bold');
    } else if (isCtrl && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      execCmd('italic');
    } else if (isCtrl && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      execCmd('underline');
    } else if (isCtrl && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        execCmd('redo');
      } else {
        execCmd('undo');
      }
    } else if (isCtrl && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      execCmd('redo');
    }
  };

  // Render Toolbar Button
  const ToolBtn = ({
    onClick,
    title,
    children,
    active = false,
  }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    active?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-xs font-bold transition-all border ${
        active
          ? 'bg-[#7c6a75] text-white border-[#7c6a75] shadow-sm'
          : 'bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 text-[#5d5770] dark:text-gray-200 border-[#7c6a75]/20'
      }`}
    >
      {children}
    </button>
  );

  const renderEditorUI = (fullscreen: boolean) => {
    const toolbarSize = fullscreen || isLarge ? 'text-xs md:text-sm py-1.5 px-2.5' : 'text-[11px] py-1 px-1.5';
    const editorSize = fullscreen || isLarge ? 'text-sm md:text-base leading-relaxed p-6' : 'text-xs leading-relaxed p-4';

    return (
      <div className="flex flex-col h-full bg-white/50 dark:bg-[#1a1823]/60 border-2 border-[#7c6a75]/20 rounded-xl overflow-hidden shadow-sm relative">
        
        {/* --- EDITING TOOLBAR --- */}
        <div className="bg-[#7c6a75]/10 dark:bg-black/30 border-b border-[#7c6a75]/20 p-1.5 flex flex-wrap items-center gap-1">
          
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 border-r border-[#7c6a75]/20 pr-1">
            <ToolBtn onClick={() => execCmd('undo')} title="Undo (Ctrl+Z)">↩</ToolBtn>
            <ToolBtn onClick={() => execCmd('redo')} title="Redo (Ctrl+Y)">↪</ToolBtn>
          </div>

          {/* Bold, Italic, Underline */}
          <div className="flex items-center gap-0.5 border-r border-[#7c6a75]/20 pr-1">
            <ToolBtn onClick={() => execCmd('bold')} title="Bold (Ctrl+B)"><b>B</b></ToolBtn>
            <ToolBtn onClick={() => execCmd('italic')} title="Italic (Ctrl+I)"><i>I</i></ToolBtn>
            <ToolBtn onClick={() => execCmd('underline')} title="Underline (Ctrl+U)"><u>U</u></ToolBtn>
          </div>

          {/* Headings Picker */}
          <div className="relative border-r border-[#7c6a75]/20 pr-1">
            <ToolBtn onClick={() => setShowHeadingPicker(!showHeadingPicker)} title="Headings & Typography">
              <span>H▾</span>
            </ToolBtn>
            {showHeadingPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-lg shadow-xl p-1 z-[60] flex flex-col min-w-[110px]">
                <button onClick={() => insertHeading('h1')} className="text-left font-black text-sm px-2 py-1 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded">H1 Title</button>
                <button onClick={() => insertHeading('h2')} className="text-left font-bold text-xs px-2 py-1 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded">H2 Section</button>
                <button onClick={() => insertHeading('h3')} className="text-left font-semibold text-[11px] px-2 py-1 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded">H3 Subtitle</button>
                <button onClick={() => insertHeading('p')} className="text-left text-xs px-2 py-1 hover:bg-[#7c6a75]/10 dark:hover:bg-white/10 rounded">Paragraph</button>
              </div>
            )}
          </div>

          {/* Highlight Color Palette */}
          <div className="relative border-r border-[#7c6a75]/20 pr-1">
            <ToolBtn onClick={() => setShowColorPicker(!showColorPicker)} title="Highlight text color">
              <span>🖍️▾</span>
            </ToolBtn>
            {showColorPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-lg shadow-xl p-1.5 z-[60] grid grid-cols-3 gap-1 w-[120px]">
                {HIGHLIGHT_COLORS.map((col) => (
                  <button
                    key={col.name}
                    onClick={() => applyHighlight(col.color)}
                    title={`Highlight ${col.name}`}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-sm shadow-sm hover:scale-110 transition-transform"
                    style={{ backgroundColor: col.color }}
                  >
                    {col.label}
                  </button>
                ))}
                <button
                  onClick={() => applyHighlight(null)}
                  title="Remove Highlight"
                  className="col-span-3 text-[10px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 py-1 rounded font-bold text-center mt-1"
                >
                  ✕ Clear Color
                </button>
              </div>
            )}
          </div>

          {/* Lists & Checklists */}
          <div className="flex items-center gap-0.5 border-r border-[#7c6a75]/20 pr-1">
            <ToolBtn onClick={() => execCmd('insertUnorderedList')} title="Bullet List">• List</ToolBtn>
            <ToolBtn onClick={() => execCmd('insertOrderedList')} title="Numbered List">1. List</ToolBtn>
            <ToolBtn onClick={insertChecklist} title="Insert Interactive Checklist">☑ Check</ToolBtn>
          </div>

          {/* Divider, Link, Image */}
          <div className="flex items-center gap-0.5">
            <ToolBtn onClick={() => execCmd('insertHorizontalRule')} title="Horizontal Divider">—</ToolBtn>
            <ToolBtn onClick={insertLink} title="Insert Hyperlink">🔗</ToolBtn>
            <ToolBtn onClick={() => fileInputRef.current?.click()} title="Insert Image / Screenshot">🖼️ Img</ToolBtn>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  insertImageFile(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* Maximize / Minimize Fullscreen Button */}
          <div className="ml-auto">
            <button
              onClick={() => setIsEditorFullscreen(!isEditorFullscreen)}
              title={isEditorFullscreen ? 'Exit Editor Fullscreen' : 'Maximize Editor Workspace'}
              className="bg-[#7c6a75] hover:bg-[#6b5b65] text-white p-1 px-2 rounded-md shadow-sm text-xs font-bold transition-transform hover:scale-105 flex items-center gap-1"
            >
              <span>{isEditorFullscreen ? '↙ Exit' : '⛶ Expand'}</span>
            </button>
          </div>

        </div>

        {/* --- IMAGE RESIZE CONTROLS (Floating when image clicked) --- */}
        {selectedImg && (
          <div className="bg-amber-100 dark:bg-amber-950/80 border-b-2 border-amber-400 px-3 py-1.5 flex items-center justify-between gap-2 text-xs font-bold text-amber-900 dark:text-amber-200 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span>🖼️ Image Size:</span>
              <button onClick={() => resizeSelectedImage('200px')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">Small</button>
              <button onClick={() => resizeSelectedImage('400px')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">Medium</button>
              <button onClick={() => resizeSelectedImage('650px')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">Large</button>
              <button onClick={() => resizeSelectedImage('100%')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">Full</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={deleteSelectedImage} className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-0.5 rounded shadow-sm">🗑️ Delete Image</button>
              <button onClick={() => setSelectedImg(null)} className="text-gray-500 hover:text-gray-800 font-bold px-1">✕</button>
            </div>
          </div>
        )}

        {/* --- EDITABLE AREA --- */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={updateStatsAndSave}
          onKeyUp={updateStatsAndSave}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={handleEditorClick}
          className={`flex-1 overflow-y-auto ${editorSize} text-[#5d5770] dark:text-gray-200 focus:outline-none custom-scrollbar font-sans`}
          style={{ minHeight: fullscreen ? '70vh' : '220px' }}
        />

        {/* --- FOOTER STATUS & AUTO-SAVE BAR --- */}
        <div className="bg-[#7c6a75]/10 dark:bg-black/30 border-t border-[#7c6a75]/20 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5d5770]/80 dark:text-gray-400 font-medium">
          <div className="flex items-center gap-3">
            <span>📝 <strong>{wordCount}</strong> words</span>
            <span>🔤 <strong>{charCount}</strong> chars</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Auto-saved at {lastEdited}
            </span>
            <Button
              variant="ghost"
              onClick={updateStatsAndSave}
              className="text-[10px] py-0.5 px-2 font-bold hover:bg-white/50"
            >
              💾 Save Now
            </Button>
          </div>
        </div>

      </div>
    );
  };

  return (
    <>
      {/* NORMAL INLINE EDITOR */}
      <div className="flex flex-col h-full w-full">
        {renderEditorUI(false)}
      </div>

      {/* FULLSCREEN EDITOR MODAL OVERLAY */}
      <AnimatePresence>
        {isEditorFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] bg-black/75 backdrop-blur-2xl flex items-center justify-center p-3 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#faf8fc] dark:bg-[#1a1823] border-4 border-[#7c6a75] dark:border-[#a78bfa] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden relative"
            >
              {/* Fullscreen Header */}
              <div className="bg-[#7c6a75] dark:bg-[#342e48] text-white px-6 py-3 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📝</span>
                  <div>
                    <h2 className="font-black text-base md:text-lg tracking-wide">{documentName} - Rich Text Personal Notes</h2>
                    <p className="text-[11px] text-white/80">Formatting toolbar, checklists, drag-and-drop screenshot captions, and live word counts</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsEditorFullscreen(false)}
                  className="bg-white/20 hover:bg-white/30 text-white font-black px-4 py-1.5 rounded-xl transition-all flex items-center gap-2 border border-white/20 shadow-sm"
                >
                  <span>✕ Exit Fullscreen</span>
                </button>
              </div>

              {/* Editor in Fullscreen */}
              <div className="flex-1 overflow-hidden p-4 md:p-6 bg-white/40 dark:bg-black/20">
                {renderEditorUI(true)}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
