$signature = @"
using System;
using System.Runtime.InteropServices;
public class KeyboardHook {
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
}
"@
Add-Type -TypeDefinition $signature

$vkCaps = 0x14 # VK_CAPITAL (CapsLock)
$vkA = 0x41    # 'A'
$wasPressed = $false

Write-Output "LISTENER_READY"

while ($true) {
    Start-Sleep -Milliseconds 35
    $capsState = [KeyboardHook]::GetAsyncKeyState($vkCaps)
    $aState = [KeyboardHook]::GetAsyncKeyState($vkA)
    
    $isCapsDown = ($capsState -band 0x8000) -ne 0
    $isADown = ($aState -band 0x8000) -ne 0

    if ($isCapsDown -and $isADown) {
        if (-not $wasPressed) {
            Write-Output "TRIGGER_HOTKEY"
            $wasPressed = $true
        }
    } else {
        $wasPressed = $false
    }
}
