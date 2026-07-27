'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { StudyDocument } from '@/types';
import StudyCanvas from './StudyCanvas';

interface PersonalNotesEditorProps {
  documentId: string;
  documentName: string;
  document?: StudyDocument;
  onUpdateNotes: (notesHtml: string) => void;
  isLarge?: boolean;
}

// 35-45% opacity rgba highlights for readability similar to MS Word/OneNote
const HIGHLIGHT_COLORS = [
  { name: 'Yellow', color: 'rgba(254, 240, 138, 0.45)', label: '🟨' },
  { name: 'Amber', color: 'rgba(254, 215, 170, 0.45)', label: '🟧' },
  { name: 'Pink', color: 'rgba(251, 207, 232, 0.45)', label: '🩷' },
  { name: 'Green', color: 'rgba(187, 247, 208, 0.45)', label: '🟩' },
  { name: 'Blue', color: 'rgba(191, 219, 254, 0.45)', label: '🟦' },
  { name: 'Purple', color: 'rgba(233, 213, 255, 0.45)', label: '🪻' },
];

const TEXT_COLORS = [
  { name: 'Black', color: '#000000', label: '⚫' },
  { name: 'Dark Purple', color: '#4c1d95', label: '💜' },
  { name: 'Dark Teal', color: '#0f766e', label: '🩵' },
  { name: 'Amber Brown', color: '#9a3412', label: '🧡' },
  { name: 'Crimson Red', color: '#b91c1c', label: '❤️' },
  { name: 'Navy Blue', color: '#1e3a8a', label: '💙' },
  { name: 'Slate Gray', color: '#4b5563', label: '🩶' },
  { name: 'Pure White', color: '#ffffff', label: '⚪' },
];

