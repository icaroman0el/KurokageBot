& (Join-Path $PSScriptRoot "stop-kurokage.ps1")
Start-Sleep -Seconds 2
& (Join-Path $PSScriptRoot "start-kurokage.ps1")
