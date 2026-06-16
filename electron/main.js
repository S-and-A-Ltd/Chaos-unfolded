const { app, BrowserWindow, ipcMain, powerMonitor, powerSaveBlocker } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;
let powerSaveId = null;
let isFocusLocked = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a1a',
      symbolColor: '#8b5cf6',
      height: 36,
    },
    backgroundColor: '#0a0a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true, // Enable guest content loading for YouTube and AI apps
    },
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
  });

  // In development, load from Next.js dev server
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, load from the built Next.js standalone server
    mainWindow.loadURL('http://localhost:3000');
  }

  // Focus tracking for the study companion
  mainWindow.on('blur', () => {
    mainWindow.webContents.send('window-blur');
    if (isFocusLocked) {
      setTimeout(() => {
        if (mainWindow && isFocusLocked) {
          mainWindow.focus();
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
        }
      }, 50);
    }
  });

  mainWindow.on('focus', () => {
    mainWindow.webContents.send('window-focus');
  });

  // Block minimize attempts during focus lock
  mainWindow.on('minimize', (event) => {
    if (isFocusLocked) {
      event.preventDefault();
      mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Block close attempts during focus lock
  mainWindow.on('close', (event) => {
    if (isFocusLocked) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Background process killer
let killInterval = null;

function startProcessKiller() {
  if (killInterval) clearInterval(killInterval);
  
  const BLACKLISTED_APPS = [
    'chrome.exe', 'msedge.exe', 'firefox.exe', 'opera.exe', 'brave.exe', 'safari.exe', 'vivaldi.exe', 'iexplore.exe',
    'discord.exe', 'spotify.exe', 'steam.exe', 'epicgameslauncher.exe', 'origin.exe', 'uplay.exe', 'galaxyclient.exe',
    'riotclientux.exe', 'battle.net.exe', 'league of legends.exe', 'valorant.exe', 'playoverwatch.exe', 'csgo.exe', 'minecraft.exe',
    'slack.exe', 'teams.exe', 'whatsapp.exe', 'telegram.exe', 'zoom.exe', 'twitch.exe'
  ];

  killInterval = setInterval(() => {
    if (!isFocusLocked) return;
    
    // Forcefully kill any running blacklisted browsers or communication/gaming apps
    BLACKLISTED_APPS.forEach(app => {
      exec(`taskkill /F /IM ${app}`, (err) => {
        // Silent error if task is not currently running
      });
    });
  }, 1000);
}

function stopProcessKiller() {
  if (killInterval) {
    clearInterval(killInterval);
    killInterval = null;
  }
}

// Focus Lock IPC handler
ipcMain.handle('set-focus-lock', (event, enabled) => {
  isFocusLocked = enabled;
  if (mainWindow) {
    if (enabled) {
      mainWindow.setKiosk(true);
      mainWindow.setSkipTaskbar(true);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.focus();
      startProcessKiller();
    } else {
      mainWindow.setKiosk(false);
      mainWindow.setSkipTaskbar(false);
      mainWindow.setAlwaysOnTop(false);
      stopProcessKiller();
    }
  }
  return true;
});

// Prevent system sleep during study sessions
ipcMain.handle('prevent-sleep', () => {
  if (powerSaveId === null) {
    powerSaveId = powerSaveBlocker.start('prevent-display-sleep');
  }
  return true;
});

ipcMain.handle('allow-sleep', () => {
  if (powerSaveId !== null) {
    powerSaveBlocker.stop(powerSaveId);
    powerSaveId = null;
  }
  return true;
});

// System idle time
ipcMain.handle('get-idle-time', () => {
  return powerMonitor.getSystemIdleTime();
});

// Window controls (restricted during focus lock)
ipcMain.handle('minimize-window', () => {
  if (!isFocusLocked) {
    mainWindow?.minimize();
  }
});

ipcMain.handle('maximize-window', () => {
  if (!isFocusLocked) {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (!isFocusLocked) {
    mainWindow?.close();
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopProcessKiller();
  if (powerSaveId !== null) {
    powerSaveBlocker.stop(powerSaveId);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
