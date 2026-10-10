# Phantom / Windows System Service Lab

> **A stealth, zero-taskbar desktop AI assistant with screen-aware vision, wrapped in a Windows system identity research lab.**

---

## ✨ Overview

This project is a hybrid desktop application combining two complementary capabilities:

1. **Stealth Desktop AI Assistant**
   - **Invisible Footprint**: Runs frameless with `skipTaskbar: true` and `alwaysOnTop: true`.
   - **Instant Summoning**: Toggle the floating HUD anytime via low-level hotkey (`CapsLock + A` or `Ctrl + Shift + A`).
   - **Clean Screen-Aware Vision**: Captures full-screen screenshots with temporary overlay opacity suppression so you capture your active workspace, not the assistant window.
   - **Universal LLM Support**: Connects to any OpenAI-compatible `/chat/completions` endpoint (OpenAI, Ollama, OpenRouter, LM Studio, etc.).

2. **Windows System & Process Identity Research Lab**
   - Controlled experiments exploring Windows AUMID (Application User Model ID), PE metadata, and process scheduling priority (`BelowNormal`).
   - Safe Windows Service installer (`WinmgmtLab`) isolated from production OS services.
   - Isolated local user account provisioning (`SysServiceLab`).

---

## ⌨️ Shortcuts & Controls

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| **`CapsLock + A`** | **Toggle Assistant HUD** | Low-level native keyboard hook (`keylistener.ps1`). Shows/hides instantly. |
| **`Ctrl + Shift + A`** | **Toggle Assistant (Fallback)** | Standard Electron global accelerator. |
| **`Enter`** | **Send Message** | Submits current chat prompt and any attached screenshot. |
| **`Shift + Enter`** | **New Line** | Inserts newline in composer textarea. |
| **`Screenshot` Button** | **Capture Desktop** | Grabs clean desktop frame and attaches to message. |

---

## 🛠️ Tech Stack

- **Runtime & Desktop**: Electron 34, Node.js
- **Frontend**: React 18, Vite 6, Custom Glassmorphic Vanilla CSS
- **System Layer**: Windows PowerShell, Win32 API (`GetAsyncKeyState`), Windows Service Control Manager (`sc.exe`)
- **AI Integration**: Native Node `fetch` with OpenAI-compatible vision completions

---

## 🚀 Quick Start

### 1. Prerequisites
- **Windows 10 / 11**
- **Node.js 18+** & **npm**
- An OpenAI-compatible API key (OpenAI, Groq, OpenRouter, or local Ollama)

### 2. Installation

Clone the repository and install dependencies:

```powershell
# Clone the repository
git clone <your-repo-url>
cd "Stealth AI"

# Install dependencies
npm install
```

### 3. Configure Environment Variables

Copy the example file to `.env`:

```powershell
Copy-Item .env.example .env
```

Open `.env` and set your credentials:

```ini
# OpenAI or any compatible endpoint
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=your_actual_api_key_here
AI_MODEL=gpt-4o-mini
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=1200

# Feature toggles
ALLOW_SCREEN_ANALYSIS=true
AUTO_INSTALL_SERVICE=false
```

> **Note**: `.env` is strictly excluded from Git tracking via `.gitignore`. Never commit API keys.

### 4. Run Development Server

```powershell
npm run dev
```

This launches the Vite dev server and starts the Electron client concurrently. Press `CapsLock + A` to toggle the overlay.

---

## 📦 Building Production Installer

To compile and package a standalone Windows installer (.exe):

```powershell
npm run dist
```

The output installer is generated in:
```text
release/Windows-System-Service-Lab-1.0.0-x64.exe
```

---

## 🧪 Windows Lab Services & Scripts

All experiments are sandboxed and use dedicated `*Lab` identifiers to avoid touching real Windows system components:

| Command / Script | Purpose |
| :--- | :--- |
| `npm run install-service` | Installs isolated Windows Service (`WinmgmtLab`) |
| `npm run uninstall-service` | Stops and deletes `WinmgmtLab` service |
| `.\scripts\create-lab-user.ps1` | Generates a low-privilege local user (`SysServiceLab`) |
| `.\scripts\remove-lab-user.ps1` | Deletes the `SysServiceLab` user |
| `.\scripts\process-identity-demo.ps1` | Inspects process PID, parent, and executable metadata |

---

## 📂 Project Structure

```text
├── electron/
│   ├── main.js             # Electron main process (lifecycle, IPC, AI caller, capture)
│   ├── preload.js          # Secure contextBridge API
│   └── keylistener.ps1     # Native low-level keyboard hook (CapsLock + A)
├── src/
│   ├── App.jsx             # React chat & screenshot interface
│   ├── index.css           # Glassmorphic overlay styling & animations
│   └── main.jsx            # React root mount
├── scripts/                # Lab service, identity, and process scripts
├── .env.example            # Environment configuration template
├── .gitignore              # Protects secrets (.env) & build artifacts (release/)
├── package.json            # Electron builder & project scripts
└── vite.config.js          # Vite build config
```

---

## 🛡️ Security & Privacy

- **API Keys**: Stored only in local `.env` or application user data directory; never baked into packages or source control.
- **IPC Isolation**: Renderer runs with `contextIsolation: true` and `nodeIntegration: false`.
- **Permissions**: Arbitrary web notifications and browser permissions are blocked by default.
- **Screen Capture**: Uses native Electron `desktopCapturer`; screenshots are only captured and sent when explicitly triggered by the user.

---

## 📄 License

MIT
