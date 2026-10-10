$ErrorActionPreference = 'Stop'

# Self-elevate when launched directly from a non-admin terminal.
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath)
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $argList -Wait
    exit $LASTEXITCODE
}

$serviceName = 'WinmgmtLab'
$displayName = 'Windows Management Instrumentation Lab'
$root = Join-Path $env:ProgramData 'WindowsSystemServiceLab'
$serviceExe = Join-Path $root 'WindowsSystemServiceLabService.exe'
$source = Join-Path $root 'WindowsSystemServiceLabService.cs'
$log = Join-Path $root 'service-install.log'

New-Item -ItemType Directory -Path $root -Force | Out-Null

# Never touch the real Windows WMI service named Winmgmt.
if ($serviceName -eq 'Winmgmt') { throw 'Safety check failed: refusing to use the real Winmgmt service name.' }

$cs = @'
using System;
using System.IO;
using System.ServiceProcess;
using System.Threading;

public sealed class WindowsSystemServiceLabService : ServiceBase
{
    private Timer timer;
    private readonly string logPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "WindowsSystemServiceLab", "service.log");

    public WindowsSystemServiceLabService()
    {
        ServiceName = "WinmgmtLab";
        CanStop = true;
        CanPauseAndContinue = false;
        AutoLog = true;
    }

    protected override void OnStart(string[] args)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(logPath));
        Write("SERVICE_STARTED");
        timer = new Timer(_ => Write("HEARTBEAT"), null, 0, 5000);
    }

    protected override void OnStop()
    {
        timer?.Dispose();
        timer = null;
        Write("SERVICE_STOPPED");
    }

    private void Write(string message)
    {
        File.AppendAllText(logPath, DateTimeOffset.Now.ToString("o") + " " + message + Environment.NewLine);
    }

    public static void Main()
    {
        ServiceBase.Run(new WindowsSystemServiceLabService());
    }
}
'@

Set-Content -Path $source -Value $cs -Encoding UTF8
Add-Type -TypeDefinition $cs -OutputAssembly $serviceExe -OutputType WindowsApplication -ReferencedAssemblies @('System.ServiceProcess.dll')

& sc.exe query $serviceName *> $null
$exists = ($LASTEXITCODE -eq 0)
if (-not $exists) {
    & sc.exe create $serviceName binPath= "`"$serviceExe`"" DisplayName= "$displayName" start= auto | Out-Host
} else {
    Write-Host "Service $serviceName already exists; leaving its registration intact."
}

& sc.exe description $serviceName "Research lab service used to study Windows service identity and lifecycle." | Out-Host
& sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/10000/none/0 | Out-Host

Write-Host "Installed $displayName ($serviceName)."
Write-Host "Service binary: $serviceExe"
Write-Host "Log: $root\service.log"
Write-Host "Start with: sc.exe start $serviceName"
Write-Host "Stop with:  sc.exe stop $serviceName"
