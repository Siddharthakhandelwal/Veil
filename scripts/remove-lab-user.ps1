#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$username = 'SysServiceLab'
$existing = Get-LocalUser -Name $username -ErrorAction SilentlyContinue
if ($existing) {
    Remove-LocalUser -Name $username
    Write-Host "Removed $username."
} else {
    Write-Host "$username does not exist."
}
