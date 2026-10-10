#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$serviceName = 'WinmgmtLab'
$root = Join-Path $env:ProgramData 'WindowsSystemServiceLab'

# Never touch the real Windows WMI service.
if ($serviceName -eq 'Winmgmt') { throw 'Safety check failed: refusing to remove the real Winmgmt service.' }

& sc.exe query $serviceName *> $null
if ($LASTEXITCODE -eq 0) {
    & sc.exe stop $serviceName | Out-Host
    Start-Sleep -Seconds 1
    & sc.exe delete $serviceName | Out-Host
    Write-Host "Removed $serviceName."
} else {
    Write-Host "$serviceName is not installed."
}

if (Test-Path $root) {
    Remove-Item $root -Recurse -Force -ErrorAction SilentlyContinue
}
