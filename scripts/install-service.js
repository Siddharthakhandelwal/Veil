const { spawn } = require('child_process');
const path = require('path');

if (process.platform !== 'win32') {
  console.log('The Windows lab service is only supported on Windows.');
  process.exit(0);
}

const script = path.join(__dirname, 'install-lab-service.ps1');
const child = spawn('powershell.exe', [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
], { stdio: 'inherit', windowsHide: false });

child.on('error', error => {
  console.error('Could not start PowerShell:', error.message);
  process.exit(1);
});
child.on('exit', code => process.exit(code ?? 1));
