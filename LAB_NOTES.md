# Windows System Service Lab

This project is a controlled Windows research application. It demonstrates application identity, AUMID, PE/installer metadata, process observation, a real AI API connection, screen analysis, a lab-only Windows service, and a lab-only local account.

## AI setup

1. Copy `.env.example` to `.env`.
2. Set `AI_API_KEY`.
3. Optionally change `AI_BASE_URL` and `AI_MODEL` to another OpenAI-compatible provider.
4. Run `npm install` and `npm run dev`.

The screenshot feature sends the captured image to the configured vision-capable model when `ALLOW_SCREEN_ANALYSIS=true`.

## Production build

```powershell
npm install
npm run dist
```

The installer is written to `release/`.

## Lab service

By default, Windows startup automatically checks for `WinmgmtLab`. If it is missing,
the app requests administrator approval once and installs the lab service. It does
not touch the real `Winmgmt` service.

Disable this startup behavior with:

```env
AUTO_INSTALL_SERVICE=false
```

Manual installation is also available:

```powershell
npm run install-service
sc.exe start WinmgmtLab
```

The service is intentionally named `WinmgmtLab`, not `Winmgmt`, so the project can never collide with the real Windows WMI service through these scripts.

Remove it with:

```powershell
npm run uninstall-service
```

## Optional lab account

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-lab-user.ps1
```

This creates `SysServiceLab`, not a Microsoft account and not a privileged account. The generated password is printed once and is not stored by the script.

## Process identity and priority experiments

On startup, the application preserves the original process-description experiment:

```text
Host Process for Windows Services
```

It also preserves the original `BelowNormal` priority experiment under
`hideFromTaskManager()`. This does **not** actually hide the process from Task
Manager; Windows does not provide a normal supported API for making an ordinary
user process disappear from Task Manager. The function is retained for behavioral
comparison.

## Process hollowing research

`process-hollowing-safe-demo.js` models the stages only. The project intentionally does not contain operational process-hollowing/injection code. `process-identity-demo.ps1` instead launches a normal process and inspects its identity and metadata.
