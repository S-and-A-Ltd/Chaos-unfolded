export interface StickyTemplate {
  id: string;
  name: string;
  assetUrl: string;
  // Safe text writing region expressed as percentage of total container bounds [0-100]
  // This ensures the rich text layer scales proportionally with the note and never overlaps artwork!
  safeRegion: {
    x: number;      // % offset from left border
    y: number;      // % offset from top border (below "NOTE:" badge & tape)
    width: number;  // % of total width for writing
    height: number; // % of total height for writing (above bottom mascots/decorations)
  };
  defaultTextColor?: string;
  defaultFontSize?: number;
}

// 28 Self-contained Sticky Note Asset Templates with metadata
export const STICKY_TEMPLATES: StickyTemplate[] = [
  {
    id: 'note-1',
    name: 'Yellow Taiyaki Bear',
    assetUrl: '/assets/sticky-notes/note-1.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-2',
    name: 'Pink Peach Blossom',
    assetUrl: '/assets/sticky-notes/note-2.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-3',
    name: 'Sky Blue Cloud Bear',
    assetUrl: '/assets/sticky-notes/note-3.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-4',
    name: 'Sage Green Clover',
    assetUrl: '/assets/sticky-notes/note-4.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-5',
    name: 'Lavender Dream Ribbon',
    assetUrl: '/assets/sticky-notes/note-5.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-6',
    name: 'Peach Apricot Memo',
    assetUrl: '/assets/sticky-notes/note-6.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-7',
    name: 'Lemon Butter Sunshine',
    assetUrl: '/assets/sticky-notes/note-7.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-8',
    name: 'Roseberry Strawberry Patch',
    assetUrl: '/assets/sticky-notes/note-8.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-9',
    name: 'Minty Penguin Chill',
    assetUrl: '/assets/sticky-notes/note-9.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-10',
    name: 'Lilac Bunny Dream',
    assetUrl: '/assets/sticky-notes/note-10.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-11',
    name: 'Vanilla Cream Honey',
    assetUrl: '/assets/sticky-notes/note-11.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-12',
    name: 'Cherry Blossom Pink',
    assetUrl: '/assets/sticky-notes/note-12.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-13',
    name: 'Glacier Blue Frost',
    assetUrl: '/assets/sticky-notes/note-13.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-14',
    name: 'Matcha Green Tea',
    assetUrl: '/assets/sticky-notes/note-14.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-15',
    name: 'Violet Twilight',
    assetUrl: '/assets/sticky-notes/note-15.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-16',
    name: 'Caramel Macchiato',
    assetUrl: '/assets/sticky-notes/note-16.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-17',
    name: 'Banana Milk Sparkle',
    assetUrl: '/assets/sticky-notes/note-17.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-18',
    name: 'Cotton Candy Cloud',
    assetUrl: '/assets/sticky-notes/note-18.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-19',
    name: 'Breeze Mint Leaf',
    assetUrl: '/assets/sticky-notes/note-19.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-20',
    name: 'Amethyst Berry',
    assetUrl: '/assets/sticky-notes/note-20.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-21',
    name: 'Honey Citrus Grid',
    assetUrl: '/assets/sticky-notes/note-21.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-22',
    name: 'Rose Gold Blossom',
    assetUrl: '/assets/sticky-notes/note-22.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-23',
    name: 'Ocean Ripple Blue',
    assetUrl: '/assets/sticky-notes/note-23.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-24',
    name: 'Eucalyptus Green',
    assetUrl: '/assets/sticky-notes/note-24.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-25',
    name: 'Sugar Plum Violet',
    assetUrl: '/assets/sticky-notes/note-25.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-26',
    name: 'Tangerine Sunrise',
    assetUrl: '/assets/sticky-notes/note-26.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-27',
    name: 'Golden Glow Memo',
    assetUrl: '/assets/sticky-notes/note-27.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
  {
    id: 'note-28',
    name: 'Starlight Lavender',
    assetUrl: '/assets/sticky-notes/note-28.jpeg',
    safeRegion: { x: 13, y: 22, width: 74, height: 58 },
    defaultTextColor: '#3A3A3A',
  },
];

// Helper to find a template by asset URL or ID
export const getStickyTemplate = (assetUrlOrId?: string): StickyTemplate => {
  if (!assetUrlOrId) return STICKY_TEMPLATES[0];
  const found = STICKY_TEMPLATES.find(
    (t) => t.id === assetUrlOrId || t.assetUrl === assetUrlOrId || assetUrlOrId.endsWith(t.assetUrl)
  );
  return found || STICKY_TEMPLATES[0];
};
