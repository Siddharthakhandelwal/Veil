const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, session } = require('electron');
const path = require('path');
const labDataPath = path.join(
  app.getPath('appData'),
  'Windows-System-Service-Lab'
);

app.setPath('userData', labDataPath);
const { spawn, exec, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const dotenv = require('dotenv');

const rootDir = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const envCandidates = [path.join(rootDir, '.env'), path.join(app.getPath('userData'), '.env'), path.join(process.cwd(), '.env')];
for (const envFile of envCandidates) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
    break;
  }
}

const LAB_SERVICE_NAME = 'WinmgmtLab';
const LAB_SERVICE_DISPLAY = 'Windows Management Instrumentation Lab';
const LAB_USER_NAME = 'SysServiceLab';
const APP_ID = 'com.research.windows-system-service-lab';
const AUTO_INSTALL_SERVICE = String(process.env.AUTO_INSTALL_SERVICE ?? 'true').toLowerCase() !== 'false';
let mainWindow = null;
let psProcess = null;

// Application identity experiment. This is intentionally a lab-specific identity,
// rather than claiming to be a Microsoft-signed application.
app.setAppUserModelId(APP_ID);

if (process.platform === 'win32') {
  app.setName('Windows System Service Lab');
  app.setAppUserModelId(APP_ID);
}

function logError(scope, error) {
  console.error(`[${scope}]`, error?.stack || error?.message || error);
}

// Lab process-identity experiment.
// This attempts the same metadata operation used by the original project.
// Modern Windows installations may not include WMIC; failure is logged and ignored.
function inspectProcessIdentity() {
  exec(
    `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ProcessId=${process.pid}' | Select-Object ProcessId,Name,ParentProcessId,ExecutablePath | Format-List"`,
    { windowsHide: true },
    (error, stdout, stderr) => {
      if (error) {
        console.error('[Process identity experiment]', error.message);
        return;
      }

      console.log('[Process identity experiment]');
      console.log(stdout);
    }
  );
}

// Preserved from the original experiment.
// IMPORTANT: BelowNormal changes scheduling priority; it does NOT hide a process
// from Task Manager or security/EDR tooling.
function hideFromTaskManager() {
  if (process.platform !== 'win32') return;
  try {
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$p = Get-Process -Id ${process.pid}; $p.PriorityClass = 'BelowNormal'`,
    ], { windowsHide: true, stdio: 'ignore' });
    ps.on('error', logError.bind(null, 'Priority experiment'));
  } catch (error) {
    logError('Priority experiment', error);
  }
}

function getLabServiceScriptPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'lab-service', 'install-lab-service.ps1');
  }
  return path.join(__dirname, '..', 'scripts', 'install-lab-service.ps1');
}

function ensureLabServiceInstalled() {
  if (process.platform !== 'win32' || !AUTO_INSTALL_SERVICE) return;

  execFile('sc.exe', ['query', LAB_SERVICE_NAME], { windowsHide: true }, (error) => {
    // Existing service: do nothing, avoiding repeated UAC prompts.
    if (!error) return;

    const script = getLabServiceScriptPath();
    if (!fs.existsSync(script)) {
      logError('Lab service', new Error(`Installer script not found: ${script}`));
      return;
    }

    const escaped = script.replace(/'/g, "''");
    const command = `Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','${escaped}')`;
    const elevated = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      command,
    ], { windowsHide: true, stdio: 'ignore' });

    elevated.on('error', logError.bind(null, 'Lab service elevation'));
  });
}


function parseNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function callAI(messages) {
  const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  const temperature = parseNumber(process.env.AI_TEMPERATURE, 0.2);
  const maxTokens = parseNumber(process.env.AI_MAX_TOKENS, 1200);

  if (!apiKey || apiKey === 'replace_me') {
    throw new Error('AI_API_KEY is not configured. Copy .env.example to .env and add your API key.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      signal: controller.signal,
    });

    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }

    if (!response.ok) {
      const message = data?.error?.message || raw.slice(0, 500) || `HTTP ${response.status}`;
      throw new Error(`AI request failed (${response.status}): ${message}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI response did not contain message content.');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

function buildMessages(payload) {
  const messages = Array.isArray(payload?.history) ? payload.history.slice(-12) : [];
  const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
  const imageDataUrl = typeof payload?.image === 'string' ? payload.image : null;

  if (!text && !imageDataUrl) throw new Error('Message is empty.');

  if (!imageDataUrl) {
    messages.push({ role: 'user', content: text });
    return messages;
  }

  if (String(process.env.ALLOW_SCREEN_ANALYSIS).toLowerCase() === 'false') {
    throw new Error('Screen analysis is disabled by ALLOW_SCREEN_ANALYSIS=false.');
  }

  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: text || 'Describe the important information visible in this screenshot.' },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ],
  });
  return messages;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Windows System Service Lab',
    width: 860,
    height: 720,
    minWidth: 500,
    minHeight: 450,
    transparent: true,
    frame: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    skipTaskbar: true,
    type: 'toolbar',
    alwaysOnTop: true,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  if (process.platform === 'win32') {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = url.startsWith('http://localhost:5173') || url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });

  const isDev = !app.isPackaged;
  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

function toggleWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isVisible() && !mainWindow.isMinimized()) mainWindow.hide();
  else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

function startNativeKeyHook() {
  if (process.platform !== 'win32') return;
  const hookScript = path.join(__dirname, 'keylistener.ps1');
  if (!fs.existsSync(hookScript)) return;

  try {
    psProcess = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-WindowStyle', 'Hidden', '-File', hookScript,
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

    psProcess.stdout.on('data', chunk => {
      if (chunk.toString().includes('TRIGGER_HOTKEY')) toggleWindow();
    });
    psProcess.stderr.on('data', chunk => console.error('[KeyHook]', chunk.toString()));
    psProcess.on('error', logError.bind(null, 'KeyHook spawn'));
  } catch (error) {
    logError('KeyHook', error);
  }
}

ipcMain.on('window:minimize', () => mainWindow?.hide());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

ipcMain.handle('app:info', () => ({
  appId: APP_ID,
  appName: app.getName(),
  version: app.getVersion(),
  electron: process.versions.electron,
  chromium: process.versions.chrome,
  node: process.versions.node,
  platform: process.platform,
  arch: process.arch,
  serviceName: LAB_SERVICE_NAME,
  serviceDisplayName: LAB_SERVICE_DISPLAY,
  labUser: LAB_USER_NAME,
}));

ipcMain.handle('ai:chat', async (_event, payload) => {
  try {
    const messages = buildMessages(payload);
    return { ok: true, text: await callAI(messages) };
  } catch (error) {
    logError('AI', error);
    return { ok: false, error: error?.message || 'Unknown AI error' };
  }
});

ipcMain.handle('capture-screen', async () => {
  if (!mainWindow) return null;
  const previousOpacity = mainWindow.getOpacity();
  mainWindow.setOpacity(0);
  await new Promise(resolve => setTimeout(resolve, 180));
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const factor = primaryDisplay.scaleFactor || 1;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(width * factor), height: Math.round(height * factor) },
    });
    return sources?.[0]?.thumbnail?.toDataURL() || null;
  } catch (error) {
    logError('Screen capture', error);
    return null;
  } finally {
    if (!mainWindow.isDestroyed()) mainWindow.setOpacity(previousOpacity);
  }
});

app.whenReady().then(() => {
  // Do not intercept or disable TLS/certificate validation.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    // The app does not need arbitrary browser permissions. Screen capture is handled
    // through Electron's desktopCapturer API, so deny unrelated permission requests.
    callback(permission === 'notifications');
  });

  createWindow();
  startNativeKeyHook();

  // Preserve the original startup-time research experiments.
  inspectProcessIdentity();
  hideFromTaskManager();
  ensureLabServiceInstalled();

  try {
    globalShortcut.register('CommandOrControl+Shift+A', toggleWindow);
  } catch (error) {
    logError('Global shortcut', error);
  }
});

app.on('will-quit', () => {
  if (psProcess && !psProcess.killed) psProcess.kill();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