const FONT_FAMILIES = [
  { name: 'Default Sans', value: 'Inter, system-ui, sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Georgia Serif', value: 'Georgia, serif' },
  { name: 'Courier Mono', value: '"Courier New", Courier, monospace' },
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { name: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
];

const FONT_SIZES = [
  { name: 'Small (10pt)', value: '1' },
  { name: 'Normal (12pt)', value: '3' },
  { name: 'Medium (14pt)', value: '4' },
  { name: 'Large (18pt)', value: '5' },
  { name: 'Huge (24pt)', value: '6' },
];

export default function PersonalNotesEditor({
  documentId,
  documentName,
  document,
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
  const [showCanvas, setShowCanvas] = useState(false);

  // Compact Toolbar Dropdowns
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHeadingPicker, setShowHeadingPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [showAlignPicker, setShowAlignPicker] = useState(false);

  // Find & Replace State (Ctrl+H)
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  // Image resize & reposition selection state
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);

  // 1. Load initial content from storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && editorRef.current) {
      const savedHtml = localStorage.getItem(`dazai_notes_${documentId}`) || '';
      const savedTime = localStorage.getItem(`dazai_notes_timestamp_${documentId}`) || 'Not saved yet';
      
      if (savedHtml && !savedHtml.includes('<') && !savedHtml.includes('>')) {
        editorRef.current.innerHTML = `<p>${savedHtml.replace(/\n/g, '<br/>')}</p>`;
      } else if (savedHtml) {
        editorRef.current.innerHTML = savedHtml;
      } else {
        editorRef.current.innerHTML = `<p class="text-gray-400">Start typing your personal study notes, formulas, or drag & drop screenshots here...</p>`;
      }

      setLastEdited(savedTime);
      updateStatsOnly();
    }
  }, [documentId]);

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

  const applyHighlight = (rgbaColor: string | null) => {
    editorRef.current?.focus();
    if (!rgbaColor) {
      document.execCommand('removeFormat', false, undefined);
    } else {
      document.execCommand('hiliteColor', false, rgbaColor);
      document.execCommand('backColor', false, rgbaColor);
    }
    setShowColorPicker(false);
    updateStatsAndSave();
  };

  const applyTextColor = (hexColor: string) => {
    editorRef.current?.focus();
    document.execCommand('foreColor', false, hexColor);
    setShowTextColorPicker(false);
    updateStatsAndSave();
  };

  const applyFontFamily = (fontName: string) => {
    editorRef.current?.focus();
    document.execCommand('fontName', false, fontName);
    setShowFontPicker(false);
    updateStatsAndSave();
  };

  const applyFontSize = (sizeVal: string) => {
    editorRef.current?.focus();
    document.execCommand('fontSize', false, sizeVal);
    setShowSizePicker(false);
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

  // 4. Find & Replace Handlers (Ctrl+H)
  const handleFindNext = () => {
    if (findQuery) {
      window.find(findQuery, false, false, true);
    }
  };

  const handleReplace = () => {
    if (findQuery && window.getSelection()?.toString().toLowerCase() === findQuery.toLowerCase()) {
      document.execCommand('insertText', false, replaceQuery);
      updateStatsAndSave();
    } else if (findQuery) {
      if (window.find(findQuery, false, false, true)) {
        document.execCommand('insertText', false, replaceQuery);
        updateStatsAndSave();
      }
    }
  };

  const handleReplaceAll = () => {
    if (findQuery && editorRef.current) {
      let count = 0;
      // Start from top of document
      const sel = window.getSelection();
      sel?.removeAllRanges();
      while (window.find(findQuery, false, false, true)) {
        document.execCommand('insertText', false, replaceQuery);
        count++;
        if (count > 500) break; // prevent infinite loop
      }
      updateStatsAndSave();
    }
  };

  // 5. Image Insertion (Draggable, repositionable, resize support, aspect ratio, alignment, captions)
  const insertImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        editorRef.current?.focus();
        const imgHtml = `<div class="dazai-img-wrapper my-3 p-2.5 bg-white/85 dark:bg-black/30 border-2 border-[#7c6a75]/30 rounded-2xl max-w-fit mx-auto shadow-md transition-all cursor-move" contenteditable="false" draggable="true" style="margin: 14px auto; padding: 12px; border: 2px solid rgba(124, 106, 117, 0.25); border-radius: 16px; background: rgba(255,255,255,0.9); display: block; float: none;"><img src="${dataUrl}" style="width: 350px; max-width: 100%; height: auto; border-radius: 10px; cursor: pointer; display: block; margin: 0 auto;" class="dazai-note-img block mx-auto" /><div contenteditable="true" class="text-center text-xs text-[#5d5770] dark:text-gray-300 mt-2 p-1 border-b border-dashed border-[#7c6a75]/30 focus:border-[#7c6a75] outline-none min-w-[180px] italic" style="text-align: center; font-size: 12px; margin-top: 8px; font-style: italic;">Caption: Add image description here...</div></div><p><br/></p>`;
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

  // 6. Click handler for image resizing/alignment and checklist strikethroughs
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

  // Image Resizing & Repositioning / Alignment
  const resizeSelectedImage = (newWidth: string) => {
    if (selectedImg) {
      selectedImg.style.width = newWidth;
      selectedImg.style.height = 'auto'; // keep aspect ratio
      updateStatsAndSave();
    }
  };

  const alignSelectedImage = (alignment: 'left' | 'center' | 'right') => {
    if (selectedImg) {
      const wrapper = (selectedImg.closest('.dazai-img-wrapper') as HTMLElement) || selectedImg;
      if (alignment === 'center') {
        wrapper.style.margin = '14px auto';
        wrapper.style.float = 'none';
        wrapper.style.display = 'block';
      } else if (alignment === 'left') {
        wrapper.style.margin = '0 16px 14px 0';
        wrapper.style.float = 'left';
        wrapper.style.display = 'inline-block';
      } else if (alignment === 'right') {
        wrapper.style.margin = '0 0 14px 16px';
        wrapper.style.float = 'right';
        wrapper.style.display = 'inline-block';
      }
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

  // 7. Keyboard Shortcuts & List Fixes (Tab / Shift+Tab for nesting, Enter on empty item exits list)
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
    } else if (isCtrl && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      setShowFindReplace(!showFindReplace);
    } else if (e.key === 'Tab') {
      // Nested list support: Tab indents, Shift+Tab outdents inside li
      const sel = window.getSelection();
      let node = sel?.anchorNode;
      while (node && node !== editorRef.current) {
        if (node.nodeName.toLowerCase() === 'li' || node.nodeName.toLowerCase() === 'ul' || node.nodeName.toLowerCase() === 'ol') {
          e.preventDefault();
          if (e.shiftKey) {
            execCmd('outdent');
          } else {
            execCmd('indent');
          }
          return;
        }
        node = node.parentNode;
      }
    } else if (e.key === 'Enter') {
      // Exit list on double Enter / empty item
      const sel = window.getSelection();
      let node = sel?.anchorNode;
      if (node && (node.nodeName.toLowerCase() === 'li' || node.parentElement?.nodeName.toLowerCase() === 'li')) {
        const li = (node.nodeName.toLowerCase() === 'li' ? node : node.parentElement) as HTMLElement;
        if (!li.innerText.trim() && li.innerText !== '\n') {
          e.preventDefault();
          execCmd('outdent');
        }
      }
    }
  };

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

          {/* Font Family & Size */}
          <div className="relative border-r border-[#7c6a75]/20 pr-1 flex items-center gap-0.5">
            <ToolBtn onClick={() => setShowFontPicker(!showFontPicker)} title="Font Family">
              <span>Font ▾</span>
            </ToolBtn>
            {showFontPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-xl shadow-2xl p-1 z-[60] flex flex-col min-w-[140px] text-xs">
                {FONT_FAMILIES.map((f) => (
                  <button key={f.name} onClick={() => applyFontFamily(f.value)} className="text-left px-2.5 py-1.5 hover:bg-[#7c6a75]/10 rounded font-medium truncate" style={{ fontFamily: f.value }}>
                    {f.name}
                  </button>
                ))}
              </div>
            )}

            <ToolBtn onClick={() => setShowSizePicker(!showSizePicker)} title="Font Size">
              <span>Size ▾</span>
            </ToolBtn>
            {showSizePicker && (
              <div className="absolute left-10 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-xl shadow-2xl p-1 z-[60] flex flex-col min-w-[120px] text-xs">
                {FONT_SIZES.map((s) => (
                  <button key={s.name} onClick={() => applyFontSize(s.value)} className="text-left px-2.5 py-1.5 hover:bg-[#7c6a75]/10 rounded font-bold">
                    {s.name}
                  </button>
                ))}
              </div>
            )}
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
                <button onClick={() => insertHeading('h1')} className="text-left font-black text-sm px-2 py-1 hover:bg-[#7c6a75]/10 rounded">H1 Title</button>
                <button onClick={() => insertHeading('h2')} className="text-left font-bold text-xs px-2 py-1 hover:bg-[#7c6a75]/10 rounded">H2 Section</button>
                <button onClick={() => insertHeading('h3')} className="text-left font-semibold text-[11px] px-2 py-1 hover:bg-[#7c6a75]/10 rounded">H3 Subtitle</button>
                <button onClick={() => insertHeading('p')} className="text-left text-xs px-2 py-1 hover:bg-[#7c6a75]/10 rounded">Paragraph</button>
              </div>
            )}
          </div>

          {/* Text Color & Highlight Palette (35-45% Opacity) */}
          <div className="relative border-r border-[#7c6a75]/20 pr-1 flex items-center gap-0.5">
            <ToolBtn onClick={() => setShowTextColorPicker(!showTextColorPicker)} title="Text Color">
              <span>A▾</span>
            </ToolBtn>
            {showTextColorPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-lg shadow-xl p-1.5 z-[60] grid grid-cols-4 gap-1 w-[130px]">
                {TEXT_COLORS.map((col) => (
                  <button key={col.name} onClick={() => applyTextColor(col.color)} title={`Text: ${col.name}`} className="w-6 h-6 rounded-md border border-gray-300 flex items-center justify-center text-xs shadow-sm hover:scale-110" style={{ backgroundColor: col.color }} />
                ))}
              </div>
            )}

            <ToolBtn onClick={() => setShowColorPicker(!showColorPicker)} title="Highlight text color (35-45% opacity)">
              <span>🖍️▾</span>
            </ToolBtn>
            {showColorPicker && (
              <div className="absolute left-6 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-lg shadow-xl p-1.5 z-[60] grid grid-cols-3 gap-1 w-[120px]">
                {HIGHLIGHT_COLORS.map((col) => (
                  <button key={col.name} onClick={() => applyHighlight(col.color)} title={`Highlight ${col.name}`} className="w-8 h-8 rounded-md flex items-center justify-center text-sm shadow-sm hover:scale-110 transition-transform" style={{ backgroundColor: col.color }}>
                    {col.label}
                  </button>
                ))}
                <button onClick={() => applyHighlight(null)} title="Remove Highlight" className="col-span-3 text-[10px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 py-1 rounded font-bold text-center mt-1">
                  ✕ Clear Color
                </button>
              </div>
            )}
          </div>

          {/* Text Alignment (Left, Center, Right, Justify) */}
          <div className="relative border-r border-[#7c6a75]/20 pr-1">
            <ToolBtn onClick={() => setShowAlignPicker(!showAlignPicker)} title="Text Alignment">
              <span>Align ▾</span>
            </ToolBtn>
            {showAlignPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-xl shadow-xl p-1 z-[60] flex flex-col min-w-[110px] text-xs">
                <button onClick={() => { execCmd('justifyLeft'); setShowAlignPicker(false); }} className="text-left px-2.5 py-1 hover:bg-[#7c6a75]/10 rounded font-bold">⬅️ Left</button>
                <button onClick={() => { execCmd('justifyCenter'); setShowAlignPicker(false); }} className="text-left px-2.5 py-1 hover:bg-[#7c6a75]/10 rounded font-bold">↔️ Center</button>
                <button onClick={() => { execCmd('justifyRight'); setShowAlignPicker(false); }} className="text-left px-2.5 py-1 hover:bg-[#7c6a75]/10 rounded font-bold">➡️ Right</button>
                <button onClick={() => { execCmd('justifyFull'); setShowAlignPicker(false); }} className="text-left px-2.5 py-1 hover:bg-[#7c6a75]/10 rounded font-bold">≣ Justify</button>
              </div>
            )}
          </div>

          {/* Lists & Checklists (Standard behavior with nested tab support) */}
          <div className="flex items-center gap-0.5 border-r border-[#7c6a75]/20 pr-1">
            <ToolBtn onClick={() => execCmd('insertUnorderedList')} title="Bullet List">• List</ToolBtn>
            <ToolBtn onClick={() => execCmd('insertOrderedList')} title="Numbered List">1. List</ToolBtn>
            <ToolBtn onClick={insertChecklist} title="Insert Interactive Checklist">☑ Check</ToolBtn>
          </div>

          {/* Divider, Link, Image, Find/Replace, Study Canvas */}
          <div className="flex items-center gap-0.5 flex-wrap">
            <ToolBtn onClick={() => execCmd('insertHorizontalRule')} title="Horizontal Divider">—</ToolBtn>
            <ToolBtn onClick={insertLink} title="Insert Hyperlink">🔗</ToolBtn>
            <ToolBtn onClick={() => fileInputRef.current?.click()} title="Insert Image / Screenshot">🖼️ Img</ToolBtn>
            <ToolBtn onClick={() => setShowFindReplace(!showFindReplace)} title="Find & Replace (Ctrl+H)">🔍 Find</ToolBtn>
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

            {/* OPEN STUDY CANVAS BUTTON */}
            <button
              onClick={() => setShowCanvas(true)}
              className="bg-gradient-to-r from-purple-500 to-teal-400 hover:from-purple-600 hover:to-teal-500 text-white font-black px-2.5 py-1 rounded-md shadow-sm text-xs transition-transform hover:scale-105 flex items-center gap-1 ml-1"
              title="Open Digital Study Whiteboard Canvas"
            >
              <span>🎨 Study Canvas</span>
            </button>
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

        {/* --- FIND & REPLACE BAR (Ctrl+H) --- */}
        {showFindReplace && (
          <div className="bg-purple-100 dark:bg-purple-950/80 border-b-2 border-purple-300 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-purple-900 dark:text-purple-200 animate-fadeIn z-20">
            <div className="flex items-center gap-2 flex-wrap">
              <span>🔍 Find:</span>
              <input
                type="text"
                placeholder="Find text..."
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                className="bg-white dark:bg-black/40 border border-purple-300 rounded px-2 py-0.5 text-xs text-black dark:text-white"
              />
              <span>Replace:</span>
              <input
                type="text"
                placeholder="Replace with..."
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                className="bg-white dark:bg-black/40 border border-purple-300 rounded px-2 py-0.5 text-xs text-black dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleFindNext} className="bg-white dark:bg-black/40 hover:bg-purple-200 px-2 py-0.5 rounded border border-purple-300">Find Next</button>
              <button onClick={handleReplace} className="bg-white dark:bg-black/40 hover:bg-purple-200 px-2 py-0.5 rounded border border-purple-300">Replace</button>
              <button onClick={handleReplaceAll} className="bg-purple-600 text-white hover:bg-purple-700 px-2.5 py-0.5 rounded shadow-sm">Replace All</button>
              <button onClick={() => setShowFindReplace(false)} className="text-gray-500 hover:text-gray-800 font-bold px-1.5 ml-1">✕</button>
            </div>
          </div>
        )}

        {/* --- IMAGE RESIZE & ALIGNMENT CONTROLS (Floating when image clicked) --- */}
        {selectedImg && (
          <div className="bg-amber-100 dark:bg-amber-950/80 border-b-2 border-amber-400 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-amber-900 dark:text-amber-200 animate-fadeIn z-20">
            <div className="flex items-center gap-2 flex-wrap">
              <span>🖼️ Align:</span>
              <button onClick={() => alignSelectedImage('left')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">⬅️ Left</button>
              <button onClick={() => alignSelectedImage('center')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">↔️ Center</button>
              <button onClick={() => alignSelectedImage('right')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">➡️ Right</button>
              <span className="ml-2">Size:</span>
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

      {/* --- STUDY CANVAS MODAL OVERLAY --- */}
      <AnimatePresence>
        {showCanvas && (
          <StudyCanvas
            document={document || { id: documentId, name: documentName, uri: '', type: 'pdf', status: 'ready', uploadedAt: Date.now() }}
            onClose={() => setShowCanvas(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
