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
  sidebarView: 'search' | 'upnext';
  searchQuery: string;
  searchResults: YoutubeVideo[];
  searchNextPageToken: string | null;
  upNextQueue: YoutubeVideo[];
  upNextNextPageToken: string | null;
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
  showSearchSidebar: () => void;
  fetchUpNext: (videoId: string, isNextPage?: boolean) => Promise<void>;
  playNext: () => boolean;
  clearSearch: () => void;
  persistToStorage: () => void;
  restoreFromStorage: () => void;
  extractVideoId: (url: string) => string;
}

const STORAGE_KEY = 'dazai_youtube_state';

export const useYoutubeStore = create<YoutubeState>((set, get) => ({
  sidebarView: 'search',
  searchQuery: '',
  searchResults: [],
  searchNextPageToken: null,
  upNextQueue: [],
  upNextNextPageToken: null,
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
    set({ searchResults: results, searchNextPageToken: nextPageToken, sidebarView: 'search' });
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
      
      return { 
        currentVideoUrl: url,
        watchHistory: history,
        sidebarView: 'upnext' as const,
        upNextQueue: [],
        upNextNextPageToken: null,
        recommendationCache: {}
      };
    });
    
    get().persistToStorage();
    get().fetchUpNext(videoId, false);
  },

  showSearchSidebar: () => {
    // Only switch the sidebar view. NEVER touch the player or currentVideoUrl.
    set({ sidebarView: 'search' });
    get().persistToStorage();
  },

  fetchUpNext: async (videoId: string, isNextPage = false) => {
    const { recommendationCache, watchHistory, searchResults, searchQuery, upNextNextPageToken, isFetchingUpNext } = get();

    if (isFetchingUpNext) return;
    if (isNextPage && !upNextNextPageToken) return;

    const processAndSetRecommendations = (items: YoutubeVideo[], newPageToken?: string) => {
      set((state) => {
        // 1. Remove watched videos and the currently playing video
        let nextVideos = items.filter(v => {
          const id = v.videoId || get().extractVideoId(v.url);
          return id !== videoId && !state.watchHistory.includes(id);
        });

        // 2. Strict deduplication across the ENTIRE existing queue (by ID and by title)
        const existingIds = new Set(state.upNextQueue.map(v => get().extractVideoId(v.url)));
        const existingTitles = new Set(state.upNextQueue.map(v => v.title.toLowerCase()));

        nextVideos = nextVideos.filter(v => {
          const id = v.videoId || get().extractVideoId(v.url);
          const titleLower = v.title.toLowerCase();

          if (existingIds.has(id)) return false;
          if (existingTitles.has(titleLower)) return false;
          if (titleLower.includes('#shorts') || titleLower.includes('shorts')) return false;

          existingIds.add(id);
          existingTitles.add(titleLower);
          return true;
        });

        // 3. Diversity enforcement: max 1 per artist across the ENTIRE queue
        const existingArtists = new Set<string>();
        state.upNextQueue.forEach(v => {
          existingArtists.add((v.author?.name || '').toLowerCase());
        });

        const accepted: YoutubeVideo[] = [];

        for (const v of nextVideos) {
          const artist = (v.author?.name || 'unknown').toLowerCase();

          // Hard rule: if this artist is already in the queue OR already accepted, skip
          if (existingArtists.has(artist)) continue;

          existingArtists.add(artist);
          accepted.push(v);
        }

        // 4. Interleave: ensure no two consecutive videos share the same artist
        const interleaved: YoutubeVideo[] = [];
        const remaining = [...accepted];
        let lastArtist = '';

        while (remaining.length > 0) {
          const idx = remaining.findIndex(v => (v.author?.name || '').toLowerCase() !== lastArtist);
          if (idx === -1) {
            // Can't avoid consecutive — just push what's left
            interleaved.push(...remaining);
            break;
          }
          const picked = remaining.splice(idx, 1)[0];
          lastArtist = (picked.author?.name || '').toLowerCase();
          interleaved.push(picked);
        }

        const finalQueue = isNextPage
          ? [...state.upNextQueue, ...interleaved]
          : [...interleaved];

        // Emergency fallback: if the queue is completely empty after all filtering
        if (!isNextPage && finalQueue.length === 0 && items.length > 0) {
          const fallback = items
            .filter(v => (v.videoId || get().extractVideoId(v.url)) !== videoId)
            .slice(0, 20);
          return {
            upNextQueue: fallback,
            upNextNextPageToken: newPageToken || null
          };
        }

        return {
          upNextQueue: finalQueue,
          upNextNextPageToken: newPageToken || null
        };
      });
      get().persistToStorage();
    };

    // 1. Check cache first (only for first page)
    if (!isNextPage && recommendationCache[videoId]) {
      processAndSetRecommendations(recommendationCache[videoId], undefined);
      return;
    }

    set({ isFetchingUpNext: true });

    try {
      let url = `/api/youtube/search?relatedToVideoId=${videoId}`;
      if (isNextPage && upNextNextPageToken) {
        url += `&pageToken=${upNextNextPageToken}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      
      let itemsToProcess: YoutubeVideo[] = data.items || [];

      // 2. Fallback to search results if endpoint returns nothing and it's the first page
      if (!isNextPage && itemsToProcess.length === 0) {
        itemsToProcess = searchResults.filter(v => v.type === 'video');
      }

      // 3. Last resort fallback: Generic search query related to previous search
      if (!isNextPage && itemsToProcess.length === 0) {
         const fallbackRes = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery || 'study motivation')}`);
         const fallbackData = await fallbackRes.json();
         itemsToProcess = fallbackData.items || [];
      }

      // Update cache only if it's the first page
      if (!isNextPage) {
        set((state) => ({
          recommendationCache: {
            ...state.recommendationCache,
            [videoId]: itemsToProcess
          }
        }));
      }

      processAndSetRecommendations(itemsToProcess, data.nextPageToken);

      // Print strict diagnostic logs for verification
      if (!isNextPage && data._debug) {
        const d = data._debug;
        
        let logStr = `\n==========================\nCURRENT VIDEO\n==========================\n`;
        logStr += `Title: ${d.currentVideo.title}\n`;
        logStr += `Channel: ${d.currentVideo.channel}\n`;
        logStr += `Category: ${d.currentVideo.category}\n`;
        logStr += `Tags: ${(d.currentVideo.tags || []).join(', ')}\n\n`;

        logStr += `==========================\nGENERATED SEARCH QUERIES\n==========================\n`;
        d.searchQueries.forEach((q: string, i: number) => {
          logStr += `Query ${i + 1}: ${q}\n`;
        });
        logStr += `\n`;

        logStr += `==========================\nYOUTUBE API RESPONSE\n==========================\n`;
        logStr += `First 10 returned channels\n\n`;
        d.rawResponses.forEach((r: any, i: number) => {
          logStr += `${i + 1}.\nTitle: ${r.title}\nChannel: ${r.channel}\n\n`;
        });

        logStr += `==========================\nFINAL UP NEXT\n==========================\n`;
        get().upNextQueue.slice(0, 15).forEach((v) => {
          logStr += `${v.title}\n${v.author?.name}\n\n`;
        });

        console.log(logStr);
      }

    } catch (err) {
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
      upNextNextPageToken: null,
      sidebarView: 'search'
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
      sidebarView: state.sidebarView,
      searchQuery: state.searchQuery,
      searchResults: state.searchResults,
      searchNextPageToken: state.searchNextPageToken,
      upNextQueue: state.upNextQueue,
      upNextNextPageToken: state.upNextNextPageToken,
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
        sidebarView: data.sidebarView || data.mode || 'search',
        searchQuery: data.searchQuery || '',
        searchResults: data.searchResults || [],
        searchNextPageToken: data.searchNextPageToken || null,
        upNextQueue: data.upNextQueue || [],
        upNextNextPageToken: data.upNextNextPageToken || null,
        watchHistory: data.watchHistory || [],
        currentVideoUrl: data.currentVideoUrl || '',
        playlistTitle: data.playlistTitle || '',
        autoplay: data.autoplay ?? true,
      });
    } catch { /* corrupt data — ignore */ }
  },
}));
