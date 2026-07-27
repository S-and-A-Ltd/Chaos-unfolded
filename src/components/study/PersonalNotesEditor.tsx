'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { StudyDocument } from '@/types';
import StudyCanvas from './StudyCanvas';

// TipTap Imports
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { FontFamily } from '@tiptap/extension-font-family';
import { Extension } from '@tiptap/core';

interface PersonalNotesEditorProps {
  documentId: string;
  documentName: string;
  document?: StudyDocument;
  onUpdateNotes: (notesHtml: string) => void;
  isLarge?: boolean;
}

// Custom TipTap Extension for Font Size
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
      },
    } as any;
  },
});

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
  { name: 'Small (10pt)', value: '13px' },
  { name: 'Normal (12pt)', value: '16px' },
  { name: 'Medium (14pt)', value: '18px' },
  { name: 'Large (18pt)', value: '24px' },
  { name: 'Huge (24pt)', value: '32px' },
];

type DropdownType = 'font' | 'size' | 'heading' | 'textColor' | 'highlight' | 'align' | null;

export default function PersonalNotesEditor({
  documentId,
  documentName,
  document,
  onUpdateNotes,
  isLarge = false,
}: PersonalNotesEditorProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor Stats & Status
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [lastEdited, setLastEdited] = useState<string>('Just now');
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);

  // Unified Dropdown State (Only one dropdown open at a time)
  const [activeDropdown, setActiveDropdown] = useState<DropdownType>(null);

  // Find & Replace State (Ctrl+H)
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  // Image resize & reposition selection state
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);

  // 1. Initialize TipTap Editor (0% execCommand, 100% proper commands)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
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
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[220px] w-full p-4 font-sans leading-relaxed text-[#5d5770] dark:text-gray-200',
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              event.preventDefault();
              const file = items[i].getAsFile();
              if (file) insertImageFile(file);
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            insertImageFile(file);
            return true;
          }
        }
        return false;
      },
    },
  });

  // 2. Load initial content from storage on mount or documentId change
  useEffect(() => {
    if (typeof window !== 'undefined' && editor && !editor.isDestroyed) {
      const savedHtml = localStorage.getItem(`dazai_notes_${documentId}`);
      const savedTime = localStorage.getItem(`dazai_notes_timestamp_${documentId}`) || 'Not saved yet';
      
      if (savedHtml && !savedHtml.includes('<') && !savedHtml.includes('>')) {
        editor.commands.setContent(`<p>${savedHtml.replace(/\n/g, '<br/>')}</p>`);
      } else if (savedHtml) {
        editor.commands.setContent(savedHtml);
      } else {
        editor.commands.setContent(`<p class="text-gray-400">Start typing your personal study notes, formulas, or drag & drop screenshots here...</p>`);
      }

      setLastEdited(savedTime);
      
      const text = editor.getText();
      const chars = text.replace(/\s/g, '').length;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setCharCount(chars);
      setWordCount(words);
    }
  }, [documentId, editor]);

  // 3. Dropdown Outside Click and Esc Key Listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  // 4. Save and notify parent helper
  const saveCurrentState = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    if (typeof window !== 'undefined') {
      localStorage.setItem(`dazai_notes_${documentId}`, html);
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      localStorage.setItem(`dazai_notes_timestamp_${documentId}`, now);
      setLastEdited(now);
    }
    onUpdateNotes(html);
  }, [documentId, editor, onUpdateNotes]);

  // 5. Image Insertion (via TipTap API)
  const insertImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl && editor) {
        editor.chain().focus().setImage({ src: dataUrl }).run();
      }
    };
    reader.readAsDataURL(file);
  };

  // 6. Click handler for image resizing/alignment selection
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLImageElement) {
      setSelectedImg(target);
    } else {
      if (selectedImg) setSelectedImg(null);
    }
  };

  const resizeSelectedImage = (newWidth: string) => {
    if (selectedImg) {
      selectedImg.style.width = newWidth;
      selectedImg.style.height = 'auto';
      selectedImg.style.borderRadius = '10px';
      saveCurrentState();
    }
  };

  const alignSelectedImage = (alignment: 'left' | 'center' | 'right') => {
    if (selectedImg) {
      if (alignment === 'center') {
        selectedImg.style.margin = '14px auto';
        selectedImg.style.float = 'none';
        selectedImg.style.display = 'block';
      } else if (alignment === 'left') {
        selectedImg.style.margin = '0 16px 14px 0';
        selectedImg.style.float = 'left';
        selectedImg.style.display = 'inline-block';
      } else if (alignment === 'right') {
        selectedImg.style.margin = '0 0 14px 16px';
        selectedImg.style.float = 'right';
        selectedImg.style.display = 'inline-block';
      }
      saveCurrentState();
    }
  };

  const deleteSelectedImage = () => {
    if (selectedImg) {
      selectedImg.remove();
      setSelectedImg(null);
      saveCurrentState();
    }
  };

  // 7. Find & Replace Handlers (Ctrl+H)
  const handleFindNext = () => {
    if (findQuery) {
      window.find(findQuery, false, false, true);
    }
  };

  const handleReplace = () => {
    if (findQuery && window.getSelection()?.toString().toLowerCase() === findQuery.toLowerCase() && editor) {
      editor.commands.insertContent(replaceQuery);
    } else if (findQuery) {
      if (window.find(findQuery, false, false, true) && editor) {
        editor.commands.insertContent(replaceQuery);
      }
    }
  };

  const handleReplaceAll = () => {
    if (findQuery && editor) {
      let count = 0;
      const sel = window.getSelection();
      sel?.removeAllRanges();
      while (window.find(findQuery, false, false, true)) {
        editor.commands.insertContent(replaceQuery);
        count++;
        if (count > 500) break;
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
      onMouseDown={(e) => {
        e.preventDefault(); // Prevents focus theft from TipTap
      }}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
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

  const toggleDropdown = (type: DropdownType) => {
    setActiveDropdown(prev => (prev === type ? null : type));
  };

  if (!editor) {
    return <div className="p-8 text-center text-gray-400">Loading TipTap rich-text editor...</div>;
  }

  const renderEditorUI = (fullscreen: boolean) => {
    return (
      <div className="flex flex-col h-full bg-white/50 dark:bg-[#1a1823]/60 border-2 border-[#7c6a75]/20 rounded-xl overflow-hidden shadow-sm relative">
        
        {/* --- EDITING TOOLBAR (100% TipTap Command API) --- */}
        <div ref={toolbarRef} className="bg-[#7c6a75]/10 dark:bg-black/30 border-b border-[#7c6a75]/20 p-1.5 flex flex-wrap items-center gap-1 select-none">
          
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 border-r border-[#7c6a75]/20 pr-1">
            <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)" active={editor.isActive('undo')}>↩</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)" active={editor.isActive('redo')}>↪</ToolBtn>
          </div>

          {/* Font Family & Size */}
          <div className="relative border-r border-[#7c6a75]/20 pr-1 flex items-center gap-0.5">
            <ToolBtn onClick={() => toggleDropdown('font')} title="Font Family" active={activeDropdown === 'font'}>
              <span>Font ▾</span>
            </ToolBtn>
            {activeDropdown === 'font' && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-xl shadow-2xl p-1 z-[60] flex flex-col min-w-[140px] text-xs">
                {FONT_FAMILIES.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editor.chain().focus().setFontFamily(f.value).run();
                      setActiveDropdown(null);
                    }}
                    className="text-left px-2.5 py-1.5 hover:bg-[#7c6a75]/10 rounded font-medium truncate"
                    style={{ fontFamily: f.value }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}

            <ToolBtn onClick={() => toggleDropdown('size')} title="Font Size" active={activeDropdown === 'size'}>
              <span>Size ▾</span>
            </ToolBtn>
            {activeDropdown === 'size' && (
              <div className="absolute left-10 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-xl shadow-2xl p-1 z-[60] flex flex-col min-w-[120px] text-xs">
                {FONT_SIZES.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      (editor.chain().focus() as any).setFontSize(s.value).run();
                      setActiveDropdown(null);
                    }}
                    className="text-left px-2.5 py-1.5 hover:bg-[#7c6a75]/10 rounded font-bold"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bold, Italic, Underline */}
          <div className="flex items-center gap-0.5 border-r border-[#7c6a75]/20 pr-1">
            <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)" active={editor.isActive('bold')}><b>B</b></ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)" active={editor.isActive('italic')}><i>I</i></ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)" active={editor.isActive('underline')}><u>U</u></ToolBtn>
          </div>

          {/* Headings Picker */}
          <div className="relative border-r border-[#7c6a75]/20 pr-1">
            <ToolBtn onClick={() => toggleDropdown('heading')} title="Headings & Typography" active={activeDropdown === 'heading' || editor.isActive('heading')}>
              <span>H▾</span>
            </ToolBtn>
            {activeDropdown === 'heading' && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-lg shadow-xl p-1 z-[60] flex flex-col min-w-[110px]">
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); setActiveDropdown(null); }} className="text-left font-black text-sm px-2 py-1 hover:bg-[#7c6a75]/10 rounded">H1 Title</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setActiveDropdown(null); }} className="text-left font-bold text-xs px-2 py-1 hover:bg-[#7c6a75]/10 rounded">H2 Section</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); setActiveDropdown(null); }} className="text-left font-semibold text-[11px] px-2 py-1 hover:bg-[#7c6a75]/10 rounded">H3 Subtitle</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().setParagraph().run(); setActiveDropdown(null); }} className="text-left text-xs px-2 py-1 hover:bg-[#7c6a75]/10 rounded">Paragraph</button>
              </div>
            )}
          </div>

          {/* Text Color & Highlight Palette (35-45% Opacity) */}
          <div className="relative border-r border-[#7c6a75]/20 pr-1 flex items-center gap-0.5">
            <ToolBtn onClick={() => toggleDropdown('textColor')} title="Text Color" active={activeDropdown === 'textColor'}>
              <span>A▾</span>
            </ToolBtn>
            {activeDropdown === 'textColor' && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-lg shadow-xl p-1.5 z-[60] grid grid-cols-4 gap-1 w-[130px]">
                {TEXT_COLORS.map((col) => (
                  <button
                    key={col.name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editor.chain().focus().setColor(col.color).run();
                      setActiveDropdown(null);
                    }}
                    title={`Text: ${col.name}`}
                    className="w-6 h-6 rounded-md border border-gray-300 flex items-center justify-center text-xs shadow-sm hover:scale-110"
                    style={{ backgroundColor: col.color }}
                  />
                ))}
              </div>
            )}

            <ToolBtn onClick={() => toggleDropdown('highlight')} title="Highlight text color (35-45% opacity)" active={activeDropdown === 'highlight' || editor.isActive('highlight')}>
              <span>🖍️▾</span>
            </ToolBtn>
            {activeDropdown === 'highlight' && (
              <div className="absolute left-6 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-lg shadow-xl p-1.5 z-[60] grid grid-cols-3 gap-1 w-[120px]">
                {HIGHLIGHT_COLORS.map((col) => (
                  <button
                    key={col.name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color: col.color }).run();
                      setActiveDropdown(null);
                    }}
                    title={`Highlight ${col.name}`}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-sm shadow-sm hover:scale-110 transition-transform"
                    style={{ backgroundColor: col.color }}
                  >
                    {col.label}
                  </button>
                ))}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run();
                    setActiveDropdown(null);
                  }}
                  title="Remove Highlight"
                  className="col-span-3 text-[10px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 py-1 rounded font-bold text-center mt-1"
                >
                  ✕ Clear Color
                </button>
              </div>
            )}
          </div>

          {/* Text Alignment (Left, Center, Right, Justify) */}
          <div className="relative border-r border-[#7c6a75]/20 pr-1">
            <ToolBtn onClick={() => toggleDropdown('align')} title="Text Alignment" active={activeDropdown === 'align' || editor.isActive({ textAlign: 'center' })}>
              <span>Align ▾</span>
            </ToolBtn>
            {activeDropdown === 'align' && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#2b2b36] border-2 border-[#7c6a75]/30 rounded-xl shadow-xl p-1 z-[60] flex flex-col min-w-[110px] text-xs">
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().setTextAlign('left').run(); setActiveDropdown(null); }} className="text-left px-2.5 py-1 hover:bg-[#7c6a75]/10 rounded font-bold">⬅️ Left</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().setTextAlign('center').run(); setActiveDropdown(null); }} className="text-left px-2.5 py-1 hover:bg-[#7c6a75]/10 rounded font-bold">↔️ Center</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().setTextAlign('right').run(); setActiveDropdown(null); }} className="text-left px-2.5 py-1 hover:bg-[#7c6a75]/10 rounded font-bold">➡️ Right</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().setTextAlign('justify').run(); setActiveDropdown(null); }} className="text-left px-2.5 py-1 hover:bg-[#7c6a75]/10 rounded font-bold">≣ Justify</button>
              </div>
            )}
          </div>

          {/* Lists & Checklists */}
          <div className="flex items-center gap-0.5 border-r border-[#7c6a75]/20 pr-1">
            <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List" active={editor.isActive('bulletList')}>• List</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List" active={editor.isActive('orderedList')}>1. List</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} title="Insert Interactive Checklist" active={editor.isActive('taskList')}>☑ Check</ToolBtn>
          </div>

          {/* Divider, Link, Image, Find/Replace, Study Canvas */}
          <div className="flex items-center gap-0.5 flex-wrap">
            <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Divider">—</ToolBtn>
            <ToolBtn
              onClick={() => {
                const url = window.prompt('Enter link URL:', 'https://');
                if (url) editor.chain().focus().setLink({ href: url }).run();
              }}
              title="Insert Hyperlink"
              active={editor.isActive('link')}
            >
              🔗
            </ToolBtn>
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
              type="button"
              onMouseDown={(e) => e.preventDefault()}
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
              type="button"
              onMouseDown={(e) => e.preventDefault()}
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
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleFindNext} className="bg-white dark:bg-black/40 hover:bg-purple-200 px-2 py-0.5 rounded border border-purple-300">Find Next</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleReplace} className="bg-white dark:bg-black/40 hover:bg-purple-200 px-2 py-0.5 rounded border border-purple-300">Replace</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleReplaceAll} className="bg-purple-600 text-white hover:bg-purple-700 px-2.5 py-0.5 rounded shadow-sm">Replace All</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setShowFindReplace(false)} className="text-gray-500 hover:text-gray-800 font-bold px-1.5 ml-1">✕</button>
            </div>
          </div>
        )}

        {/* --- IMAGE RESIZE & ALIGNMENT CONTROLS (Floating when image clicked) --- */}
        {selectedImg && (
          <div className="bg-amber-100 dark:bg-amber-950/80 border-b-2 border-amber-400 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-amber-900 dark:text-amber-200 animate-fadeIn z-20">
            <div className="flex items-center gap-2 flex-wrap">
              <span>🖼️ Align:</span>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => alignSelectedImage('left')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">⬅️ Left</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => alignSelectedImage('center')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">↔️ Center</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => alignSelectedImage('right')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">➡️ Right</button>
              <span className="ml-2">Size:</span>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => resizeSelectedImage('200px')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">Small</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => resizeSelectedImage('400px')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">Medium</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => resizeSelectedImage('650px')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">Large</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => resizeSelectedImage('100%')} className="bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200">Full</button>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={deleteSelectedImage} className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-0.5 rounded shadow-sm">🗑️ Delete Image</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSelectedImg(null)} className="text-gray-500 hover:text-gray-800 font-bold px-1">✕</button>
            </div>
          </div>
        )}

        {/* --- TIPTAP PROSEMIRROR EDITABLE AREA --- */}
        <div onClick={handleEditorClick} className="flex-1 overflow-y-auto custom-scrollbar" style={{ minHeight: fullscreen ? '70vh' : '220px' }}>
          <EditorContent editor={editor} />
        </div>

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
              onClick={saveCurrentState}
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
                    <h2 className="font-black text-base md:text-lg tracking-wide">{documentName} - Rich Text Personal Notes (TipTap)</h2>
                    <p className="text-[11px] text-white/80">ProseMirror command engine, checklists, drag-and-drop screenshot captions, and live word counts</p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
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
