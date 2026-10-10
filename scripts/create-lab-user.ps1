#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$username = 'SysServiceLab'
$description = 'Windows System Service Lab local test account'

$existing = Get-LocalUser -Name $username -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "User $username already exists. No password change performed."
    exit 0
}

$chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
$passwordText = -join (1..24 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
$password = ConvertTo-SecureString $passwordText -AsPlainText -Force
New-LocalUser -Name $username -Password $password -Description $description -PasswordNeverExpires:$false | Out-Null
Add-LocalGroupMember -Group 'Users' -Member $username

Write-Host "Created $username."
Write-Host "Temporary password (store it securely; it will not be written to disk): $passwordText"
