/**
 * Desktop Storage Utility
 * Synchronizes key-value state (Settings, Search History, Recent Files, Whiteboard Projects, AI Notes, Flashcards)
 * directly into the user's OS application data directory (%APPDATA%/dazai-study-companion/storage).
 */

export async function saveDesktopData(key: string, value: any): Promise<void> {
  const dataStr = typeof value === 'string' ? value : JSON.stringify(value);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, dataStr);
    } catch (e) {
      console.warn('[Desktop Storage] localStorage fallback warning:', e);
    }
    if ((window as any).electronAPI?.saveStorageFile) {
      await (window as any).electronAPI.saveStorageFile(key, dataStr);
    }
  }
}

export async function loadDesktopData(key: string): Promise<string | null> {
  if (typeof window !== 'undefined') {
    if ((window as any).electronAPI?.getStorageFile) {
      const desktopVal = await (window as any).electronAPI.getStorageFile(key);
      if (desktopVal !== null && desktopVal !== undefined) {
        try {
          localStorage.setItem(key, desktopVal);
        } catch {}
        return desktopVal;
      }
    }
    return localStorage.getItem(key);
  }
  return null;
}

export async function removeDesktopData(key: string): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {}
    if ((window as any).electronAPI?.removeStorageFile) {
      await (window as any).electronAPI.removeStorageFile(key);
    }
  }
}
