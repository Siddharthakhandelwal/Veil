const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');

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
  ipcMain.on('window:minimize', () => win.minimize());
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
