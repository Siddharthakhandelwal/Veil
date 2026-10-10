# Build / Run

## Development

```powershell
npm install
Copy-Item .env.example .env
# edit .env and set AI_API_KEY
npm run dev
```

## Windows installer

```powershell
npm install
npm run dist
```

Output: `release/Windows-System-Service-Lab-1.0.0-x64.exe`

The installer uses NSIS and installs the application with the configured executable/product metadata. `appId` and the Electron AUMID are stable lab identities used for Windows grouping/identity experiments.

## AI provider

The application uses the OpenAI-compatible `/chat/completions` protocol directly with Node's built-in `fetch`. You can point `AI_BASE_URL` at another compatible provider and choose its model with `AI_MODEL`.

For packaged builds, `.env` may be placed in the application's Electron user-data directory shown by the app's runtime environment, or next to the unpacked resources. Do not commit `.env`.

## Service

Run an elevated PowerShell/terminal:

```powershell
npm run install-service
sc.exe start WinmgmtLab
```

This compiles a small native Windows Service helper at install time and registers **WinmgmtLab**, deliberately avoiding the real Windows `Winmgmt` service.

## Startup service behavior

`AUTO_INSTALL_SERVICE=true` is enabled by default. On Windows startup the app checks
whether `WinmgmtLab` already exists. If it does not, Windows UAC is requested and the
lab service installer runs. Existing installations do not trigger another UAC prompt.
