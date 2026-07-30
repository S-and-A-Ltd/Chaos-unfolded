const { app, BrowserWindow, ipcMain, powerMonitor, powerSaveBlocker, Menu, nativeTheme, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const http = require('http');

let mainWindow;
let powerSaveId = null;
let isFocusLocked = false;
let serverProcess = null;

function logStartup(step, message, extra = '') {
  const time = new Date().toISOString();
  const line = `[${time}] [${step}] ${message}${extra ? ' | ' + extra : ''}`;
  console.log(line);
  try {
    const logPath = path.join(app.getPath('userData'), 'startup.log');
    fs.appendFileSync(logPath, line + '\n', 'utf-8');
  } catch (err) {
    console.error('Failed to append to startup.log:', err);
  }
}

function getAppRoot() {
  if (app.isPackaged) {
    const appDir = path.join(process.resourcesPath, 'app');
    if (fs.existsSync(appDir)) return appDir;
    const unpackedDir = path.join(process.resourcesPath, 'app.asar.unpacked');
    if (fs.existsSync(unpackedDir)) return unpackedDir;
    return path.join(process.resourcesPath, 'app.asar');
  }
  return path.join(__dirname, '..');
}

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const data = fs.readFileSync(getWindowStatePath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { width: 1400, height: 900, x: undefined, y: undefined };
  }
}

function saveWindowState(window) {
  if (!window || window.isDestroyed()) return;
  try {
    const bounds = window.getBounds();
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(bounds), 'utf-8');
  } catch (err) {
    console.error('Failed to save window state:', err);
  }
}

