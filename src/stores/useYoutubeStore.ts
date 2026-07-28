import { create } from 'zustand';

export interface YoutubeVideo {
  url: string;
  title: string;
  thumbnail: string;
  type: 'video' | 'list';
  listId?: string;
  author?: { name: string };
  videoId?: string;
  duration?: string;
  viewCount?: string;
}

interface YoutubeState {
  mode: 'search' | 'watch';
  searchQuery: string;
  searchResults: YoutubeVideo[];
  searchNextPageToken: string | null;
  upNextQueue: YoutubeVideo[];
  watchHistory: string[];
  recommendationCache: Record<string, YoutubeVideo[]>;
  currentVideoUrl: string;
  playlistTitle: string;
  message: string;
  isSearching: boolean;
  isFetchingNextPage: boolean;
  isProcessing: boolean;
  isFetchingUpNext: boolean;
  autoplay: boolean;

  setSearchQuery: (query: string) => void;
  setSearchResults: (results: YoutubeVideo[], nextPageToken?: string | null) => void;
  fetchNextSearchPage: () => Promise<void>;
  setCurrentVideoUrl: (url: string) => void;
  setPlaylistTitle: (title: string) => void;
  setMessage: (msg: string) => void;
  setIsSearching: (val: boolean) => void;
  setIsProcessing: (val: boolean) => void;
  setAutoplay: (val: boolean) => void;
  toggleAutoplay: () => void;
  selectVideo: (url: string) => void;
  exitWatchMode: () => void;
  fetchUpNext: (videoId: string) => Promise<void>;
  playNext: () => boolean;
  clearSearch: () => void;
  persistToStorage: () => void;
  restoreFromStorage: () => void;
  extractVideoId: (url: string) => string;
}

const STORAGE_KEY = 'dazai_youtube_state';

export const useYoutubeStore = create<YoutubeState>((set, get) => ({
  mode: 'search',
  searchQuery: '',
  searchResults: [],
  searchNextPageToken: null,
  upNextQueue: [],
  watchHistory: [],
  recommendationCache: {},
  currentVideoUrl: '',
  playlistTitle: '',
  message: '',
  isSearching: false,
  isFetchingNextPage: false,
  isProcessing: false,
  isFetchingUpNext: false,
  autoplay: true,

  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setSearchResults: (results, nextPageToken = null) => {
    set({ searchResults: results, searchNextPageToken: nextPageToken, mode: 'search' });
    get().persistToStorage();
  },

  fetchNextSearchPage: async () => {
    const { searchQuery, searchNextPageToken, isFetchingNextPage, searchResults } = get();
    if (!searchQuery.trim() || !searchNextPageToken || isFetchingNextPage) return;

    set({ isFetchingNextPage: true });
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}&pageToken=${searchNextPageToken}`);
      const data = await res.json();
      if (data.items) {
        set({
          searchResults: [...searchResults, ...data.items],
          searchNextPageToken: data.nextPageToken || null
        });
        get().persistToStorage();
      }
    } catch {
      // Ignore errors silently on pagination
    } finally {
      set({ isFetchingNextPage: false });
    }
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
      
      // If the selected video is in the Up Next queue, remove it from the queue
      const updatedQueue = state.upNextQueue.filter(v => get().extractVideoId(v.url) !== videoId);

      return { 
        currentVideoUrl: url,
        watchHistory: history,
        mode: 'watch',
        upNextQueue: updatedQueue
      };
    });
    
    get().persistToStorage();
    get().fetchUpNext(videoId);
  },

  exitWatchMode: () => {
    set({ mode: 'search', currentVideoUrl: '', upNextQueue: [] });
    get().persistToStorage();
  },

  fetchUpNext: async (videoId: string) => {
    const { recommendationCache, watchHistory, searchResults, searchQuery } = get();

    const processAndSetRecommendations = (items: YoutubeVideo[]) => {
      set((state) => {
        // Filter out already watched videos and the currently playing video
        let nextVideos = items.filter(v => {
          const id = v.videoId || get().extractVideoId(v.url);
          return id !== videoId && !state.watchHistory.includes(id);
        });

        // Ensure we don't duplicate items already in the queue
        const existingIds = new Set(state.upNextQueue.map(v => get().extractVideoId(v.url)));
        nextVideos = nextVideos.filter(v => !existingIds.has(v.videoId || get().extractVideoId(v.url)));

        let finalQueue = [...state.upNextQueue, ...nextVideos];

        // If the queue is entirely empty after filtering, relax the watchHistory constraint, 
        // but never include the currently playing video.
        if (finalQueue.length === 0) {
          finalQueue = items.filter(v => {
             const id = v.videoId || get().extractVideoId(v.url);
             return id !== videoId;
          });
        }

        return { upNextQueue: finalQueue };
      });
      get().persistToStorage();
    };

    // 1. Check cache first
    if (recommendationCache[videoId]) {
      processAndSetRecommendations(recommendationCache[videoId]);
      return;
    }

    set({ isFetchingUpNext: true });

    try {
      const res = await fetch(`/api/youtube/search?relatedToVideoId=${videoId}`);
      const data = await res.json();
      
      let itemsToProcess: YoutubeVideo[] = data.items || [];

      // 2. Fallback to search results if endpoint returns nothing
      if (itemsToProcess.length === 0) {
        itemsToProcess = searchResults.filter(v => v.type === 'video');
      }

      // 3. Last resort fallback: Generic search query related to previous search
      if (itemsToProcess.length === 0) {
         const fallbackRes = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery || 'study motivation')}`);
         const fallbackData = await fallbackRes.json();
         itemsToProcess = fallbackData.items || [];
      }

      // Update cache
      set((state) => ({
        recommendationCache: {
          ...state.recommendationCache,
          [videoId]: itemsToProcess
        }
      }));

      processAndSetRecommendations(itemsToProcess);

    } catch {
      // ignore silently, upNext remains what it was
    } finally {
      set({ isFetchingUpNext: false });
    }
  },

  playNext: () => {
    const state = get();
    
    // Autoplay ONLY uses the Up Next queue now
    if (state.upNextQueue.length > 0) {
      const nextVideo = state.upNextQueue[0];
      get().selectVideo(nextVideo.url);
      return true;
    }

    return false;
  },

  clearSearch: () => {
    set({
      searchQuery: '',
      searchResults: [],
      searchNextPageToken: null,
      playlistTitle: '',
      currentVideoUrl: '',
      upNextQueue: [],
      mode: 'search'
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
      mode: state.mode,
      searchQuery: state.searchQuery,
      searchResults: state.searchResults,
      searchNextPageToken: state.searchNextPageToken,
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
        mode: data.mode || 'search',
        searchQuery: data.searchQuery || '',
        searchResults: data.searchResults || [],
        searchNextPageToken: data.searchNextPageToken || null,
        upNextQueue: data.upNextQueue || [],
        watchHistory: data.watchHistory || [],
        currentVideoUrl: data.currentVideoUrl || '',
        playlistTitle: data.playlistTitle || '',
        autoplay: data.autoplay ?? true,
      });
    } catch { /* corrupt data — ignore */ }
  },
}));
