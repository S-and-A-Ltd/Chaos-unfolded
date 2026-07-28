import { create } from 'zustand';

export interface YoutubeVideo {
  url: string;
  title: string;
  thumbnail: string;
  type: 'video' | 'list';
  listId?: string;
  author?: { name: string };
  videoId?: string;
}

interface YoutubeState {
  searchQuery: string;
  searchResults: YoutubeVideo[];
  upNextQueue: YoutubeVideo[];
  watchHistory: string[];
  currentVideoUrl: string;
  playlistTitle: string;
  message: string;
  isSearching: boolean;
  isProcessing: boolean;
  autoplay: boolean;

  setSearchQuery: (query: string) => void;
  setSearchResults: (results: YoutubeVideo[]) => void;
  setCurrentVideoUrl: (url: string) => void;
  setPlaylistTitle: (title: string) => void;
  setMessage: (msg: string) => void;
  setIsSearching: (val: boolean) => void;
  setIsProcessing: (val: boolean) => void;
  setAutoplay: (val: boolean) => void;
  toggleAutoplay: () => void;
  selectVideo: (url: string) => void;
  fetchUpNext: (videoId: string) => Promise<void>;
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
  upNextQueue: [],
  watchHistory: [],
  currentVideoUrl: '',
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

  selectVideo: (url) => {
    const videoId = get().extractVideoId(url);
    if (!videoId) return;

    set((state) => {
      // Add to watch history, keeping only the last 20
      const history = [...state.watchHistory.filter(id => id !== videoId), videoId].slice(-20);
      return { 
        currentVideoUrl: url,
        watchHistory: history 
      };
    });
    
    get().persistToStorage();
    get().fetchUpNext(videoId);
  },

  fetchUpNext: async (videoId: string) => {
    try {
      const res = await fetch(`/api/youtube/search?relatedToVideoId=${videoId}`);
      const data = await res.json();
      if (data.items) {
        set((state) => {
          // Filter out already watched videos
          let nextVideos = (data.items as YoutubeVideo[]).filter(v => {
            const id = v.videoId || get().extractVideoId(v.url);
            return !state.watchHistory.includes(id);
          });

          // If everything was filtered out, just use all of them as fallback
          if (nextVideos.length === 0) {
            nextVideos = data.items;
          }

          return { upNextQueue: nextVideos };
        });
        get().persistToStorage();
      }
    } catch {
      // ignore silently, upNext remains what it was or empty
    }
  },

  playNext: () => {
    const state = get();
    
    // 1. Try Up Next Queue first
    if (state.upNextQueue.length > 0) {
      const nextVideo = state.upNextQueue[0];
      get().selectVideo(nextVideo.url);
      return true;
    }

    // 2. Fallback to search results if Up Next is empty
    const videoResults = state.searchResults.filter((r) => r.type !== 'list');
    const currentIndex = videoResults.findIndex(v => v.url === state.currentVideoUrl);
    
    if (currentIndex >= 0 && currentIndex + 1 < videoResults.length) {
      const nextVideo = videoResults[currentIndex + 1];
      get().selectVideo(nextVideo.url);
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
      upNextQueue: [],
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
      upNextQueue: state.upNextQueue,
      watchHistory: state.watchHistory,
      currentVideoUrl: state.currentVideoUrl,
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
        upNextQueue: data.upNextQueue || [],
        watchHistory: data.watchHistory || [],
        currentVideoUrl: data.currentVideoUrl || '',
        playlistTitle: data.playlistTitle || '',
        autoplay: data.autoplay ?? true,
      });
    } catch { /* corrupt data — ignore */ }
  },
}));
