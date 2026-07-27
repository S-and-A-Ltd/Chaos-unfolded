export interface NoteTemplate {
  id: string;
  name: string;
  image: string; // Asset URL in /public/assets/sticky-notes/
  aspectRatio: number; // Width / Height ratio of visible cropped artwork
  croppedBounds?: {
    top: number;    // % offset from top image border
    left: number;   // % offset from left image border
    width: number;  // % of total visible image width
    height: number; // % of total visible image height
  };
  writingArea: {
    x: number;      // % offset relative to visible cropped width
    y: number;      // % offset relative to visible cropped top
    width: number;  // % of visible cropped width for safe writing
    height: number; // % of visible cropped height for safe writing
  };
  writingRegions?: {
    x: number;      // % offset relative to visible cropped width
    y: number;      // % offset relative to visible cropped top
    width: number;  // % of visible cropped width
    height: number; // % of visible cropped height
  }[];
  padding: string;       // Custom CSS padding inside text zone, e.g. "4% 5%"
  defaultFont?: string;  // e.g. "'Quicksand', 'Nunito', sans-serif"
  defaultFontSize: number;
  lineHeight: number;    // Line spacing per template, e.g. 1.5
  defaultTextColor: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

export type StickyTemplate = NoteTemplate;

// Automatically scans PNG alpha channel to remove invisible transparent padding around artwork
export const autoAlphaCropImage = (img: HTMLImageElement): { top: number; left: number; width: number; height: number } => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width || 100;
    canvas.height = img.naturalHeight || img.height || 100;
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.width === 0 || canvas.height === 0) {
      return { top: 0, left: 0, width: 100, height: 100 };
    }
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const alpha = data[(y * canvas.width + x) * 4 + 3];
        if (alpha > 15) { // Non-transparent pixel threshold
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return { top: 0, left: 0, width: 100, height: 100 };

    const left = Number(((minX / canvas.width) * 100).toFixed(1));
    const top = Number(((minY / canvas.height) * 100).toFixed(1));
    const width = Number((((maxX - minX + 1) / canvas.width) * 100).toFixed(1));
    const height = Number((((maxY - minY + 1) / canvas.height) * 100).toFixed(1));

    return { top, left, width, height };
  } catch (e) {
    return { top: 0, left: 0, width: 100, height: 100 };
  }
};

