$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $Root "app"
$LogDir = Join-Path $Root "logs"
$ExePath = Join-Path $AppDir "kurokage-bot.exe"
$LogPath = Join-Path $LogDir ("kurokage-" + (Get-Date -Format "yyyy-MM-dd") + ".log")

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

$running = Get-Process -Name "kurokage-bot" -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -eq $ExePath }

if ($running) {
  Write-Host "Kurokage ja esta rodando. PID(s): $($running.Id -join ', ')"
  exit 0
}

if (-not (Test-Path -LiteralPath $ExePath)) {
  throw "Executavel nao encontrado: $ExePath"
}

Push-Location $AppDir
try {
  "[$(Get-Date -Format s)] Starting Kurokage from $ExePath" | Add-Content -LiteralPath $LogPath
  & $ExePath *>> $LogPath
} finally {
  Pop-Location
}
