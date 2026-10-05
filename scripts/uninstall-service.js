const { exec } = require('child_process');

// Uninstall Windows service
if (process.platform === 'win32') {
    const script = `
    $serviceName = "Winmgmt"
    $serviceExists = Get-Service -Name "$serviceName" -ErrorAction SilentlyContinue
    if ($serviceExists) {
      Stop-Service -Name "$serviceName" -Force
      Remove-Service -Name "$serviceName"
      Write-Output "ServiceRemoved"
    } else {
      Write-Output "ServiceNotFound"
    }
  `;

    exec(`powershell.exe -Command "${script}"`, (error, stdout, stderr) => {
        if (error) {
            console.error('Error uninstalling service:', error);
            return;
        }
        console.log('Service uninstallation status:', stdout.trim());
    });
} else {
    console.log('Service uninstallation is only supported on Windows');
}