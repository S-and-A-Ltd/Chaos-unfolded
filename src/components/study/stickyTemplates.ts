export interface StickyTemplate {
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
  defaultFontSize: number;
  lineHeight: number;    // Line spacing per template, e.g. 1.5
  defaultTextColor: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

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
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-2',
    name: 'Pink Peach Blossom',
    image: '/assets/sticky-notes/note-2.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-3',
    name: 'Sky Blue Cloud Bear',
    image: '/assets/sticky-notes/note-3.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-4',
    name: 'Sage Green Clover',
    image: '/assets/sticky-notes/note-4.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-5',
    name: 'Lavender Dream Ribbon',
    image: '/assets/sticky-notes/note-5.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-6',
    name: 'Peach Apricot Memo',
    image: '/assets/sticky-notes/note-6.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-7',
    name: 'Lemon Butter Sunshine',
    image: '/assets/sticky-notes/note-7.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-8',
    name: 'Roseberry Strawberry Patch',
    image: '/assets/sticky-notes/note-8.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-9',
    name: 'Minty Penguin Chill',
    image: '/assets/sticky-notes/note-9.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-10',
    name: 'Lilac Bunny Dream',
    image: '/assets/sticky-notes/note-10.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-11',
    name: 'Vanilla Cream Honey',
    image: '/assets/sticky-notes/note-11.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-12',
    name: 'Cherry Blossom Pink',
    image: '/assets/sticky-notes/note-12.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-13',
    name: 'Glacier Blue Frost',
    image: '/assets/sticky-notes/note-13.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-14',
    name: 'Matcha Green Tea',
    image: '/assets/sticky-notes/note-14.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-15',
    name: 'Violet Twilight',
    image: '/assets/sticky-notes/note-15.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-16',
    name: 'Caramel Macchiato',
    image: '/assets/sticky-notes/note-16.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-17',
    name: 'Banana Milk Sparkle',
    image: '/assets/sticky-notes/note-17.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-18',
    name: 'Cotton Candy Cloud',
    image: '/assets/sticky-notes/note-18.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-19',
    name: 'Breeze Mint Leaf',
    image: '/assets/sticky-notes/note-19.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-20',
    name: 'Amethyst Berry',
    image: '/assets/sticky-notes/note-20.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-21',
    name: 'Honey Citrus Grid',
    image: '/assets/sticky-notes/note-21.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-22',
    name: 'Rose Gold Blossom',
    image: '/assets/sticky-notes/note-22.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-23',
    name: 'Ocean Ripple Blue',
    image: '/assets/sticky-notes/note-23.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-24',
    name: 'Eucalyptus Green',
    image: '/assets/sticky-notes/note-24.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-25',
    name: 'Sugar Plum Violet',
    image: '/assets/sticky-notes/note-25.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-26',
    name: 'Tangerine Sunrise',
    image: '/assets/sticky-notes/note-26.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-27',
    name: 'Golden Glow Memo',
    image: '/assets/sticky-notes/note-27.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
  {
    id: 'note-28',
    name: 'Starlight Lavender',
    image: '/assets/sticky-notes/note-28.jpeg',
    aspectRatio: 1.0,
    croppedBounds: { top: 1, left: 1, width: 98, height: 98 },
    writingArea: { x: 12, y: 22, width: 76, height: 58 },
    padding: '4% 5%',
    defaultFontSize: 15,
    lineHeight: 1.5,
    defaultTextColor: '#3A3A3A',
    textAlign: 'left',
  },
];

export const STICKY_TEMPLATES = INITIAL_STICKY_TEMPLATES;

// Helper to get all templates, merging with any local developer calibrations saved via Template Editor
export const getStickyTemplates = (): StickyTemplate[] => {
  if (typeof window === 'undefined') return INITIAL_STICKY_TEMPLATES;
  try {
    const calibrated = localStorage.getItem('dazai_calibrated_templates');
    if (calibrated) {
      const parsed: StickyTemplate[] = JSON.parse(calibrated);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return INITIAL_STICKY_TEMPLATES.map(t => {
          const found = parsed.find(p => p.id === t.id || p.image === t.image);
          return found || t;
        });
      }
    }
  } catch (e) {
    console.error('Failed to parse calibrated templates from localStorage', e);
  }
  return INITIAL_STICKY_TEMPLATES;
};

// Helper to find a template by asset URL or ID
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
    localStorage.setItem('dazai_calibrated_templates', JSON.stringify(next));
  }
  return next;
};
