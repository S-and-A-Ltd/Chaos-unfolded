import { create } from 'zustand';

interface YoutubeVideo {
  url: string;
  title: string;
  thumbnail: string;
  type: 'video' | 'list';
  listId?: string;
  author?: { name: string };
}

interface YoutubeState {
  searchQuery: string;
  searchResults: YoutubeVideo[];
  currentVideoUrl: string;
  currentVideoIndex: number;
  playlistTitle: string;
  message: string;
  isSearching: boolean;
  isProcessing: boolean;
  autoplay: boolean;

  setSearchQuery: (query: string) => void;
  setSearchResults: (results: YoutubeVideo[]) => void;
  setCurrentVideoUrl: (url: string) => void;
  setCurrentVideoIndex: (index: number) => void;
  setPlaylistTitle: (title: string) => void;
  setMessage: (msg: string) => void;
  setIsSearching: (val: boolean) => void;
  setIsProcessing: (val: boolean) => void;
  setAutoplay: (val: boolean) => void;
  toggleAutoplay: () => void;
  selectVideo: (url: string, index: number) => void;
  playNext: () => boolean;
  clearSearch: () => void;
  persistToStorage: () => void;
  restoreFromStorage: () => void;
  extractVideoId: (url: string) => string;
}

const STORAGE_KEY = 'dazai_youtube_state';

export const useYoutubeStore = create<YoutubeState>((set, get) => ({
  searchQuery: '',
  searchResults: [],
  currentVideoUrl: '',
  currentVideoIndex: -1,
  playlistTitle: '',
  message: '',
  isSearching: false,
  isProcessing: false,
  autoplay: true,

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => {
    set({ searchResults: results });
    get().persistToStorage();
  },
  setCurrentVideoUrl: (url) => {
    set({ currentVideoUrl: url });
    get().persistToStorage();
  },
  setCurrentVideoIndex: (index) => set({ currentVideoIndex: index }),
  setPlaylistTitle: (title) => set({ playlistTitle: title }),
  setMessage: (msg) => set({ message: msg }),
  setIsSearching: (val) => set({ isSearching: val }),
  setIsProcessing: (val) => set({ isProcessing: val }),
  setAutoplay: (val) => {
    set({ autoplay: val });
    get().persistToStorage();
  },
  toggleAutoplay: () => {
    set((s) => ({ autoplay: !s.autoplay }));
    get().persistToStorage();
  },

  selectVideo: (url, index) => {
    set({ currentVideoUrl: url, currentVideoIndex: index });
    get().persistToStorage();
  },

  playNext: () => {
    const state = get();
    const videoResults = state.searchResults.filter((r) => r.type !== 'list');
    const nextIndex = state.currentVideoIndex + 1;
    if (nextIndex < videoResults.length) {
      const nextVideo = videoResults[nextIndex];
      set({ currentVideoUrl: nextVideo.url, currentVideoIndex: nextIndex });
      get().persistToStorage();
      return true;
    }
    return false;
  },

  clearSearch: () => {
    set({
      searchQuery: '',
      searchResults: [],
      playlistTitle: '',
      currentVideoUrl: '',
      currentVideoIndex: -1,
    });
    get().persistToStorage();
  },

  extractVideoId: (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.searchParams.get('v') || '';
    } catch {
      return url.replace('https://www.youtube.com/watch?v=', '');
    }
  },

  persistToStorage: () => {
    if (typeof window === 'undefined') return;
    const state = get();
    const data = {
      searchQuery: state.searchQuery,
      searchResults: state.searchResults,
      currentVideoUrl: state.currentVideoUrl,
      currentVideoIndex: state.currentVideoIndex,
      playlistTitle: state.playlistTitle,
      autoplay: state.autoplay,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* quota exceeded — ignore */ }
  },

  restoreFromStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      set({
        searchQuery: data.searchQuery || '',
        searchResults: data.searchResults || [],
        currentVideoUrl: data.currentVideoUrl || '',
        currentVideoIndex: data.currentVideoIndex ?? -1,
        playlistTitle: data.playlistTitle || '',
        autoplay: data.autoplay ?? true,
      });
    } catch { /* corrupt data — ignore */ }
  },
}));
