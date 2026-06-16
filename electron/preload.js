const { contextBridge, ipcRenderer } = require('electron');

// Expose protected Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // Power management
  preventSleep: () => ipcRenderer.invoke('prevent-sleep'),
  allowSleep: () => ipcRenderer.invoke('allow-sleep'),

  // System info
  getIdleTime: () => ipcRenderer.invoke('get-idle-time'),

  // Focus events from main process
  onWindowBlur: (callback) => {
    ipcRenderer.on('window-blur', callback);
    return () => ipcRenderer.removeListener('window-blur', callback);
  },
  onWindowFocus: (callback) => {
    ipcRenderer.on('window-focus', callback);
    return () => ipcRenderer.removeListener('window-focus', callback);
  },

  // Focus lock control
  setFocusLock: (enabled) => ipcRenderer.invoke('set-focus-lock', enabled),

  // Check if running in Electron
  isElectron: true,
});
