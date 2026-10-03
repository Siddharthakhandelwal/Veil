const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let psProcess = null;

function toggleWindow() {
  const allWins = BrowserWindow.getAllWindows();
  if (allWins.length === 0) {
    createWindow();
    return;
  }
  const win = allWins[0];

  if (win.isVisible() && !win.isMinimized()) {
    console.log('[toggleWindow] Window is visible -> hiding');
    win.hide();
  } else {
    console.log('[toggleWindow] Window is hidden/minimized -> showing and focusing');
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
  }
}

function startNativeKeyHook() {
  const hookScript = path.join(__dirname, 'keylistener.ps1');
  console.log('[startNativeKeyHook] Launching keylistener:', hookScript);

  try {
    psProcess = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', hookScript,
    ], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    psProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if (text.includes('TRIGGER_HOTKEY')) {
        console.log('[Native Hook] Caps+A detected! Toggling window...');
        toggleWindow();
      }
    });

    psProcess.stderr.on('data', (err) => {
      console.error('[KeyHook Stderr]:', err.toString());
    });

    psProcess.on('exit', (code) => {
      console.log('[KeyHook process exited]:', code);
    });
  } catch (e) {
    console.error('[Failed to spawn keyhook]:', e);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    title: 'Chat',
    width: 860,
    height: 720,
    minWidth: 500,
    minHeight: 450,
    transparent: true,
    frame: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // In development, load from Vite local server; otherwise load dist index.html
  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Window control IPC handlers
  ipcMain.on('window:minimize', () => {
    console.log('[window:minimize] Hiding window');
    win.hide();
  });
  ipcMain.on('window:maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.on('window:close', () => win.close());

  // Full-screen capture IPC handler
  ipcMain.handle('capture-screen', async () => {
    const allWins = BrowserWindow.getAllWindows();
    const activeWin = allWins[0];

    // Hide window briefly so screenshot captures the clean desktop/apps behind it
    if (activeWin) activeWin.setOpacity(0);
    await new Promise((resolve) => setTimeout(resolve, 180));

    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.size;
      const factor = primaryDisplay.scaleFactor || 1;

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.round(width * factor),
          height: Math.round(height * factor),
        },
      });

      if (activeWin) activeWin.setOpacity(1);

      if (sources && sources.length > 0) {
        return sources[0].thumbnail.toDataURL();
      }
    } catch (err) {
      console.error('Failed to capture screen:', err);
      if (activeWin) activeWin.setOpacity(1);
    }
    return null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Start native low-level Caps+A keyboard hook
  startNativeKeyHook();

  // Register Alt+A as secondary standard shortcut
  try {
    globalShortcut.register('Alt+A', () => {
      console.log('[HOTKEY TRIGGERED]: Alt+A');
      toggleWindow();
    });
  } catch (e) {
    console.log('Alt+A registration error:', e);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  if (psProcess) {
    psProcess.kill();
    psProcess = null;
  }
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
