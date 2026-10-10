# Safe process-identity lab: demonstrates that process identity and executable metadata
# are observable independently. It does NOT replace process memory or hollow a process.
$ErrorActionPreference = 'Stop'

$p = Start-Process notepad.exe -PassThru
Start-Sleep -Milliseconds 500
try {
  $p.Refresh()
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)"
  $file = Get-Item $process.ExecutablePath
  $version = $file.VersionInfo

  [pscustomobject]@{
    PID = $p.Id
    Name = $process.Name
    ParentPID = $process.ParentProcessId
    Path = $process.ExecutablePath
    ProductName = $version.ProductName
    CompanyName = $version.CompanyName
    FileDescription = $version.FileDescription
  } | Format-List
}
finally {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}