function createMainWindow(urlToLoad) {
  nativeTheme.themeSource = 'dark';
  Menu.setApplicationMenu(null);

  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    title: 'Chaos Unfolded',
    width: state.width || 1400,
    height: state.height || 900,
    x: state.x,
    y: state.y,
    minWidth: 1000,
    minHeight: 650,
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
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: false,
      webviewTag: true,
    },
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
  });

  const saveState = () => saveWindowState(mainWindow);
  mainWindow.on('resize', saveState);
  mainWindow.on('move', saveState);

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logStartup('STEP 8', `BrowserWindow did-fail-load error! ErrorCode: ${errorCode}, ErrorDescription: "${errorDescription}", ValidatedURL: "${validatedURL}", IsMainFrame: ${isMainFrame}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logStartup('STEP 8', `BrowserWindow did-finish-load SUCCESS! Loaded URL: "${mainWindow.webContents.getURL()}"`);
  });

  logStartup('STEP 7', `Loading URL into BrowserWindow: ${urlToLoad}`);
  mainWindow.loadURL(urlToLoad);

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isInternal = url.startsWith('http://localhost:3000') || url.startsWith('http://127.0.0.1:3000');
    if (!isInternal) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isInternal = url.startsWith('http://localhost:3000') || url.startsWith('http://127.0.0.1:3000');
    if (!isInternal) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

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

// Storage IPC Handlers for Application Data persistence in user's OS app data directory
const getStorageDir = () => {
  const dir = path.join(app.getPath('userData'), 'storage');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Security helper: Validate key strings to prevent directory traversal
function isValidStorageKey(key) {
  return typeof key === 'string' && key.length > 0 && key.length < 256 && /^[a-zA-Z0-9_\-.]+$/.test(key);
}

ipcMain.handle('save-storage-file', (event, key, data) => {
  if (!isValidStorageKey(key)) {
    console.error(`[IPC Security] Invalid storage key rejected: ${key}`);
    return false;
  }
  try {
    const storageFolder = getStorageDir();
    const filePath = path.join(storageFolder, `${key}.json`);
    if (!filePath.startsWith(storageFolder)) {
      console.error(`[IPC Security] Path traversal blocked for key: ${key}`);
      return false;
    }
    fs.writeFileSync(filePath, typeof data === 'string' ? data : JSON.stringify(data), 'utf-8');
    return true;
  } catch (err) {
    console.error(`[Desktop Storage] Failed to save file ${key}:`, err);
    return false;
  }
});

ipcMain.handle('get-storage-file', (event, key) => {
  if (!isValidStorageKey(key)) {
    console.error(`[IPC Security] Invalid storage key rejected: ${key}`);
    return null;
  }
  try {
    const storageFolder = getStorageDir();
    const filePath = path.join(storageFolder, `${key}.json`);
    if (!filePath.startsWith(storageFolder)) {
      console.error(`[IPC Security] Path traversal blocked for key: ${key}`);
      return null;
    }
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  } catch (err) {
    console.error(`[Desktop Storage] Failed to read file ${key}:`, err);
    return null;
  }
});

ipcMain.handle('remove-storage-file', (event, key) => {
  if (!isValidStorageKey(key)) {
    console.error(`[IPC Security] Invalid storage key rejected: ${key}`);
    return false;
  }
  try {
    const storageFolder = getStorageDir();
    const filePath = path.join(storageFolder, `${key}.json`);
    if (!filePath.startsWith(storageFolder)) {
      console.error(`[IPC Security] Path traversal blocked for key: ${key}`);
      return false;
    }
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (err) {
    console.error(`[Desktop Storage] Failed to remove file ${key}:`, err);
    return false;
  }
});

// Native File System Support (Open, Save, Save As, Export)
ipcMain.handle('show-open-dialog', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: typeof options.title === 'string' ? options.title : 'Open Chaos Unfolded Project',
    filters: Array.isArray(options.filters) ? options.filters : [
      { name: 'Chaos Unfolded Project', extensions: ['dazai', 'json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: Array.isArray(options.properties) ? options.properties : ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, filePath: null, content: null };
  }
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { canceled: false, filePath, content };
});

ipcMain.handle('show-save-dialog', async (event, options = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: typeof options.title === 'string' ? options.title : 'Save File',
    defaultPath: typeof options.defaultPath === 'string' ? options.defaultPath : 'Project.dazai',
    filters: Array.isArray(options.filters) ? options.filters : [
      { name: 'Chaos Unfolded Project', extensions: ['dazai', 'json'] }
    ],
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true, filePath: null };
  }
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('write-file-data', async (event, filePath, data, encoding = 'utf-8') => {
  if (typeof filePath !== 'string' || !filePath || typeof data === 'undefined') {
    console.error('[IPC Security] Invalid write-file-data parameters');
    return false;
  }
  const allowedEncodings = ['utf-8', 'base64', 'binary'];
  if (!allowedEncodings.includes(encoding)) {
    console.error(`[IPC Security] Invalid encoding rejected: ${encoding}`);
    return false;
  }
  try {
    if (encoding === 'base64') {
      const base64Data = data.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);
    } else if (encoding === 'binary') {
      const buffer = Buffer.from(data);
      fs.writeFileSync(filePath, buffer);
    } else {
      fs.writeFileSync(filePath, typeof data === 'string' ? data : JSON.stringify(data, null, 2), 'utf-8');
    }
    return true;
  } catch (err) {
    console.error('[Native File System] Failed to write file:', err);
    return false;
  }
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
app.whenReady().then(async () => {
  try {
    const logPath = path.join(app.getPath('userData'), 'startup.log');
    fs.writeFileSync(logPath, `=== CHAOS UNFOLDED STARTUP LOG ===\nLog Location: ${logPath}\n\n`, 'utf-8');
  } catch {}

  // STEP 1
  logStartup('STEP 1', 'Electron main process started.');

  // STEP 2: Dev vs production
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
  logStartup('STEP 2', `Mode: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} (app.isPackaged=${app.isPackaged}, NODE_ENV=${process.env.NODE_ENV})`);

  // ── DEVELOPMENT: npm run dev is already running — open window directly ──────
  if (isDev) {
    logStartup('STEP 2 [DEV]', 'Development mode — skipping standalone server spawn. Loading http://localhost:3000 directly.');
    createMainWindow('http://localhost:3000');
    // Open DevTools automatically in development
    if (mainWindow) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow('http://localhost:3000');
    });
    return;
  }

  // ── PRODUCTION: spawn standalone server then open window ────────────────────

  // STEP 3: Resolve standalone server path
  const appRoot = getAppRoot();
  const serverPath = path.join(appRoot, '.next', 'standalone', 'server.js');
  const standaloneDir = path.join(appRoot, '.next', 'standalone');
  logStartup('STEP 3', `Standalone server path: ${serverPath}`);

  // STEP 4: Verify server.js exists
  const serverExists = fs.existsSync(serverPath);
  logStartup('STEP 4', `server.js exists: ${serverExists}`);

  // STEP 5: Spawn server
  if (!serverExists) {
    logStartup('STEP 5', 'ABORT: server.js not found. Cannot start application.');
    createMainWindow('about:blank');
    return;
  }

  logStartup('STEP 5', 'Spawning standalone server...');
  let stderrAccumulated = '';

  try {
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: standaloneDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: '3000',
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    logStartup('STEP 5', `Server spawned. PID: ${serverProcess.pid}`);

    serverProcess.stdout?.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) logStartup('STEP 5 [STDOUT]', text);
    });

    serverProcess.stderr?.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) {
        stderrAccumulated += text + '\n';
        logStartup('STEP 5 [STDERR]', text);
      }
    });

    serverProcess.on('exit', (code, signal) => {
      logStartup('STEP 5 [EXIT]', `Server exited. code=${code} signal=${signal}`);
      if (stderrAccumulated) logStartup('STEP 5 [STDERR FULL]', stderrAccumulated.trim());
    });
  } catch (err) {
    logStartup('STEP 5 [SPAWN ERROR]', err.stack || String(err));
  }

  // STEP 6: Poll localhost:3000 every second
  logStartup('STEP 6', 'Polling http://127.0.0.1:3000...');
  let httpOk = false;
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts && !httpOk) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:3000', (res) => {
        logStartup('STEP 6', `Attempt #${attempts}: HTTP ${res.statusCode}`);
        if (res.statusCode >= 200 && res.statusCode < 400) httpOk = true;
        resolve(true);
      });
      req.on('error', (err) => {
        logStartup('STEP 6', `Attempt #${attempts}: ECONNREFUSED (${err.code})`);
        resolve(false);
      });
      req.end();
    });
  }

  // STEP 7: Open BrowserWindow only after server is ready
  if (httpOk) {
    logStartup('STEP 7', 'Server ready. Creating BrowserWindow → http://localhost:3000');
    createMainWindow('http://localhost:3000');
  } else {
    logStartup('STEP 7', `TIMEOUT: server did not respond within ${maxAttempts}s`);
    createMainWindow('about:blank');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow('http://localhost:3000');
  });
});

function killNextServerProcess() {
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
    serverProcess = null;
  }
}

app.on('will-quit', killNextServerProcess);

app.on('window-all-closed', () => {
  killNextServerProcess();
  stopProcessKiller();
  if (powerSaveId !== null) {
    powerSaveBlocker.stop(powerSaveId);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

