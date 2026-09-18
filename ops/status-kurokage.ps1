$Root = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $Root "app"
$LogDir = Join-Path $Root "logs"
$ExePath = Join-Path $AppDir "kurokage-bot.exe"

Write-Host "Root: $Root"
Write-Host "App:  $AppDir"
Write-Host "Logs: $LogDir"
Write-Host ""

$processes = Get-Process -Name "kurokage-bot" -ErrorAction SilentlyContinue |
  Select-Object ProcessName,Id,CPU,WorkingSet,Path

if ($processes) {
  $processes | Format-Table -AutoSize
} else {
  Write-Host "Kurokage nao esta rodando."
}

Write-Host ""
Write-Host "Ultimas linhas de log:"
$latestLog = Get-ChildItem -LiteralPath $LogDir -Filter "*.log" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($latestLog) {
  Get-Content -LiteralPath $latestLog.FullName -Tail 30
} else {
  Write-Host "Nenhum log encontrado ainda."
}