// Initial calibrated defaults for all 28 self-contained stationery note templates
export const INITIAL_STICKY_TEMPLATES: StickyTemplate[] = [
  {
    id: 'note-1',
    name: 'Yellow Taiyaki Bear',
    image: '/assets/sticky-notes/note-1.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 15, y: 25, width: 55, height: 50 },
    writingRegions: [{ x: 15, y: 25, width: 55, height: 50 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-2',
    name: 'Pink Peach Blossom',
    image: '/assets/sticky-notes/note-2.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 22, y: 25, width: 42, height: 50 },
    writingRegions: [{ x: 22, y: 25, width: 42, height: 50 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-3',
    name: 'Sky Blue Cloud Bear',
    image: '/assets/sticky-notes/note-3.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 20, y: 22, width: 45, height: 50 },
    writingRegions: [{ x: 20, y: 22, width: 45, height: 50 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-4',
    name: 'Sage Green Clover',
    image: '/assets/sticky-notes/note-4.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 15, y: 22, width: 48, height: 56 },
    writingRegions: [{ x: 15, y: 22, width: 48, height: 56 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-5',
    name: 'Flower Frame',
    image: '/assets/sticky-notes/note-5.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 18, y: 18, width: 64, height: 64 },
    writingRegions: [{ x: 18, y: 18, width: 64, height: 64 }],
    padding: '4% 5%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-6',
    name: 'Notebook Spiral Memo',
    image: '/assets/sticky-notes/note-6.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 18, y: 15, width: 72, height: 75 },
    writingRegions: [{ x: 18, y: 15, width: 72, height: 75 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-7',
    name: 'Scalloped Heart Frame',
    image: '/assets/sticky-notes/note-7.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 15, y: 22, width: 70, height: 65 },
    writingRegions: [{ x: 15, y: 22, width: 70, height: 65 }],
    padding: '4% 5%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-8',
    name: 'Purple Flower Patch',
    image: '/assets/sticky-notes/note-8.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 12, y: 15, width: 52, height: 72 },
    writingRegions: [{ x: 12, y: 15, width: 52, height: 72 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-9',
    name: 'Star Character',
    image: '/assets/sticky-notes/note-9.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 15, y: 32, width: 72, height: 58 },
    writingRegions: [{ x: 15, y: 32, width: 72, height: 58 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-10',
    name: 'Penguin Notebook',
    image: '/assets/sticky-notes/note-10.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 20, y: 15, width: 40, height: 70 },
    writingRegions: [{ x: 20, y: 15, width: 40, height: 70 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-11',
    name: 'Daisy Green Frame',
    image: '/assets/sticky-notes/note-11.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 15, y: 15, width: 50, height: 70 },
    writingRegions: [{ x: 15, y: 15, width: 50, height: 70 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-12',
    name: 'Strawberry Ribbon',
    image: '/assets/sticky-notes/note-12.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 12, y: 24, width: 45, height: 65 },
    writingRegions: [{ x: 12, y: 24, width: 45, height: 65 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-13',
    name: 'Rain Cloud Blue',
    image: '/assets/sticky-notes/note-13.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 18, y: 38, width: 64, height: 52 },
    writingRegions: [{ x: 18, y: 38, width: 64, height: 52 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-14',
    name: 'Tulip Binder Clip',
    image: '/assets/sticky-notes/note-14.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 15, y: 26, width: 50, height: 65 },
    writingRegions: [{ x: 15, y: 26, width: 50, height: 65 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-15',
    name: 'Teddy Bear Peeking',
    image: '/assets/sticky-notes/note-15.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 14, y: 22, width: 44, height: 68 },
    writingRegions: [{ x: 14, y: 22, width: 44, height: 68 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-16',
    name: 'Lavender Bouquet',
    image: '/assets/sticky-notes/note-16.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 32, y: 15, width: 55, height: 70 },
    writingRegions: [{ x: 32, y: 15, width: 55, height: 70 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-17',
    name: 'Cinnamoroll Baby Blue',
    image: '/assets/sticky-notes/note-17.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 22, y: 28, width: 56, height: 45 },
    writingRegions: [{ x: 22, y: 28, width: 56, height: 45 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-18',
    name: 'Puppy Duo Peeking',
    image: '/assets/sticky-notes/note-18.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 12, y: 33, width: 76, height: 58 },
    writingRegions: [{ x: 12, y: 33, width: 76, height: 58 }],
    padding: '4% 5%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-19',
    name: 'Lamb Rainbow Cloud',
    image: '/assets/sticky-notes/note-19.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 15, y: 22, width: 50, height: 44 },
    writingRegions: [{ x: 15, y: 22, width: 50, height: 44 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-20',
    name: 'Sumikko Nature Frame',
    image: '/assets/sticky-notes/note-20.jpeg',
    aspectRatio: 0.75,
    writingArea: { x: 18, y: 15, width: 64, height: 68 },
    writingRegions: [{ x: 18, y: 15, width: 64, height: 68 }],
    padding: '3% 4%',
    defaultFontSize: 13,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-21',
    name: 'My Melody & Hello Kitty',
    image: '/assets/sticky-notes/note-21.jpeg',
    aspectRatio: 1.0,
    writingArea: { x: 12, y: 12, width: 76, height: 53 },
    writingRegions: [{ x: 12, y: 12, width: 76, height: 53 }],
    padding: '3% 4%',
    defaultFontSize: 14,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-22',
    name: 'Cat Shape Checklist',
    image: '/assets/sticky-notes/note-22.jpeg',
    aspectRatio: 0.75,
    writingArea: { x: 25, y: 35, width: 50, height: 40 },
    writingRegions: [{ x: 25, y: 35, width: 50, height: 40 }],
    padding: '3% 4%',
    defaultFontSize: 13,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-23',
    name: 'Sumikko Music Wall',
    image: '/assets/sticky-notes/note-23.jpeg',
    aspectRatio: 0.75,
    writingArea: { x: 30, y: 5, width: 65, height: 78 },
    writingRegions: [{ x: 30, y: 5, width: 65, height: 78 }],
    padding: '3% 4%',
    defaultFontSize: 13,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-24',
    name: 'Dazai Ningen Shikkaku',
    image: '/assets/sticky-notes/note-24.jpeg',
    aspectRatio: 0.72,
    writingArea: { x: 18, y: 10, width: 65, height: 38 },
    writingRegions: [{ x: 18, y: 10, width: 65, height: 38 }],
    padding: '3% 5%',
    defaultFontSize: 13,
    lineHeight: 1.6,
    defaultTextColor: '#1a1a3e',
    textAlign: 'left',
  },
  {
    id: 'note-25',
    name: 'Aquatic Mascot Memo',
    image: '/assets/sticky-notes/note-25.jpeg',
    aspectRatio: 0.75,
    writingArea: { x: 15, y: 22, width: 70, height: 50 },
    writingRegions: [{ x: 15, y: 22, width: 70, height: 50 }],
    padding: '3% 4%',
    defaultFontSize: 13,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-26',
    name: 'Totoro Weekly Planner',
    image: '/assets/sticky-notes/note-26.jpeg',
    aspectRatio: 0.75,
    writingArea: { x: 5, y: 24, width: 33, height: 45 },
    writingRegions: [
      { x: 5, y: 24, width: 33, height: 45 },
      { x: 55, y: 58, width: 38, height: 22 },
    ],
    padding: '2% 3%',
    defaultFontSize: 12,
    lineHeight: 1.4,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-27',
    name: 'Jiji Cat Starlight',
    image: '/assets/sticky-notes/note-27.jpeg',
    aspectRatio: 0.75,
    writingArea: { x: 15, y: 20, width: 68, height: 50 },
    writingRegions: [{ x: 15, y: 20, width: 68, height: 50 }],
    padding: '3% 4%',
    defaultFontSize: 13,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-28',
    name: 'Jinbesan Ocean Memo',
    image: '/assets/sticky-notes/note-28.jpeg',
    aspectRatio: 0.75,
    writingArea: { x: 15, y: 24, width: 70, height: 46 },
    writingRegions: [{ x: 15, y: 24, width: 70, height: 46 }],
    padding: '3% 4%',
    defaultFontSize: 13,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
];

const NORMALIZED_INITIAL: StickyTemplate[] = INITIAL_STICKY_TEMPLATES.map(t => ({
  ...t,
  defaultFont: t.defaultFont || "'Quicksand', 'Nunito', sans-serif",
  writingRegions: (t.writingRegions && t.writingRegions.length > 0) ? t.writingRegions : [t.writingArea || { x: 12, y: 22, width: 76, height: 58 }],
}));

export const STICKY_TEMPLATES = NORMALIZED_INITIAL;

let cachedCalibrated: string | null = null;
let cachedResult: StickyTemplate[] = NORMALIZED_INITIAL;

// Helper to get all templates with stable object references
export const getStickyTemplates = (): StickyTemplate[] => {
  if (typeof window === 'undefined') return NORMALIZED_INITIAL;
  try {
    const calibrated = localStorage.getItem('dazai_calibrated_templates');
    if (calibrated === cachedCalibrated && cachedResult !== NORMALIZED_INITIAL) {
      return cachedResult;
    }
    if (!calibrated) {
      cachedCalibrated = null;
      cachedResult = NORMALIZED_INITIAL;
      return NORMALIZED_INITIAL;
    }
    const parsed: any[] = JSON.parse(calibrated);
    if (Array.isArray(parsed) && parsed.length > 0) {
      cachedCalibrated = calibrated;
      cachedResult = NORMALIZED_INITIAL.map(t => {
        const found = parsed.find(p => p.id === t.id || p.image === t.image);
        return found ? {
          ...found,
          defaultFont: found.defaultFont || t.defaultFont || "'Quicksand', 'Nunito', sans-serif",
          writingRegions: (found.writingRegions && found.writingRegions.length > 0) ? found.writingRegions : [found.writingArea || { x: 12, y: 22, width: 76, height: 58 }],
        } : t;
      });
      return cachedResult;
    }
  } catch (e) {
    console.error('Failed to parse calibrated templates from localStorage', e);
  }
  return NORMALIZED_INITIAL;
};

// Helper to find a template by asset URL or ID returning stable reference
export const getStickyTemplate = (assetUrlOrId?: string): StickyTemplate => {
  const all = getStickyTemplates();
  if (!assetUrlOrId) return all[0];
  const found = all.find(
    (t) => t.id === assetUrlOrId || t.image === assetUrlOrId || assetUrlOrId.endsWith(t.image)
  );
  return found || all[0];
};

// Helper to save a calibrated template (used by the development Template Editor)
export const saveCalibratedTemplate = (updated: StickyTemplate): StickyTemplate[] => {
  const current = getStickyTemplates();
  const next = current.map(t => t.id === updated.id ? updated : t);
  if (typeof window !== 'undefined') {
    const str = JSON.stringify(next);
    localStorage.setItem('dazai_calibrated_templates', str);
    cachedCalibrated = str;
    cachedResult = next;
  }
  return next;
};
